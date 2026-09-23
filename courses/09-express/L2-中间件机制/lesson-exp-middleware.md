# Express 中间件深入：自定义与组合

> 目标：**编写高质量自定义中间件**——理解签名约定、参数解析、异步安全、错误传播、复用与组合模式；掌握第三方中间件的包装与适配。

---

## 一、中间件签名与分类

### 1.1 五种函数签名

```js
// 普通中间件
(req, res, next) => { ... next(); }

// 路由 handler
(req, res) => { res.json(...); }  // 不调 next 即终止

// 错误处理中间件（必须 4 参数！）
(err, req, res, next) => { ... }

// 异步中间件（Express 5 自动捕获）
async (req, res) => { await doSomething(); res.json(...); }

// 工厂函数（返回中间件）
function options(opts) { return (req, res, next) => { ... } }
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
import { randomUUID } from 'crypto';

export function requestId(req, res, next) {
  req.id = req.get('X-Request-Id') || randomUUID();
  res.set('X-Request-Id', req.id);
  next();
}
```

### 2.2 响应时间中间件

```js
export function responseTime(req, res, next) {
  const start = performance.now();
  res.on('finish', () => {
    const dur = (performance.now() - start).toFixed(2);
    res.set('X-Response-Time', `${dur}ms`);
    // 注意：finish 后 res.set 已无效——改用 locals 在 json/send 前设
  });
  next();
}
```

更优写法（monkey-patch `res.json`）：
```js
export function responseTime(req, res, next) {
  const start = performance.now();
  const origJson = res.json.bind(res);
  res.json = (body) => {
    res.set('X-Response-Time', `${performance.now() - start}ms`);
    return origJson(body);
  };
  next();
}
```

### 2.3 限流中间件

```js
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15min
  max: 100,                   // 每 IP 最多 100 次
  standardHeaders: true,       // RateLimit-* 头
  legacyHeaders: false,
});
app.use('/api/', limiter);
```

### 2.4 请求验证中间件

```js
export function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        errors: error.details.map(d => d.message),
      });
    }
    req.body = value;  // 用清洗后的值覆盖
    next();
  };
}

// 使用
import Joi from 'joi';
const UserSchema = Joi.object({ email: Joi.string().email().required(), age: Joi.number().min(0) });
app.post('/users', validate(UserSchema), createUser);
```

---

## 三、中间件组合模式

### 3.1 compose 工具（从右到左 / 从内到外）

```js
// 简化版 compose（类似 Koa）
function compose(middlewares) {
  return function (req, res, next) {
    let index = -1;
    function dispatch(i) {
      if (i <= index) return next(new Error('next() called multiple times'));
      index = i;
      const fn = middlewares[i] || next;
      if (i === middlewares.length) return next();
      try { return fn(req, res, dispatch.bind(null, i + 1)); }
      catch (err) { return next(err); }
    }
    dispatch(0);
  };
}
```

### 3.2 条件执行

```js
function conditional(check, ...middlewares) {
  return (req, res, next) => {
    if (check(req)) {
      compose(middlewares)(req, res, next);
    } else {
      next();
    }
  };
}

// 用法：仅 POST 请求验证 JSON body
app.use(conditional(req => req.method === 'POST', express.json(), validate(schema)));
```

---

## 四、异步安全陷阱

### 4.1 Unhandled Rejection（Express 4 遗留问题）

即使在 Express 5 中，**脱离 Promise 链的异步代码**仍然不被捕获：

```js
// ❌ 这个 setTimeout 里的错误不被 Express 捕获
app.get('/bad', async (req, res) => {
  setTimeout(() => { throw new Error('💥'); }, 100);
  res.send('ok');
});

// ✅ 正确做法：用 Promise 包装
app.get('/good', async (req, res) => {
  await new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error('💥')), 100);
  });
});
```

### 4.2 竞态条件

```js
// ❌ 两个 await 间 req 可能已被修改
app.get('/race', async (req, res) => {
  const user = await getUser(req.params.id);
  // 此时 req.body 可能已被另一中间件清理
  await updateOrder(req.body.orderId, user.id);
  res.json({ ok: true });
});
```

---

## 五、第三方中间件适配

### 5.1 Connect 风格 → Express 5

Express 5 基于 `router`（原 `path-to-regexp` 重写）——但**接口兼容 Connect 中间件**。老中间件如 `cookie-parser`、`compression` 直接 `app.use()`。

### 5.2 把非 Express 适配器包进来（如 busboy 流式上传）

```js
import busboy from 'busboy';

export function upload(req, res, next) {
  const bb = busboy({ headers: req.headers, limits: { fileSize: 5 * 1024 * 1024 } });
  req.files = [];
  bb.on('file', (name, info) => { req.files.push({ name, filename: info.filename }); });
  bb.on('finish', () => next());
  bb.on('error', next);
  req.pipe(bb);
}
```

### 5.3 Express 中间件 → 非 Express 环境复用

写核心逻辑为纯函数 `(options) => (input) => output`，中间件只是适配层：

```js
// 核心
function makeFilter({ max }) {
  return (text) => text.slice(0, max);
}
// Express 适配
function filterBody(opts) {
  const filter = makeFilter(opts);
  return (req, res, next) => { req.body.text = filter(req.body.text); next(); };
}
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
