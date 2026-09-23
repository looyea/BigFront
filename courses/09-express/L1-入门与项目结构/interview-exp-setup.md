# exp-setup 面试题精选

> 共 12 题，覆盖 **项目架构 / 中间件原理 / 安全 / CORS / Body 解析 / 配置管理** 六类。

---

## 一、项目架构

### 1. 为什么推荐把 app.js 和 server.js 分离？

**可测试性**：测试文件 `import app from './app'` → 传给 `supertest(app)` → 不占端口、不依赖网络 → 跑得快、无端口冲突。server.js 只管 `app.listen(PORT)` + 优雅关闭。如果混在一起，import 就触发 listen → 测试之间端口冲突。

**来源**：Express testing guide; NearForm Node Best Practices — "Project Structure"

### 2. Controller-Service-Model 分层的好处？

- **Controller**：HTTP 适配（取参、返回格式）——换框架只改这层；
- **Service**：纯业务逻辑——可单测不 mock HTTP；
- **Model**：数据访问（SQL/ORM）——换 DB 只改这层。
三层解耦 → 并行开发 → 职责清晰 → 单测覆盖容易。

**来源**：Microsoft — "Layered architecture"; NestJS docs — "Architecture"

---

## 二、中间件原理

### 3. `app.use()` 和 `app.get()` 在底层实现上有什么区别？

底层都是 push 到 `app._router.stack`（Layer 数组）。区别：`app.use` 创建的 Layer 设 `route=false`（只匹配路径前缀，不检查 HTTP 方法）；`app.get` 创建的 Layer 设 `route=true` + 方法列表。请求进来时遍历 stack：先匹配 path → 如果 Layer 有 route 则检查 method。

**来源**：Express source — `lib/router/index.js`; "Understanding Express Middleware" by StrongLoop

### 4. 中间件的 next(err) 和 next() 有什么区别？

`next()` → 跳过当前 Layer，进**下一个普通中间件/路由**。`next(err)` → 跳过所有普通中间件，直接找**最近的 4 参数 error middleware**。如果 `next('router')` → 跳出当前整个 Router 实例回到上层。

**来源**：Express API reference — "next"; "Error handling"

---

## 三、安全

### 5. helmet 具体设置了哪些 Header？

默认启用（部分）：`Content-Security-Policy`、`X-DNS-Prefetch-Control`、`X-Frame-Options: SAMEORIGIN`、`X-Content-Type-Options: nosniff`、`Strict-Transport-Security`、`X-XSS-Protection`（已 deprecated）、`Referrer-Policy`、`Cross-Origin-Resource-Policy` 等 14 个头。每个可单独关掉或配。

**来源**：helmet GitHub README — "Usage"

### 6. express.json({ limit }) 超限后 Express 返回什么？

body-parser 抛一个 `entity.too.large` 错误（status 413）→ 如果没有 error middleware 就返回 HTML 500。配合 error handler 统一返回 `413 Payload Too Large` JSON。

**来源**：body-parser docs — "limit"; HTTP 413 MDN

---

## 四、CORS

### 7. 简单请求和预检请求的区别？Express 里 cors 中间件怎么处理？

简单请求（GET/POST + 特定 Content-Type + 无自定义头）→ 浏览器直接发 → 服务端响应带 `Access-Control-Allow-Origin`。预检（复杂请求）→ 浏览器先发 OPTIONS → 服务端返回允许的 methods/headers → 通过才发真实请求。`cors()` 中间件自动处理 OPTIONS → 设正确响应头。

**来源**：MDN — "CORS"; cors npm package README

### 8. `credentials: true` 时 origin 能设 `*` 吗？

不能。浏览器规定：请求带 cookie（`credentials: 'include'`）时，响应头的 `Access-Control-Allow-Origin` **必须精确指定域名**，不能是通配 `*`。cors 中间件需配具体 origin 列表或函数。

**来源**：Fetch Spec — "CORS with credentials"; MDN — "Access-Control-Allow-Credentials"

---

## 五、Body 解析

### 9. `express.json()` 和 `express.urlencoded({ extended: true })` 分别解析什么 Content-Type？

- `express.json()` → `Content-Type: application/json`（API 请求体）；
- `express.urlencoded({ extended: true })` → `Content-Type: application/x-www-form-urlencoded`（传统表单 / HTML form POST）；
- extended: true → 用 qs 解析 → 支持嵌套 `user[name]=abc`；false → querystring 仅扁平。

**来源**：Express 4.x — "Built-in body parser"; body-parser GitHub README

### 10. 解析 multipart/form-data（文件上传）用 express.json 行吗？

不行。`express.json` 只处理 JSON 文本。文件上传需要 **multer** 中间件（或其他如 busboy / formidable）。`app.post('/upload', multer({ storage }).array('photos', 5), handler)`。

**来源**：multer GitHub README; Express — "Using multer"

---

## 六、配置管理

### 11. 生产环境如何安全管理密钥？

① `.env` 本地开发（`.gitignore` 排除）；② CI/CD Secrets（GitHub Actions secrets / Vault / AWS Secrets Manager）；③ 运行时注入环境变量（`docker run -e JWT_SECRET=...`）；④ **永远不写代码里、永远不 commit**。用 `dotenv/config` 只在开发加载；生产由编排平台注入。

**来源**：12-Factor App — "Config"; OWASP — "Secrets management"

### 12. `app.set('trust proxy', 1)` 解决什么问题？

Nginx / ALB / Cloudflare 等反代 → Express 看到的 `req.ip` 永远是 127.0.0.1（代理的 IP）。`trust proxy` 让 Express 信任 `X-Forwarded-For` 头 → `req.ip` 返回真实客户端 IP；`req.secure` 从 `X-Forwarded-Proto` 判断。设 `true` 信任所有代理，设数字信任 N 跳。

**来源**：Express API — "app.set('trust proxy')"; MDN — "X-Forwarded-For"
