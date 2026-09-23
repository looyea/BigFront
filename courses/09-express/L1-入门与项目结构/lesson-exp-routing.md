# Express 路由系统

> 目标：**精通 Express 5 路由全部用法**——HTTP 方法、命名参数、通配符、Router 模块化、路由级中间件、链式调用、条件匹配。

---

## 一、基础路由

### 1.1 所有 HTTP 方法

```js
app.get('/users', handler);        // 查
app.post('/users', handler);       // 增
app.put('/users/:id', handler);    // 全量改
app.patch('/users/:id', handler);  // 部分改
app.delete('/users/:id', handler); // 删
app.all('/legacy', handler);       // 匹配任意方法
app.options('/cors', handler);     // CORS 预检
```

### 1.2 多 handler 链（Express 5 数组）

```js
// 依次执行直到 res 结束或 next() 跳出
app.get('/protected',
  requireAuth,           // 中间件 1
  validateQuery,         // 中间件 2
  async (req, res) => {  // 最终 handler
    res.json({ user: req.user });
  }
);

// Express 5 也支持数组写法
app.post('/orders', [validate, auth, createOrder]);
```

---

## 二、路径参数（path-to-regexp v8）

### 2.1 命名参数

```js
app.get('/users/:id', (req, res) => {
  req.params.id;  // '42'
});
```

### 2.2 多段通配 `{*name}`

```js
// 匹配 /files/a/b/c.txt → params.name = 'a/b/c.txt'
app.get('/files/{*filepath}', (req, res) => {
  req.params.filepath;
});
```

### 2.3 可选参数 `{:name}?`

```js
// 匹配 /posts 和 /posts/page/2
app.get('/posts/{:page}?', (req, res) => {
  req.params.page;  // undefined 或 '2'
});
```

### 2.4 正则约束 `{:name(pattern)}`

```js
// id 只匹配数字
app.get('/users/{:id(\\d+)}', (req, res) => {
  req.params.id;  // 保证全是数字
});
// 匹配 /search/hello 但不匹配 /search/123
app.get('/search/{:keyword([a-z]+)}', handler);
```

### 2.5 命名路由 + `.name`

```js
const userRoute = app.get('/users/:id', handler);
userRoute.name = 'getUser';
// req.url 生成（配合 res.locals）
```

---

## 三、Router 模块化

### 3.1 创建 & 挂载

```js
// routes/orders.js
import { Router } from 'express';
const router = Router({ mergeParams: true });  // 保留父级 params

router.get('/', listOrders);
router.get('/:orderId', getOrder);
router.post('/', createOrder);
router.put('/:orderId/status', updateStatus);

export default router;
```

```js
// app.js
import orderRoutes from './routes/orders.js';
app.use('/api/users/:userId/orders', orderRoutes);
// → /api/users/1/orders/2/status  →  params: { userId: '1', orderId: '2' }
```

**`mergeParams: true`**：把父路由的参数合并进子 router 的 `req.params`。

### 3.2 路由级中间件

```js
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});
```

### 3.3 参数中间件 `router.param()`

```js
// 加载 user 到 req.user —— 所有含 :userId 的路由自动执行
router.param('userId', async (req, res, next, id) => {
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  req.user = user;
  next();
});

router.get('/users/:userId/posts', (req, res) => {
  res.json(req.user.posts);  // req.user 已由 param middleware 注入
});
```

---

## 四、路由匹配顺序

Express **自上而下**匹配——**第一个匹配的 handler 处理请求**（除非调 `next()`）。

```js
app.get('/users/:id', getUser);       // 也匹配 /users/new
app.get('/users/new', getNewForm);    // 永远到不了这里！
```

**修复**：精确路径放前面。

```js
app.get('/users/new', getNewForm);    // ✅ 精确优先
app.get('/users/:id', getUser);
```

---

## 五、查询字符串

```js
// GET /products?page=2&sort=price&filters[brand]=nike&filters[brand]=adi
app.get('/products', (req, res) => {
  req.query.page;     // '2'
  req.query.sort;     // 'price'
  req.query.filters;  // { brand: ['nike', 'adi'] }  ← qs 解析
});
```

Express 5 默认用 **qs** → 嵌套对象/数组开箱可用。

---

## 六、Request 对象常用属性

| 属性 | 说明 |
| --- | --- |
| `req.method` | HTTP 方法 |
| `req.url` | 原始 URL（不含 host） |
| `req.path` | URL 路径部分 |
| `req.params` | 路径参数 |
| `req.query` | 查询参数 |
| `req.body` | 请求体（需 body parser） |
| `req.headers` | 请求头对象 |
| `req.get('Host')` | 取单个头 |
| `req.ip` | 客户端 IP（trust proxy 开启后从 X-Forwarded-For 取） |
| `req.hostname` | Host 头去掉端口 |
| `req.protocol` | 'http' / 'https' |
| `req.secure` | 是否 HTTPS |
| `req.xhr` | 是否 XMLHttpRequest (AJAX) |
| `req.originalUrl` | 完整原始 URL（不受 router mount 影响） |
| `req.baseUrl` | Router 挂载的路径前缀 |
| `req.accepts(type)` | 内容协商 |

---

## 七、Response 常用方法

| 方法 | 效果 |
| --- | --- |
| `res.status(code)` | 设状态码（可链式） |
| `res.json(obj)` | 设 Content-Type: application/json + 序列化 |
| `res.send(body)` | 自动判断类型（string/html/json/buffer） |
| `res.sendStatus(code)` | 发送状态码文字（5 新增） |
| `res.sendStatus(code)` | 同上传状态码 + 文字体 |
| `res.redirect(url)` | 302 重定向 |
| `res.redirect(301, url)` | 指定重定向码 |
| `res.type('pdf')` | 设 Content-Type |
| `res.set('X-Foo', 'bar')` | 设响应头 |
| `res.append('Set-Cookie', val)` | 追加头 |
| `res.attachment(filename)` | 设 Content-Disposition: attachment |
| `res.download(path)` | 触发文件下载 |
| `res.cookie(name, val, opts)` | 设 Cookie |
| `res.clearCookie(name)` | 清 Cookie |
| `res.vary(field)` | 设 Vary 头 |
| `res.render(view, data)` | 渲染模板 |

---

## 八、错误处理路由

### 8.1 路由内 throw → 全局 catch

```js
app.get('/boom', async (req, res) => {
  throw new Error('kaboom');  // Express 5 自动捕获
});

// 最后注册
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
  });
});
```

### 8.2 next(err) 手动传递

```js
app.get('/users/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    const err = new Error('Invalid ID');
    err.status = 400;
    return next(err);  // 跳过后续 handler → 进 error middleware
  }
  const user = await db.users.findById(id);
  res.json(user);
});
```

---

## 九、版本路由策略

### 9.1 URL 前缀

```js
app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);
```

### 9.2 Header 版本（Accept / X-API-Version）

```js
function versioned(req, res, next) {
  const v = req.get('X-API-Version') || '1';
  req.apiVersion = v;
  next();
}
app.use('/api', versioned, apiRouter);
```

---

## 十、自检清单

- [ ] Express 5 里 `{*name}` 匹配什么？
- [ ] 路由匹配顺序为什么重要？如何避免"精确路径被参数路径截胡"？
- [ ] `mergeParams: true` 解决什么问题？
- [ ] `router.param()` 和路由级中间件的区别？
- [ ] Express 5 里 async handler 抛错还需要 try/catch 吗？
- [ ] `req.originalUrl` 和 `req.url` 的区别？

---

## 🚀 部署预告

- **路由健康检查**：`app.get('/healthz', (req, res) => res.json({ status: 'ok' }))` —— LB/K8s 探活；
- **版本路由灰度发布**：`/api/beta/*` 指向 staging → 金丝雀切流；
- **路由超时**：`app.use((req, res, next) => { req.setTimeout(10000); next(); })` 防慢请求。

下一关进入 L2 中间件深入：日志 / 错误处理 / 第三方中间件集成。
