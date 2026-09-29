# Express 路由系统

> 目标：**精通 Express 5 路由全部用法**——HTTP 方法、命名参数、通配符、Router 模块化、路由级中间件、链式调用、条件匹配。

---

## 一、基础路由

### 1.1 所有 HTTP 方法

```js
// 目的：按 HTTP 动词注册路由——方法+路径共同决定命中
app.get('/users', handler);        // ✅ 查
app.post('/users', handler);       // ✅ 增
app.put('/users/:id', handler);    // ✅ 全量改
app.patch('/users/:id', handler);  // ✅ 部分改
app.delete('/users/:id', handler); // ✅ 删（Express5 无 app.del，旧写法直接报 not a function）
app.all('/legacy', handler);       // ✅ 任意方法都命中
app.options('/cors', handler);     // ✅ CORS 预检
```

### 1.2 多 handler 链（Express 5 数组）

```js
// 目的：一路由挂多个 handler——依次执行，直到 res 结束或某步不调 next 而跳出
app.get('/protected',
  requireAuth,           // ✅ 中间件1：鉴权失败直接 res.end，不再往下
  validateQuery,         // ✅ 中间件2：校验通过调 next() 继续
  async (req, res) => {  // ✅ 最终 handler
    res.json({ user: req.user });
  }
);

// ✅ Express 5 也支持数组写法，语义与逗号并列一致
app.post('/orders', [validate, auth, createOrder]);
// ❌ 中间件里既不 res 也不 next() → 请求永久挂起
```

---

## 二、路径参数（path-to-regexp v8）

### 2.1 命名参数

```js
// 目的：命名参数——冒号段捕获为字符串
app.get('/users/:id', (req, res) => {
  req.params.id;  // ✅ '42'（始终是字符串，需数字要自己 Number 转换）
});
```

### 2.2 多段通配 `{*name}`

```js
// 目的：{*name} 匹配剩余多段——Express5 取代旧的 ':name*'/'​:name+'
app.get('/files/{*filepath}', (req, res) => {
  req.params.filepath;  // ✅ /files/a/b/c.txt → 'a/b/c.txt'（含斜杠的整段）
});
// ❌ 沿用 Express4 的 '/files/:filepath*' → path-to-regexp v8 抛 TypeError 拒绝注册
```

### 2.3 可选参数 `{:name}?`

```js
// 目的：{:name}? 可选参数——带不带该段都命中
app.get('/posts/{:page}?', (req, res) => {
  req.params.page;  // ✅ /posts → undefined；/posts/page/2 → '2'（用前先判 undefined）
});
```

### 2.4 正则约束 `{:name(pattern)}`

```js
// 目的：{:name(正则)} 约束参数——不匹配则整条路由不命中（自动回落 404，省掉手写校验）
app.get('/users/{:id(\\d+)}', (req, res) => {
  req.params.id;  // ✅ 只会是纯数字串，/users/abc 根本进不来
});
app.get('/search/{:keyword([a-z]+)}', handler);  // ✅ 匹配 /search/hello，不匹配 /search/123
```

### 2.5 命名路由 + `.name`

```js
// 目的：给路由命名，便于反向生成 URL（如模板/重定向引用）
const userRoute = app.get('/users/:id', handler);
userRoute.name = 'getUser';   // ✅ 之后可用 app.route('getUser', {id:5}) 生成 '/users/5'
// ❌ name 只是标签，不影响匹配行为；拼错名字反向生成时会找不到路由
```

---

## 三、Router 模块化

### 3.1 创建 & 挂载

```js
// 目的：orders 子路由——mergeParams:true 才能读到父级挂载路径里的 :userId
import { Router } from 'express';
const router = Router({ mergeParams: true });  // ✅ 保留父级 params

router.get('/', listOrders);                    // ✅ /api/users/:userId/orders
router.get('/:orderId', getOrder);              // ✅ .../orders/:orderId
router.post('/', createOrder);
router.put('/:orderId/status', updateStatus);   // ✅ .../orders/:orderId/status

export default router;
// ❌ 漏 mergeParams:true → 子 router 里 req.params.userId 为 undefined，只剩自己的 orderId
```

```js
// 目的：把子路由挂到带参数的父路径——两级 params 合并
import orderRoutes from './routes/orders.js';
app.use('/api/users/:userId/orders', orderRoutes);
// ✅ /api/users/1/orders/2/status → params: { userId: '1', orderId: '2' }（靠 mergeParams 才能同时拿到）
```

**`mergeParams: true`**：把父路由的参数合并进子 router 的 `req.params`。

### 3.2 路由级中间件

```js
// 目的：路由级中间件——只对本 router 内所有请求生效
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();   // ✅ 必须调，否则该 router 下所有路由都挂起
});
```

### 3.3 参数中间件 `router.param()`

```js
// 目的：参数中间件——凡路径含 :userId 都先跑它，把 user 预加载进 req（去重样板代码）
router.param('userId', async (req, res, next, id) => {
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });  // ✅ 找不到就短路，不进 handler
  req.user = user;   // ✅ 挂到 req 供下游直接用
  next();
});

router.get('/users/:userId/posts', (req, res) => {
  res.json(req.user.posts);  // ✅ req.user 已由 param 中间件注入，无需再查
});
// ❌ 参数名要与路径里的 :userId 完全一致，写成 'id' 则该中间件永不触发
```

---

## 四、路由匹配顺序

Express **自上而下**匹配——**第一个匹配的 handler 处理请求**（除非调 `next()`）。

```js
// 目的：反例——自上而下首个命中即处理，参数路由在前会截胡精确路径
app.get('/users/:id', getUser);       // ❌ '/users/new' 也命中它，id='new'
app.get('/users/new', getNewForm);    // ❌ 永远到不了这里！
```

**修复**：精确路径放前面。

```js
// 目的：正例——把静态段排在参数段之前，保证 /users/new 不被 :id 吞掉
app.get('/users/new', getNewForm);    // ✅ 精确优先
app.get('/users/:id', getUser);       // ✅ 剩下的 id 才走参数路由
```

---

## 五、查询字符串

```js
// 目的：读查询串——Express5 默认 qs，嵌套/数组开箱可用
// GET /products?page=2&sort=price&filters[brand]=nike&filters[brand]=adi
app.get('/products', (req, res) => {
  req.query.page;     // ✅ '2'（仍是字符串，分页要 Number）
  req.query.sort;     // ✅ 'price'
  req.query.filters;  // ✅ { brand: ['nike', 'adi'] }  ← qs 解析成数组
});
// ❌ 直接拿 req.query.page 参与算术比较（如 page>10）→ 字符串隐式转换易出 bug，务必显式转数字
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
// 目的：路由内直接 throw——Express5 自动捕获并转给错误中间件，无需 try/catch
app.get('/boom', async (req, res) => {
  throw new Error('kaboom');  // ✅ Express5 检测 thenable，reject 自动 .catch(next)
});

// ✅ 错误中间件必须最后注册，且是四参数签名
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,  // ✅ 生产不外泄内部信息
  });
});
// ❌ 若错误中间件写成三参数 (err, req, res) → 被当普通中间件，err 永远到不了这里
```

### 8.2 next(err) 手动传递

```js
// 目的：同步校验失败时手动 next(err)——跳过后续 handler 直达错误中间件
app.get('/users/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    const err = new Error('Invalid ID');
    err.status = 400;                       // ✅ 自定义状态码供错误中间件读取
    return next(err);                       // ✅ 带 err 调 next → 跳过 handler 进 error middleware
  }
  const user = await db.users.findById(id);
  res.json(user);
});
// ❌ 写成 next() 不带 err → 被视为正常放行，继续往下跑，错误被吞掉
```

---

## 九、版本路由策略

### 9.1 URL 前缀

```js
// 目的：URL 前缀版本化——不同大版本各挂一套 router，互不干扰
app.use('/api/v1', v1Router);   // ✅ /api/v1/* → v1 实现
app.use('/api/v2', v2Router);   // ✅ /api/v2/* → v2 实现
// ❌ v1/v2 共用同一 URL 前缀 → 后注册的 router 永远命中不到
```

### 9.2 Header 版本（Accept / X-API-Version）

```js
// 目的：Header 版本化——从请求头读版本挂到 req，供下游 router/handler 分流
function versioned(req, res, next) {
  const v = req.get('X-API-Version') || '1';  // ✅ 缺省当作 v1
  req.apiVersion = v;                           // ✅ 挂到 req 供后续判断
  next();                                       // ✅ 放行
}
app.use('/api', versioned, apiRouter);          // ✅ 进 apiRouter 前每个请求都先跑 versioned
// ❌ 忘 next() → 请求卡在 versioned 里，永远到不了 apiRouter
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
