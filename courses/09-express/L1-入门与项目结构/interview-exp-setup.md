# exp-setup 面试题精选

> 共 15 题，覆盖 **项目架构 / 中间件原理 / 安全 / CORS / Body 解析 / 配置管理** 六类。

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

---

## 补充（新专题 13-15）

### 13.  让你为团队维护一个 Express 项目脚手架（starter），它会包含什么？怎么防止它三年后烂掉？

包含清单按"每个项目都会重写一遍"为准入线：① 进程骨架——app/server 分离、优雅关闭（SIGTERM→停收→限时收尾）、启动期 env schema 校验（zod 一把过，缺即 crash）；② 观测底座——pino + requestId 贯穿（AsyncLocalStorage）、/healthz+/readyz、错误上报接线（Sentry handler 顺序正确）；③ 安全默认——helmet、CORS 白名单配置化、rate-limit 骨架、x-powered-by 清理；④ 结构示例——一条完整纵切（route→validate→controller→service→repository + 三层测试各一条），比十页文档有用；⑤ 工程门禁——lint/prettier/commit 规范/CI（typecheck+test+coverage 底线）。防腐三招：脚手架进版本库+CHANGELOG 纪律（它也是产品，有人负责）、每月拿"新项目"真跑一次它（不用就腐烂）、提供 codemod/升级脚本而不是让人重拉模板对比手动搬。关键克制：模板只做"没有它会每个项目各写一遍"的东西，业务倾向性强的东西（ORM 二选一、目录哲学）留成两个示例分支——塞得越全，弃用越快。

**来源**：Nuxt/Nest 脚手架机制对照；InfoQ《内部模板库的维护经济学》

### 14.  CommonJS 与 ESM 在 Express 项目里混用会产生哪些具体坑？模块系统该怎么定？

具体坑：① __dirname/__filename 在 ESM 不存在（要 import.meta.url + fileURLToPath），模板引擎 views 路径、静态目录拼接全中招——最高频事故；② 同步 require 没了，CJS 包混进来时 default 导入的互操作魔法（some CJS 要 import x from 拿 module.exports、named export 靠构建工具静态分析常失灵）；③ 循环依赖行为不同：CJS 拿到半成品 exports、ESM 在链接期报错，老代码"能跑"的环一迁就炸；④ 顶层 await 只有 ESM 有（配置预读场景是红利）；⑤ 部分中间件按 CJS 写的 this 单例假设在 ESM 加载器下多一份实例（少见但排查要命）。决策框架：新项目直接 "type":"module" 全 ESM（Node 原生支持稳、生态 CJS 终会退潮），迁移项目按"入口先行+混用只允许 ESM→CJS 单向 import"推进，配 lint 规则锁方向；别上 ts-node 双系统缝合的野路子。收口句：模块系统是地基级决定——它的代价不在切换当天，在之后每次 import 方向对不对都要人记着的三年里。

**来源**：Node 官方 ESM 文档（Interoperability）；掘金《我们的 Express 项目迁移 ESM 的清单》

### 15.  app.js 顶上那串 app.use(...) 是全项目最重要的架构声明——你怎么治理这列中间件栈？

治理三件：① 清单即文档——栈按固定分段写死顺序并注释语义：协议修正层（trust proxy/compression）→ 观测层（requestId/morgan/pino-http）→ 安全层（helmet/cors/rate-limit）→ 解析层（json/urlencoded 带 limit）→ 鉴权层（session/auth）→ 业务路由 → 404 → 错误处理。顺序规则可背："先记账后干活、先安全后解析、谁短路谁靠后"，每层新中间件必须 PR 说明插在哪段为什么。② 隐式依赖显式化——两个中间件暗通 res.locals/req 字段（A 写 B 读）是最脆的耦合：契约字段收进命名空间（res.locals.ctx）+ TS 类型声明，README 列"字段生产者→消费者"表。③ 腐化信号与手术——出现"这个中间件要对某些路由跳过"的路径 if 满天飞时，说明该从 app.use 下放到 router.use/路由级挂载了；"必须在 X 之后否则静默失灵"的坑要用集成测试锁（打一个请求断言 X 确实跑了）。加分句：中间件栈没人画得清，等于这个服务没人真正拥有——架构图可以先从 app.use 列表生成。

**来源**：Express 官方 Using middleware；InfoQ《一个把中间件清单当 API 管理的团队》
