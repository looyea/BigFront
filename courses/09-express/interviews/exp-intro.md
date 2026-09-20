# exp-intro 面试题精选

> 共 12 题，覆盖 **Express 定位 / 5 vs 4 变化 / 路由语法 / 中间件概念 / 生态** 五类。

---

## 一、Express 定位

### 1. Express 和 Koa 的核心区别是什么？

Express 内置路由（`app.get/post`）+ 丰富的 req/res 增强方法；Koa 极轻（只提供 context + 中间件机制），路由靠 @koa/router。洋葱模型两者都用，但 Express 4 需要第三方包才支持 async（Express 5 原生）、Koa 天生 async。生态：Express 更成熟（中间件海量）；Koa 更现代。选 Express 求稳求全，选 Koa 求轻求控制。

**来源**：Koa GitHub README — "Why not Express?"; Express 5 migration guide

### 2. Express 适合什么场景？不适合什么场景？

**适合**：REST API、BFF 层、小型全栈应用、快速原型、微服务。**不适合**：需要 WebSocket 强实时的（用 Socket.IO/NestJS）、需要 DI/装饰器架构的企业应用（用 NestJS）、纯 GraphQL server（用 Apollo/yoga）。Express 哲学是"极简不锁"，大型团队可能需要 NestJS 的约束。

**来源**：Express official docs — "Express applications"; NestJS docs — "Why NestJS?"

---

## 二、Express 5 vs 4 变化

### 3. Express 5 的 async 错误处理原理是什么？

handler 的返回值如果是 thenable（有 `.then` 方法），Express 5 内部自动 `Promise.resolve(result).catch(next)`——即 Promise reject → 调用 `next(err)` → 进入 error middleware。不需要 try/catch 也不需要 express-async-errors。注意：**只捕获 handler 返回的 Promise**，如果在 setTimout 里 throw 仍然捕获不到。

**来源**：Express GitHub PR #5347 — "feat: auto handle rejected promises"

### 4. path-to-regexp v8 为什么抛弃 `*` 和 `+` 语法？

v8 重构为**命名捕获 + 显式修饰符**：花括号 `{:name(regex)}` 把参数声明限定在 `{}` 内，消除以前 `:name*` 里 `*` 和通配路径混淆的歧义。另外 v8 的 path 解析完全 **不用 regex**（逐段匹配）——性能更好且可反向生成路径（`pathToRegexp.path(params)`）。

**来源**：path-to-regexp GitHub README — "Syntax changes"

### 5. Express 5 为什么把 req.query 默认改为 qs？

`querystring` 只支持扁平 `a=1&b=2`；`qs` 支持嵌套 `filter[brand]=nike&filter[price][gt]=100` → 对象/数组自动解析。前端传复杂筛选条件（如 Element/Ant Design 表格的 filter 参数）时无需手动 JSON.parse → 开发体验提升。

**来源**：Express 5 migration guide — "Query Parser"; qs GitHub README

---

## 三、路由语法

### 6. 如何写一个匹配 `/blog/2024/01/hello-world` 的路由并解出三个参数？

```js
app.get('/blog/{:year}/{:month}/{:slug}', (req, res) => {
  // req.params = { year: '2024', month: '01', slug: 'hello-world' }
});
```

Express 5 里花括号是可选的参数声明语法（`{:name}`），也可简写 `/:year/:month/:slug`（无正则时效果相同）。

**来源**：Express Routing guide; path-to-regexp v8 docs

### 7. `app.use('/api', router)` 和 `app.get('/api/*', handler)` 有什么区别？

`app.use` 匹配 **路径前缀**（不含正则），并在 router 内截去前缀（req.url 相对）；`app.get('/api/*')` 是精确路由注册 + Express 5 通配（`{*name}`）。`use` 可挂载整个 Router 实例（模块化）；`get` 只注册一条路由。`use` 不区分 HTTP 方法；`get` 只匹配 GET。

**来源**：Express 5 API reference — "app.use" / "app.METHOD"

---

## 四、中间件概念

### 8. 什么是"中间件"？为什么叫"洋葱模型"？

中间件 = `(req, res, next) => {}` 函数，按注册顺序串行执行。洋葱模型：请求**由外向内**穿过每一层中间件（`next()` 之前 = 进入），到最内层 handler → 响应**由内向外**返回（`next()` 之后 = 退出）。像穿过一个多层洋葱。好处：横切关注（日志/鉴权/错误处理）不侵入业务代码。

**来源**：Koa guide — "Middleware concepts"; Express middleware guide

### 9. 错误处理中间件必须注册在最后吗？

**强烈建议**。如果在业务路由之前注册 error middleware，它仍然只能捕获**已经经过它的**路由中抛出的错误。Express 按注册顺序匹配——error middleware 前面的路由抛错 → 如果 error middleware 还没注册 → 漏捕。放在最末尾确保捕获所有。

**来源**：Express error handling guide

---

## 五、生态

### 10. Express 项目里 body-parser 还需要单独安装吗？

不需要。Express 4.16+ 内置 `express.json()` / `express.urlencoded()` / `express.text()` / `express.raw()`——都是 body-parser 的重新导出。直接用 `app.use(express.json())` 即可。

**来源**：Express 4.x — "Built-in middleware"

### 11. 如何优雅关闭 Express 服务？

```js
const server = app.listen(PORT);
process.on('SIGTERM', () => {
  server.close(() => {
    // 所有已有连接处理完毕 → 关 DB 池 → exit
    db.end().then(() => process.exit(0));
  });
});
```

`server.close()` 停止 accept 新连接 + 等待已有请求完成 → 回调里释放资源。配合 `--force` 超时兜底。

**来源**：Node.js HTTP server docs — "server.close()"; NearForm — "Node.js graceful shutdown"

### 12. Express 和 NestJS 的关系？新项目怎么选？

NestJS **底层默认用 Express**（可切换到 Fastify）——它是在 Express 之上加了 DI、装饰器、模块化、守卫/拦截器/管道体系。小项目 / BFF / API gateway → Express 足矣。大型企业 / DDD / 复杂鉴权/队列/微服务 → NestJS 提供架构约束。Express 5 发布后两者差距缩小（async 错误处理对齐）。

**来源**：NestJS docs — "Platform Express"; Express 5 announcement blog
