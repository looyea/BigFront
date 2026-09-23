# L1 作业：Express 5 入门 / 项目结构 / 路由

> 覆盖：exp-intro / exp-setup / exp-routing

---

## 一、读代码（10 题）

### 1. 以下 Express 4 代码迁移到 Express 5 需要改哪几处？

```js
const app = require('express')();
app.del('/old-route', handler);
app.get('/files/:name*', (req, res) => { res.send(200); });
app.post('/api', require('express-async-errors'), async (req, res) => {
  const data = await fetchData();
  res.json(data, 201);
});
```

### 2. 阅读以下代码，`GET /api/users/42/posts/7` 到达 posts 路由时 req.params 是什么？

```js
const postsRouter = express.Router();
postsRouter.get('/:postId', (req, res) => {
  res.json(req.params);
});
app.use('/api/users/:userId/posts', postsRouter);
```
（注意有没有 mergeParams: true）

### 3. 以下代码的输出是什么？

```js
const app = express();
app.get('/a', (req, res) => { res.send('a'); });
app.get('/a/b', (req, res) => { res.send('ab'); });
// 请求 GET /a/b → 响应？
// 请求 GET /a   → 响应？
```

### 4. 分析错误传递流程：

```js
app.get('/test', (req, res, next) => {
  next(new Error('step1'));
});
app.use((err, req, res, next) => {
  if (err.message === 'step1') return next(new Error('step2'));
  res.status(500).send(err.message);
});
app.use((err, req, res, next) => {
  res.status(422).send(err.message);
});
// GET /test 响应？
```

### 5. 以下 cors 配置有安全问题吗？

```js
app.use(cors({ origin: '*', credentials: true }));
```

### 6. `app.use(express.json({ limit: '100kb' }))` 后，攻击者发 200KB JSON → 响应状态码？

### 7. 阅读路由顺序，`GET /users/new` 命中哪个 handler？

```js
app.get('/users/:id', (req, res) => res.send(`user ${req.params.id}`));
app.get('/users/new', (req, res) => res.send('new form'));
```

### 8. Express 5 中 `GET /search?tags[]=a&tags[]=b&filter[price]=100` 的 req.query 值？

### 9. 以下 async handler 在 Express 5 中抛错后进程会崩溃吗？为什么？

```js
app.get('/boom', async (req, res) => {
  throw new Error('💥');
});
app.use((err, req, res, next) => {
  res.status(500).json({ msg: err.message });
});
```

### 10. `app.use('/admin', adminRouter)` 中，如果请求 `/admin/settings`，adminRouter 内的 `req.url` 是什么？

---

## 二、手写（5 题）

### 1. 初始化一个 Express 5 项目，包含：
- ESM（type: module）；
- `app.js` + `server.js` 分离；
- `node --watch` dev 脚本；
- 安装 helmet / cors / morgan / express.json。

### 2. 创建模块化路由：
`/api/users` (GET 列表, GET /:id, POST, PUT /:id, DELETE /:id) + `/api/products` (同结构)，用 Router 分离。

### 3. 写一个 `router.param('id')` 中间件，从内存数组 `[{id:1,name:'Alice'},...]` 查找用户并挂到 `req.user`，找不到则 404。

### 4. 写一个全局 error handler：根据 `err.status` 返回对应 JSON；开发环境附带 `err.stack`。

### 5. 用 path-to-regexp v8 语法写路由：
- 匹配 `/blog/2024/01/hello-world` 取出 year/month/slug；
- 匹配 `/static/assets/img/logo.png` 取出完整路径 `assets/img/logo.png`；
- id 参数只接受数字。

---

## 三、场景题（1 题）

### 1. 你的 Express 5 API 需要支持 `/api/v1/*` 和 `/api/v2/*` 两个版本共存，且 v2 路由需要额外鉴权 `requireScope('v2')`。设计路由结构（写出代码）。

---

## 四、简答题（3 题）

### 1. Express 5 的 async 错误捕获机制原理是什么？它有什么不覆盖的场景？

### 2. 为什么要 app.js/server.js 分离？给出具体测试代码示例（supertest 用法）。

### 3. `app.use('/api', router)` 中，请求 `/api/users?page=1` 时 router 内的 req.url、req.originalUrl、req.baseUrl 分别是什么？

---

## 五、挑战题（1 题）

### 🏆 构建一个"博客 API 骨架"

要求：
- Express 5 + ESM；
- 至少包含 users / posts / comments 三组路由（每组 CRUD）；
- Router 模块化 + mergeParams（posts 路由能拿到 userId）；
- 统一 error handler；
- helmet + cors + morgan + express.json 装配完整；
- 用 `node --watch` 开发；
- 写一份 README.md 列出所有端点。
