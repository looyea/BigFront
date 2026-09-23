# exp-rest 面试题精选

> 共 12 题，覆盖 **REST 原理 / 方法语义 / 幂等 / 状态码 / 命名 / 版本 / 响应结构** 七类。

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
