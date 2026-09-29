# Express 5 概览与核心变化

> 目标：**理解 Express 5 相比 Express 4 的关键变化**；掌握 `npm install express@5` 后项目启动方式；认识 async 错误自动捕获、path-to-regexp v8 重写、req.query 改用 qs、废弃 API 等 breaking changes。

---

## 一、Express 是什么

Express 是 Node.js 生态**最流行的 Web 框架**（周下载 3000 万+），定位"极简、灵活的 Node.js Web 应用框架"——提供：
- 路由（HTTP 方法 + URL pattern → handler）；
- 中间件（洋葱圈模型，请求/响应管道）；
- HTTP 工具（req/res 增强、错误处理）；
- 模板引擎集成。

Express **不做的事**：不绑 ORM、不锁模板引擎、不管前端渲染、不强制项目结构。

---

## 二、Express 5 新特性一览

| 变化 | 说明 |
| --- | --- |
| **async handler 错误自动捕获** | 不再需要 `try/catch` 或 `express-async-errors`——路由里 Promise reject 自动传给 error handler |
| **path-to-regexp v8** | 路由语法变化：`:name*` → `{*name}`；`:name+` → `{*name}`；`?` → `{...}?` |
| **req.query 用 qs 解析** | `?a[b]=c` → `{a: {b: 'c'}}` 直接可用（4 里需自行配置） |
| **res.send(status) 移除** | 必须 `res.status(404).send()` 两步 |
| **app.del() 移除** | 用 `app.delete()`（`del` 因 HTTP 方法名与关键字冲突早已 deprecated） |
| **res.json(obj, status) 移除** | 用 `res.status(201).json(obj)` |
| **req.param(name) 移除** | 用 `req.params` / `req.body` / `req.query` 直接访问 |
| **multiple handlers** | router 支持传数组 `app.get('/', [fn1, fn2])` |
| **linked router** | `router.use(router2)` 支持嵌套并保留参数传递 |
| **Node.js >=18 要求** | 不再支持 Node 16 及以下 |
| **默认 body parser 增强** | `express.json()` 默认 type 检查更严格 |
| **安全增强** | `res.location()` / `res.redirect()` 验证 Location header 防 open redirect |

---

## 三、安装与启动

### 3.1 创建项目

```bash
# 目的：从零建一个 Express 5 项目并确认版本
mkdir my-app && cd my-app
npm init -y                 # ✅ 生成默认 package.json
npm install express         # ✅ 装最新 Express（当前为 5.x）
# 确认版本
node -e "console.log(require('express').version)"  # ✅ 打印 5.x.x
```

### 3.2 Hello World

```js
// 目的：最小可跑的 Express 5 服务——一个路由 + 监听端口
// app.js  (ESM)
import express from 'express';        // ✅ 默认导出工厂函数
const app = express();                 // ✅ 创建应用实例（本质是可调用的请求处理函数）
const PORT = 3000;

app.get('/', (req, res) => {           // ✅ 注册 GET / 的 handler，路径精确匹配 '/'
  res.send('Hello Express 5!');        // ✅ 发 200、Content-Type text/html、正文这串
});

app.listen(PORT, () => {               // ✅ 绑定端口开始监听，回调在就绪后打印
  console.log(`Running at http://localhost:${PORT}`);
});
// ❌ 忘 app.listen() → 进程直接退出、无人监听；访问 /nope → 命中默认 404（本 app 未注册该路由）
```

```bash
# 目的：启动服务并验证
node app.js                 # ✅ 起 HTTP 服务、阻塞进程保持监听
# 打开 http://localhost:3000 → "Hello Express 5!"
```

### 3.3 package.json 配置 ESM

```json
// 目的：声明 ESM + 脚本——type:module 让 .js 按 ESM 解析，--watch 自动重启
{
  "type": "module",                     // ✅ 启用 ESM，import/export 语法直接可用
  "scripts": {
    "start": "node app.js",             // ✅ npm start 跑生产入口
    "dev": "node --watch app.js"        // ✅ Node 18.11+ 文件改动自动重启
  }
}
```

> ❌ 不加 `"type":"module"` 却用 import 语法 → 报 “Cannot use import statement outside a module”。

`--watch`（Node 18.11+）自动重启——开发利器。

---

## 四、路由语法变化（path-to-regexp v8）

Express 4 的 `:name*`（零或多段）和 `:name+`（一或多段）在 v8 里**不再支持**：

| Express 4 写法 | Express 5 写法 | 含义 |
| --- | --- | --- |
| `/files/:name*` | `/files/{*name}` | 零或多段（匹配 `/files/` 和 `/files/a/b/c`） |
| `/users/:id+` | `/users/{*id}` | 一或多段（至少一段） |
| `/optional/:id?` | `/optional/{:id}?` | 可选参数 |
| `/regex/:id(\\d+)` | `/regex/{:id(\\d+)}` | 自定义正则 |

> `{...}` 花括号 = v8 的新参数包裹语法；内部保留 `:name` 命名 + 可选正则。

---

## 五、req.query 变化

Express 4 默认用简单的 `querystring` 模块 → `?a[b]=c` 解析不完整。Express 5 切换为 **qs** 库 → 默认支持嵌套对象、数组：

```
GET /search?filter[price][gt]=100&tags[]=js&tags[]=node
```

```js
// 目的：Express 5 默认用 qs 解析 → 嵌套对象/数组开箱可用
req.query;
// ✅ 结果 { filter: { price: { gt: '100' } }, tags: ['js', 'node'] }（4 里需自行配置才能这样）
// ❌ 依赖旧 querystring 行为做字符串拼接解析 → 结构变了没察觉；要切回可 app.set('query parser','simple')
```

可通过 `app.set('query parser', 'simple')` 切回 querystring。

---

## 六、Async 错误自动捕获（最重要！）

### 6.1 Express 4 的痛点

```js
// 目的：回忆 Express 4 痛点——async handler 里 reject 不会被接管
// Express 4：async handler 里 throw → 未捕获 → 进程崩溃
app.get('/users', async (req, res) => {
  const data = await db.query('SELECT...');  // ❌ reject → 无人 catch → UnhandledRejection，进程崩溃
  res.json(data);
});
// 4 里必须 try/catch 调 next(err)，或装 express-async-errors 猴补丁
```

需要 `express-async-errors` 包或手写包装器。

### 6.2 Express 5 原生支持

```js
// 目的：Express 5 原生捕获 async 错误——reject 自动转给 error handler，无需 try/catch
app.get('/users', async (req, res) => {
  const data = await db.query('SELECT...');  // ✅ reject → Express 检测 thenable 自动 .catch(next)
  res.json(data);                             // ✅ 成功才走到这
});

// ✅ 统一错误处理：四参数 (err, req, res, next) 签名才会被识别为错误中间件
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});
// ❌ 错误中间件漏写 next 变成三参数 (err, req, res) → 被当成普通中间件，永远接不到 err
```

**原理**：Express 5 检查 handler 返回值是否为 thenable → 是就 `.catch(next)`。

---

## 七、迁移检查清单

- [ ] Node >= 18；
- [ ] 全局搜索 `:name*` / `:name+` → 改为 `{*name}`；
- [ ] 删除所有 `try/catch` 包装（async handler 不再需要）；
- [ ] 删除 `express-async-errors` 依赖；
- [ ] `res.send(status)` → `res.status(code).send()`；
- [ ] `res.json(obj, status)` → `res.status(code).json(obj)`；
- [ ] `app.del()` → `app.delete()`；
- [ ] `req.param('name')` → `req.params.name / req.body.name / req.query.name`；
- [ ] 检查 query 解析行为是否依赖 4 的简单解析（`'extended'` vs `'simple'`）。

---

## 八、自检清单

- [ ] Express 5 最低 Node 版本是多少？
- [ ] 为什么 `app.get('/', async (req, res) => { throw new Error('x') })` 在 5 里不会崩？
- [ ] `/files/:name*` 在 Express 5 里怎么写？
- [ ] `req.query` 在 5 里默认用什么解析？有什么优势？
- [ ] Express 4 里 `res.send(404)` 还能用吗？

---

## 🚀 部署预告

本关聚焦 Express **本身**。部署阶段：
- **启动脚本**：`NODE_ENV=production node app.js`；
- **进程守护**：pm2 / systemd（`pm2 start app.js -i max`）；
- **反向代理**：Nginx → upstream: `proxy_pass http://127.0.0.1:3000;`；
- **健康检查**：`app.get('/healthz', (req, res) => res.sendStatus(200))`。

后续 L8 部署与性能关会完整展开。下一关 `exp-setup` 讲项目结构与中间件装配。
