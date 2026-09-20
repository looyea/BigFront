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
// src/app.js
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

// 全局中间件
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: process.env.CLIENT_URL }));

// 业务路由
app.use('/api', routes);

// 404 兜底
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

// 全局错误处理
app.use(errorHandler);

export default app;
```

```js
// src/server.js
import app from './app.js';
import { PORT } from './config/index.js';

const server = app.listen(PORT, () => {
  console.log(`Server ready on :${PORT}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
```

**为什么分离**：测试时 `import app from './app.js'` + supertest 不需要真正 listen。

---

## 三、中间件执行模型（洋葱圈）

```js
app.use((req, res, next) => {
  console.log('← 请求进来');    // 1
  next();                       // 交给下一个
  console.log('→ 响应出去');    // 4（返回后）
});
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
npm i helmet
```

```js
import helmet from 'helmet';
app.use(helmet());  // 设置 CSP/X-Frame-Options/X-Content-Type 等安全头
```

### 4.2 CORS

```bash
npm i cors
```

```js
import cors from 'cors';
app.use(cors({
  origin: ['http://localhost:5173', 'https://myapp.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
```

### 4.3 日志

```bash
npm i morgan
```

```js
import morgan from 'morgan';
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
```

### 4.4 静态文件

```js
app.use('/uploads', express.static('public/uploads', {
  maxAge: '7d',
  etag: true,
}));
```

### 4.5 Body 解析

```js
app.use(express.json({ limit: '1mb' }));           // JSON body
app.use(express.urlencoded({ extended: true }));    // form 表单
```

### 4.6 压缩

```bash
npm i compression
```

```js
import compression from 'compression';
app.use(compression());  // gzip/brotli 自动压缩响应
```

---

## 五、路由模块化

```js
// src/routes/index.js
import { Router } from 'express';
import userRoutes from './users.js';
import productRoutes from './products.js';

const router = Router();
router.use('/users', userRoutes);
router.use('/products', productRoutes);
export default router;
```

```js
// src/routes/users.js
import { Router } from 'express';
import { getUsers, getUserById } from '../controllers/userController.js';

const router = Router();
router.get('/', getUsers);
router.get('/:id', getUserById);
export default router;
```

---

## 六、环境变量管理

```js
// src/config/index.js
import 'dotenv/config';  // npm i dotenv

export const {
  PORT = 3000,
  NODE_ENV = 'development',
  DB_URL,
  JWT_SECRET,
  CLIENT_URL = 'http://localhost:5173',
} = process.env;
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
