# L2 作业：中间件 / 错误处理 / 第三方集成

> 覆盖：exp-middleware / exp-error / exp-3rd-party

---

## 一、读代码（10 题）

### 1. 以下中间件链执行顺序是什么？请求 GET /api/users 时实际调用了哪几个？

```js
app.use(helmet());
app.use('/api', cors());
app.use(express.json());
app.use(logger);
app.get('/api/users', handler);
app.use(errorHandler);
```

### 2. 这个错误处理有什么问题？

```js
app.use((err, req, res, next) => {
  console.log(err);
  next(err);
});
app.use((err, req, res, next) => {
  res.status(500).json({ error: 'oops' });
});
```
（提示：第一个 handler 里只 console.log 没有 res 响应就结束了？）

### 3. 以下 setTimeout 的错误在 Express 5 中会被全局 error handler 捕获吗？

```js
app.get('/async-trap', (req, res) => {
  setTimeout(() => {
    throw new Error('💥 from timer');
  }, 100);
  res.send('ok');
});
```

### 4. multer 配置中，上传一个 15MB 文件后响应是什么？

```js
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});
app.post('/upload', upload.single('file'), (req, res) => res.json({ ok: true }));
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }
  next(err);
});
```

### 5. express-session + MemoryStore 部署到 pm2 -i 4 后，用户为什么有时登录后立刻 401？

### 6. 以下 pino 配置，输出的日志中 Authorization header 的值是什么？

```js
const logger = pino({ redact: ['req.headers.authorization'] });
// 请求带 Authorization: Bearer abc123
```

### 7. 这个限流配置的实际效果是什么？

```js
const limiter = rateLimit({ windowMs: 60000, max: 10 });
app.get('/api/search', limiter, handler);
```

### 8. cors 配置 credentials: true 但 origin: '*'，浏览器会允许请求通过吗？为什么？

### 9. 阅读以下代码，请求 POST /data 带 Content-Type: text/plain 时 req.body 是什么？

```js
app.use(express.json());
app.use(express.text({ type: 'text/plain' }));
app.post('/data', (req, res) => { res.json({ body: req.body }); });
```

### 10. `app.use(express.static('public', { maxAge: '1h', etag: false }))` 中 etag:false 的后果是什么？

---

## 二、手写（5 题）

### 1. 编写一个 requestId 中间件：优先从请求头 X-Request-Id 取值，没有则 crypto.randomUUID()，挂到 req.id 并设响应头。

### 2. 编写 HttpError 类（status/message/details/expose）+ 静态方法 + 全局 error handler。

### 3. 用 multer + file-type 实现安全图片上传：校验 magic bytes（只允许 JPEG/PNG/WebP），保存到 uploads/ 目录，文件名用 UUID + 真实扩展。

### 4. 配置 pino-http：生成 requestId、脱敏 password/authorization 字段、慢请求（>2s）用 warn 级别。

### 5. 写一个简易 Redis-backed 限流中间件（不用 express-rate-limit）：key=IP+route → Redis INCR + EXPIRE → 超限返回 429。

---

## 三、场景题（1 题）

### 1. 你的 Express API 上线后发现大量 500 错误（TypeError: Cannot read properties of undefined）。同时 unhandledRejection 导致进程频繁重启。写出从发现到解决的完整排查和修复步骤。

---

## 四、简答题（3 题）

### 1. Express 中间件注册顺序为什么重要？列出推荐的注册顺序。

### 2. Session-based 认证和 JWT 认证在 CSRF 防护上有什么本质区别？

### 3. /healthz（liveness）和 /readyz（readiness）在 Kubernetes 中的行为区别？

---

## 五、挑战题（1 题）

### 🏆 构建"Express 中间件工具箱"

创建一个可发布的 npm 包 `@yourname/express-toolkit`，包含：
- `requestId()` 中间件
- `responseTime()` 中间件
- `httpError(status, msg, details)` 类 + 工厂方法
- `globalErrorHandler(options)` 中间件（支持 onLog 回调）
- `slowQuery(thresholdMs)` 中间件
- 完整 TypeScript 类型声明
- 单元测试（supertest + vitest）
- README 含所有中间件使用示例
