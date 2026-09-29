# Express 中间件深入：自定义与组合

> 目标：**编写高质量自定义中间件**——理解签名约定、参数解析、异步安全、错误传播、复用与组合模式；掌握第三方中间件的包装与适配。

---

## 一、中间件签名与分类

### 1.1 五种函数签名

```js
// 目的：辨认五种签名——参数个数与形式决定 Express 如何对待这个函数
// 普通中间件
(req, res, next) => { ... next(); }              // ✅ 三参数，必须 next() 放行否则挂起

// 路由 handler
(req, res) => { res.json(...); }                 // ✅ 不调 next 即终止响应

// 错误处理中间件（必须 4 参数！）
(err, req, res, next) => { ... }                 // ✅ 只有四参数才被识别为错误中间件
// ❌ 少写一个参数变 (err, req, res) → 被当普通中间件，err 永远进不来

// 异步中间件（Express 5 自动捕获）
async (req, res) => { await doSomething(); res.json(...); }  // ✅ reject 自动转 next(err)

// 工厂函数（返回中间件）
function options(opts) { return (req, res, next) => { ... } }  // ✅ app.use(options({...}))
```

### 1.2 执行时机

| 注册方式 | 匹配规则 |
| --- | --- |
| `app.use('/path', mw)` | 前缀匹配 + 所有 HTTP 方法 |
| `app.get('/path', mw)` | 精确路径 + 仅 GET |
| `router.use(mw)` | Router 内所有后续路由 |
| 参数 `router.param(name, mw)` | 路径含 `:name` 时触发 |

---

## 二、编写自定义中间件

### 2.1 请求 ID 中间件

```js
// 目的：给每个请求打唯一 ID——方便链路追踪，回写响应头供前端对账
import { randomUUID } from 'crypto';

export function requestId(req, res, next) {
  req.id = req.get('X-Request-Id') || randomUUID();  // ✅ 优先沿用上游传的，否则新生成
  res.set('X-Request-Id', req.id);                    // ✅ 回写响应头
  next();                                             // ✅ 必须放行
}
```

### 2.2 响应时间中间件

```js
// 目的：反例——用 res.on('finish') 计时
export function responseTime(req, res, next) {
  const start = performance.now();
  res.on('finish', () => {           // ⚠️ finish = 响应已发出
    const dur = (performance.now() - start).toFixed(2);
    res.set('X-Response-Time', `${dur}ms`);  // ❌ 此时头已发送，res.set 无效，客户端拿不到该头
  });
  next();
}
```

更优写法（monkey-patch `res.json`）：
```js
// 目的：正例——拦截 res.json，在真正发送前把耗时写进响应头
export function responseTime(req, res, next) {
  const start = performance.now();
  const origJson = res.json.bind(res);       // ✅ 存原始方法
  res.json = (body) => {
    res.set('X-Response-Time', `${performance.now() - start}ms`);  // ✅ 头还没发，set 生效
    return origJson(body);                    // ✅ 再走真正的发送
  };
  next();
}
// ❌ 若下游用 res.send/res.end 而非 res.json，此补丁不覆盖那些路径，头会缺失
```

### 2.3 限流中间件

```js
// 目的：每 IP 限流——抵御刷屏/暴力尝试，保护后端
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // ✅ 时间窗 15min
  max: 100,                   // ✅ 窗内每 IP 最多 100 次，超出返 429
  standardHeaders: true,       // ✅ 回 RateLimit-* 标准头
  legacyHeaders: false,
});
app.use('/api/', limiter);      // ✅ 挂在业务路由之前才拦得住
// ❌ 多进程/多实例时默认内存计数各自为政 → 实际限额翻倍，需换 Redis store
```

### 2.4 请求验证中间件

```js
// 目的：校验工厂——接一个 schema 返回中间件，非法直接 400，合法用清洗后的值覆盖 body
export function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });  // ✅ 一次收集所有错误
    if (error) {
      return res.status(400).json({          // ✅ 短路返回，不进业务 handler
        errors: error.details.map(d => d.message),
      });
    }
    req.body = value;  // ✅ 用白名单清洗后的值覆盖，剔除多余字段
    next();
  };
}

// ✅ 使用：把 validate 插在路由 handler 之前
import Joi from 'joi';
const UserSchema = Joi.object({ email: Joi.string().email().required(), age: Joi.number().min(0) });
app.post('/users', validate(UserSchema), createUser);
// ❌ validate 必须依赖 express.json() 已先把 req.body 解析好，顺序反了 req.body 是 undefined
```

---

## 三、中间件组合模式

### 3.1 compose 工具（从右到左 / 从内到外）

```js
// 目的：简化版 compose（类似 Koa）——把一组中间件串成一个函数，洋葱式进出
function compose(middlewares) {
  return function (req, res, next) {
    let index = -1;
    function dispatch(i) {
      if (i <= index) return next(new Error('next() called multiple times'));  // ✅ 防同一中间件重复 next
      index = i;
      const fn = middlewares[i] || next;
      if (i === middlewares.length) return next();   // ✅ 跑完全部 → 交回外层 next
      try { return fn(req, res, dispatch.bind(null, i + 1)); }  // ✅ 把“下一个”作为 newNext 传入
      catch (err) { return next(err); }              // ✅ 同步抛错转给外层 err
    }
    dispatch(0);
  };
}
// ❌ 子中间件里写了 await 但没被 dispatch 的 try 接住（异步 reject）→ 逃逸捕获，需自行包 Promise
```

### 3.2 条件执行

```js
// 目的：条件执行——只有 check(req) 为真才跑这组中间件，否则直接放行
function conditional(check, ...middlewares) {
  return (req, res, next) => {
    if (check(req)) {
      compose(middlewares)(req, res, next);   // ✅ 命中条件才串联执行
    } else {
      next();                                 // ✅ 不命中直接放行
    }
  };
}

// ✅ 用法：仅 POST 请求才去解析并验证 JSON body
app.use(conditional(req => req.method === 'POST', express.json(), validate(schema)));
```

---

## 四、异步安全陷阱

### 4.1 Unhandled Rejection（Express 4 遗留问题）

即使在 Express 5 中，**脱离 Promise 链的异步代码**仍然不被捕获：

```js
// 目的：理解 Express5 捕获边界——只接管当前 Promise 链上的错误
// ❌ 这个 setTimeout 里的错误不被 Express 捕获（脱离了 handler 的 Promise 链）
app.get('/bad', async (req, res) => {
  setTimeout(() => { throw new Error('💥'); }, 100);  // ❌ 回调在下一个宏任务里抛 → UncaughtException，进程崩
  res.send('ok');
});

// ✅ 正确做法：用 Promise 包装，让错误回到 await 链上→ Express 才能 catch(next)
app.get('/good', async (req, res) => {
  await new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error('💥')), 100);   // ✅ reject → handler 返回的 Promise 失败 → 自动转错误中间件
  });
});
```

### 4.2 竞态条件

```js
// 目的：竞态隐患——两个 await 之间 req 可能已被其它中间件改写
app.get('/race', async (req, res) => {
  const user = await getUser(req.params.id);
  // ⚠️ 此时 req.body 可能已被另一中间件清理/改写
  await updateOrder(req.body.orderId, user.id);   // ❌ req.body.orderId 可能已变 undefined
  res.json({ ok: true });
});
// ✅ 防竞态：进入 handler 先把需要的值缓存到局部变量（const orderId = req.body.orderId），后续不用 req.body
```

---

## 五、第三方中间件适配

### 5.1 Connect 风格 → Express 5

Express 5 基于 `router`（原 `path-to-regexp` 重写）——但**接口兼容 Connect 中间件**。老中间件如 `cookie-parser`、`compression` 直接 `app.use()`。

### 5.2 把非 Express 适配器包进来（如 busboy 流式上传）

```js
// 目的：把非 Express 的 busboy 流式解析包装成中间件—7 类适配器典型手法
import busboy from 'busboy';

export function upload(req, res, next) {
  const bb = busboy({ headers: req.headers, limits: { fileSize: 5 * 1024 * 1024 } });  // ✅ 限单文件 5MB
  req.files = [];                                          // ✅ 挂到 req 供下游读
  bb.on('file', (name, info) => { req.files.push({ name, filename: info.filename }); });  // ✅ 每收一个文件收集
  bb.on('finish', () => next());                          // ✅ 解析完才放行
  bb.on('error', next);                                   // ✅ 出错→ next(err) 转错误中间件
  req.pipe(bb);                                           // ✅ 把请求流灌进 busboy
}
// ❌ 未 pipe(req) → busboy 永远收不到数据，finish 不触发，请求挂起
```

### 5.3 Express 中间件 → 非 Express 环境复用

写核心逻辑为纯函数 `(options) => (input) => output`，中间件只是适配层：

```js
// 目的：核心逻辑与 Express 适配层分离—核心是纯函数，换个环境也能复用
// 核心（纯函数，无任何 req/res 概怒）
function makeFilter({ max }) {
  return (text) => text.slice(0, max);         // ✅ 输入输出都是普通值，可单测
}
// Express 适配层（仅把纯函数接到 req.body 上）
function filterBody(opts) {
  const filter = makeFilter(opts);              // ✅ 装配时一次性闭包住 filter
  return (req, res, next) => { req.body.text = filter(req.body.text); next(); };
}
// ❌ 若 req.body 未定义（无 Content-Type: application/json）就 .text → TypeError，应先确保 body 已解析
```

---

## 六、中间件注册最佳实践

| 顺序 | 中间件 | 原因 |
| --- | --- | --- |
| 1 | `helmet()` | 安全头最先设置 |
| 2 | `cors()` | OPTIONS 预检尽早返回 |
| 3 | `compression()` | 响应发送前压缩 |
| 4 | `express.json()` / `urlencoded()` | 解析 body |
| 5 | `morgan()` | 记日志（含 statusCode） |
| 6 | 自定义全局（requestId / responseTime） | 业务上下文 |
| 7 | 路由 | 业务逻辑 |
| 8 | 404 兜底 | 无任何路由命中时执行 |
| 9 | Error handler（4 参数） | 最后！ |

---

## 七、自检清单

- [ ] 错误中间件和普通中间件的参数区别？
- [ ] Express 5 能捕获 setTimeout 里的错误吗？
- [ ] 中间件工厂函数和直接导出的区别？
- [ ] `app.use` 和 `app.get` 在中间件匹配上有什么不同？
- [ ] 限流中间件放在路由前还是后？
- [ ] compose 的作用是什么？

---

## 🚀 部署预告

生产中间件精简：
- `morgan` → `morgan('combined')` + 重定向 stdout 到 file / Datadog agent；
- `rate-limit` → 换 Redis 存储（多进程/多实例共享计数）；
- `compression` → 或交给 Nginx/CDN 做（减轻 Node CPU）；
- `helmet` → 保留（无性能损耗）。

下一关 `exp-error` 专讲错误处理策略全貌。
