# react-deploy 面试题精选

> 共 12 题，覆盖 A 静态构建与 base / B history 回退 / C 环境变量与安全 / D 缓存·CDN·Next 部署类。

---

## 一、静态构建与 base（A 类）

### 1. create-react-app / Vite 构建出的 React 应用是什么样？如何部署？

**答**：构建产物是一组**静态文件**：`index.html` + `assets/` 里带 hash 的 JS/CSS + 图片等。部署就是把 `dist/`（或 `build/`）放到任意静态托管：Nginx、对象存储(OSS/S3)+CDN、Vercel/Netlify/GitHub Pages。若是 SSR 的 Next 则另需 Node/Edge 运行时（见 D 类）。核心心智：SPA 构建后是"一个 HTML 壳 + JS"，运行时由 JS 接管路由与渲染（呼应 react-deploy 第一节、vue-deploy）。

**来源**：Vite 文档 — Producing a build、MDN — Static site hosting

### 2. 站点不在域名根路径(如 /myapp/)部署要注意什么？

**答**：设置 **`base`**（Vite，早期 vue-cli 叫 `publicPath`）为 `/myapp/`，否则 `index.html` 里引用的 `/assets/...` 会 404（因为请求打到了域名根）。同理路由 `BrowserRouter` 要加 `basename="/myapp"`，Next 用 `basePath`。三处（资源 base、路由 basename、应用 basePath）都要对齐子路径。这是子目录部署最常见的坑（呼应 react-deploy 第六节）。

**来源**：Vite — base / public base path、React Router basename、Next.js basePath

---

## 二、history 回退（B 类）

### 3. 为什么 BrowserRouter 部署后刷新子路由 404？怎么解决？

**答**：history 模式下 `/user/1` 是前端路由概念，磁盘上没有对应文件；首屏从根进入正常，但**直接访问/刷新 `/user/1`** 会向服务器要这个路径的资源 → 404。解决：服务器配**回退**——所有未命中真实文件的路径都返回 `index.html`（nginx `try_files $uri /index.html`；Netlify `/* /index.html 200`；Vercel rewrites），再让前端路由接管。替代：HashRouter（带 `#`、免配置，但 URL 不优雅、SEO 差）（呼应 react-router-basics、react-deploy 第二节）。

**来源**：MDN — SPA history fallback、React Router 部署指南、Netlify SPA redirect

### 4. HashRouter 能避开回退问题吗？为什么不推荐用于生产？

**答**：能——`/#/path` 的 `#` 后内容不发往服务器，服务器只见根路径，永不 404、无需回退配置。但缺点：URL 含 `#` 不美观、锚点语义冲突、SEO 与分享体验差、部分爬虫/统计对 hash 处理不佳。生产更推荐 BrowserRouter + 正确的 history 回退（或 SSR/SSG），既干净又利于收录（呼应 react-router-basics 第 2 题）。

**来源**：React Router — HashRouter vs BrowserRouter、web.dev — hash vs history routing

---

## 三、环境变量与安全（C 类）

### 5. Vite 的 `VITE_` 和 Next 的 `NEXT_PUBLIC_` 前缀本质是什么？

**答**：是**"是否内联进客户端 bundle"的开关**。构建时，带这些前缀的变量值被**文本替换/内联**进打包 JS，浏览器可读；不带前缀的只在**服务端/构建时**可读，不进客户端包。由此推论：① 加了前缀 = 任何人都能从 JS 里看到，**只能是公开配置**（API 地址、公钥、开关）；② 机密（DB 串、私钥、第三方 secret）**绝不加前缀**、绝不进前端（呼应 react-deploy 第四节、node-config）。

**来源**：Vite — Env variables and modes、Next.js — Environment Variables 前缀规则

### 6. "把 API 密钥配到前端环境变量里"为什么是安全事故？

**答**：因为前端环境变量会被**内联进公开的 JS 产物**，任何人打开 DevTools/查看源码即可提取——等于把密钥公开。密钥必须留在**服务端**，客户端只调用你自己后端代理的接口（后端再带密钥请求第三方），或用短期、限域、可吊销的令牌。`VITE_`/`NEXT_PUBLIC_` 的存在就是提醒你"加了前缀就是公开的"（呼应 09-exp-security、exp-auth）。

**来源**：12-Factor App — 配置存储、OWASP — Secrets in frontend、Next.js 安全提示

### 7. 改了环境变量要重启还是重建才生效？

**答**：Vite 的 `VITE_*` 是**构建期**内联，改了必须**重新 build**（dev 下重启 dev server），因为值已写死进产物；纯静态托管无"运行时读 env"能力。Next 分两种：`NEXT_PUBLIC_*` 客户端值在 build 时固化；**服务端**用到的 env 在 `next start`/运行时读取，自托管可换 env 后重启服务生效（不重建）。别把构建期注入误当成运行时配置——这是"改了没生效/密钥泄漏"的根源（呼应 react-deploy 第四、六节）。

**来源**：Vite env 文档、Next.js — 构建时 vs 运行时环境变量

---

## 四、缓存、CDN 与 Next 部署（D 类）

### 8. 前端发布的缓存策略：hash 资源和 index.html 分别怎么设？为什么？

**答**：带内容 hash 的 `assets/app.[hash].js` **可长缓存**（`Cache-Control: public, max-age=31536000, immutable`）——内容一变文件名就变，绝不会错命中旧版。`index.html` **必须 `no-cache`/`must-revalidate`**——它引用的是最新 hash 资源清单，若缓存了旧 html，用户就继续加载旧 hash JS、新版永远下不去。二者配合实现"发版即生效 + 静态资源长期缓存"（呼应 10-vite-deploy、react-deploy 第五节）。

**来源**：web.dev — Cache strategies / immutable、MDN Cache-Control、Rollup hashed assets

### 9. 发版后部分用户看到"白屏/旧版/资源 404"，如何从缓存角度排查？

**答**：常见：① html 被强缓存 → 拿旧清单引用已删除的旧 hash JS → 404，需确保 html `no-cache`；② CDN 未刷新/边缘节点缓存旧 html，主动 purge；③ `base` 配错致资源路径 404；④ 保留上一版资源一段时间（滚动发布）可让"发版瞬间仍开着旧页面"的用户点击导航时不至于拉不到旧 chunk。定位顺序：Network 看 html 与失败资源的状态码/来源（呼应 react-deploy 第六节、10-vite-deploy）。

**来源**：CDN 缓存失效实践、Vercel/Netlify 部署缓存文档、SPA 滚动发布

### 10. Next.js 应用有哪几种部署形态？各自对运行时的要求？

**答**：① **静态导出**（`output:'export'`）：纯静态，丢任意静态托管/CDN，**不需 Node**，但放弃 SSR/动态 route handler/server-side `headers()/cookies()`/ISR；② **Node 自托管**（`next build && next start`）：Docker/服务器常驻，支持 SSR/Server Actions/ISR，需维护运行时；③ **平台 Serverless/Edge**（Vercel 等）：自动拆分函数、全球分发、按需扩缩，零运维（呼应 react-nextjs、react-deploy 第三节）。

**来源**：Next.js — Deploy / output export、Vercel Next.js 文档、next start

### 11. 前后端分离部署时前端直连后端接口的跨域(CORS)怎么处理？

**答**：由**后端**发 `Access-Control-Allow-Origin`（等头）允许前端来源，必要时 `Allow-Credentials` + 精确 origin（不能 `*` 带 cookie）；复杂请求有预检 OPTIONS。也可在部署层用**同源反向代理**（nginx `/api` 转发到后端、或 Next rewrites）让浏览器视角同源，免 CORS。开发期用 Vite `server.proxy`（呼应 09-exp-security、vite-deploy）。生产优先"反代同源"，其次后端正确配 CORS。

**来源**：MDN — CORS、web.dev — 跨域与 proxy、Next.js rewrites

### 12. 面试问"把一个 React SPA 从零部署到生产，你会做哪些事"，如何答得完整？

**答**：串一遍：① `build` 出带 hash 的静态产物，配好 `base`/路由 `basename`；② 静态托管/CDN + **history 回退**到 index.html；③ **缓存策略**（资源 immutable 长缓存、html no-cache）+ 发版刷新 CDN；④ **环境变量**只放公开配置、密钥留后端、注意构建期固化；⑤ 后端配 **CORS 或同源反代**、HTTPS、压缩(brotli)；⑥ source map 上传错误监控、Sentry；⑦ CI/CD 自动化构建与原子发布、回滚预案。体现从"构建 → 托管 → 缓存 → 安全 → 监控 → 流水线"的完整链路（呼应 react-deploy、exp-deploy、vue-deploy）。

**来源**：Netlify/Vercel 部署指南、MDN 部署最佳实践、web.dev — Fast and reliable site setup
