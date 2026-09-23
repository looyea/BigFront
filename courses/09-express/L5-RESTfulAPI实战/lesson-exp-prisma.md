# Prisma：关系型数据库与类型安全查询

> 目标：补上 09-express 的持久化主线——用 Prisma 接管 PostgreSQL/MySQL：schema 建模、迁移工作流、类型安全 CRUD、关系查询与事务。本包前几关的内存 Map 存储与 exp-testing 里被 mock 的 DB，这一关全部换成真家伙（呼应 02-ts 的生成器红利、exp-pagination 的游标分页、exp-perf 的连接池、exp-security 的 SQL 注入）。

---

## 一、为什么是 Prisma

后端三选一的老账：

| 路线 | 代表 | 痛点 |
|---|---|---|
| 裸 SQL | pg / mysql2 | 字符串拼 SQL：注入面 + 无类型 + 重构失明 |
| ODM/Mongo | mongoose | 本包已见；关系型场景不适用 |
| 传统 ORM | sequelize / typeorm | 运行时定义模型，类型靠手写 |
| **schema 优先** | **Prisma / Drizzle** | 单一事实源 + 生成器出类型 |

Prisma 的杀手锏：`schema.prisma` 声明一次，`prisma generate` 生成的 **PrismaClient 让每个查询带完整 TS 类型**——表改名列删错，编译期就炸而不是上线后 500（生成器思想呼应 02-ts）。代价：查询语言是 Prisma 自己的 DSL，深度自定义 SQL 要走 `$queryRaw` 逃生舱。

## 二、schema.prisma：建模即文档

```prisma
// prisma/schema.prisma
generator client { provider = "prisma-client-js" }
datasource db    { provider = "postgresql"; url = env("DATABASE_URL") }

model User {
  id    String @id @default(cuid())
  email String @unique
  name  String?            // 可选列：类型直接是 string | null
  posts Post[]             // 一对多的"多"端
}

model Post {
  id       String  @id @default(cuid())
  title    String
  published Boolean @default(false)
  author   User    @relation(fields: [authorId], references: [id])  // 必填关系
  authorId String
  tags     Tag[]              // 多对多：Prisma 自动建中间表
}

model Tag {
  id    Int    @id @default(autoincrement())
  name  String @unique
  posts Post[]
}
```

读关系三句口诀：**数组端=多、单对象端=一；`@relation(fields:)` 里放外键、谁持有外键一目了然**；多对多两侧都给数组，中间表 Prisma 托管（显式中间 model 可做"关系带属性"，如 OrderItem 带数量单价）。

## 三、迁移：migrate dev 与 db push 的分工

```bash
npx prisma migrate dev --name add_post_tags   # 开发：生成 SQL 迁移文件 + 应用 + 重新 generate
npx prisma migrate deploy                     # 生产/CI：只按迁移目录顺序重放，不生成
npx prisma db push                            # 原型/个人项目：schema 直推数据库，无迁移历史
npx prisma studio                             # 浏览器里看数据的官方 GUI
```

迁移哲学：**迁移文件是代码，必须进 git**。`migrate dev` 生成的 `prisma/migrations/xxx/migration.sql` 让人工 review 得到"这次改动到底对表做了什么"；生产上永远 `deploy`，绝不 `db push`（无历史=无法回滚无法审计）。团队协作撞迁移：先 pull 再 `migrate dev --create-only` 手改（呼应 node-config 的环境变量纪律——`DATABASE_URL` 走 env，密码永不进仓库）。

## 四、CRUD：类型安全与关系读写

```js
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()          // 整个应用一个实例（连接池内建于它）

// 创建：关系可以"嵌套写"
const post = await prisma.post.create({
  data: { title: 'Hello', author: { connect: { id: userId } },   // 或 create: {...} 连作者一起建
          tags: { create: [{ name: 'node' }] } },
})

// 查询：include 拉关系（子查询）、select 裁列（永远优先）
const list = await prisma.post.findMany({
  where: { published: true, author: { email: { endsWith: '@dev.io' } } },
  include: { author: { select: { name: true } }, tags: true },     // 嵌套过滤/选列都可以
  orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  take: 20, skip: 0,                                               // offset 分页两行搞定
})
```

游标分页（exp-pagination 推荐的大表方案）在 Prisma 里是 `cursor: { id: lastId } + take: 20`，配合按 id 排序天然稳定。**N+1 警报**：`include: { author: true }` 对 20 条帖子实际发 21 条 SQL——Prisma 的 include 不是 JOIN，列表接口务必用 `select` 只取所需列，宽表关系考虑 `$queryRaw` 手写 JOIN 或分两步 `findMany({ where: { id: { in: ids } } })` 拼装。

## 五、事务：$transaction 两形态

```js
// 形态一：数组批量——顺序执行、任一失败全部回滚（无相互依赖的写操作）
await prisma.$transaction([
  prisma.post.delete({ where: { id } }),
  prisma.user.update({ where: { id: userId }, data: { postCount: { decrement: 1 } } }),
])

// 形态二：交互式——先读后写有依赖（转账模板），失败自动回滚、可配超时
await prisma.$transaction(async (tx) => {
  const acc = await tx.account.findUniqueOrThrow({ where: { id: fromId } })
  if (acc.balance < amount) throw new Error('余额不足')     // throw = 回滚整段
  await tx.account.update({ where: { id: fromId }, data: { balance: { decrement: amount } } })
  await tx.account.update({ where: { id: toId },   data: { balance: { increment: amount } } })
})
```

要点：交互式回调里**必须用 tx 客户端**（用外层 prisma 等于事务外裸奔，最常见的假事务 bug）；默认超时 5s，大批量要调 `timeout/maxWait`；高并发扣减再加乐观锁版本号 `where: { id, version: acc.version }`——事务不是万金油，隔离级别与竞态（09-express 幂等、node-queues-jobs 消费端幂等同源）各自有各自的解。

## 六、连接池与部署形态

- 一个 `PrismaClient` = 一个连接池：`connection_limit`（默认 CPU×2）与 `pool_timeout` 在 URL 参数里调；**多进程（cluster/pm2 每 worker 一份）**，总连接数 = 实例数 × limit，别超数据库 `max_connections`（呼应 exp-perf、node-cluster）；
- Serverless/短生命周期环境连接会打爆数据库 → Prisma Accelerate 或 PgBouncer 路线；
- 单测不连真库：mock `PrismaClient` 方法（exp-testing 的 mongoose mock 同位替换），或用测试库 + `migrate deploy` + 事务回滚夹具；
- 前端红利：schema 生成的类型可随共享包发给付费前端，`PostGetPayload` 派生查询结果类型——zod 校验（exp-validation）+ Prisma 类型的双保险。

## 自检清单

- [ ] 三句口诀读得懂任意 schema 的关系，并能写出带属性的显式中间表。
- [ ] migrate dev / migrate deploy / db push 各在什么场合用，说得一对一错。
- [ ] 知道 include 的 N+1 成因，列表接口先想 select 裁列。
- [ ] $transaction 两形态怎么选、"回调里必须用 tx"为什么。
- [ ] 会算连接账：进程数 × connection_limit 不触数据库上限。

---

## 🚀 部署预告

- `env("DATABASE_URL")` 的密钥纪律回扣 **node-config**，Docker 注入在 **exp-deploy** 合体；
- Prisma 生成器是 **02-ts** "类型来自代码生成"路线的 DB 版，与 zod（exp-validation）共享 schema 是 tRPC 式全栈类型的地基；
- 游标分页的 cursor 写法与 **exp-pagination** 的 base64 不透明游标拼成完整列表接口；
- `$queryRaw` 逃生舱里仍要参数化查询——SQL 注入防线见 **exp-security**（Prisma 默认帮你挡，raw 帮不了浪的人）；
- 多进程连接账与 **exp-perf**、**node-cluster** 的扩容公式一致。

L5 到此真正收官。下一关进入 **L6 exp-security**：Helmet、CORS、注入与限流——把 API 敞口全部过一遍安检。
