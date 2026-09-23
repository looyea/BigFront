# vue-deploy 面试题精选

> 共 12 题，覆盖 A 构建产物 / B 路由回退 / C 环境变量与缓存 / D CDN·压缩·选型类。

## 一、构建产物（A 类）

### 1. `vite build` 都做了哪些事？产物长什么样？
生产构建做 tree-shaking、转译/压缩（esbuild+Rollup）、代码分割、静态资源内联或加 hash、按 `base` 重写路径，输出纯静态 `dist/`（`index.html` + `assets/*.[hash]` + `public/` 原样拷贝）。SPA 场景这份静态目录任意静态服务器/CDN 即可托管（呼应 vue-deploy 第一节、10-vite build）。
**来源**：Vite 文档 — 生产构建、Building for Production

### 2. 什么是 `base`？部署到子目录资源 404 怎么办？
`base` 决定 `index.html` 里资源引用的公共前缀。部署到 `https://x/admin/` 却没设 `base:'/admin/'`，产物仍请求 `/assets/...` 就 404。要同时对齐 Vite `base`、Nginx `root/alias`、CDN 前缀（呼应 vue-deploy 第二节）。
**来源**：Vite 文档 — 公开路径 base、部署公共基础路径

## 二、路由回退（B 类）

### 3. history 路由刷新 404 的原理和解决？hash 路由为何没这问题？
`createWebHistory` 用 `pushState` 产生真实路径，刷新时浏览器向服务器请求该路径文件，服务器无此文件即 404。解法：服务器把所有未命中静态文件的路径回退到 `index.html`（Nginx `try_files $uri $uri/ /index.html`），前端路由再接管解析。hash 路由（`/#/path`）服务器永远只拿 `/index.html`，故天然免回退，但 URL 丑、SEO 差（呼应 vue-deploy 第三节、vue-router-basics 第一节）。
**来源**：Vue Router 部署 — history mode 服务器回退、MDN pushState

### 4. Nginx 部署 SPA 的最小可用配置要点有哪些？
`root` 指向 dist、`index index.html`、`location / { try_files $uri $uri/ /index.html; }`、给 assets 长缓存给 html no-cache、开 gzip、必要时配 HTTPS/HSTS 与安全头（呼应 vue-deploy 第三、五、六节、exp-static）。
**来源**：Nginx 官方 — SPA 部署 recipes、Vue 部署指南

## 三、环境变量与缓存（C 类）

### 5. 前端能把 API 密钥放进 `VITE_` 变量吗？为什么？
不能。`VITE_` 变量在**构建时内联**进 JS 产物、随浏览器下载公开，任何人反解 bundle 就能拿到。秘密必须留后端，前端只调后端接口；把密钥发前端等同公开（呼应 vue-deploy 第四节、node-config、exp-security/OWASP）。
**来源**：Vite 文档 — 环境变量与模式、12-Factor 前端配置误区

### 6. 为什么 hash 文件名 + 长缓存 + index.html 不缓存，是最优缓存组合？
assets 带内容 hash：内容变→文件名变→URL 变，故可 `immutable` 永久缓存、发版靠换名天然失效，命中率高。`index.html` 不带 hash 且是"资源清单"，若长缓存用户会一直拿指向旧资源的入口，所以 `no-cache`/短缓存保证每次校验拿到最新入口（呼应 vue-deploy 第五节）。
**来源**：web.dev — HTTP caching、cache-busting with hashed filenames

### 7. 发版后用户偶发点新路由报"chunk 加载失败"，为什么、怎么缓解？
旧 `index.html` 被缓存，或用户在旧页面停留时发了新 hash 版，去 `import()` 已被清理的旧 chunk → 404。缓解：保留一段时间新旧产物并存/CDN 不即删、`router.onError`/异步组件 onError 捕获后 `location.reload()`、index.html 不长缓存（呼应 vue-project-architecture、vue-deploy 第五节）。
**来源**：rollup/Vite — dynamically imported module failed、SPA 发布 chunk 失效实践

## 四、CDN·压缩·选型（D 类）

### 8. gzip 与 brotli 有何区别？预压缩放在哪一层更好？
都在 HTTP 层压缩文本资源减小传输；brotli 压缩率更高（尤其静态资产）、现代浏览器普遍支持。构建期预压缩（`vite-plugin-compression` 生成 `.gz`/`.br`）比每个请求现算更省 CPU，服务器直接按 `Accept-Encoding` 选发（呼应 vue-deploy 第六节、node-deploy-perf、10-vite）。
**来源**：web.dev — 文本压缩 brotli/gzip、Vite 压缩插件

### 9. CDN 对一个 Vue SPA 的价值？和缓存策略怎么配合？
CDN 就近分发静态产物降低延迟、卸载源站带宽。与 hash 长缓存配合：不变资源在边缘与浏览器长期命中，发版换 hash 又保证即时失效；`index.html` 走动态/短缓存（呼应 vue-deploy 第六节）。
**来源**：web.dev — CDN 与缓存、MDN Cache-Control

### 10. 首屏优化你能列出哪些具体手段？
路由/组件分包 + 关键路由预加载（`import()`、`modulepreload`）、`<link rel=preload>` 关键资源、图片懒加载 + 现代格式、brotli/gzip + CDN、`shallowRef`/虚拟滚动防大列表卡顿、SSG 直出 HTML。先测量（visualizer、Lighthouse、Performance 面板）再优化（呼应 vue-performance、vue-deploy 第六节）。
**来源**：web.dev — 首屏加载/性能清单、Vue 性能最佳实践

### 11. SPA / SSG / SSR 分别适合什么项目？部署有何不同？
SPA：交互型后台、对 SEO/首屏不敏感，`vite build` 静态托管 + try_files。SSG：内容稳定营销/文档站，构建时预渲染纯静态上 CDN 免服务器。SSR：内容高度动态又要 SEO/首屏，需 Node/edge 跑 server entry。三轴权衡：SEO/首屏 × 动态性 × 运维（呼应 vue-deploy 第七节、vue-ssr-nuxt）。
**来源**：Nuxt 渲染策略、Jamstack / 渲染模式综述

### 12. SSR/Node 版前端产物在生产怎么稳定跑起来（进程层面）？
用 pm2/系统服务守护、多进程 cluster 利用多核、健康检查与优雅重启、结构化日志与监控、环境变量外置、灰度/回滚。与 Node 后端部署同一套（呼应 node-deploy-perf、exp-deploy、08-nuxt Nitro 部署预设）。
**来源**：Node 生产部署最佳实践、pm2 / cluster 文档、Nuxt Nitro 部署目标
