# exp-routing 面试题精选

> 共 15 题，覆盖 **路由匹配 / Router 模块化 / params/query / res 方法 / 错误传递 / 版本策略** 六类。

---

## 一、路由匹配

### 1. Express 路由匹配算法是什么？性能如何？

线性遍历 `_router.stack`（Layer 数组），逐个对 `path` 做匹配（v8 用逐段字符串比较，非 regex）。**先注册先匹配**。1000 个路由 = 最坏 1000 次比较。优化：`app.route('/users').get().post()` 把同 path 合并为一个 Layer（只匹配一次 path）。大量路由可考虑前缀 tree（express 5 内部未做；Hono/Fastify 做了）。

**来源**：Express source — `Router.prototype.handle`; path-to-regexp v8 — "Performance"

### 2. 精确匹配和正则匹配的性能差异？

`/users/:id` 在 path-to-regexp v8 里编译成 **tokenizer → 逐段比较**——不调用 RegExp。自定义正则 `{:id(\\d+)}` 回退到 regex.test → 多一层开销但可忽略。真正慢的是老 v0/v4 的全路径一个大 regex 匹配——v8 已重写消除了这个瓶颈。

**来源**：path-to-regexp v8 benchmarks; Gerald — "Express router performance" blog

---

## 二、Router 模块化

### 3. Router() 和 Router({ mergeParams: true }) 的区别？

默认 Router 实例的 `req.params` 只含**自己路径上的参数**。挂载在 `app.use('/users/:userId/orders', ordersRouter)` 时，ordersRouter 里 `req.params.userId` 是 undefined。加 `mergeParams: true` 后父级 params 合并进来 → `req.params = { userId, ... }`。

**来源**：Express API reference — "express.Router([options])"

### 4. 如何在 Router 里对子路由统一加鉴权？

```js
const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));  // 之后所有路由都受保护
adminRouter.get('/dashboard', handler);
adminRouter.delete('/users/:id', handler);
app.use('/admin', adminRouter);
```

`router.use(middleware)` 作用于该 Router 实例内**后续所有匹配的路由**。

**来源**：Express routing guide — "Router instances"

---

## 三、params / query

### 5. `req.params` / `req.query` / `req.body` 的区别？

| 来源 | 示例 |
| --- | --- |
| `req.params.id` | URL 路径参数 `/users/:id` |
| `req.query.page` | URL 查询串 `?page=2`（qs 解析） |
| `req.body.name` | 请求体（需 body parser 中间件） |

三者互不干扰，不会自动合并（Express 5 删了 `req.param()` 方法正是因为避免优先级歧义）。

**来源**：Express 5 migration guide — "req.param removed"

### 6. qs 解析深度限制？如何防原型链污染？

qs 默认 `depth: 5`、`parameterLimit: 1000`。攻击者发 `?__proto__[admin]=true` → qs 默认不污染 `Object.prototype`（安全解析），但中间件如果做 `Object.assign(req.query, ...)` 可能出事。建议：express 5 已安全；不要自行 merge query 到全局对象。

**来源**：qs GitHub — "Security considerations"; Hapi Lab — "Prototype pollution"

---

## 四、Response 方法

### 7. res.send() 和 res.json() 的区别？

| 维度 | res.send() | res.json() |
| --- | --- | --- |
| 自动设置 Content-Type | text/html（string）/ application/octet-stream（Buffer） | application/json |
| 序列化 | 不序列化（直接写） | `JSON.stringify` |
| 链式 | — | 自动调 `res.send()` |

实际 res.json 内部做了 `this.body = obj; this.send()`。

**来源**：Express API — "res.send" / "res.json"

### 8. 如何触发文件下载？

```js
res.download('/path/to/report.pdf', 'monthly-report.pdf', (err) => {
  if (err) console.error('Download failed:', err);
});
```

设 `Content-Disposition: attachment; filename="monthly-report.pdf"` + `Content-Type: application/pdf` + 流式传输文件内容。回调在传输完成或出错时调用。

**来源**：Express API — "res.download"

---

## 五、错误传递

### 9. next(err) 之后会发生什么？

Express 从当前 Layer 的**下一个**开始查找 4 参数 error middleware → 找到就调用 `fn(err, req, res, next)` → 如果它也调 `next(err)` 则继续向下找。找不到任何 error handler → Express 内置默认 handler → 返回 HTML 500（开发模式含 stack trace）。

**来源**：Express error handling guide

### 10. 为什么 Express 5 不再需要在每个 async handler 前写 try/catch？有例外吗？

handler 的返回值是 Promise → Express 5 自动 `.catch(next)`。例外：① **回调里的错误**（如 `setTimeout(() => throw ...)` → 不在 Promise 链上 → 不被捕获）；② handler 内手动开了一个新 Promise 但不 return 给 Express。确保 async handler 内所有 await 都在**同一个 return 的 async 函数**里。

**来源**：Express 5 docs — "Error handling in async handlers"

---

## 六、版本策略

### 11. URL 版本 vs Header 版本，各有什么优劣？

| 维度 | URL `/api/v1/users` | Header `X-API-Version: 1` |
| --- | --- | --- |
| 可缓存 | CDN/浏览器天然按 URL 缓存 | Vary 头复杂 → 缓存困难 |
| 可发现 | 浏览器地址栏直接看 | 需要工具 |
| URL 污染 | 版本嵌入路径 → 多版本并存时路由翻倍 | 保持 RESTful 纯净 |
| 移动端兼容 | 最简单 | 需配 CORS 允许自定义头 |

大多数公开 API（GitHub/Stripe）用 Header 或 Accept；内部 BFF 用 URL 前缀更直观。

**来源**：Microsoft — "API Versioning"; API Design Guidelines — "Versioning"

### 12. 如何在不影响旧版本的情况下灰度发布新版路由？

```js
const canary = req => req.get('X-Canary') === 'true';
app.get('/api/feature', (req, res) => {
  const handler = canary(req) ? v2Handler : v1Handler;
  return handler(req, res);
});
```

或更清晰：`app.use('/api', versionMiddleware, router)` → versionMiddleware 根据 header / cookie / percentage 分配 → 挂不同 router。配合 Nginx 按 cookie 分流更稳定。

**来源**：Martin Fowler — "Canary release"; Netflix Tech Blog — "Automated canary deployments"

---

## 补充（新专题 13-15）

### 13.  app.use 的"路径前缀匹配"语义（含 /apifox 陷阱）背后，Express 的路径匹配体系你完整讲一遍。

三层体系分层讲：① 挂载匹配——app.use 按"路径前缀（不要求边界）+ 全部方法"匹配，命中后 req.url 被临时改写（剥前缀）供 router 内部继续匹配，req.baseUrl 记录被剥部分，出栈恢复；路由（app.get 等）要求"完整路径+方法"双匹配，无改写。② 段语法——v5 起 path 只有三种构件：字面段、具名参数 :id（可跟修饰符 ? * +）、具名通配 /*filepath（贪婪多段），没有词边界概念所以 /api 天然吃掉 /apifox——要边界感就在 use 后自己判 req.path === '/api' 或改挂 router 于 /api/ 语义路径。③ 顺序仲裁——注册序即匹配序（线性栈），先注册先赢：通用 > 具体的顺序错误（/users/:id 挡在 /users/new 前）是最高频路由 bug，纪律是"具体路径先注册 + 兜底永远最后"。④ 排障工具链——app._router.stack 打印、express-router-debug 类工具可视化，以及"新路由 404 先查前缀拼重/顺序"的排查口诀。加分句：Express 路由表的"简单"（一维数组线性扫）是性能上可争论、但心智上伟大的设计。

**来源**：Express 官方 Routing table 与 route path 语法文档；SegmentFault《/api 中间件为什么命中了 /apifox》

### 14.  方法不对但路径存在时，如何给出诚实的 405 而不是含糊的 404？这值得做吗？

现状：Express 默认栈不做方法收集——路径存在但方法不匹配会走到最终 404，错误语义偏轻（客户端以为资源不存在，其实是自己用错了方法）。做 405 的两条路：① 路由层收口——把同一路径的注册用统一 helper 登记（router.route(path) 聚合天然提供"此路径有哪些方法"），404 兜底前检查路径命中集，命中则返回 405 + Allow 头（方法列表，RFC 要求）；② 框架层——用 405 兜底中间件（社区方案或自己按 router.stack 扫 matchesPath）。成本账：Allow 头要随路由注册动态维护（静态写死=下一个腐化点），实现约几十行 + 测试；收益在对外 API 的自描述性与客户端排障速度，纯内部服务收益低。决策：公开 API/被第三方集成的接口做（405+Allow 是 REST 完备性的一部分，呼应 REST 关）；内部微服务 404 够用别过度工程。延伸加分：这个题真正的映射是"错误语义要精确到能指导客户端下一步"——404 让客户端放弃，405 告诉它换方法重试，语义差一个码、行为差一截。

**来源**：MDN 405 Method Not Allowed；RFC 9110 方法语义；知乎《API 返回 404 还是 405》

### 15.  一个 200 条路由的 Express 服务，路由表本身怎么管理才不腐化？和 Nest 式声明对比你的取舍？

痛点先列全：路径字符串满天飞（改一处漏三处）、无全局视图（前缀冲突/重复注册查不出）、命名无规范（/getUser 混 /users/:id）、鉴权散挂（一半路由忘带 auth 中间件）。治理四件：① 分域聚合——每业务域一个 router 文件、主文件只留一张"挂载表"（path prefix → router → 域负责人），挂载表进文档首页；② 路径常量化——域内路径集中 export（const P = { list: '/', byId: '/:id' }），杜绝字面量漂移；③ 注册期自检——启动时遍历 app._router.stack 生成"全量路由清单"快照（断言无重复 method+path、前缀无意外吞并、鉴权中间件覆盖率 100%），CI diff 该清单当 API 变更审查面；④ 约定进脚手架——新增资源跑生成器（文件+测试+挂载一行）。对比 Nest：装饰器声明+DI 把这些变成框架能力（全局前缀/守卫/拦截器生命周期），Express 路线是"自己拼且要自觉"——取舍账：Express 保住了心智小与任意风格自由，代价是治理设施全靠团队内建，20 人以上团队建议评估 Nest（本质是"用框架纪律换人肉纪律"）。收口：路由表腐化的解药不是更聪明的字符串管理，是"路由清单可枚举可断言"。

**来源**：Express 官方 Best practices: Application generator；InfoQ《大 Express 工程的路由治理》
