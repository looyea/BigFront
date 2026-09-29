# 工程模式：分层架构 / 配置管理 / 错误码 / 日志

> 目标：**把 Express 项目从"能跑"提升到"可维护的生产工程"**——Controller-Service-Repository 分层、依赖注入、集中配置管理、统一错误码体系、结构化日志规范、目录组织。

---

## 一、目录结构：Feature-Slice 优于按类型

传统"按技术分层"目录（所有 controller 一起、所有 model 一起）在小项目可行，大项目难以定位。现代推荐**按业务特性切分（feature-slice / 领域驱动）**：

```
src/
├── app.js                 # Express 装配（中间件、路由挂载）
├── config/                # 配置集中管理
│   └── index.js
├── common/                # 跨领域公共设施
│   ├── errors/            # 错误码体系
│   ├── middleware/        # 通用中间件
│   ├── logger/            # 日志
│   └── utils/
├── modules/               # 按业务领域组织，每个模块自带三层
│   ├── user/
│   │   ├── user.controller.js
│   │   ├── user.service.js
│   │   ├── user.repository.js
│   │   ├── user.schema.js       # zod 校验
│   │   └── user.routes.js
│   └── order/
│       └── ...
└── server.js              # 启动入口（listen / graceful shutdown）
```

每个功能模块内高内聚（改一个业务只碰一个目录），模块间低耦合。

---

## 二、三层架构：Controller / Service / Repository

关注点分离，每层只做一件事：

```
HTTP 层（Controller）  接收 req、调用 service、组织 res —— 只懂"协议"
业务层（Service）      业务规则、编排、事务、校验授权 —— 只懂"业务"
数据层（Repository）   与 DB/外部服务交互 —— 只懂"存取"
```

### 2.1 Controller（薄）

```js
// 目的：Controller 层—只接 req、调 service、组织 res，不写业务也不碰 DB
// user.controller.js
import userService from './user.service.js';

export async function createUser(req, res) {
  const user = await userService.register(req.body);   // ✅ req.body 已在上游校验成可信 DTO
  res.status(201).location(`/users/${user.id}`).json({ data: user });  // ✅ 创建成功 201+Location
}
export async function getUser(req, res) {
  const user = await userService.getById(req.params.id);   // ✅ 业务在 service，这里只搬运
  res.json({ data: user });
}
// ❌ 在 controller 里直接 new User().save() 或写业务分支 → 层职责破坏，无法被 CLI/定时任务复用、难单测
```

Controller 不含业务逻辑、不直接碰 DB。方便替换框架 / 单测。

### 2.2 Service（业务核心，纯函数易测）

```js
// 目的：Service 层—业务规则/编排，抛语义化业务错误（由全局 handler 转状态码），不依赖 req/res
// user.service.js
import userRepository from './user.repository.js';
import { ConflictError, NotFoundError } from '../../common/errors/index.js';
import bcrypt from 'bcrypt';

export async function register(dto) {
  if (await userRepository.findByEmail(dto.email)) {
    throw new ConflictError('邮箱已被注册', { field: 'email' });   // ✅ 抛业务错误→全局 handler 自动转 409
  }
  const passwordHash = await bcrypt.hash(dto.password, 12);          // ✅ 只存哈希
  return userRepository.create({ ...dto, passwordHash });
}
export async function getById(id) {
  const u = await userRepository.findById(id);
  if (!u) throw new NotFoundError('用户不存在');                     // ✅ 不存在抛错，不回 null 给 controller 判
  return u;
}
// ❌ 把 req/res 传进 service 或在这里 res.status(...) → 与 HTTP 耦合，CLI/消息消费者无法复用
```

Service 与 HTTP 解耦 → 也可被 CLI/定时任务/消息消费者复用。

### 2.3 Repository（数据访问）

```js
// 目的：Repository 层—唯一与 DB 打交道的地方，.lean() 返回纯对象避免反复改模型
// user.repository.js
import User from './user.model.js';
export const findByEmail = (email) => User.findOne({ email }).lean();   // ✅ 只存取，无业务判断
export const findById = (id) => User.findById(id).lean();
export const create = (data) => User.create(data);
// ❌ 在这层写“邮箱重复就抛 409”类业务规则 → 数据层混入业务，换 DB 时逻辑丢失
```

换 DB（Mongo→PG）只改这层，业务不动。

---

## 三、依赖注入（DI）

Service 直接 import Repository 会造成硬依赖、难 mock 测试。轻量 DI：装配层注入。

```js
// 目的：轻量依赖注入—把依赖作参数传入，测试时可注 fake，无需真 DB/mailer
// 构造注入
export function makeUserService(userRepo, mailer, clock) {   // ✅ 依赖从参数注入而非内部 import
  return {
    async register(dto) {
      if (await userRepo.findByEmail(dto.email)) throw new ConflictError();
      const u = await userRepo.create(dto);
      await mailer.sendWelcome(u);                             // ✅ 用注入的 mailer
      return u;
    },
  };
}

// 装配（composition root，app.js 里集中 new）
const userService = makeUserService(userRepository, mailer, { now: Date.now });   // ✅ 真实依赖只在装配处接起来
// ✅ 测试：makeUserService(fakeRepo, fakeMailer, { now: () => 0 }) 即可，无需真库
// ❌ service 内部直接 import userRepository → 硬依赖难 mock，单测就得连真 DB
```

测试时传假实现（fake repo / mailer）即可，无需真 DB。大型项目可用 InversifyJS / tsyringe，但多数场景"手工工厂 + composition root"足够（避免过度设计）。

---

## 四、配置管理

集中、分环境、类型安全、不泄密：

```bash
# 目的：安装环境变量加载
npm i dotenv
```

```js
// 目的：集中配置—按环境加载 + 启动即校验必填项（fail fast）
// config/index.js
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });   // ✅ 按环境加载 .env.development/.env.production

// ✅ 集中读取 + 校验 + 默认值
const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  db: { url: required('DATABASE_URL') },                     // ✅ 必填，缺失启动即崩
  jwt: { secret: required('JWT_SECRET'), accessTtl: process.env.JWT_TTL || '15m' },
  redis: { url: process.env.REDIS_URL || 'redis://localhost:6379' },
  features: { enableSentry: process.env.SENTRY === 'true' },
};
function required(name) {
  const v = process.env[name];
  if (v === undefined) throw new Error(`Missing required env: ${name}`);   // ✅ 缺关键配置直接报错而非默默运行
  return v;
}
export default config;
// ❌ 密钥硬编码在源码 → 进 git 历史永久泄露；应全走 env，.env 加 .gitignore
```

原则：
- **启动即校验**（fail fast，缺关键配置直接崩而不是运行到一半出错）；
- `.env.*` 按环境分文件，**`.env` 绝不入 git**（`.gitignore`）；
- 生产密钥来自环境/Secret Manager，不硬编码；
- 全项目只从 `config` 对象读，不散落 `process.env` 各处；
- 可用 `convict`/`envalid`/`zod` 做配置 schema 校验。

---

## 五、统一错误码体系

让前后端有稳定的错误契约（呼应 L5 exp-rest）：

```js
// 目的：统一错误基类—携带 HTTP status + 机器读 code + 是否对外 expose
// common/errors/index.js
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);              // ✅ 继承 Error，保留 stack
    this.status = status;        // ✅ 全局 handler 据此定响应码
    this.code = code;            // ✅ 机器可读、稳定（前端据此分支）
    this.details = details;
    this.expose = status < 500;   // ✅ 4xx 才把 message 暴露给客户端
  }
}
export class BadRequestError   extends AppError { constructor(m, d) { super(400, 'BAD_REQUEST', m, d); } }     // ✅ 子类只定默认 status/code
export class UnauthorizedError extends AppError { constructor(m='未认证') { super(401, 'UNAUTHORIZED', m); } }
export class ForbiddenError    extends AppError { constructor(m='无权限') { super(403, 'FORBIDDEN', m); } }
export class NotFoundError     extends AppError { constructor(m='资源不存在') { super(404, 'NOT_FOUND', m); } }
export class ConflictError     extends AppError { constructor(m, d) { super(409, 'CONFLICT', m, d); } }
// ❌ 子类忘调 super(message) → err.message 为空、无 stack，日志里无法定位
```

全局 error handler（Express 5 async 自动转发，呼应 L2）：

```js
// 目的：全局错误中间件—按 status 分级记日志、按 expose/env 决定回什么（四参数）
// common/middleware/errorHandler.js
import config from '../../config/index.js';
import logger from '../logger/index.js';

export function notFound(req, res, next) { next(new NotFoundError()); }   // ✅ 404 兜底包成 err 交下去

export function errorHandler(err, req, res, next) {                       // ✅ 四参数才是错误中间件
  const status = err.status || 500;
  // ✅ 5xx 记 error 日志（含堆栈），4xx 记 warn
  (status >= 500 ? logger.error : logger.warn)({ err, reqId: req.id, path: req.originalUrl });

  const body = {
    error: {
      code: err.code || 'INTERNAL_ERROR',                                   // ✅ 未知错误也给稳定 code
      message: status >= 500 && config.env === 'production' ? '服务器内部错误' : err.message,  // ✅ 生产不外泄 5xx 原文
      ...(err.details && { details: err.details }),
    },
  };
  res.status(status).json(body);
}
// ❌ errorHandler 若漏写 next 变三参数 → 不被识别为错误中间件，err 永远接不到
```

`app.use(errorHandler)` 放最后。全项目 `throw new ConflictError(...)` 即可，无需每处手写 res.status。

---

## 六、结构化日志规范

用 **pino**（JSON 日志，呼应 L2 morgan/pino-http）而非 `console.log`：

```js
// 目的：结构化日志—pino JSON，按环境定级 + 脱敏 + 公共字段
// common/logger/index.js
import pino from 'pino';
import config from '../../config/index.js';

export const logger = pino({
  level: config.env === 'production' ? 'info' : 'debug',                 // ✅ 生产少噪音
  redact: ['req.headers.authorization', 'req.body.password', '*.token'],   // ✅ 脱敏，凭证不入日志
  base: { service: 'user-api', env: config.env },                          // ✅ 每条带公共上下文
  transport: config.env !== 'production' ? { target: 'pino-pretty' } : undefined,  // ✅ 开发可读彩色
});
// ❌ 用 console.log 拼字符串 → ELK/Loki 无法按字段索引检索，排障时 grep 半天
```

规范：
- **JSON 结构化**（可被 ELK/Loki 索引），别写非结构化字符串；
- **分级**：fatal/error/warn/info/debug，生产 info；
- **关联**：每个请求带 requestId（呼应 L2），贯穿日志便于链路追踪；
- **脱敏**：password/token/PII 绝不入日志；
- **上下文**：记 message + 结构化字段（userId、path、duration），非只堆栈；
- **别在热路径 debug 级日志**（性能）。

---

## 七、横切关注点与模式

- **中间件编排**：安全（helmet/cors）→ 解析（json）→ 请求上下文（requestId/logger）→ 限流 → 路由 → 404 → 错误处理，固定顺序（呼应 L2）；
- **统一响应 helper**：`ok(res, data, meta)` / `created(res, data)` 减少重复；
- **AsyncHandler**：Express 5 已原生支持 async 错误，v4 需包装；
- **DTO 边界**：Controller 收到即校验成 DTO，Service 只接收可信 DTO；
- **幂等 / 重试 / 熔断**：调用外部服务用 p-retry / opossum；
- **优雅关闭**：SIGTERM → 停止接收新连接 → 处理完在途 → 关 DB/Redis（呼应 L8 部署）。

---

## 八、自检清单

- [ ] Controller/Service/Repository 各自职责边界？
- [ ] 为什么 Service 不该 import req/res？
- [ ] 配置为什么要在启动时校验？
- [ ] 错误码 code 和 message 分别给谁看？
- [ ] 为什么 5xx 在生产要隐藏原始 message？
- [ ] 结构化日志相比 console.log 好在哪？
- [ ] 依赖注入解决了什么测试痛点？

---

## 🚀 部署预告

- **十二要素应用（12-Factor）**：配置存环境、进程无状态、日志写到 stdout（由平台收集）——本关正是 12-Factor 落地；
- **集中日志**：pino JSON → 容器 stdout → Loki/ELK/CloudWatch 聚合检索；
- **APM 关联**：requestId 贯穿 → 分布式追踪（OpenTelemetry）串起多服务调用链；
- **错误上报**：error handler 里 5xx → Sentry（带 requestId 关联日志）。

下一关进入 **L7 测试**（exp-testing）——supertest 与测试分层。
