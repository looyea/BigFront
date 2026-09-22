# 性能审计：TTFB、水合成本与 bundle 账

> 目标：拿上一关的机制去算账——Kit 开箱替你做了哪九件性能好事、为什么必须在 `build && preview` 而非 dev 下测、如何用 Lighthouse/Network/`Server-Timing` 定位瓶颈，再逐项砍：图片（`@sveltejs/enhanced-img`）/视频/字体（handle 里 `resolve` 带 preload 过滤）、代码瘦身（Svelte 版本 / visualizer / 动态 import）、水合成本、瀑布（server load 聚合 vs 客户端串行）、预加载策略、托管与 HTTP/2（呼应 vite-ci-perf 度量三件套、svelte-perf）

## 一、先认清：Kit 开箱已经帮你做的九件事

官方明确列了 SvelteKit 默认就在做的优化，审计前先确认你没把它们关掉白费力气：

1. **代码分割**——只加载当前页需要的代码；
2. **资源预加载**——防止"文件请求文件"的瀑布；
3. **文件 hash**——资源可永久缓存；
4. **请求合并（request coalescing）**——多个 **server load** 的数据拉取被归并成**一次** HTTP 往返；
5. **并行加载**——多个 **universal load** 并发取数，不串行；
6. **数据内联（data inlining）**——SSR 期间 `fetch` 过的请求，浏览器水合时**直接复用内联结果、不再发一次**（靠 `+page.server`/universal load 里那个代理 `fetch`，别绕过它裸调 `globalThis.fetch`）；
7. **保守失效（conservative invalidation）**——只在必要时重跑 load；
8. **预渲染**——无动态数据的页可秒开（可按路由配）；
9. **链接预加载**——悬停/视口内即预备好目标页的 code + data。

**性能审计的本质不是"加东西"，而是"别破坏这九条 + 补它没覆盖的（图片/字体/第三方脚本）"。**

## 二、测量纪律：只在 preview 测，别信 dev 的数

dev 模式行为和生产**根本不同**（无真 manifest、SSR 走 Vite 即时编译、不压缩、不分割到位）。官方红线：**性能测试要 `vite build` 之后跑 `vite preview`**。工具选择：

- **上线站点**：Google **PageSpeed Insights** / **WebPageTest**（真实网络、实验室 + 字段数据）。
- **本地/任意**：Chrome/Edge 的 **Lighthouse + Network + Performance** 面板，Firefox Network/Performance，Safari 性能面板。
- **后端为什么慢**：Network 里看到某个 API 调用耗时长，就上 **OpenTelemetry** 或 **`Server-Timing` 响应头**做服务端埋点，把"慢在 DB 还是慢在 SSR 渲染"分开。

Core Web Vitals（LCP/INP/CLS）是通用尺子——Kit 项目也用同一套，只是下面几节讲"在 Kit 上具体去哪砍"。

## 三、砍资源：图片 / 视频 / 字体

**图片**通常是最大、最易见效的一刀。用官方 **`@sveltejs/enhanced-img`**（`<enhanced:img>`）：构建期自动压缩、转现代格式、生成正确 `width/height`（防 CLS 布局抖动）与多尺寸 `srcset`。Lighthouse 会点名最差的几张。

**视频**：用 Handbrake 压缩、转 `.webm`/`.mp4` 等浏览器友好格式；**折叠线以下的视频** `preload="none"` 懒加载（代价是点播起播稍慢）；静音视频用 FFmpeg **抽掉音轨**再发。

**字体**——Kit 的已知盲点：它**自动预加载 `.js` 和 `.css`，但不预加载字体**（怕拉进 CSS 引用却没真正用到的字重）。正确姿势是在 **`handle` 钩子里给 `resolve` 传 preload 过滤**，把你的字体纳入预加载；并用**字体子集化（subsetting）**减体积。这是 Kit 性能调优里最常被漏的一块，务必手动处理。

## 四、砍代码体积

- **升到最新 Svelte**：官方排序 **Svelte 5 < Svelte 4 < Svelte 3**（越小越快），跑最新版本本身就是免费性能。
- **找大包**：`rollup-plugin-visualizer` 看谁占体积；或 `build: { minify: false }` 临时关压缩**肉眼读产物**（记得部署前改回来）、或浏览器 Network 面板反查。
- **第三方脚本**：尽量少塞进浏览器。用**服务端分析**（Cloudflare/Netlify/Vercel 等平台自带）替代 JS 埋点；必须跑的第三方用 **Partytown** 丢进 Web Worker，别阻塞主线程。
- **选择性加载**：`import` 静态引入的会**打进当前页 chunk**；只在特定条件才需要的代码用 **`import()` 动态引入**，把组件懒加载——这与第一节"代码分割"是一体两面：你乱静态 import 就等于手动关掉分割。

## 五、砍瀑布与用好预加载

**瀑布（waterfall）= 一串串行请求**，是最大杀手，尤其移动/远端用户。两类：

- **浏览器瀑布**：HTML→JS→CSS→背景图→字体 的链。Kit 用 `<link rel="modulepreload">`（或响应头）大部分替你解决，但**字体等要你在 Network 面板里自查补预加载**。**SPA 模式**会制造最恶劣的瀑布（空壳页→拉 JS→JS 再渲内容→再拉数据），首屏像素前多好几趟往返——能不关 SSR 就别关。
- **后端瀑布**：universal load 里"先取 user → 用 user 取列表 → 用列表逐项取详情"这种**从浏览器串行发**的链。官方解法：**用 server load 向后端发依赖请求**（服务端到服务端、且多个 server load 被第一节"请求合并"归并成一次往返）。但 server load **也不免疫**——查 user 再查 items 两次查询，不如**一次 join** 合并。

**预加载策略**：`<a data-sveltekit-preload-data="hover|tap">` 与 `preloadCode`/`preloadData`（L7）能显著加速站内跳转，但要**节制**——给低意图链接预加载数据会白耗带宽与后端。默认挂在 `<body>` 上的预加载已覆盖常见场景，微调即可，别乱开激进档。

## 六、托管与传输层

- **前后端同机房**：SSR 服务器与你的 DB/API 应在**同一数据中心**，减少 load 阶段的后端往返延迟。
- **边缘部署**：许多 adapter 支持 deploy 到 edge（就近处理请求，TTFB 大降），部分还能**按路由**配部署位置。
- **图片走 CDN**：CDN 本质是边缘网络；多数 adapter 宿主会自动帮你做。
- **必须 HTTP/2+**：Vite 为缓存友好把代码切成**很多小文件**，这套策略**前提是能并行加载小文件**——HTTP/1.1 的队头会把它拖垮。确认你的 host 开的是 HTTP/2/3。

## 七、自检清单

1. 说出 Kit 开箱九项性能优化，并各举一个"你若乱写就会亲手破坏它"的反例（如裸调 `globalThis.fetch` 破坏数据内联、乱静态 import 破坏代码分割）。
2. 为什么 dev 下测性能是错的？PageSpeed / Lighthouse / `Server-Timing` 分别适合回答"哪一层慢"的什么问题？
3. Kit 对图片/视频/字体分别给了什么专用手段（`enhanced-img`、`preload="none"`、字体为何不自动预加载、在哪个钩子怎么补）？
4. 什么是客户端"瀑布"与后端"瀑布"？为什么"universal load 从浏览器串行取数"最差、"改用 server load + 一次 join"更优？request coalescing 在这里起了什么作用？
5. 为什么 SPA 模式对首屏不友好？为什么 Kit 的小文件代码分割要求 HTTP/2？边缘部署与前后端同机房分别压的是哪个指标？

🚀 下一站：kit-capstone——本包最后一关，把 L1→L9 全链收敛成一张"生产毕业清单"，做一次终战项目的验收演练。
