# exp-patterns 面试题精选

> 共 12 题，覆盖 **分层 / DI / 目录 / 配置 / 错误码 / 日志 / 12-Factor** 七类。

---

## 一、分层架构

### 1. Controller-Service-Repository 三层各自职责？为什么这么分？

Controller：处理 HTTP（解析 req、调 service、组织 res），懂"协议"；Service：业务规则、编排、事务、授权，懂"业务"，与传输无关；Repository：数据存取（DB/外部服务），懂"存取"。分层让每层单一职责、可独立测试、可替换（换 DB 只改 Repository、换框架只改 Controller），业务逻辑集中可复用（HTTP/定时任务/消息消费共用 Service）。

**来源**：Martin Fowler — "Patterns of Enterprise Application Architecture"; Microsoft — "Layered Architecture"; Clean Architecture — "Uncle Bob"

### 2. 为什么 Service 不应该 import req/res？

一旦 Service 引用 HTTP 对象，就与 Express/传输协议耦合 → ① 不能被 CLI/队列消费者/测试复用；② 单测要伪造 req/res；③ 换框架要重写业务。Service 应接收纯 DTO、返回纯数据 + 抛业务错误，HTTP 映射只在 Controller 发生。这是"关注点分离/依赖方向"原则。

**来源**：Clean Architecture — "Dependency Rule"; 12-factor — "processes"; Node Best Practices — "keep business logic framework-free"

### 3. "按业务特性切目录（feature-slice）"和"按技术分层切目录"各有什么优劣？

按技术（controllers/ services/ models/ 各一堆）：直观、小项目快；大项目时改一个功能要跨多个目录跳、文件泛滥、耦合看不清。按特性（modules/user、modules/order，每个内含三层）：高内聚（一个业务一处搞定）、易删除/迁移模块、团队协作少冲突；缺点跨模块公共逻辑要抽到 common。大项目普遍倾向 feature-slice。

**来源**：Bulletproof React — "Folder structure / by feature"; Matérn — "Feature-Sliced Design"; Node — "project structure"

---

## 二、依赖注入

### 4. 什么是依赖注入？Node.js 里一定要上 DI 容器吗？

DI = 不自己在模块内 new 依赖，而由外部把依赖"传进来" → 解耦、可替换、可测。Node 里**不必**用重型容器（InversifyJS 有样板/性能开销）。多数场景用"工厂函数 + composition root"（装配处集中构造并注入）即享受可测性，轻量直观。真到大型多绑定/生命周期管理再考虑 tsyringe/Inversify。

**来源**：Martin Fowler — "Inversion of Control and Dependency Injection"; InversifyJS docs; Node — "DI without frameworks"

---

## 三、配置管理

### 5. 配置管理应遵循哪些原则？

① 集中：全项目从一个 config 模块读，不散落 process.env；② 分环境：.env.development/.production；③ 启动校验（fail fast，用 zod/envalid/convict）；④ 密钥不入代码库/不硬编码（环境或 Secret Manager 注入）；⑤ 类型安全（Number/Boolean 转换）；⑥ 有默认值但区分"可默认/必填"。核心是 12-Factor 的 Config 严格与代码分离。

**来源**：12-Factor App — "III. Config"; dotenv / envalid / convict docs; OWASP — "Secrets Management"

### 6. 环境变量放 .env 里安全吗？生产该怎么做？

.env 只适合本地开发 convenience，且**必须 .gitignore**（提交进仓库=密钥泄露事故）。生产不应依赖打包进镜像的 .env（镜像可被拉取/diff 泄露）。正确：运行时从平台的 Secret 注入（K8s Secret、AWS Secrets Manager/Vault、CI secret），进程只从环境变量读，不落盘、不进镜像层、有访问审计与轮换。

**来源**：OWASP — "Secrets Management Cheat Sheet"; 12-Factor — "Config"; AWS — "Secrets Manager best practices"

---

## 四、错误码体系

### 7. 如何设计一套可维护的领域错误体系？

基类 `AppError{status,code,message,details,expose}` + 语义子类（BadRequest/Unauthorized/Forbidden/NotFound/Conflict/Unprocessable）。① code 用稳定 SCREAMING_SNAKE（前端可编程分支）；② expose 区分 4xx（可给用户）/5xx（隐藏）；③ Service 只 throw 领域错误，不碰 res；④ 全局 error handler 统一转成响应 + 记日志；⑤ 可选：错误码集中登记成字典文档 + 号段规范。

**来源**：Microsoft REST API Guidelines — "Error Response"; IANA — "HTTP status"; google — "error codes design"

### 8. 全局 error handler 为什么要放在所有路由之后？Express 如何识别它是错误中间件？

错误中间件签名必须是 `(err, req, res, next)` 四参数——Express 靠参数个数区分普通中间件与错误中间件。它拦截前面所有 `next(err)`/抛出的错误，故要注册在路由与其他中间件之后（洋葱最外，最后兜底）。放前面会因不匹配普通流程而不生效或顺序错。可用 `app.use(fn)` 或 `app.use('prefix', fn)`。

**来源**：Express — "Error handling middleware"; Express API — "error handlers (4 args)"; Express Guide — "Error Handling"

---

## 五、日志规范

### 9. 生产日志应该记什么、不该记什么？

该记：结构化事件（时间/级别/service/requestId/userId/动作/结果/耗时/关键上下文）。不该记：密码、token、API key、信用卡/身份证等 PII、完整请求体（可能含敏感）、无节制 debug（性能+存储爆炸）。用 redact 脱敏（pino redact），用采样/级别控制量，用 requestId 关联链路。日志要"可排障且不泄密"。

**来源**：OWASP — "Logging Cheat Sheet"; pino — "redact"; Google SRE — "Logging / observability"

### 10. 为什么"每个请求一个 requestId 贯穿所有日志"很重要？

现代系统一次用户请求可能流经多个中间件、多次 DB/外部调用甚至多个微服务。给每个请求打唯一 id，并在该请求生命周期所有日志行都带上它 → 排查时用一个 id 捞出完整调用链，定位"哪一步慢/在哪失败"。没有它，高并发下日志交错无法归因。呼应 OpenTelemetry 的 traceId。

**来源**：Twitter/Uber — "request id / correlation id"; OpenTelemetry — "trace context"; NearForm — "logging best practices"

---

## 六、工程实践

### 11. 如何组织中间件顺序？给一个推荐的从外到内顺序。

安全与解析在前、错误处理在最后：`helmet` → `cors` → `requestId`（最早，后续日志都要带）→ `morgan/pino-http`（记录耗时）→ `express.json`(限 size) → `rate-limit` → 认证/鉴权 → 路由 → `notFound(404)` → `errorHandler`。理由：requestId/日志要在包裹业务前就位；解析在业务前；错误处理必须最后兜住所有 next(err)。注册顺序=执行顺序（呼应 L2）。

**来源**：Express — "Middleware execution order"; NearForm Node Best Practices; OWASP — "Application Security Verification"

### 12. 什么是"优雅关闭"？为什么生产需要？

收到 SIGTERM（K8s 缩容/发版/重启）时不是立刻 kill，而是：① 停止监听新连接；② 等在途请求处理完（设上限超时）；③ 关闭 DB/Redis/队列连接；④ flush 日志/metrics。避免发版瞬间截断用户请求造成 500/数据不一致。`server.close()` + `process.on('SIGTERM')` + 超时兜底 `process.exit`。这是 12-Factor"优雅启动/关闭"要求（详见 L8）。

**来源**：Node — "server.close()"; 12-Factor — "Processes / graceful shutdown"; Kube — "Pod termination / preStop hook"
