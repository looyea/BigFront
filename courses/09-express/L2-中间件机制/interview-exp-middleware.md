# exp-middleware 面试题精选

> 共 15 题，覆盖 **中间件原理 / 自定义编写 / 异步安全 / 组合模式 / 执行顺序 / 性能** 六类。

---

## 一、中间件原理

### 1. Express 中间件的底层执行机制是什么？

`app._router.stack` 是一个 Layer 数组。请求进来 → `router.handle(req, res, done)` → 遍历 stack → 对每个 Layer 做 path 匹配 → 匹配成功就调 Layer.handle → 内部按 method 找 route → route 的 dispatch 串行调用 handlers（每个 handler 调 `next()` 才进下一个）。本质是**递归/回调链**——不是 Koa 的 async/await compose。

**来源**：Express source — `lib/router/layer.js` / `route.js`; StrongLoop — "Understanding Express Middleware"

### 2. `app.use('/path', mw)` 时 `/path` 的匹配规则是什么？

**前缀匹配**（非精确）——`/path` 匹配 `/path`、`/path/anything`、`/path?a=1`；不匹配 `/pathname`（要求 `/` 分隔）。正则也支持：`app.use(/^\/api/, mw)`。多个路径：`app.use(['/a','/b'], mw)`。

**来源**：Express API — "app.path" / "app.use"

---

## 二、自定义中间件

### 3. 如何写一个"只在 JSON 请求体大于 1KB 时才启用验证"的条件中间件？

```js
function conditionalValidate(check, ...mws) {
  return (req, res, next) => {
    if (!check(req)) return next();  // 不满足直接跳过
    compose(mws)(req, res, next);    // 满足才执行
  };
}
app.use(express.json());
app.use('/api', conditionalValidate(
  req => req.get('Content-Length') > 1024,
  schemaValidator
));
```

**来源**：Express middleware composition patterns

### 4. 为什么中间件工厂函数比直接导出更好？

工厂 `function limiter(opts) { return mw }` → 每个使用点可传不同 opts（`/api` 限 100、`/login` 限 5）→ **一个逻辑多次配置**。直接导出的中间件无法参数化，除非用全局变量（耦合）。

**来源**：express-rate-limit docs — "Usage"; 设计模式 — "Factory Pattern"

---

## 三、异步安全

### 5. Express 4 里 async 中间件 unhandled rejection 为什么会让进程崩溃？

Node 15+ 默认 `--unhandled-rejections=throw` → 未 catch 的 rejection 变 uncaughtException → 进程崩。Express 4 不检查 handler 返回值 → async handler 返回的 Promise 没人 `.catch(next)` → 错误"漏出"。解决：`try/catch` 包裹或 `express-async-errors` monkey-patch Layer.handle。

**来源**：Node.js — "unhandledRejection"; express-async-errors GitHub README

### 6. 如果中间件里开了后台任务（不 await），如何确保错误不丢？

```js
app.post('/report', async (req, res) => {
  res.json({ status: 'accepted' });  // 先响应
  generateReport(req.body).catch(err => logger.error({ err }));  // 后台执行 + 显式 catch
});
```

不能用 next(err)（响应已发送）→ 必须自行 catch + 记日志 + 告警。或用 BullMQ/队列 → worker 里错误有重试。

**来源**：NearForm Node Best Practices — "Error handling"

---

## 四、组合模式

### 7. Koa 的 compose 和 Express 中间件链有什么异同？

| 维度 | Koa compose | Express |
| --- | --- | --- |
| 模型 | async/await 洋葱（next 返回 Promise）| 回调 next()（同步推进） |
| 后置代码 | `await next()` 之后 | 需 monkey-patch res.on('finish') |
| 错误 | try/catch 包裹 await next() | next(err) 显式传递 |
| 类型 | 必须 async | 可 sync 可 async |

Koa 洋葱更直觉（一处写前后逻辑）；Express 更灵活（error 链独立）。

**来源**：Koa guide — "Middleware"; koa-compose source

---

## 五、执行顺序

### 8. 如果两个中间件都匹配同一个请求，谁先执行？

**注册顺序决定执行顺序**。`app.use(mw1)` 写在 `app.use(mw2)` 前面 → 先执行 mw1。同一路径 `app.use` + `app.get` → `use` 先（Layer 排在 route 前面）。`app.get('/a', mw1, mw2, handler)` → mw1 → mw2 → handler。

**来源**：Express — "Middleware execution order"; "Routing guide"

---

## 六、性能

### 9. 中间件数量对性能有多大影响？如何优化？

每个 Layer 匹配 ~0.01ms（v8 逐段比较）——100 个中间件 ~1ms 开销，可忽略。真正慢的是中间件**内部逻辑**（DB 查询 / JSON.parse）。优化：① 只匹配特定路径（避免全局）；② 热路径精简（去掉 dev-only 中间件）；③ express.json 设 limit 防大包解析阻塞。

**来源**：Express Performance — "Best practice"; Webframe — "Express middleware performance"

### 10. 为什么 express.json() 应放在不需要 body 的路由后面？

如果 `GET /healthz` 也经过 `express.json()` → 即使没有 body 也会检查 Content-Type → 微小开销 + OPTIONS 预检可能误触发。最佳：把 body parser 挂载到 `/api` 前缀或需要的方法上：`app.post('/users', express.json(), handler)`。

**来源**：Express — "Route-level middleware"; body-parser docs

---

## 七、实战场景

### 11. 如何写一个请求体大小限制的中间件（不用 body-parser）？

```js
function limitBody(maxBytes) {
  return (req, res, next) => {
    let length = 0;
    req.on('data', chunk => {
      length += chunk.length;
      if (length > maxBytes) {
        req.destroy();
        res.status(413).json({ error: 'Payload Too Large' });
      }
    });
    next();
  };
}
```

实际生产用 `express.json({ limit })` 更完善（已处理 encoding/abort/timeout）。

**来源**：Node.js streams docs — "data event"; HTTP 413 MDN

### 12. 一个中间件如何"短路"不再往下传（不调 next 也不 res.end）？

不能这样——必须**结束响应**（res.send/json/end）或 **next()** 或 **next(err)**。三者都不调 → 请求挂起直到超时。如果只想阻止后续路由：`res.status(403).json(...)` 结束即可（没调 next → 链断）。

**来源**：Express — "Writing middleware"; NearForm — "Error handling"

---

## 补充（新专题 13-15）

### 13.  把"中间件组合"上升为架构语言：你的服务分层怎么用挂载顺序表达？

模型：一列 app.use 栈=从"网络协议"到"业务"的同心圆，越外圈越通用越无状态、越内圈越业务越有知。推荐分段：传输修正（trust proxy/keepAlive 观测）→ 观测（requestId  AsyncLocalStorage 起点、日志、指标——必须早，一切后续错误都要被记）→ 安全护栏（helmet/CORS/限流——在解析前，别让恶意 body 先消耗解析 CPU）→ 解析与校验（json/urlencoded+schema validate）→ 身份（session/auth 中间件产出 ctx.user）→ 授权细筛（路由级 requireRole）→ 业务路由 → 404 → 错误处理。三条例外规则要讲：① 昂贵解析可延迟（webhook 验签要在 json 解析前且用 raw type 定制）；② 观测永远在最外层（"日志中间件在错误中间件之后"=丢错误现场）；③ 分段即权限——外圈中间件全局拥有者单一（平台组），内圈路由级归业务组，CODEOWNERS 按段划。加分句：这套语言的价值在评审时——"这个新中间件进哪段、依赖哪段先跑"一句话定性，不需要读实现。

**来源**：Express 官方 middleware 文档；InfoQ《中间件即架构：Node 服务的一条栈》

### 14.  一个中间件从"能用"到"可复用可测试"，重构路径是什么？给一个你写过的例子。

例：内部 auth中间件（读 env 的 JWT_SECRET、直接查库、res 硬编码 401 形状）→ 可复用形态三步：① 依赖外移——工厂接收 { verify, getUser, onDeny }，不 import 具体 ORM 与常量（纯"策略消费器"）；② 输出协议化——失败只 next(apiError(401,...))，绝不自己 res 写响应（把"表现"还给错误层，一处错误形状全栈统一，也天然支持 SSE/非 JSON 场景）；③ 语义显式——req 上写什么（req.auth.user）、没写时下游怎么判，进 README 契约表。测试红利：单测不启 HTTP（造最小 req/res + 注入假 verify，毫秒级全覆盖）；集成测试换真依赖跑装配。通用判据背三条：不 import 配置常量、不直接终结响应、增强 req/res 有契约文档——中两条以上就值得抽包。加分收口："可复用"的反面不是耦合库，是耦合"这个项目当下"——时间、部署形态、错误协议。

**来源**：connect 设计文档；掘金《把公司鉴权中间件开源出去的三步重构》

### 15.  中间件栈腐化的典型病症有哪些？你在 Code Review 里守什么线？

病症五例：① 顺序依赖成谜——"必须放在 X 之后否则静默失灵"的知识只活在老员工脑子里（解药：装配点集中+每段一行注释+集成测试锁关键顺序）；② 隐式通信——res.locals 字段 A 写 B 读无契约（解药：ctx 命名空间+TS 类型）；③ 短路黑洞——某中间件条件不调 next 也不响应，请求悬挂超时（解药：每个分支必须"响应或 next"二选一，lint 规则/模板强制）；④ body 消费战争——验签要 raw、解析要 json，两个中间件抢同一个流（解药：type 函数定制解析、或 verify→parse 固化次序成公共段）；⑤ 栈膨胀——每人新增一个全局 use，30 层里一半对多数路由 no-op（解药：新增全局中间件需评审，能路由级不开全局门）。CR 守线三问：它进哪一段（层级）、它写 req/res 什么字段（契约）、它不调 next 的所有路径都有响应吗（终局）——三问答不上来就打回。本质：中间件是全局可变管道上的函数，不加纪律的"自由注册"必然滑向行为不可读。

**来源**：SegmentFault《我们的中间件顺序排查了三天》；InfoQ《Node 服务的技术债解剖》
