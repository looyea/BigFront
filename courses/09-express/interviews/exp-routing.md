# exp-routing 面试题精选

> 共 12 题，覆盖 **路由匹配 / Router 模块化 / params/query / res 方法 / 错误传递 / 版本策略** 六类。

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
