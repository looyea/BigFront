# exp-prisma 面试题精选

> 共 15 题，覆盖 ORM 选型与建模 / 迁移工作流 / 查询与性能 / 事务与连接 四类 + 工程综合。

---

## 一、选型与建模

### 1. 为什么现代 Node 项目倾向 Prisma/Drizzle 而不是手写 SQL 或老 ORM？

三个红利：①**类型安全**——schema 生成客户端类型，字段改动编译期暴露（02-ts 生成器路线的 DB 版）；②**迁移有历史**——每次表结构变更是可 review 的 SQL 文件；③**关系表达**——connect/include 把外键操作变成声明。手写 SQL 三项全靠纪律，老 ORM（sequelize）模型定义在运行时、TS 支持是打的补丁（呼应 exp-prisma 第一节）。

**来源**：Prisma — "Why Prisma"；Node 后端选型通识

### 2. 那什么时候仍然该用裸 SQL / $queryRaw？

①复杂分析查询（多表 JOIN + 窗口函数 + 聚合）DSL 表达别扭时；②性能热点需要精确控制执行计划（覆盖索引、特定 JOIN 顺序）；③数据库专有特性（Postgres CTE/JSONB 操作符）。原则：**默认走类型安全层，逃生舱走参数化 raw**——`$queryRaw` 用 `Prisma.sql` 模板标签防注入，绝不字符串拼接（呼应 exp-security SQL 注入）。

**来源**：Prisma — "Raw database access / SQL tag"

### 3. 多对多关系在 Prisma 里怎么建模？什么时候要显式中间表？

隐式：两侧各给数组（`tags Tag[]` + `posts Post[]`），Prisma 自动建并托管中间表。当**关系本身要带属性**（订单-商品的单价/数量、好友关系的申请时间）必须显式：中间建成 model（OrderItem 带外键与属性），两侧变两个一对多。隐式转显式是高频 schema 重构，要会当面画（呼应 exp-prisma 第二节）。

**来源**：Prisma — "Many-to-many relations / explicit intermediate models"

---

## 二、迁移工作流

### 4. migrate dev / migrate deploy / db push 分别在什么场景用？CI/CD 里放哪个？

dev：开发机，diff schema 与库、生成迁移目录、应用、重新 generate——一条龙但**只属于开发**。deploy：CI/CD 与生产，按 `prisma/migrations/` 顺序重放审核过的 SQL，不生成任何东西。db push：原型/个人项目/边缘场景（如测试库快速重置），无历史不可审计。流水线标准姿势：构建阶段 `prisma generate`，发布前独立步骤 `migrate deploy`（先于新进程启动），Studio 永不上生产（呼应 exp-prisma 第三节、exp-deploy）。

**来源**：Prisma — "Migrate vs db push in deployment"

### 5. 两个开发者各写了迁移，Git 冲突了怎么处理？回滚迁移怎么做？

冲突：先 pull 合并 schema（model 改动可共存），再 `migrate dev --create-only` 基于合并后 schema 重新生成一支迁移、废弃冲突的旧文件——**迁移文件冲突不要手工拼接 SQL 硬修**。回滚：Prisma 迁移不提供自动 down SQL（官方立场是让新迁移改回去），需要回滚就写一支反向迁移；这也是"迁移是代码、review 严格于 SQL"哲学的代价（呼应 exp-prisma 第三节）。

**来源**：Prisma — "Migrations FAQ / rollforward 策略"

---

## 三、查询与性能

### 6. include 和 select 的区别？各自什么时候用？

都是查询修饰：`include` 拉出关系字段（返回里带关联对象），`select` 精确裁列（**也可嵌套**在 include 的子查询里裁）。要点：①include 展开整行+子查询，列表接口滥用=带宽与 N+1 双重浪费；②只用 `select` 构造最小列集是列表 API 默认姿势；③返回类型会随 select 变化，`PostGetPayload<>` 工具类型可以把它继续喂给前端（呼应 exp-prisma 第四节、02-ts 工具类型）。

**来源**：Prisma — "Including & Selecting relations"

### 7. Prisma 的 N+1 是出了名的，成因和解法？

成因：`include: { author: true }` 编译为"主查询 + 按结果条数逐条（或分批 IN）的关系查询"，**不是 JOIN**。20 条帖子 = 21 条 SQL。解法分级：①列表页 select 裁列、能不拉关系就不拉；②两步查询手工批取（收集 authorId → `findMany({ where: { id: { in: ids } } })` → Map 拼装）；③热点报表直接 `$queryRaw` 写 JOIN。比"ORM 有 N+1"更值钱的是**数 SQL**：`log: ['query']` 打开看每条语句（呼应 exp-prisma 第四节、exp-perf）。

**来源**：Prisma — "Solving the N+1 problem"；Prisma 官方性能指南

### 8. 游标分页（exp-pagination 推荐的）用 Prisma 怎么写？为什么不能 orderBy createdAt 单列？

```js
prisma.post.findMany({ where: { id: { gt: lastId } }, orderBy: { id: 'asc' }, take: 20 })
// 或 cursor: { id: lastId } + skip: 1 + take: 20
```
游标必须落在**唯一且有序**的列上；createdAt 会撞（同毫秒并发写入）导致漏行/重行，复合游标要 `(createdAt, id)` 双键。offset 的 skip 在大表上是真扫描，越翻越慢——这条与 exp-pagination 的理论课在此合体落地（呼应 exp-prisma 第四节、exp-pagination）。

**来源**：Prisma — "Cursor-based pagination"；exp-pagination 同题

---

## 四、事务与连接

### 9. $transaction 的数组形态和交互式形态怎么选？转账场景为什么必须后者？

数组：一批**相互无读依赖**的写，顺序执行、整体回滚，开销最小。交互式 `async (tx) =>`：后续语句**依赖前面读出的值**（先查余额→判断→扣减加给对面），逻辑只有拿到 acc 之后才知道写什么——数组形态做不到"先读后判"。铁律：回调里全部用 `tx` 客户端；默认 5s 超时对重逻辑不够，显式 `timeout`；并发扣加还会上乐观锁 version 字段（呼应 exp-prisma 第五节）。

**来源**：Prisma — "Interactive transactions"

### 10. PrismaClient 实例怎么管理？connection_limit 怎么算账？

**一个进程一个实例**（模块级单例导出，别每请求 new——每个实例都自带一池）。账：总连接 = 进程数 × connection_limit（默认 CPU 核数×2），必须 ≤ 数据库 max_connections × 0.8（留运维与 replica 余量）。cluster 4 worker = 4 倍开销（呼应 node-cluster）；Serverless 短生命周期会疯狂建连 → Prisma Accelerate / PgBouncer 中间层。退出时 `prisma.$disconnect()` 进 graceful shutdown 清单（呼应 exp-prisma 第六节、exp-deploy）。

**来源**：Prisma — "Connection pooling / serverless best practices"

---

## 五、工程综合

### 11. 有了 Prisma 还需要 zod 吗？各自的边界在哪？

需要，两道闸不重复：**Prisma 管"结构合法性"**（类型、非空、外键存在——到库这一层的编译期护栏），**zod 管"业务与输入合法性"**（HTTP 边界上的 body 校验、格式规则、trim/enum 白名单、错误聚合返回 422）。永远不要把 `prisma.user.create({ data: req.body })` 裸奔——req.body 是不可信输入（呼应 exp-validation、vue-forms-validation 的 schema-first 同构思想）。

**来源**：Node API 校验通识；exp-validation 同题

### 12. 单测怎么测带 Prisma 的 Service？（exp-testing 的 mongoose mock 同位问题）

三层策略：①单元——mock PrismaClient 方法（`vi.mock('@prisma/client')` 或注入 fake client），只测业务分支不碰库；②集成——真 Postgres（testcontainers/docker）+ `migrate deploy` + 每测试事务回滚夹具，数据真实性最高；③契约——supertest 打端点走②的库。反模式：拿生产连接串跑测试、用 SQLite 内存库"模拟" Postgres（方言差异会让它假绿）（呼应 exp-testing、exp-prisma 第六节）。

**来源**：Prisma — "Testing"; node-testing / exp-testing 同题

---

## 补充（新专题 13-15）

### 13.  Schema 变更要上生产：讲讲 online 迁移的 expand-contract 流程与 Prisma migrate 在大型团队里的现实问题。

流程骨架：所有破坏性变更拆成"先扩后收"两次以上发布——加非空列（先 nullable+默认值→回填→再收紧，或分两迁）、改类型（新列双写→切读→删旧列）、重命名（Prisma 会把 rename 看成 drop+add，必须手工改 migration.sql 保数据，这是官方文档都重点警告的大坑）。每步独立可回滚、迁移与代码发布解耦（代码兼容前后两个 schema 版本，用特性开关决定读哪列）。Prisma migrate 的大型团队现实问题：① shadow database——migrate dev 需要临时库做漂移校验，生产权限收紧的企业里往往只有 DBA 能建库（团队转 migrate deploy+人工生成 SQL 或引 gh-ost/pt-osc 类在线工具接管大表变更）；② 迁移文件冲突的合并纪律（dev 分支串行化迁移号、rebase 后重新生成）；③ 大表 DDL 锁——Postgres 的 ALTER 多数瞬间完成但 CREATE INDEX 要非并发版、MySQL 的 ALGORITHM=INPLACE 要看版本，Prisma 默认生成的 SQL 不懂这些，DBA 审 SQL 的关口不能省。组织侧：migration.sql 进代码评审当 API 变更对待（一次 PR 只一个变更意图）、回填走独立批处理任务（迁移里 5000 万行 UPDATE 就是锁表事故）。收口句：迁移工具的边界是"生成与执行 SQL"，而"何时能执行、执行失败怎么退"永远是发布系统设计的事。

**来源**：Prisma 官方数据库迁移指南；GitHub Blog《Scaling MySQL online schema changes》；InfoQ《一次 expand-contract 不彻底的数据故障复盘》

### 14.  Prisma Client 的实例管理、连接数与冷启动，在多实例部署下有哪些必须知道的行为？

实例模型：PrismaClient 内含连接池+引擎子进程/二进制，进程级单例（模块加载创建、全应用共享）——每请求 new 会把引擎与握手成本×QPS（教科书级事故）；热重载环境（dev nodemon/ts-node-dev）要 globalThis 挂载防句柄耗尽。连接数账：池默认上限是 CPU核数×2+1，真账是"副本数 × 每实例池上限" 必须小于 数据库 max_connections 减去预留（管理员/复制/监控）——盲目调大池压垮数据库（PM2 4 实例 × 池 20 = 80 条，Postgres 默认 100 直接红）。Serverless/冷启动：引擎二进制启动+握手在毫秒到秒级，Lambda 场景用连接代理（PgBouncer transaction 模式——但 Prisma 的 prepared statement 与事务型会话有兼容坑，要设 pgbouncer 参数或上 RDS Proxy）、或按需选 driver adapters（去掉引擎子进程）。部署细节：generate 在构建阶段完成（prisma generate 进 CI、node_modules 产物进镜像，运行时不 generate）、binaryTargets 对齐基础镜像（alpine 的 musl 与 debian 的 openssl 版本不匹配是容器内 engine 起不来的头号原因）、prisma CLI 与引擎版本一致性锁死。P2024（池超时）排查路径：并发量×慢查询=池饥饿，先看慢 SQL 与事务泄漏（交互式事务里 await 了外部 HTTP），而不是先调池参数。

**来源**：Prisma 官方连接与 Best Practices；Prisma 讨论区（P2024 池超时）；掘金《我们把 Prisma 放进 Lambda 之后》

### 15.  事务边界应该划在哪一层？结合 Prisma 谈谈单元-of-work 的划分与"跨服务一致性"的诚实方案。

层内规则：事务边界=一个业务意图的原子单位，落在 service 层（controller 不感知 tx、repository 接收 tx 参数而不是自开连接）——传参式（tx 作为上下文穿透调用链，Prisma 交互式事务的 client 即 tx）优于隐式传播（ALS 存 tx 在 Node 并发下的串台风险）。边界内的纪律：外部 HTTP/消息发送/日志刷盘不进事务（连接被网络占用=池饥饿之源），用"提交后副作用"模式（先拿变更结果、提交成功后再发事件，outbox 表保证不漏）；只读查询别包事务（除非隔离需求），读从库的流量与主库写事务分开。跨聚合：同一数据库内多表，一个事务收口；跨服务/跨存储，先反问"真的需要强一致吗"——90% 场景的最终一致+对账足够： saga（正向链+补偿链，每步幂等可重放）、outbox+队列（本地事务发件箱替代分布式事务）、唯一约束/版本号做消费端幂等。强一致需求（资金账务）才上"同一库多聚合"的建模重构或 TCC/共享账本服务。常见反模式三件套：事务里调第三方（超时长事务）、为"方便"整方法包大事务（锁放大）、补偿逻辑不幂等（重试二次伤害）。收口句：PR 审查里"这个事务的边界是业务意图还是代码顺序的巧合"是区分 ORM 熟手与老手的最快一问。

**来源**：Prisma 事务文档；Martin Fowler《Transaction Scope》；InfoQ《分布式事务在业务系统的真实存活率》
