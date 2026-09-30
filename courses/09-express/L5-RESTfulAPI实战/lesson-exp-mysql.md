# 接远程独立 MySQL：驱动、连接池、方言与运维红线

> 目标：把"公司里已经有一台 MySQL"这个最常见的现实走通——**mysql2 裸 SQL 的正确姿势（预编译 / 事务 / 连接归还）**、Prisma 的 `provider = "mysql"` 分支怎么改、远程实例的连接账（白名单 / SSL / 认证插件 / 时区 / 字符集与索引前缀）、与 Postgres 的方言差异、连接池打满与空闲断连的排障。**判据**：`09-express` 的 `exp-prisma` 讲"怎么用 ORM 连库"，本关讲"连的是 MySQL、而且它在另一台机器上"时多出来的那些事。
>
> 呼应关：`exp-prisma`（Prisma 建模与迁移主课）、`exp-rest` / `exp-validation`（把表变成窄接口）、`exp-pagination`（游标分页在 MySQL 里的写法）、`exp-perf`（进程数 × 池上限的连接账）、`exp-security`、`es-local-db`（四层数据地图与"前端不能直连库"的原因）、`03-nodejs` `node-env-config`（连接串放 env）。

---

## 一、先选型：四条路，各自的代价

| 路线 | 什么时候选 | 得到什么 | 付出什么 |
|---|---|---|---|
| `mysql2/promise` + 裸 SQL | 报表/批量/复杂 SQL、DBA 要求能看懂 SQL、表结构不受你控制 | 最可控、无抽象泄漏、依赖最轻 | 手写映射与转义规则，防注入靠纪律 |
| **Prisma**（`provider = "mysql"`） | 新项目、业务模型清晰、想要端到端类型 | CRUD/事务/迁移全类型安全，IDE 补全 | 生成 Client、复杂 SQL 要 `$queryRaw`、冷启动与连接池另有一套参数 |
| TypeORM / Sequelize | 老项目已有、团队熟 | 装饰器/实体风格 | 迁移与事务语义坑多，文档与实现常有出入 |
| Knex（查询构造器） | 想要"能写出人话 SQL"又要链式方便 | 迁移工具好用、无实体绑定 | 返回的是行对象数组，要自己收敛类型 |

**判据一句话**：表结构你说了算 → ORM；表结构别人说了算（遗留库、数仓、DBA 审批制）→ `mysql2` + `prisma db pull` 或 Knex。

---

## 二、mysql2：连接池、预编译、事务（三段必须一起写对）

```bash
# 目的：装驱动；注意别装成十年前的 mysql 包（不支持 caching_sha2_password）
npm i mysql2
# ❌ 用老 mysql 包连 MySQL 8 → "Client does not support authentication protocol"（认证插件不认）
```

```js
// 目的：建一个进程级单例池（不是每次请求建一个池！），并跑一次查询
// 连接串放 env，代码里绝不出现密码（见 node-env-config、exp-security）
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,     // ✅ mysql://app_rw:****@db.internal:3306/shop?charset=utf8mb4
  connectionLimit: 10,               // ✅ 每进程最多 10 条连接；总账 = 进程数 × 10（见 §五）
  queueLimit: 0,                     // ✅ 0 = 等待队列不限长；设成正数则满了直接报错而不是排队
  waitForConnections: true,          // ✅ 池空时排队等待；false 则立刻抛错（快速失败策略）
  connectTimeout: 10_000,            // ✅ TCP 建连超时；网络不通要 1 分钟才报错就是没设它
  enableKeepAlive: true,             // ✅ 周期性 TCP keepalive，降低被中间层（LB/防火墙）静默断开的概率
  timezone: '+08:00',                // ✅ 与库侧时区对齐；默认 'local' 会按 Node 进程时区解释 DATETIME
  dateStrings: false,                // ✅ false → DATETIME 读回 Date 对象；true → 原样字符串（跨时区更安全）
  multipleStatements: false,         // ❌ 设 true = 一次能发多条语句 → SQL 注入的放大开关，默认必须保持 false
});

const [rows, fields] = await pool.query('SELECT id, title FROM note WHERE author = ?', ['lisa']);
// ✅ rows = [{ id: 1, title: 'hi' }, ...]；解构出的第 2 项是列元信息，日常用不到
// ✅ 带 ? 占位符时 mysql2 做值转义（字符串加引号、数字裸写、Date 格式化、null → NULL）
// ❌ `WHERE author = '${name}'` 字符串拼接 → name = "' OR 1=1 -- " 时整表泄露（经典注入）
// ❌ 把用户输入拼进 ORDER BY / 表名 / 列名 → 占位符会被加引号，语法位置不能用 ?，必须白名单校验
```

`query` 与 `execute` 的区别是高频追问点：

```js
// 目的：同一条 SQL 反复执行时走预编译语句，参数与语法彻底分离
const [res] = await pool.execute('INSERT INTO note (title, author) VALUES (?, ?)', ['hi', 'lisa']);
// ✅ res = { insertId: 7, affectedRows: 1, ... }；MySQL 没有 RETURNING，新主键只能读 insertId
// ✅ execute = PREPARE/EXECUTE 协议，参数永远当值，不可能被解析成 SQL；重复执行还能复用执行计划
// ⚠️ mysql2 的预处理语句有内部缓存（上限约 10k 条），别在循环里拼出成千上万条"不同形状"的 SQL
// ❌ 以为 execute 的 ? 能替代表名/列名：`FROM ?` 直接语法报错——那些位置只能自己白名单
```

```sql
-- 目的：MySQL 8 里字符串比较默认不区分大小写与重音（utf8mb4_0900_ai_ci）
SELECT * FROM `user` WHERE name = 'LiSA';        -- ✅ 也能命中 'lisa'（大小写不敏感）
-- ❌ 需要精确区分时别指望改代码：要么列换 _bin/_cs 排序规则，要么比较处加 BINARY
SELECT * FROM `user` WHERE BINARY name = 'LiSA'; -- ✅ 区分大小写；代价：该列索引失效（函数包裹）
```

### 2.1 事务：三件套一步都不能少

```js
// 目的：扣库存 + 写订单，要么都成要么都败
async function placeOrder(userId, itemId) {
  const conn = await pool.getConnection();   // ✅ 事务必须独占一条连接（池借的）
  try {
    await conn.beginTransaction();            // ✅ 不能用 query('START TRANSACTION') 之外的花样；保持一致
    const [upd] = await conn.execute(
      'UPDATE stock SET qty = qty - 1 WHERE id = ? AND qty > 0', [itemId]);   // ✅ 提交增量条件，防超卖
    if (upd.affectedRows === 0) throw new Error('库存不足');                  // ✅ 用 affectedRows 判定，不靠先 SELECT
    await conn.execute('INSERT INTO `order` (user_id, item_id) VALUES (?, ?)', [userId, itemId]);
    await conn.commit();                       // ✅ 提交才落盘；只 await 单条 execute 不等于事务完成
  } catch (e) {
    await conn.rollback();                    // ✅ 任一步失败回滚；rollback 自己也可能抛，外层要有兜底
    throw e;
  } finally {
    conn.release();                           // ❌ 忘 release = 连接泄漏，池会被抽干（表现为请求永久挂起）
  }
}
// ❌ 在事务里用 pool.execute 而不是 conn.execute → 走的是池里"另一条"连接，根本不在同一事务内
```

> Prisma 侧同一件事写作 `$transaction(async (tx) => { await tx.stock.update(...) })`，且**必须用 `tx` 客户端**（用 `prisma.xxx` 会跳出事务，形成"假事务"）。见 `exp-prisma` §五。

---

## 三、Prisma 的 MySQL 分支：改 3 处，别改 1 处

```prisma
// prisma/schema.prisma —— 与 Postgres 版本的差异集中在 datasource / provider / @db 三处
datasource db {
  provider = "mysql"              // ✅ 由 "postgresql" 改为 "mysql"；换 provider 后必须重新生成 Client
  url      = env("DATABASE_URL")  // ✅ mysql://app_rw:pass@db.internal:3306/shop?connection_limit=8
}

generator client {
  provider = "prisma-client-js"
}

model Note {
  id        String   @id @default(cuid())
  title     String   @db.VarChar(191)   // ✅ VarChar(191)：191×4=764B < 767B，utf8mb4 建索引不越界（见 §四）
  body      String?  @db.Text           // ✅ 长文本用 Text，不用 VARCHAR(65535)（行溢出 + 索引不可能）
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now()) @db.DateTime(0)  // ✅ MySQL DATETIME 精度默认 0；要毫秒写 @db.DateTime(3)
  @@index([authorId, createdAt])
}
```

三条真实差异，踩过才知道：

1. **换 provider 要清迁移历史**：`migrate dev` 的 journal 与已落库的 SQL 双方言不通用。对着已经用 Postgres 迁移过的库改 `provider="mysql"` 会报"迁移不与数据库同步"。正解是**新库新历史**，或 `prisma migrate resolve --applied <name>` 逐条标记（详见 Prisma 文档）；实在不行 `db push` 只在开发库用。
2. **有既有表时不要自己写 schema**：`prisma db pull` 反向生成 model（introspection），再逐步改建模。注意 MySQL 的"表名/列名大小写"会被原样带进 schema。
3. **连接池参数写在 URL 上**：`?connection_limit=8&pool_timeout=10`。Prisma 每进程一个池，`connection_limit` 默认是 `CPU 核数 × 2 + 1`，多副本部署时**必须手动算**（见 §五）。

---

## 四、远程实例的连接账：连不上通常不是代码问题

```bash
# 目的：本地学习用，起一个 8.0；数据放卷里，删容器不删数据
docker run -d --name mysql-lab -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=dev_only_root -e MYSQL_DATABASE=shop \
  mysql:8.0 --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
# ✅ 端口映射 3306:3306 后，Node 侧连 127.0.0.1:3306
# ❌ 生产把 3306 映射到公网 = 扫描器 10 分钟内到位；正解是只允许应用服务器 IP 访问（安全组/白名单）
```

排障按这张表从上往下对号入座：

| 现象 | 十有八九是 | 验证动作 |
|---|---|---|
| `ECONNREFUSED` | 地址/端口错、服务没起、只 bind 了 127.0.0.1 | `nc -vz db.internal 3306`；服务端看 `bind-address` |
| `ETIMEDOUT` / 卡住很久 | 安全组/白名单没放行、跨 VPC 路由不通 | 云上改白名单；把 `connectTimeout` 设小快速失败 |
| `ER_ACCESS_DENIED_ERROR` | 账号 + 来源主机不匹配（MySQL 的账号是 `user@host` 二元组） | `SELECT user, host FROM mysql.user;` |
| `Authentication plugin 'caching_sha2_password' cannot be loaded` | 驱动太旧 | 升 mysql2 / Prisma；或该账号改 `mysql_native_password`（不推荐长期） |
| SSL 相关报错 / 明文被拒 | 云实例强制 TLS，或反之 | 配 `ssl: { ca: [readFileSync('rds-ca.pem')], rejectUnauthorized: true }` |
| 时区差 8 小时 | 进程时区、连接 `timezone`、库 `time_zone` 三处不一致 | `SELECT @@global.time_zone, @@session.time_zone, NOW();` |
| `Specified key was too long` | utf8mb4 索引前缀超 767/3072 | 列长降到 `VarChar(191)`，或前缀索引 `KEY (col(64))` |

```js
// 目的：远程实例强制 TLS 的正确配法（别把证书校验关掉"图省事"）
const pool = mysql.createPool({
  host: 'rm-xxxx.mysql.rds.aliyuncs.com', port: 3306,
  user: 'app_rw', password: process.env.DB_PASSWORD, database: 'shop',
  ssl: { ca: fs.readFileSync('certs/rds-ca.pem'), rejectUnauthorized: true },  // ✅ 校验服务端证书
});
// ❌ rejectUnauthorized: false → 中间人可随意改你的 SQL 与结果；只为临时排障，绝不进生产配置
```

**权限最小化**：给应用的账号只开这个库的 `SELECT, INSERT, UPDATE, DELETE`（`GRANT` 时按 `shop.*` 限定）；建表/删库给迁移专用账号，CI 里单独一把钥匙。DBA 流程下常见"应用账号无 DDL"，此时 Prisma `migrate deploy` 会失败，只能走"生成 SQL 交审批"的路线（`prisma migrate diff` / `migrate deploy --create-only`）。

---

## 五、连接池打满与空闲断连（线上最常见的两个 MySQL 事故）

```
账很简单：  总连接数 = 副本数 × 每进程 connection_limit ≤ max_connections − 运维预留
例： 4 个 Node 副本 × Prisma connection_limit=20 = 80；MySQL 8 默认 max_connections=151
    → 再叠一个本地跑的脚本 + 迁移任务 + DBA 会话，高峰期就撞 Too many connections
```

- **`Too many connections`**：新建连接直接被拒。解法按优先级：① 降 `connection_limit`（连接不是越多越快，MySQL 每连接一线程，过多是负优化）；② 前置连接代理（ProxySQL / RDS Proxy / PgBouncer 同类角色）做**多路复用**；③ 排查泄漏：借了 `getConnection()` 没 `release()`、事务没走到 `finally`。
- **空闲被服务端断开**：MySQL 的 `wait_timeout`（默认 28800s，云厂商常改成 600s 甚至更短）到期，服务端单方面 close，而池里那条连接还"看着是好的"。下一次从池里拿到它就报 `PROTOCOL_CONNECTION_LOST` / `Packet sequence number wrong`。对策：`enableKeepAlive`（mysql2）、Prisma 侧靠较短的 `pool_timeout` + 自动重试、以及前置代理回收；**幂等写操作**要配重试（`Deadlock found (1213)`、`Lock wait timeout (1205)` 同理，重试 2-3 次带退避）。

```sql
-- 目的：连接与慢查询的自我诊断（DBA 会问你这几条）
SHOW VARIABLES LIKE 'max_connections';                 -- ✅ 服务端总上限
SHOW STATUS  LIKE 'Threads_connected';                 -- ✅ 当前已建立连接数
SHOW STATUS  LIKE 'Slow_queries';                      -- ✅ 慢查询累计计数
EXPLAIN SELECT * FROM note WHERE author = 'lisa';      -- ✅ type=ALL 且 key=NULL → 全表扫，加索引
-- ❌ 生产用 SELECT *：列一变代码就崩，且宽表全扫 IO 巨大；列表接口用 exp-prisma 的 select 裁列口径
```

---

## 六、方言差异速查（从 Postgres 过来最常撞的 8 条）

| 事项 | PostgreSQL | MySQL | 影响 |
|---|---|---|---|
| 新插入行的返回值 | `INSERT ... RETURNING *` | 无 RETURNING → `insertId` / `affectedRows` | 想要整行必须再 SELECT 一次 |
| 标识符引号 | `"double"` | `` `backtick` ``（`ANSI_QUOTES` 可改） | 复制 SQL 会报语法错 |
| 自增 | `SERIAL / IDENTITY` | `AUTO_INCREMENT` | Prisma 侧写 `@default(autoincrement())` |
| 布尔 | 原生 `boolean` | `tinyint(1)`（`TINYINT(1)` 是约定不是类型系统） | 报表工具会当数字 |
| upsert | `ON CONFLICT DO UPDATE` | `ON DUPLICATE KEY UPDATE` | Prisma `upsert` 已屏蔽差异；裸 SQL 不通用 |
| 大小写/重音 | 依赖 `citext` 或表达式索引 | 由**排序规则**决定，默认 `utf8mb4_0900_ai_ci` 不区分 | 唯一索引会误判 `Lisa`/`lisa` 重复 |
| `GROUP BY` | 宽松（未在聚合列可用） | 默认开 `ONLY_FULL_GROUP_BY`，不合法写法直接报错 | 迁移过来的旧 SQL 会挂 |
| `LIMIT` 写法 | `LIMIT n OFFSET o` | `LIMIT o, n` 与 `LIMIT n OFFSET o` 都收，**顺序别记反** | 分页错位极隐蔽 |
| 数组 / JSONB | 原生 `array`、`jsonb` + GIN 索引 | 只有 JSON 类型与函数（8.0 较完整） | 依赖数组字段的设计要改造 |

> 5.7 与 8.0 也不能混为一谈：`utf8mb4_0900_*` 系列排序规则是 8.0 才有（5.7 用 `utf8mb4_unicode_ci`）；8.0 默认认证插件改成 `caching_sha2_password`；窗口函数 8.0 才支持。写迁移脚本前先 `SELECT VERSION();`。

---

## 七、API 层怎么把这层挡住（回到本项目的口径）

```js
// 目的：无论底层是 mysql2 还是 Prisma，对前端只暴露"窄接口 + 游标分页 + 统一错误"
app.get('/api/notes', async (req, res, next) => {
  try {
    const take = Math.min(Number(req.query.take) || 20, 50);        // ✅ 上限硬编码，防 ?take=999999 拖垮库
    const cursor = req.query.cursor ? String(req.query.cursor) : null;
    const rows = cursor
      ? await db.note.findMany({ where: { id: { lt: cursor } }, orderBy: { id: 'desc' }, take,
                                 select: { id: true, title: true, authorId: true } })   // ✅ 裁列，不 SELECT *
      : await db.note.findMany({ orderBy: { id: 'desc' }, take,
                                 select: { id: true, title: true, authorId: true } });
    res.json({ items: rows, nextCursor: rows.length === take ? rows.at(-1).id : null });  // ✅ 游标分页（见 exp-pagination）
  } catch (e) { next(e); }   // ✅ 错误交给统一中间件；❌ 别把 e.message 直接回前端（会泄露 SQL 片段与表名）
});
```

三条口径，和 `es-local-db`、`exp-security` 一致：① 连接串只在服务端 env，永不进前端 bundle；② 前端永远只看到窄接口，看不到表结构；③ 浏览器里那些"看着像数据库"的东西（localStorage / IndexedDB）只是缓存，**事实源在这台 MySQL 上**。

---

## 自检清单

- [ ] 说清 `pool.query` 与 `pool.execute` 的区别，以及为什么占位符不能用于表名/列名。
- [ ] 手写一个 MySQL 事务，讲清 `conn` vs `pool`、`affectedRows` 判超卖、`finally release` 各自防什么事故。
- [ ] Prisma 从 Postgres 切到 MySQL 要改哪三处，迁移历史为什么要重开。
- [ ] `Specified key was too long` 的成因（utf8mb4 × 767/3072）与两种解法。
- [ ] `ECONNREFUSED` / `ETIMEDOUT` / `ER_ACCESS_DENIED_ERROR` / 认证插件报错，各对应哪一层问题。
- [ ] 连接账公式，以及“连接调更大为什么可能更慢”。
- [ ] `wait_timeout` 导致的 `PROTOCOL_CONNECTION_LOST` 有哪些缓解手段（keepalive / 代理 / 重试幂等）。
- [ ] 说出 5 条 MySQL 与 Postgres 的方言差异，并解释 `ONLY_FULL_GROUP_BY` 为什么会让老 SQL 挂掉。
- [ ] 说明"应用账号无 DDL"时 Prisma 迁移该怎么走。

---

## 🚪 下一站

- `exp-prisma`（建模、迁移哲学、`select` 裁列与 N+1、`$transaction` 两形态）；
- `exp-pagination`（游标 vs offset，深分页在 MySQL 上的实测坑）、`exp-perf`（进程数与连接池的账）；
- `exp-testing`（`mongodb-memory-server` 与"不连真库怎么测"，本关的 MySQL 对应物是 Docker + 测试库 + 迁移）；
- `es-local-db` §七（四大框架侧的接线图：谁负责缓存、谁是事实源）。
