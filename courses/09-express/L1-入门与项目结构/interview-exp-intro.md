# exp-intro 面试题精选

> 共 15 题，覆盖 **Express 定位 / 5 vs 4 变化 / 路由语法 / 中间件概念 / 生态** 五类。

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

---

## 补充（新专题 13-15）

### 13.  有人断言"Express 是上个时代的框架，新项目该用 Fastify/Hono"，你怎么评价这句话？

先把"时代论"拆成三个可检验的子命题：① 性能——Fastify/Hono 确实快（路由基准 2-5 倍），但绝大多数业务的瓶颈在 DB 与外部调用，框架层每请求省 0.1ms 换不到架构级收益，除非你做的是边缘/高 QPS 网关；② 现代性——Express 5 补齐了 async 错误、具名通配、req.query 加固，"停在 2014"的说法过期了，但它确实没有 schema 校验、TS 优先、插件生命周期这些"默认包含"；③ 生态——Express 的中间件语义是事实标准（Hono/Fastify 都兼容/connect 风格），教程、招聘、老代码存量全网最大。我的结论分场景：给"团队+业务系统"选，Express 的"什么都不替你决定"反而是优点（认知成本与人员流动友好）；给"新起的高并发/边缘产品"选，Fastify/Hono 的默认现代件确实省组装功夫。最后亮判据：框架选型三问——团队谁熟、瓶颈在不在框架、三年后招人难不难——Express 在问一二上常赢。

**来源**：Express 官方 v5 发布说明；InfoQ《Node 框架竞争格局十年》

### 14.  Express 的"不置可否（unopinionated）"哲学，哪些地方是自由红利、哪些地方是长期债？

红利面：① 心智极小——只有"中间件+路由"两个概念，两小时上手、一周精通源码级排障（栈薄，出错能一眼望到底），这是大框架给不了的；② 组合自由——任何框架风格都能搭（Nest 骑在它上面、各种 MVC/三层/微框架都是它的下游），技术决策留在团队手里而不是框架里；③ 迁移友好——升级恐惧小（API 面窄），Express 4→5 破坏性集中在路由语法而非编程模型。债面：① 约定缺失=团队自己长约定——目录结构、错误体系、校验、配置全靠人肉纪律，新公司会把 20 个项目的 20 种写法重演；② 安全默认值弱——不装 helmet 就没有安全头，Nest/Fastify 类"默认安全"哲学更护新手；③ 无内置 DI/生命周期，可测试性要自己搭脚手架（app/listen 分离、composition root 全是社区约定）。工程答案：把"框架不给的"沉淀成公司内部 starter（选型固化+CI 门禁），自由的红利用在业务演进、自由的债用模板偿还——这才是对"unopinionated"的成熟态度。

**来源**：Express 设计哲学讨论（TJ/官方 README）；知乎《Express 为什么什么都能干也什么都得自己干》

### 15.  从 Express 4 升级到 5，你给团队做的升级评估报告会包含哪些内容？

报告四段：① 变更清单按"爆炸半径"分级——破坏性（路由语法：匿名 */ 前缀 * / 内嵌正则全部失效，req.query 只读+null 原型，res.obj 移除、render 异步化、removed 方法如 app.del）为红级；行为变化（async 错误自动捕获后你们手写的 wrap 中间件变多余、possible 双重处理）为黄级；新增能力为绿级。② 依赖体检——中间件生态的兼容性扫描：凡依赖 qs 原型可写、手拼 req.query、用了废弃 res.status(...).json 链的包（老版 cors/morgan 定制 fork）先锁问题清单；express-async-errors 这类补丁包升级后必须移除（与 v5 内建机制冲突）。③ 回归策略——先跑路由快照测试（所有注册路由打一遍 404/405 断言），再灰度：v4/v5 双版本并行部署按流量比例切换，重点盯错误率与新错误签名。④ 决策与工时——把"不升的收益"也写进去（安全修复停发、qs 污染面），给迁移工时估区间、标出你们项目最疼的三处（通常是正则路由与 query 手改），最后给 go/no-go 建议。加分句：升级报告的价值不是罗列 breaking changes，而是把官方 changelog 翻译成"我们这个代码库的影响面地图"。

**来源**：Express 官方 Migrating from 4.x to 5.x 指南；SegmentFault《Express 5 升级踩坑实录》
