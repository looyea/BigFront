# vite-deploy 面试题精选

> 共 15 题，覆盖 **静态托管 / base / 缓存与 fallback / Docker / Monorepo / Library Mode / SSG** 七类。

---

## 一、静态部署

### 1. 一个 Vite SPA 构建后，dist 里都有什么？怎么上线？

`dist/` 含：入口 `index.html`、按内容哈希命名的 JS/CSS chunk（`assets/index-a1b2.js`）、静态资源、sourcemap（若生成）。上线三选一：① 对象存储 + CDN（S3/OSS + CloudFront）；② 静态托管平台（Netlify/Vercel/Cloudflare Pages/GH Pages）`vite build` 后上传 dist；③ 自托管 Nginx `root dist` + 缓存头 + SPA fallback。纯前端产物无需 Node 运行时（SSR 除外）。上线前用 `vite preview` 拿真实产物自检。

**来源**：Vite — "Deploying Static Assets / build output"; Netlify/Vercel — "Vite deploy guides"

### 2. `base` 到底影响什么？子路径部署不配会怎样？

`base` 是发布应用时资源 URL 的公共前缀，决定 `index.html` 里 `<script>/<link>/img` 的引用路径与运行时 `import.meta.env.BASE_URL`。默认 `/`。部署在 `https://x/my-app/` 却不设 `base:'/my-app/'` → 产物仍引用 `/assets/...`（域名根）→ 404 白屏。相对 `./` 适合路径不定/本地打开，但与 history 深层路由的相对解析有坑。CDN 部署可把 base 指向 CDN 域。GitHub Pages 项目站常见坑就是漏配 `base:/仓库名/`。

**来源**：Vite — "Public Base Path / base"; Vue Router — "base / history"; GH Pages — "project sites base"

### 3. SPA history 路由刷新 404 的根因与解法？

history 模式用 `history.pushState` 改地址栏，但 `/about` 并非真实文件；直接刷新/分享该 URL 会向服务器请求 `/about`，静态服务器找不到 → 404。解法：**服务端 fallback**——把所有未匹配到文件的请求返回 `index.html`，前端路由再接管。Nginx `try_files $uri $uri/ /index.html`；Netlify `_redirects: /* /index.html 200`；Vercel rewrite；对象存储配"404 也返回 index.html"。hash 模式（`/#/about`）不需要 fallback 但 URL 不美观。

**来源**：MDN — "History API / pushState"; Nginx — "try_files SPA"; create-react-app/Vite — "SPA routing fallback"

---

## 二、缓存与传输

### 4. 为什么 hashed 资源用 immutable 长缓存、index.html 用 no-cache？

文件名带 contenthash（内容变则名变），所以某个具体 hash 的文件永远不会变 → 可 `Cache-Control: public, max-age=31536000, immutable` 让浏览器/CDN 永久强缓存、命中即秒开。而 `index.html` 引用着这些 hash 名，**必须每次协商**（`no-cache`）才能保证发版后浏览器拿到指向新 hash 的 HTML；若 HTML 也强缓存，用户会拿到旧 HTML 去请求已被淘汰的旧 hash → 发版后白屏/加载失败。二者配套才既快又能及时更新（呼应 Express L4）。

**来源**：web.dev — "HTTP caching / immutable"; MDN — "Cache-Control"; Vite — "asset hashing / cache"

### 5. gzip/brotli 应该在哪一层做？构建期还是服务器？

优先在 CDN/边缘或 Nginx 层动态/预压缩（brotli 压缩率更高、gzip 兼容广）。也可构建期预压（`vite-plugin-compression` 产出 `.gz`/`.br`）让服务器直接发静态压缩文件、省 CPU。注意：别压已压缩资源（图片/视频/字体多数已压），小文件（低于阈值）不值得。文本类 JS/CSS/HTML 压缩收益最大。原则：靠近用户做、别把压缩 CPU 压在源站热路径（呼应 Express L8 性能）。

**来源**：web.dev — "text compression / brotli"; Nginx — "gzip / brotli module"; Vite — "compress assets"

---

## 三、容器与流程

### 6. 用 Docker 部署一个 Vite SPA，推荐的 Dockerfile 结构？

多阶段：① 构建阶段 `node` 镜像 `npm ci && npm run build` 产出 dist；② 运行阶段用轻量 `nginx:alpine`，把 dist 拷进 `/usr/share/nginx/html` + 自定义 `nginx.conf`（缓存头、SPA fallback）。Node 只在构建阶段出现，运行镜像不含 Node/源码/devDeps → 小、攻击面小（呼应 Express L8）。`.dockerignore` 排除 node_modules/dist。若 SSR 则运行阶段换成 `node` 跑 server 产物。

**来源**：Docker — "Build a Vue/React app / multi-stage"; nginx — "serve static SPA"

---

## 四、Monorepo

### 7. 前端为什么要用 Monorepo？带来什么收益与成本？

收益：① 统一依赖版本（配合 catalog/单一 lockfile 防版本漂移）；② 跨包原子改动（一个 PR 同改库+应用）；③ 复用配置/CI/构建缓存；④ 内部包"源码直用"提升 DX。成本：① 构建图/依赖拓扑复杂（需 turbo/nx 编排）；② 权限边界模糊（一个仓库全员可碰）；③ CI 需增量/受影响范围分析避免全量构建；④ 需 workspace 与工具链正确配置。适合多包强关联的中大型团队，简单项目不必上。

**来源**：Turbo — "what is a monorepo"; Nx — "monorepo benefits"; pnpm — "workspaces"

### 8. Monorepo 里本地包被 Vite 应用消费，源码直用和产物消费各有什么利弊？

- **源码直用**（库入口指 `src/*.ts` + 应用 `optimizeDeps.exclude`）：改库源码即时 HMR、无需先 build、类型直达；但要让 Vite 能解析真实路径（`preserveSymlinks:false`、workspace 软链）、库不能含应用环境跑不了的构建步骤。
- **产物消费**（库先 build 出 dist，app 依赖之）：边界清晰、贴近真实发布、可测产物；但要"先库后 app"的构建顺序（turbo 编排）、开发期改库要重新 build 或配 watch，HMR 体验差。
内部协作常用源码直用求快，对外发布包用产物消费求稳。

**来源**：Vite — "Monorepo / linked deps / optimizeDeps"; Turbo — "caching / build order"; pnpm workspace — "link:"

---

## 五、Library Mode

### 9. 用 Vite 库模式发布组件库，配置上要注意哪些点？

① `build.lib` 设 entry/name/formats（至少 ES + CJS，按需 UMD）；② `rollupOptions.external` 把 vue/react 等 **peerDependencies** 排除，别打进包（重复实例/体积爆炸）；③ `fileName` 各格式规范命名；④ `package.json` 配 `exports`（import/require 条件）、`types`、`sideEffects:false`（利于 tree-shaking）；⑤ 用 `vite-plugin-dts`/`vue-tsc` 生成完整 `.d.ts`；⑥ CSS 会聚成单文件需文档说明引入方式；⑦ SSR 兼容（避免顶层访问 window）。库模式是底座，工程质量靠 exports 与类型。

**来源**：Vite — "Build Library Mode"; Vue — "component library / vite-plugin-dts"; node — "package exports / conditional"

### 10. 为什么库要同时产出 ESM 和 CJS、并设 `sideEffects: false`？

消费者环境多样：现代 bundler/Node ESM 走 ESM（可 tree-shake），老工具/CommonJS `require` 走 CJS——双格式最大化兼容。`sideEffects:false` 告诉打包器"未被引用且无副作用的模块可整块删除"，让下游能彻底 tree-shake 掉未用到的导出，减小消费方体积。若确有全局副作用（如注入 polyfill 的入口）则不能盲目设 false，要用数组精确标注。类型（`.d.ts`）与 `exports.types` 保证 TS 体验。

**来源**：Rollup — "tree-shaking / sideEffects"; package.json — "exports / sideEffects"; TS — "declaration emit"

---

## 六、预渲染与选型

### 11. Vite 项目要 SEO，一定得上 SSR 吗？SSG/预渲染是不是更省事？

不一定。若内容**不随请求变化**（博客、文档、落地页），**预渲染/SSG** 更优：构建期输出静态 HTML，首屏与 SEO 都达标，却**无需常驻 Node 服务**、可纯静态 CDN 托管、更便宜更稳。SSR 才适合"每次请求内容不同/需实时个性化"。选型阶梯：纯 CSR（SEO 不重要）→ SSG（内容静态）→ SSR/流式（内容动态）。别为不需要的动态性背上 SSR 运维成本。

**来源**：web.dev — "SSR vs SSG vs CSR"; vite-ssg / Astro — "static sites"; Next — "SSG vs SSR decision"

### 12. 从"构建产物"到"稳定上线"，你会在 CI/CD 里做哪些事？

流水线：`npm ci` → lint + 类型检查（`tsc --noEmit`，esbuild 不查类型，呼应 vite-framework）→ 单测/构建 → 产物检查（体积阈值、敏感信息扫描、无秘密进包）→ `vite preview` + E2E/冒烟 → 构建镜像（多阶段）→ 推 Registry（不可变 tag）→ 部署（滚动/金丝雀）→ 缓存头/base/SPA fallback 校验 → 监控告警。Monorepo 用 turbo 受影响范围只构建改动包。发版后 CDN 刷新/预热。把"先测量/先验证"落到门禁里，防回退。

**来源**：Vite CI — "GitHub Actions / build"; Turborepo — "affected / remote caching"; Google SRE — "CI/CD / release engineering"

---

## 补充（新专题 13-15）

### 13.  vite preview 能当生产服务器用吗？它的实现是什么、边界在哪？

实现：preview 复用 dev server 的中间件栈（connect + sirv 静态服务），但跳过转换层直接 serve dist——所以它"像 dev 一样能配 history fallback、代理、headers"。官方立场明确：不是生产服务器（性能无并发优化、无 TLS/HTTP2 终结、错误处理面向开发者）。真实边界：内网预览/CI 冒烟验证（产物可加载性、路由回退是否配置正确）完全够用；公网生产必须换专业静态服务器（nginx/Caddy/CDN origin），原因不是"会崩"而是"缺能力"：缓存头精细控制、限流、TLS 配置、访问日志与监控、原子发布联动都无处安放。常见误用的事故样本：preview 的 CORS 默认宽松、暴露 .map 文件（配合 map 上传策略是泄露面）、无 gzip 层导致"预览很快线上慢"的对比失真。正确姿势写成检查表：preview 只验证"产物+路由+资源解析"三件事；性能与安全基线在真实服务器层复测。加分句：preview 的定位是"用 dev 的体验验证 build 的产物"——它是发布流程的质量闸而非发布目标本身。

**来源**：Vite 官方 preview 文档；sirv 项目；Vite#8463（preview 非生产用途讨论）

### 14.  给一个 Vite SPA 写生产级部署链：nginx 配置模板与 Docker 多阶段构建你会包含什么？

nginx 要素清单：history 回退（try_files $uri /index.html，静态资源路径前缀优先命中真文件）；缓存分层（hash 资源 expires 1y + immutable，index.html no-cache——配错一侧就白屏或缓存炸弹）；压缩（gzip on 起步；brotli 需模块或前置层，压缩层级与 min length 权衡小文件开销）；安全头（CSP、X-Frame-Options、nosniff，配合 SRI 的 crossorigin）；错误页与健康检查端点。Docker 多阶段：builder 层（node:alpine、corepack 启用 pnpm、先 COPY lockfile → install → 再 COPY 源码——利用层缓存把依赖安装与代码变更分离）→ 产物只进 runtime 层（nginx:alpine + COPY --from 的 dist，镜像从几百 MB 到 20 MB 量级）；构建参数（VITE_API_URL 这类编译期常量不能靠容器 env——要显式 ARG 传入并文档化"它是构建产物的一部分"，运行时可变的要改服务端注入配置）。CI 联动：镜像 tag 绑 git sha + 版本 manifest；发布用蓝绿或 CDN 原子切换（呼应 splitting 关的 ChunkLoadError）。加分句：这题拿分靠"顺序与理由"——每行配置都能挂一句"不配会发生什么事故"，比背指令集值钱。

**来源**：nginx 官方 best practices（缓存与压缩）；Docker 官方 Node 多阶段指南；web.dev 缓存策略

### 15.  CI 环境里构建 Vite 项目，和本地相比有哪些必须显式处理的差异？

差异逐条：① 缓存冷——lockfile 与 store、node_modules、Vite 的 node_modules/.vite 与 cacheDir 分层缓存（key 含 lock hash + 构建相关文件 hashFiles 范围，呼应 ci-perf 关）；恢复缓存后要验证依赖版本一致性（缓存投毒与半新状态比无缓存更糟，hash 不匹配宁可重建）；② 内存与并发——CI 容器内存常低于开发机，大项目 build 的 OOM（exit 137）要 Node heap 上限与机器限额对齐、rollup 并行度调低或按模块拆分构建；pnpm 的 --frozen-lockfile 必开（CI 禁改 lock）；③ 环境变量与密钥——Vite 的 VITE_ 前缀是"会进产物"的语义红线，CI 里用非前缀 env 传给部署配置、构建前跑产物扫描守卫（密钥上产物是 CI 最贵的事故，呼应 plugin-write 的守卫题）；④ 网络与时区——registry 镜像源固定、sourcemap 上传在构建步骤内完成（产物销毁后就找不到 map）；⑤ 可复现性——同 commit 两次构建 hash 应一致（路径/环境差异破坏内容哈希稳定性，排查见 splitting 关的 hash 传染题）。收口句：本地跑得快是"环境有状态"的假象，CI 的纪律是把一切状态显式化——锁文件、缓存 key、env 清单三项齐备才算迁移完成。

**来源**：Vite 官方 CI 建议；pnpm store 缓存文档（actions/cache）；Node --max-old-space-size 与容器内存限额实践
