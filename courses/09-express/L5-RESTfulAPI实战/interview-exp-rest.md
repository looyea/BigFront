# exp-rest 面试题精选

> 共 15 题，覆盖 **REST 原理 / 方法语义 / 幂等 / 状态码 / 命名 / 版本 / 响应结构** 七类。

---

## 一、REST 原理

### 1. REST 的六个约束是什么？为什么说"RESTful"？

Roy Fielding 博士论文提出：① 客户端-服务器；② 无状态（每个请求自带全部信息）；③ 可缓存；④ 统一接口；⑤ 分层系统；⑥ 按需代码（可选）。"RESTful"指遵循这些约束，尤其统一接口（用 HTTP 方法+状态码操作资源）。多数 Web API 是"面向资源的 RPC"，够 REST 就行，不必教条。

**来源**：Roy Fielding 博士论文 — "Architectural Styles and the Design of Network-based Software Architectures"; restfulapi.net — "REST constraints"

### 2. 无状态（statelessness）对服务端有什么好处？代价是什么？

好处：任何请求可被任意实例处理 → 水平扩展简单（负载均衡随意分发）、易缓存、故障隔离。代价：不能靠服务端 session 存上下文 → 每次带 token（JWT）→ 认证信息重复传输；跨请求状态需存外部（DB/Redis）。

**来源**：REST — "Stateless constraint"; MDN — "HTTP authentication stateless"; Auth0 — "Stateless authentication JWT"

---

## 二、方法语义与幂等

### 3. 幂等为什么重要？网络重试时 PUT 和 POST 处理有什么不同？

幂等 = 一次和多次请求副作用相同。客户端超时重试：PUT/DELETE 可安全重发（结果不变）；POST 不幂等 → 重试可能重复创建（重复扣款/下单）。解决 POST 幂等：引入 **Idempotency-Key** 请求头（Stripe 首创）→ 服务端记录 key，重复则返回首次结果。

**来源**：RFC 9110 §9 — "Idempotent methods"; Stripe — "Idempotent requests"; IETF — "The Idempotency-Key HTTP Header Field"

### 4. PUT 和 PATCH 的区别？各给一个例子。

PUT = 全量替换（客户端发完整资源，服务端整体覆盖）→ 漏发字段会被清空。PATCH = 局部更新（只发要改的字段）→ 更适合"只改邮箱"场景。例：`PUT /users/1 {name,age,email}`（替换整个）vs `PATCH /users/1 {email}`（只改 email）。PATCH 有多种格式（JSON Merge Patch、JSON Patch RFC 6902）。

**来源**：RFC 5789 — "PATCH Method"; RFC 7386 — "JSON Merge Patch"; RFC 6902 — "JSON Patch"

### 5. GET 请求能带 body 吗？为什么一般不推荐？

HTTP 协议层面 GET 可以有 body，但绝大多数服务器/代理/缓存会忽略或不支持（fetch 甚至禁止 GET 带 body），语义上 GET 应"安全、无副作用、可缓存"。复杂查询用 POST /search 或用 query 参数。依赖 GET body 会导致兼容性/缓存问题。

**来源**：RFC 9110 — "GET method"; Fetch spec — "Request body / GET forbidden"; StackOverflow — "GET with body"

---

## 三、状态码

### 6. 400、401、403、404、422 分别用于什么？给一组易混例子。

- 400 Bad Request：请求体/参数格式错（JSON 解析失败、缺必填）；
- 401 Unauthorized：没认证（token 缺失/过期）→ "你是谁？"；
- 403 Forbidden：已认证但无权限 → "你不能干这个"；
- 404 Not Found：资源不存在；
- 422 Unprocessable Entity：格式对但语义校验失败（邮箱格式合法但已被注册可用 409）。
易混：401 vs 403（认证 vs 授权）；404 vs 403（隐藏资源存在性时用 404 防枚举）。

**来源**：MDN — "HTTP response status codes"; RFC 9110 §15; IANA — "HTTP Status Code Registry"

### 7. 为什么有时对"无权限的私有资源"返回 404 而不是 403？

安全考量：返回 403 会告诉攻击者"这个资源存在，只是你不许看"→ 泄露资源 ID 的存在性（可被枚举）。返回 404 则不区分"不存在"和"无权"→ 防止信息泄露。这是防止资源枚举的常见做法。

**来源**：OWASP — "Insecure Direct Object References (IDOR)"; GitHub API — "404 for private repos"; RFC 9110 — "404 403 semantics"

---

## 四、命名与设计

### 8. 如何处理"批量操作"和"复杂动作"这类不适合标准 CRUD 的需求？

① 批量删除：`DELETE /articles` + body 传 ids，或 `POST /articles/batch-delete`；② 复杂动作建模为子资源或动作端点：`POST /orders/1/cancel`、`POST /invoices/5/ refund`；③ 状态迁移优先用 `PATCH /orders/1 {status:'cancelled'}`；④ 搜索：`POST /search`（复杂条件带 body）。没有银弹——可读性 + 团队规范优先。

**来源**：Microsoft REST API Guidelines — "Standard Methods / resource operations"; Google AIP — "Custom methods (:verb)"; zapier — "REST design"

### 9. URL 用复数还是单数？连字符还是下划线？有标准吗？

无强制标准，但社区主流共识：**资源用复数**（`/users`，表示集合）、**路径小写 + 连字符**（`/user-profiles`，URL 惯例更常见于连字符，避免下划线在部分场景被链接遮挡）。关键是项目内一致。JSON 字段命名另议（camelCase 或 snake_case 全程统一）。

**来源**：Google JSON Style Guide; Microsoft REST Guidelines — "serialization"; zapier/platform — "API URL conventions"

---

## 五、响应结构

### 10. 列表接口的分页元信息应该放在哪里？为什么不要混进 data？

放 `meta`（或顶层）：`{ data: [...], meta: { page, pageSize, total, totalPages } }`。data 只装业务数据数组，保持结构纯净 → 前端可通用解析（data 永远是列表，meta 永远是分页/统计）。混进 data 会让"数据"和"元数据"职责不清，难以复用通用列表组件。链接式分页（`links: {next, prev}`）是 JSON:API 风格。

**来源**：JSON:API — "Top Level meta / links"; Microsoft REST Guidelines — "Pagination"; paginated — "API pagination best practices"

### 11. 错误响应为什么要带机器可读的 code？

前端不能靠 message 文案做逻辑分支（文案会变、要国际化）。稳定字符串 code（如 `INSUFFICIENT_BALANCE`）→ 前端据 code 精确处理（弹充值/跳登录）。message 给人看、code 给程序看、details 放字段级校验错误。这是 API 契约的一部分。

**来源**：Microsoft REST API Guidelines — "Error Response Body"; JSON:API — "Error Objects"; Stripe — "Errors / error codes"

---

## 六、版本与演进

### 12. 不做版本化，如何安全地演进 API（向后兼容地改）？

遵循 **Evolutionary API** 原则：① 只加可选字段（客户端应忽略未知字段）；② 不删/不改已有字段语义（废弃用 `@deprecated` + Deprecation 头过渡）；③ 新增强大功能加新端点而非改老的；④ 用功能开关。实在破坏性 → 才 URL 版本 `/v2` 并行运行 + 灰度迁移 + 旧版 sunset 计划。

**来源**：Google Cloud — "API Evolution"; storify — "Life Beyond the Versioned API"; IETF — "Deprecation Header (Sunset RFC 8594)"

---

## 补充（新专题 13-15）

### 13.  错误响应体怎么设计？RFC 7807/9457 problem+json 和自定义 {code,message,data} 信封你怎么选？

需求清单先行：人能读（message）、机器能分支（稳定 code + 类型化 errors 数组带 field）、能追踪（traceId/requestId）、能自助（type 链接指向错误文档）、不泄露（500 通用文案）。两派解剖：problem+json 是标准化方案（type/title/status/instance + 扩展字段 errors），优势在通用客户端与网关能统一理解、Swagger 原生支持；信封派（code/message/data）优势在"成功与失败同构、客户端解析路径统一"，是国内生态默认。决策维度：对外/被集成的 API 优先标准（省掉对方适配层与文档解释成本），内部全栈自家消费则信封派够用但要防三害：code 无注册表随意新增（要发号器+文档站点）、HTTP 状态码被废弃成恒 200（丢弃了中间层可观测性与缓存语义——"业务失败 200、协议失败真码"的混合规则要明文）、message 直接透传底层异常（泄露与不稳定文案）。细节加分：422 校验错误的 errors 数组（field/reason 机器可读）两派都该有；type URL 用离线可缓存的短标识而不是实时生成长链；5xx 的 instance/traceId 是客服排障的生命线——"用户报障码"要出现在响应里而不只在日志。收口：错误体是"用户侧可机读异常报告"的设计题，格式之争只是表皮，注册表治理与泄露边界才是里子。

**来源**：RFC 9457 Problem Details for HTTP APIs；Google AIP-193；知乎《我们的错误码长成了意大利面》

### 14.  OpenAPI 文档在你的 API 团队里是活契约还是死附件？讲讲从文档到治理的完整链路。

层级递进：① 生成方向选对——代码注释生成（decorators/swagger-jsdoc）让文档随代码腐化，schema-first（OpenAPI 文件是源、代码生成骨架与类型）才能让文档成为契约；② CI 三关——lint（ Spectral 规则：命名/版本/必备字段）、breaking change 检测（optic/oasdiff 对比 git 上一版，破坏性变更需显式审批标记）、mock（Prism 按 spec 起 mock 服务，前端不候后端）；③ 契约测试——消费者驱动（pact）适合内部多团队，spec 对实现的双向验证（dredd 类）适合对外 API，核心都是"文档说的一旦实现做不到，红的是 CI 而不是线上的集成方"；④ 发布与版本沟通——changelog 由 spec diff 自动生成、SDK 由 spec 生成（openapi-generator 按语言出包）、beta/deprecated 用 spec 扩展字段标记并配 Sunset 头与移除策略（先标 deprecated+监控调用量，归零后再删）。组织现实：文档治理的最大阻力不是工具是"改契约要过谁的手"——spec 文件进 CODEOWNERS、破坏性变更走 RFC，这两条流程没有，工具链都是摆设。加分句：判断一个团队 API 成熟度，看"新人加入时 SDK 从哪来"——生成的是治理，手抄的是传说。

**来源**：OpenAPI Specification 官网；Prism/dredd 契约测试工具；InfoQ《API First 落地两年的得与失》

### 15.  长耗时操作（报表导出、批量导入）的 API 怎么设计才不阻塞、可恢复、可观测？

反模式代价先讲：同步长接口占满连接与 worker、超时被网关掐断后"客户端以为失败服务端还在跑"、重试风暴叠加。标准形态（AIP-151 心智）：POST /exports → 202 + 一个 job 资源（Location: /jobs/123），job 资源含 status（queued/running/succeeded/failed）与百分比 progress、结果引用（done 后 resultUrl 指向签名下载地址）、失败原因（结构化可分支）。轮询协议：响应带 Retry-After（服务端给节奏）、job 支持 ?field= 轻查询、ETag/If-None-Match 让"没变化"的轮询走 304（大团队轮询风暴的省流阀）；进阶推送——完成时 webhook 回调（带签名+重试与去重）或 SSE 订阅 job 进度，轮询保底推送加速的双通道。实现层：任务队列（BullMQ 等 Redis 系）+ worker 进程与 API 进程分离（API 挂了任务不死）、job 幂等（提交去重键：同参数 5 分钟内不重复入队）、并发与配额（每用户同时 job 数上限）、孤儿回收（running 超 TTL 标 failed——worker 崩溃不能留永生中间态）。观测面：队列深度告警、端到端时延分布、失败按 stage 分类。收口句：长任务 API 的设计本质是"把一次调用换成一个资源"——有了资源身份，进度、重试、取消、审计全部顺理成章。

**来源**：Google AIP-151 LRO（Long Running Operations）；MDN 202 语义；掘金《我们把导出做成同步接口后的三连故障》
