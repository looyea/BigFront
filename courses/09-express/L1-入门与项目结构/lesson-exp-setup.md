# Express 项目结构与中间件装配

> 目标：**设计清晰的 Express 5 项目目录结构**；理解"中间件即一切"的哲学；装配 body parser、CORS、日志、静态文件、路由模块化。

---

## 一、推荐项目结构

```
my-api/
├── src/
│   ├── app.js            ← 创建 app 实例（导出供 server 和测试用）
│   ├── server.js         ← 启动 HTTP server（listen）
│   ├── config/
│   │   └── index.js      ← 环境变量聚合
│   ├── routes/
│   │   ├── index.js      ← 路由注册中心
│   │   ├── users.js
│   │   └── products.js
│   ├── controllers/
│   │   ├── userController.js
│   │   └── productController.js
│   ├── services/
│   │   └── userService.js
│   ├── middlewares/
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── validate.js
│   ├── models/
│   │   └── User.js
│   └── utils/
│       └── logger.js
├── public/               ← 静态文件
├── views/                ← 模板（如果用 EJS/Nunjucks）
├── tests/
│   ├── users.test.js
│   └── app.test.js
├── .env
├── .gitignore
├── package.json
└── eslint.config.js
```

### 分层职责

| 层 | 职责 | 不该做 |
| --- | --- | --- |
| **routes** | URL pattern → controller 映射 | 不写业务逻辑 |
| **controllers** | 取 req 数据 → 调 service → 返 res | 不直接操作 DB |
| **services** | 业务逻辑、编排 | 不碰 req/res 对象 |
| **models** | 数据访问（ORM/DB 查询） | 不含 HTTP 概念 |
| **middlewares** | 横切关注（鉴权/日志/校验） | 不返回业务数据 |

---

## 二、app.js / server.js 分离

```js
// 目的：组装 app——只创建实例、挂中间件与路由、导出，绝不 listen（listen 交给 server.js，测试才能 import 而不占端口）
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

// 全局中间件（顺序即执行顺序，见第三节洋葱圈）
app.use(morgan('dev'));                       // ✅ 每请求打印方法/路径/状态/耗时
app.use(express.json({ limit: '1mb' }));      // ✅ 解析 JSON body → req.body；限 1mb 防大包打爆内存
app.use(cors({ origin: process.env.CLIENT_URL }));  // ✅ 只放行白名单源

// 业务路由
app.use('/api', routes);                      // ✅ 所有 /api/* 转给模块化 router

// 404 兜底（必须放在所有路由之后！）
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));  // ✅ 前面都没命中才到这

// 全局错误处理（四参数签名，放最后）
app.use(errorHandler);                        // ✅ (err,req,res,next) 接管前面 next(err) 抛出的错误

export default app;                            // ✅ 导出实例供 server.js listen、测试 supertest 直接注入
// ❌ 404 兜底若写在 app.use('/api',...) 之前 → 每个请求都先命中它返回 404，业务路由永远跑不到
```

```js
// 目的：进程入口——唯一真正 listen 端口的地方，并挂优雅关闭
import app from './app.js';
import { PORT } from './config/index.js';

const server = app.listen(PORT, () => {   // ✅ 绑定端口开始监听，回调在就绪后打印
  console.log(`Server ready on :${PORT}`);
});

// 优雅关闭：收到停止信号时先让 server.close() 处理完在途请求，再退出进程
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));    // ✅ 不再接新连接，等在途请求 drain 完退出（PM2/Docker 停容器发 SIGTERM）
});
// ❌ 直接 process.exit(0) 不 close → 在途请求被硬切断，客户端收到连接重置
```

**为什么分离**：测试时 `import app from './app.js'` + supertest 不需要真正 listen。

---

## 三、中间件执行模型（洋葱圈）

```js
// 目的：演示洋葱圈——next() 之前=请求下行，next() 之后=响应上行
app.use((req, res, next) => {
  console.log('← 请求进来');    // 1 下行：请求阶段
  next();                       // ✅ 交棒给下一个中间件；漏调则请求挂起永无响应
  console.log('→ 响应出去');    // 4 上行：下游处理完回溯到这里
});
// ❌ 忘写 next() 且未 res.end/send → 请求石沉大海、浏览器一直转圈直到超时
```

完整顺序（简化）：
```
Request → morgan → cors → express.json → auth → route-handler → errorHandler → Response
                                                                        ↑ 只有出错才到这
```

### 中间件四种类型

| 类型 | 特征 | 示例 |
| --- | --- | --- |
| 应用级 | `app.use()` | logger, cors |
| 路由级 | 挂在特定路径 | `app.use('/admin', requireAuth)` |
| Router 级 | `router.use()` | 模块化子路由 |
| 错误处理 | **4 参数** `(err, req, res, next)` | 全局 catch |
| 内置 | `express.static()` / `express.json()` | 静态/解析 |
| 第三方 | body-parser, helmet, compression | npm 生态 |

---

## 四、常用中间件装配

### 4.1 安全

```bash
# 目的：安装安全头中间件
npm i helmet
```

```js
// 目的：helmet 一键设置一批安全响应头
import helmet from 'helmet';
app.use(helmet());  // ✅ 自动加 X-Content-Type-Options/X-Frame-Options/CSP 等，缓解点击劫持、MIME 嗅探
// ❌ helmet 要放最前面；若放在会 res.end 的中间件之后就加不上头
```

### 4.2 CORS

```bash
# 目的：安装跨域中间件
npm i cors
```

```js
// 目的：配置 CORS 白名单——允许携带凭证时 origin 绝不能写 '*'
import cors from 'cors';
app.use(cors({
  origin: ['http://localhost:5173', 'https://myapp.com'],  // ✅ 显式白名单，命中才回 Access-Control-Allow-Origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'],               // ✅ 预检 OPTIONS 允许的动词
  credentials: true,                                       // ✅ 允许带 Cookie/Authorization
}));
// ❌ origin:'*' 同时 credentials:true → 浏览器直接拒绝带凭证跨域（规范冲突），前端拿不到 Set-Cookie
```

### 4.3 日志

```bash
# 目的：安装 HTTP 日志中间件
npm i morgan
```

```js
// 目的：按环境切换日志格式——开发详尽、生产机器可解析
import morgan from 'morgan';
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
// ✅ combined 含 IP/UA/耗时，供 ELK/Datadog 采集；dev 带颜色耗时便于本地看
```

### 4.4 静态文件

```js
// 目的：托管静态资源——给 URL 前缀 + 缓存策略
app.use('/uploads', express.static('public/uploads', {   // ✅ 请求 /uploads/x.png → 映射到磁盘 public/uploads/x.png
  maxAge: '7d',                                          // ✅ 响应带 Cache-Control:max-age，浏览器/CDN 缓存 7 天
  etag: true,                                            // ✅ 生成 ETag，支持 304 协商缓存
}));
// ❌ 路径参数写成绝对盘符或未部署该目录 → 命中不了文件，回落到底层 404
```

### 4.5 Body 解析

```js
// 目的：解析两种请求体——必须在读取 req.body 的路由/handler 之前挂载
app.use(express.json({ limit: '1mb' }));           // ✅ application/json → 填充 req.body 为对象
app.use(express.urlencoded({ extended: true }));    // ✅ form 表单提交（application/x-www-form-urlencoded）
// ❌ 漏挂 express.json → 即使请求带了 JSON，req.body 仍是 undefined，`req.body.name` 直接抛 TypeError
// ❌ body 超过 limit → 抛 entity.too.large(413)，需在上层 errorHandler 转成友好提示
```

### 4.6 压缩

```bash
# 目的：安装响应压缩中间件
npm i compression
```

```js
// 目的：gzip/brotli 压缩响应体，省带宽
import compression from 'compression';
app.use(compression());  // ✅ 客户端 Accept-Encoding 支持时对文本响应压缩（图片等已压缩格式自动跳过）
// ❌ 放在 res.end 之后或小响应（<1kb 阈值）上不加压缩属正常，非 bug
```

---

## 五、路由模块化

```js
// 目的：路由注册中心——把各资源子路由挂到统一前缀，保持 app.js 干净
import { Router } from 'express';
import userRoutes from './users.js';
import productRoutes from './products.js';

const router = Router();               // ✅ 独立路由实例，可嵌套 use
router.use('/users', userRoutes);      // ✅ /api/users/* → 转给 users.js
router.use('/products', productRoutes);
export default router;
```

```js
// 目的：users 子路由——只做 URL→handler 映射，逻辑下沉到 controller
import { Router } from 'express';
import { getUsers, getUserById } from '../controllers/userController.js';

const router = Router();
router.get('/', getUsers);             // ✅ 完整路径 = /api/users（前缀在 index.js 拼接）
router.get('/:id', getUserById);       // ✅ /api/users/5 → req.params.id === '5'
export default router;
// ❌ 这里的 '/:id' 若用 Express4 的 ':id*' 通配语法，v8 会抛 TypeError 拒绝注册
```

---

## 六、环境变量管理

```js
// 目的：集中读环境变量——给非敏感项默认值，敏感项留空由启动断言把关
import 'dotenv/config';  // ✅ 副作用导入：自动加载 .env 到 process.env（npm i dotenv）

export const {
  PORT = 3000,                    // ✅ 非敏感：缺省给默认值
  NODE_ENV = 'development',
  DB_URL,                         // ❗ 敏感/必填：无默认，取到 undefined 即暴露漏配
  JWT_SECRET,
  CLIENT_URL = 'http://localhost:5173',
} = process.env;
// ❌ 忘装/忘引 dotenv → DB_URL、JWT_SECRET 全 undefined，token 用 undefined 密钥签发，鉴权形同虚设
```

**规则**：永远从 `process.env` 读取 → 不硬编码 → `.env` 文件加 `.gitignore`。

---

## 七、ESLint + Prettier

```bash
npm i -D eslint prettier eslint-config-prettier
```

Express 项目推荐 ESLint Flat Config + `eslint:recommended` + `prettier`——避免 trailing semicolon / indent 等无意义争论。

---

## 八、自检清单

- [ ] app.js 和 server.js 为什么分离？
- [ ] 错误处理中间件的特征是什么？（参数个数）
- [ ] `express.json({ limit: '1mb' })` 防什么？
- [ ] helmet 做了什么？
- [ ] 路由级中间件 `app.use('/admin', ...)` 什么时候执行？
- [ ] 中间件里忘了调 `next()` 会怎样？

---

## 🚀 部署预告

生产环境中间件差异：
- `morgan('combined')` → 日志格式适配 ELK / Datadog 采集；
- `compression()` → 开启后 CDN 边缘节点也需配 `Vary: Accept-Encoding`；
- `helmet()` + `cors()` → 白名单域名写 env → 不给 `*`；
- `express.static()` → 通常**不在 Express 里 serve**——让 Nginx/CDN 直接处理。

下一关 `exp-routing` 详解路由各种玩法。
