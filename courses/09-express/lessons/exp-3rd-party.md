# 第三方中间件集成与生态

> 目标：**选型并集成 Express 生态中最常用的第三方中间件**——cookie/session、CSRF、文件上传(multer)、请求限流、压缩、日志(winston/pino)、健康检查、GraphQL 挂载。

---

## 一、Cookie & Session

### 1.1 cookie-parser

```bash
npm i cookie-parser
```

```js
import cookieParser from 'cookie-parser';
app.use(cookieParser('secret-for-signing'));  // 签名防篡改

// 设置
res.cookie('theme', 'dark', { maxAge: 900000, httpOnly: true, signed: true });
// 读取
req.cookies.theme;        // 普通
req.signedCookies.theme;  // 签名验证后取值
```

### 1.2 express-session

```bash
npm i express-session connect-redis redis
```

```js
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';

const redisClient = createClient({ url: process.env.REDIS_URL });
await redisClient.connect();

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: 'auto', httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },
}));

// 使用
req.session.userId = user.id;   // 登录
req.session.destroy();           // 登出
```

**生产必须**：Redis（或 memcached）共享 session——多进程 / 多实例才能保持一致。

---

## 二、CSRF 保护

### 2.1 csurf（已 deprecated）→ 替代方案

csurf 2024 年归档。替代：
- **双重提交 Cookie**（Double Submit Cookie）；
- **Origin 检查**（现代浏览器 same-origin fetch 自动带 Origin 头）；
- **JWT in Authorization header**（天然免疫 CSRF）。

### 2.2 最小 Origin 检查中间件

```js
function csrfProtection(allowedOrigins) {
  return (req, res, next) => {
    if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
    const origin = req.get('Origin') || req.get('Referer');
    if (!origin || !allowedOrigins.some(o => origin.startsWith(o))) {
      return res.status(403).json({ error: 'CSRF check failed' });
    }
    next();
  };
}
app.use(csrfProtection(['https://myapp.com', 'http://localhost:5173']));
```

---

## 三、文件上传：multer

```bash
npm i multer
```

```js
import multer from 'multer';
import { extname, join } from 'path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },  // 10MB/5个
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    if (allowed.test(extname(file.originalname)) && allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'));
    }
  }
});

// 单文件
app.post('/avatar', upload.single('avatar'), (req, res) => {
  res.json({ path: req.file.path });
});

// 多文件
app.post('/gallery', upload.array('photos', 5), handler);

// 混合字段
app.post('/profile', upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
]), handler);
```

---

## 四、日志：pino

```bash
npm i pino pino-http express
```

```js
import pino from 'pino';
import { pinoHttp } from 'pino-http';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

app.use(pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
  customLogLevel: (req, res, err) => {
    if (err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  redact: ['req.headers.authorization', 'req.headers.cookie'],
}));

// 业务代码里用
app.get('/users', (req, res) => {
  req.log.info('fetching users');  // 结构化 JSON → stdout → Loki/Datadog
  ...
});
```

**pino vs winston vs morgan**：pino（JSON、极快、适合 ELK/Loki）> winston（多功能但慢）> morgan（只记 HTTP 访问日志）。

---

## 五、健康检查

```bash
npm i express-healthcheck
```

或手写（推荐）：

```js
import { Router } from 'express';
const healthRouter = Router();

healthRouter.get('/healthz', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

healthRouter.get('/readyz', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ready' });
  } catch (e) {
    res.status(503).json({ status: 'not ready', error: e.message });
  }
});

app.use(healthRouter);
```

`/healthz` = liveness（进程活着）；`/readyz` = readiness（能处理请求）。K8s/Docker 探针用不同 endpoint。

---

## 六、压缩

```bash
npm i compression
```

```js
import compression from 'compression';
app.use(compression({
  threshold: 1024,  // <1KB 不压缩
  level: 6,
}));
```

**与 Nginx/CDN 的关系**：如果前面有 Nginx `gzip on` 或 CDN 自动压缩 → Express 的 compression 就多余（省 CPU）。

---

## 七、GraphQL 共存

```bash
npm i @apollo/server express
```

```js
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';

const server = new ApolloServer({ typeDefs, resolvers });
await server.start();

// 挂载到现有 Express
app.use('/graphql', expressMiddleware(server, {
  context: async ({ req }) => ({ user: await auth(req.token) }),
}));
```

一个 Express app 同时有 REST `/api/*` + GraphQL `/graphql`。

---

## 八、选型决策表

| 需求 | 推荐 | 备注 |
| --- | --- | --- |
| 日志 | pino | JSON 结构化 |
| 安全头 | helmet | 一行搞定 |
| CORS | cors | 白名单 origin |
| 限流 | express-rate-limit | Redis store 多实例 |
| 上传 | multer | 限制大小/类型 |
| Session | express-session + Redis | 多进程安全 |
| 压缩 | compression | 或直接交给 Nginx |
| 参数校验 | zod / joi | 纯函数可脱离 Express |
| 健康检查 | 手写 | 检查 DB/Redis/下游 |
| 监控 | Sentry + Prometheus | Error + Metrics + Tracing |

---

## 九、自检清单

- [ ] signed cookie 防什么？能防 XSS 偷 cookie 吗？
- [ ] multer 的 fileFilter 拒绝文件后错误如何传递？
- [ ] 为什么 session store 要 Redis？用默认 MemoryStore 有什么问题？
- [ ] `/healthz` 和 `/readyz` 的区别？
- [ ] JWT 方案天然免疫 CSRF 的原理？
- [ ] pino-http 的 genReqId 有什么意义？

---

## 🚀 部署预告

- **uploads 目录**：容器环境用 volume 挂载 / 或直接传 S3/OSS（multer-s3）；
- **Redis session**：部署时 REDIS_URL 走 env → K8s Secret；
- **日志采集**：pino → stdout → Docker json-file / Fluentd → Loki；
- **监控**：Prometheus `/metrics` endpoint（express-prom-bundle）→ ServiceMonitor → Alert。

下一关进入 L3（Request / Response / Upload 高级用法）。
