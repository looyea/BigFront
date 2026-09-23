# exp-patterns 面试题精选

> 共 15 题，覆盖 **分层 / DI / 目录 / 配置 / 错误码 / 日志 / 12-Factor** 七类。

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

---

## 补充（新专题 13-15）

### 13.  什么时候该从单体拆微服务？给你一个可操作的判据清单和拆完必付的账单。

先立默认值：单体优先（能模块化单体解决的不上分布式），拆的动机只有组织与弹性两类——判据清单：① 团队规模（一个模块的 PR 排队/发布互相踩踏成为周经问题，且模块负责人制解决不了）；② 伸缩比差异（一个高频服务把另一个的低频大计算挤在同一个扩缩单元里，成本账算得过来）；③ 故障隔离（一个 OOM 风险模块不能容忍带走核心）；④ 异构硬需求（必须换语言/换运行时的一小块）；⑤ 合规物理隔离。技术判据（性能、可维护性）几乎从不真需要微服务——那是模块化与架构治理的本分。账单逐项：分布式事务与一致性（outbox/saga 从可选变必写）、可观测成本（trace 跨服务、日志聚合）、发布与版本管理（契约测试、兼容窗口）、网络故障模式（超时/重试/幂等三件套每个调用点都要有）、延迟预算重分配、平台设施（服务网格/注册配置中心）与 oncall 面扩大、"共享数据库反微服务"的两难（拆库才是真拆，数据迁移成本一次性巨大）。中间路线清单：模块化单体+内部发布接口纪律（进程内边界先立稳，哪天真要拆时边界已经验证过——Fowler 的 MonolithFirst 精髓）、独立部署的"绞杀者"只切高价值模块。收口句：拆分的真问题是"组织沟通结构与系统结构对齐"（康威定律），答不出"为哪个团队痛点拆"的拆分都是技术浪漫。

**来源**：Martin Fowler《MonolithFirst》；Sam Newman《Building Microservices》；InfoQ《拆出去两年又合回来的团队》

### 14.  一个 Express 工程里的"领域错误体系"怎么设计与维护？从异常类型到用户文案的完整链路。

分层建模：① 类型体系——Error 基类扩展出 AppError（statusCode/code/expose/meta），按域派生（NotFoundError/ConflictError/PermissionError），禁止裸 throw new Error 带语义（lint 自定义规则收口：业务路径 throw 必须是 AppError 或可编程错误）；② code 注册表——machine 可读码集中枚举+文档站点自动生成（从代码注释提取），发号规则（域前缀+序号）、废弃码保留不复用（客户端要兼容历史）；③ 文案翻译——用户文案不进异常 message（开发者语言与产品语言分家），code → 文案 key → i18n 资源三层，动态参数占位（余额不足还差 {{amount}}）；④ 转换边界——error handler 统一完成"异常→HTTP 状态+code+可展示文案"映射表，4xx 透传 expose、5xx 一律通用文案+traceId；⑤ 前端契约——SDK/文档按注册表生成，客户端按 code 分支（支付失败码要驱动 UI 行为）而不是字符串匹配 message。维护面：新码 PR 必须同时提交注册表条目+文案 key（CI 断言三者齐），季度审"从未被客户端处理过也未被告警消费"的码（僵尸码清退）；测试用"抛什么异常→响应什么码"的表驱动快照。加分句：错误体系的本质是 API 契约的一部分——它的治理动作（注册、废弃、翻译）与字段治理完全同构，说得出这句的人不是在背模式，是在带产品。

**来源**：领域驱动设计（异常即领域语言）；知乎《我们的错误码文档三个月就没人对齐了》；Google AIP 错误模型

### 15.  代码分层之外，"配置、日志、指标、错误"这些公共设施怎么在多服务团队里保持一致？平台化的尺度在哪。

问题规模化：8 个服务 8 套 pino 配置、4 种 requestId 字段名、3 套错误码风格——每一次"新服务从旧服务复制再改两行"都在扩大熵。解法三段：① 内部包化——把"日志器+错误体系+配置装载+健康检查+优雅关闭"收进公司 starter 包（版本化发布、breaking change 走 codemod），服务 import 而不是 copy；② golden path 而不是强制统一——平台是产品：默认路径顺滑到"照做最省事"（模板生成即合规），偏离自由但要登记（审计豁免清单）；③ 治理闭环——合规性进 CI 门禁（日志格式断言、必备指标存在性检查），观测面本身聚合出"哪些服务还在用旧版本"，平台团队看采纳率与工单分布排 roadmap。尺度把握：平台过度=业务被模板绑架（每个非常规需求都要给平台提需求排期，团队开始绕开平台自建——信号要自省）；平台不足=每团队重复造轮子且质量参差（事故成本）。判据："新工程师从入职到独立发一个合规服务要几天、问几个人"——golden path 的度量就是这一句。危险信号清单： starter 大版本升级两年推不动（缺 codemod 与 owner）、包变成了"什么都塞"的第二框架（准入线仍是"每项目重写的东西"）、平台团队 KPI 是"覆盖率"而不是"采纳率+满意度"（强制推来的统一会在考核松掉那天分崩）。

**来源**：Spotify Backstage golden path 实践；InfoQ《内部平台是个产品，要有 roadmap》；SegmentFault《我们的 8 套日志格式》
