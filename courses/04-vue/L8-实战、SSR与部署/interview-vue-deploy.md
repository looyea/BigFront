# vue-deploy 面试题精选

> 共 15 题，覆盖 A 构建产物 / B 路由回退 / C 环境变量与缓存 / D CDN·压缩·选型类。

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

---

## 补充（新专题 13-15）

### 13. 设计一个前端发布回滚方案：静态资源、SSR 服务、环境变量三类变更各自的回滚粒度与陷阱。

静 态 资源：旧 版 资 产 永久 保留（CDN 不 删）使 得 「回 滚 = 把 HTML 指 向 旧 版」O(1)，陷阱 是 HTML 本 身 的 缓存（回 滚 后 CDN 仍 命 中 新 HTML → 加 版 本 标 识 刷 新 或 短 TTL+协商 缓存 的 组 合，本关 HTML 不 缓 存 题 的 回 滚 轴）；SSR 服务：实 例 滚 动 + 快 照 回 放（进 程 内 存 状态——LRU 缓存/链 接 池 状 态 不 参 与 回 滚，无 状 态 化 设 计 是 回 滚 自 由 的 前 提，本包 SSR 每 请求 单 例 题 的 运维 面）；环 境 变量：最 阴 险 的 一 类（新 版 读 新 变量 格 式、回 滚 后 旧 版 不 认——配置 与 代码 **双 向 兼 容 窗 口**：新 旧 都能 跑 在 新 配置 上 再 切，feature flag 先 行 是 通 行 做 法）；API 契 约：版 本 兼 容 窗 口 比 代 码 更 长（后 端 先 向 后 兼 容 发 布，前 端 才 能 独 立 回 滚——前 后 端 契约 的 回 滚 决 定 权 要 在 组 织 层 面 讲 清，纯 技 术 方 案 救 不 了 未 经 协 调 的 同 时 发 布）。验 证：回 滚 要 定期 演（回 滚 一 次 生 产/仿 真 的 时 间 与 失 败 点 记 录），「没 演 练 过 的 回 滚 等 于 没 有 回 滚」。

**来源**：不可变基础设施与蓝绿/金丝雀发布通行实践；前端版本回滚（CDN 资产保留）社区方案。

### 14. Source map 的工程全流程：生成、保管、符号化、安全，每环的选择与理由。

生 成：生 产 始 终 构 建 sourcemap（hidden 模式，vite 的 hidden 选项/上传 后 删 除），否 则 线上 堆栈 是 压 缩 乱 码——「有 map 才 谈 得 上 诊 断」是 第 一 原 则；保 管：map 上 传 监 控 平 台（Sentry 类）后 **从 公开 资 源 路径 移 除**（sourceMappingURL 指 向 公网 = 源码 出 库，知 名 事故 类 型），或 者 全 程 私 有 存 储 + 访 问 控 制；符 号 化：两 种 时 机——上 报 时 实 时 符 号 化（平 台 负 责，要 map 可 达）与 查 询 时 符 号 化（CI 只 传 map 索 引，热 分 析 更 便 利），要 选 一 条 并 保 证 版 本 号 贯 通（release 概 念：版 本 号 写 进 构建 产 物 + 上 报 事件，map 与 事 件 同 版 才 对 得 上）；关 联 维 度：按 版 本 聚合 异 常（新 版 引 入 的 错 误 类 型 一眼 看 出，本 关 版 本 漂移 指 纹 题 的 同 源 工 具）；安全 业 务 业 态 位：敏 感 页 面（金 融 背 景）甚 至 约 定 业 务 代 码 不 上 map，只 留 诊 断 映 射 表。流程 收 尾：发 布 流水 线 的 固 定 步 骤 = 构建 → 注 入 版 本 号 → 传 map → 删 公 开 map → 资 产 上 CDN → 切 HTML 入口——顺 序 错 一 步 就 是 一 次 泄 露 或 盲 飞。

**来源**：Sentry 文档 sourcemap 上传与隐藏部署流程；社区「source map 公网泄漏」事故复盘。

### 15. 多环境（dev/staging/prod）前端配置管理：环境差异都落在哪些载体上，各自的泄露风险与验证手段？

四 个 载 体 分 环 境：① 构建 时（VITE_*/import.meta.env）——决 定 「不 同 环境 不 同 产 物」，泄 露 面 = 反 编 译 即 得（与 硬 编 码 无 异，本关 密钥 题 的 重 申）；② 运 行 时 接 口 下 发（配置 中心/首 屏 接口）——适 合 可 运 维 变 量（URL 开 关/灰度 参数），泄 露 面 小（但 签 名/权限 相 关 不 能 走 这 条 无 鉴 权 通道）；③ 边缘 层（Nginx/CDN 注入 全局 变量、反 代 地 址）——适 合 域 名 级 差 异，注 意 SSR 每 请求 注 入 的 安全（进 度 隔 离 与 本包 SSR 单 例 题 同 构）；④ secret 空 间（仅 CI 凭 据/服务 端 代 码 持 有，从 不 出 现 在 任 何 客 户 端 资 产）。验 证 手 段：产 物 级 自 检（grep 构 建 产 物 里 的 staging 内 网 域名/预 发 密 钥 特 征 串，CI 断 言 干 净——环 境 污染 的 机 器 守 门 员）+ 冒 烟 矩 阵（staging 用 的 就 是 要 发 prod 的 那 个 产 物，只 换 载 体 不 换 包——「测 的 不 是 发 的」是 大 流 程 第 一 破 洞）。组 织 现 实：配 置 往 往 长 在 三 个 地 方（仓 库、CI secret、平 台 配 置），所 有 人 都 知 道 「唯 一 真 实 来 源」的 地 图 才 是 最 后 一 件 工 具。

**来源**：12-Factor 前端配置实践；多环境构建产物一致性的 CI 校验模式。
