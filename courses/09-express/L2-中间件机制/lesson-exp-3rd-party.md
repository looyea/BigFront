# 第三方中间件集成与生态

> 目标：**选型并集成 Express 生态中最常用的第三方中间件**——cookie/session、CSRF、文件上传(multer)、请求限流、压缩、日志(winston/pino)、健康检查、GraphQL 挂载。

---

## 一、Cookie & Session

### 1.1 cookie-parser

```bash
# 目的：安装 cookie 解析中间件
npm i cookie-parser
```

```js
// 目的：解析并签名验证 Cookie
import cookieParser from 'cookie-parser';
app.use(cookieParser('secret-for-signing'));  // ✅ 传密钥后 signed:true 的 cookie 才能验签防篡改

// 设置
res.cookie('theme', 'dark', { maxAge: 900000, httpOnly: true, signed: true });  // ✅ httpOnly 防 JS 读、signed 防篡改
// 读取
req.cookies.theme;        // ✅ 普通 cookie
req.signedCookies.theme;  // ✅ 验签通过后才取值（篡改则此处为 undefined）
// ❌ cookieParser 未传密钥却用了 signed:true → signedCookies 拿不到值（无法验签）
// ❌ 不装 cookieParser 直接读 req.cookies → 永远 undefined
```

### 1.2 express-session

```bash
# 目的：安装 session + Redis 存储
npm i express-session connect-redis redis
```

```js
// 目的：用 Redis 做 session 存储——多进程/多实例共享会话，重启不丢登录态
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';

const redisClient = createClient({ url: process.env.REDIS_URL });
await redisClient.connect();                 // ✅ 未 connect 就使用会报 client hasn't connected

app.use(session({
  store: new RedisStore({ client: redisClient }),   // ✅ 会话存 Redis，而非进程内存
  secret: process.env.SESSION_SECRET,               // ✅ 签名 session ID cookie
  resave: false,                                    // ✅ 未变不重复写回
  saveUninitialized: false,                          // ✅ 未登录不空写一条 session
  cookie: { secure: 'auto', httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },  // ✅ https 下自动 secure
}));

// 使用
req.session.userId = user.id;   // ✅ 登录：往 session 挂身份
req.session.destroy();           // ✅ 登出：销毁服务端 session
// ❌ 用默认 MemoryStore 上多进程 → 每个 worker 各自一份 session，A 登录 B 不认识，时而登录成功时而掉线
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
// 目的：极简 CSRF 防护—非幂等方法校验 Origin/Referer 是否在白名单
function csrfProtection(allowedOrigins) {
  return (req, res, next) => {
    if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();   // ✅ 安全方法直接放行
    const origin = req.get('Origin') || req.get('Referer');              // ✅ 现代浏览器跨站发请求会带 Origin
    if (!origin || !allowedOrigins.some(o => origin.startsWith(o))) {
      return res.status(403).json({ error: 'CSRF check failed' });      // ✅ 不在白名单就 403 短路
    }
    next();
  };
}
app.use(csrfProtection(['https://myapp.com', 'http://localhost:5173']));
// ❌ 有些旧浏览器/非浏览器请求不带 Origin也不带 Referer → origin 为空被误拦，需按场景权衡放行策略
```

---

## 三、文件上传：multer

```bash
# 目的：安装 multipart 文件上传中间件
npm i multer
```

```js
// 目的：配磁盘存储 + 大小/类型限制，避免恶意上传打爆磁盘
import multer from 'multer';
import { extname, join } from 'path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),   // ✅ 固定目录（需预先存在）
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);  // ✅ 时间戳+随机防重名覆盖
    cb(null, unique + extname(file.originalname));                      // ✅ 只取扩展名，不直接用用户文件名的路径部分
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },  // ✅ 单文件10MB/最多5个，超出报错
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    if (allowed.test(extname(file.originalname)) && allowed.test(file.mimetype)) {
      cb(null, true);                             // ✅ 扩展名与 MIME 都合法才接受
    } else {
      cb(new Error('Only images allowed'));       // ✅ 传 err 给 cb → 路由 handler 不执行，转 next(err)
    }
  }
});

// 单文件
app.post('/avatar', upload.single('avatar'), (req, res) => {   // ✅ 字段名要与表单 name 一致
  res.json({ path: req.file.path });
});

// 多文件
app.post('/gallery', upload.array('photos', 5), handler);      // ✅ 同名多文件，最5张

// 混合字段
app.post('/profile', upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
]), handler);   // ✅ 不同字段各一个 → req.files 为 { avatar:[...], cover:[...] }
// ❌ 上传 multipart 却没挂对应 multer → req.file/req.files 均 undefined；form 字段名与 single('avatar') 不也是
```

---

## 四、日志：pino

```bash
# 目的：安装结构化日志
npm i pino pino-http express
```

```js
// 目的：每请求自动记结构化日志 + 分配 requestId + 对敏感头脱敏
import pino from 'pino';
import { pinoHttp } from 'pino-http';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });   // ✅ 统一日志级别

app.use(pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),  // ✅ 沿用上游 ID，方便跨服务串联
  customLogLevel: (req, res, err) => {
    if (err) return 'error';                 // ✅ 有错→error
    if (res.statusCode >= 400) return 'warn'; // ✅ 4xx→warn
    return 'info';
  },
  redact: ['req.headers.authorization', 'req.headers.cookie'],   // ✅ 隐藏凭证，防止日志里落明文 token
}));

// 业务代码里用
app.get('/users', (req, res) => {
  req.log.info('fetching users');  // ✅ 自动带 requestId 的结构化 JSON → stdout → Loki/Datadog
  ...
});
// ❌ 日志不 redact 敏感头 → authorization/cookie 明文落盘，日志系统成新的泄露源
```

**pino vs winston vs morgan**：pino（JSON、极快、适合 ELK/Loki）> winston（多功能但慢）> morgan（只记 HTTP 访问日志）。

---

## 五、健康检查

```bash
# 目的：（可选）安装现成健康检查包，下文手写更可控
npm i express-healthcheck
```

或手写（推荐）：

```js
// 目的：暴露两个探针——liveness 只判存活，readiness 包含依赖探测
import { Router } from 'express';
const healthRouter = Router();

healthRouter.get('/healthz', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });   // ✅ 进程活着就回 200（不查外部）
});

healthRouter.get('/readyz', async (req, res) => {
  try {
    await db.query('SELECT 1');                    // ✅ 探测 DB 连通性
    res.json({ status: 'ready' });                 // ✅ 就绪才回 200
  } catch (e) {
    res.status(503).json({ status: 'not ready', error: e.message });  // ✅ 503 让 K8s readiness 摘流
  }
});

app.use(healthRouter);
// ❌ /healthz(liveness) 里去查 DB → DB 抖动时 K8s 会直接重启容器而非摘流，健检风暴把小故障放大成雪崩
```

`/healthz` = liveness（进程活着）；`/readyz` = readiness（能处理请求）。K8s/Docker 探针用不同 endpoint。

---

## 六、压缩

```bash
# 目的：安装响应压缩中间件
npm i compression
```

```js
// 目的：自定义压缩阈值与等级
import compression from 'compression';
app.use(compression({
  threshold: 1024,  // ✅ 小于 1KB 不压缩（压缩反而因头开销变大）
  level: 6,          // ✅ gzip 等级 1-9，6 为性能/压缩比平衡
}));
// ❌ 对已压缩资源（图片/zip）再压缩白白耗 CPU，compression 默认会跳过，但自定义 filter 时要留意
```

**与 Nginx/CDN 的关系**：如果前面有 Nginx `gzip on` 或 CDN 自动压缩 → Express 的 compression 就多余（省 CPU）。

---

## 七、GraphQL 共存

```bash
# 目的：安装 Apollo Server（与 Express 共存）
npm i @apollo/server express
```

```js
// 目的：把一个 GraphQL 端点挂到现有 Express，与 REST 并行
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';

const server = new ApolloServer({ typeDefs, resolvers });
await server.start();      // ✅ 必须先 start 再挂载，否则报 “Cannot use … before it has been started”

// ✅ 挂到现有 Express
app.use('/graphql', expressMiddleware(server, {
  context: async ({ req }) => ({ user: await auth(req.token) }),   // ✅ 每个请求注入鉴权上下文
}));
// ❌ expressMiddleware 需要 body-parser 先解析好 POST body（GraphQL 走 application/json），漏挂会拿不到 query
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
