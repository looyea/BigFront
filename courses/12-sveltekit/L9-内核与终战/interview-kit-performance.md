# kit-performance 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) SvelteKit 开箱默认替你做了哪些性能优化？至少说六项。
**来源**：Kit 开箱优化清单题的转述。

代码分割（只加载当前页所需）、资源预加载（防瀑布）、文件 hash（永久缓存）、**请求合并**（多 server load 归并成一次 HTTP）、**并行加载**（多 universal load 并发）、**数据内联**（SSR 的 fetch 水合时复用不再发）、保守失效（只在必要时重跑 load）、预渲染、链接预加载。审计的本质是"别破坏这些 + 补它没覆盖的（图/字体/三方脚本）"。

### 2. (A) "数据内联（data inlining）"的触发前提是什么？你怎样会亲手破坏它？
**来源**：load fetch 代理机制题的转述。

前提：在 load 里用**事件对象提供的那个 `fetch`** 发请求，Kit 才能记录其响应并内联进页面供水合复用。破坏方式：绕过它去裸调 `globalThis.fetch`/axios/XMLHttpRequest——Kit 记不到，浏览器端会**再发一次**同样的请求，白白多一趟往返。

### 3. (B) 上线 LCP 很差，从 Kit 角度给出你的排查与削减顺序。
**来源**：LCP 实战调优题的转述。

① 确认没被误关 SSR/开了 SPA 模式（空壳→拉 JS→再取数据的最恶劣瀑布）；② 首屏大图换 `@sveltejs/enhanced-img`（压缩、现代格式、正确 width/height）并置于关键路径、必要时 preload；③ web 字体默认不预加载——在 handle 里给 resolve 加 preload 过滤 + 子集化，消除文本阻塞；④ 检查是否用 server load 把首屏数据合并成一次（避免客户端串行取数）。LCP 元素多为图或大标题，优先攻这两类。

### 4. (A) 为什么 Kit 默认不预加载 web 字体？正确补法是什么？
**来源**：字体预加载专题题的转述。

它自动预加载关键 `.js`/`.css`，但字体若全预加载会拉进 CSS 引用却**当前页没真正用到**的字重，浪费带宽。正确补法：在 `handle` 里 `resolve(event, { preload: (href,type)=> type==='font'||默认规则 })` 把你的字体纳入预加载，并对字体做 **subsetting** 减体积。这块是 Kit 调优最常被漏的盲点。

### 5. (C) request coalescing、parallel loading、waterfall 三者的关系？为什么 server load 更能抗瀑布？
**来源**：数据获取模式对比题的转述。

universal load 在**浏览器**跑，若一个 load 里"user→用 user 取 items→逐项取详情"就产生浏览器串行瀑布，跨慢网络致命。改用 **server load**：请求从服务端发（就近后端），且多个 server load 的取数被**请求合并**成一次 HTTP 往返、并行执行。但 server load 也不免疫——两次 DB 查询不如**一次 join** 合并。

### 6. (B) 你发现某个 build 产物 JS 体积暴涨，怎么定位元凶并瘦身？
**来源**：bundle 体积排坑题的转述。

用 `rollup-plugin-visualizer` 看占比最大的包；临时 `build:{minify:false}` 肉眼读产物（记得改回）或浏览器 Network 反查。瘦身方向：把只在特定条件需要的代码改**动态 `import()`**（别静态 import 进当前页 chunk）、移除未用重依赖、尽量用服务端分析替代第三方 JS（或 Partytown 丢进 Worker）、升到最新 Svelte（5 比 4/3 更小更快）。

### 7. (A) 第三方脚本怎么放才不拖垮 INP/主线程？
**来源**：三方脚本与主线程题的转述。

能不用浏览器 JS 就不用——改用平台自带的**服务端分析**（Cloudflare/Netlify/Vercel）。必须跑的（如某些 SDK）用 **Partytown** 放进 **Web Worker**，避免阻塞主线程直接改善 INP。原则：最小化浏览器里跑的第三方脚本数量。

### 8. (D) 一个"预加载开太猛"反被产品投诉耗流量/后端压力的项目，你怎么调？
**来源**：预加载策略权衡题的转述。

预加载（hover/tap 的 `data-sveltekit-preload-data`、`preloadCode`/`preloadData`）加速站内跳转，但对**低意图链接**预拉数据=白耗带宽与后端。调法：默认保留挂在 `<body>` 的常规预加载，对高成本/低频路由改 `viewport` 或关闭、只 `preloadCode` 不 `preloadData`，把激进档留给确有把握的下一步导航；用 Network 面板核对每条预加载的实际收益。

### 9. (C) Kit 的 prerender、CDN 缓存、数据缓存三者边界怎么分？
**来源**：缓存分层题的转述。

prerender 是**构建期**把无动态数据的页渲成静态 HTML（第 1 阶段执行），运行时根本不进 handle；CDN/edge 缓存是**部署期**对 HTML/资源按 `Cache-Control` 做**响应级**缓存（Kit 端点无自动缓存，得自己加头）；数据缓存是**应用层**在 server load 里对上游结果做 memo/TTL。三层各司其职，别把动态页误 prerender、也别指望框架替你缓存端点。

### 10. (A) "非必需慢数据"在 load 里怎么返回才对首屏最友好？
**来源**：流式/延迟数据题的转述。

把慢且非首屏必需的数据在 load 返回对象里放成 **promise** 而非 await 后的值：对 **server load**，这会让该数据在导航（或首屏）之后**流式补进来**，先渲出骨架/其余内容，改善 LCP/可交互时间。别为了"数据都齐了再渲"去 await 一个慢调用把整页拖住。

### 11. (B) preview 里一切正常，部署到某 serverless 平台后流式响应退化、TTFB 反而变差，为什么？
**来源**：平台缓冲与 adapter 差异题的转述。

preview 跑本地 Node、能体现流式；某些 serverless/edge 平台会**缓冲整个响应**再一次性吐出（Lambda 类），使"数据内联 + 流式补数据"的收益消失、TTFB 被拉长到全页就绪。查所选 adapter 目标平台能力（是否支持流式/`ReadableStream`），必要时换 edge adapter 或调整渲染/缓存策略。

### 12. (D) 让你给团队定一份"Kit 性能预算 + 度量口径"，你会写哪些条目？
**来源**：性能预算设计题的转述。

① **口径**：一律 `build && preview` 上测，Lighthouse（LCP/INP/CLS）+ WebPageTest 字段数据，后端埋 `Server-Timing`/OpenTelemetry；② **预算**：首屏 JS 压缩后上限（如 ≤ XX KB/gzip）、关键图体积、字体子集后体积、三方脚本数=0 或全进 Worker；③ **守门**：CI 里 visualizer 比对体积、破坏开箱九优化（裸 fetch、SPA 化、乱静态 import）即告警；④ **传输**：强制 HTTP/2+、前后端同机房或边缘、图片 CDN。每条都可被度量、可回归。

---

## 补充（新专题 13-15）

### 13.  上线 LCP 很差：给出你在 Kit 技术栈上的完整排查树。 

 分渲染层（prerender/SSR 首包大小、数据内联体量）、资源层（字体阻塞、hero 图未 preload/未优先编码）、传输层（CDN 命中、HTML 缓存）、代码层（关键 JS 分割过度/不足）；CrUX+RUM 定分布再逐层削。 

**来源**： https://web.dev/articles/lcp ； https://svelte.dev/docs/kit 

### 14.  build 产物体积暴涨的归因方法学？ 

 体积归因要用产物级工具（visualizer/build stats 差分两版 chunk 归属），逐个升级依赖二分定位只作辅助；CI 设包体积预算门禁防无声劣化，同时区分客户端与服务端 bundle 各自设限。 

**来源**： https://github.com/btd/rollup-plugin-visualizer ； https://svelte.dev/docs/kit/faq 

### 15.  预加载开太猛被投诉耗流量，你的分级方案？ 

 按路由价值分级：高频入口 hover+viewport，长尾改 click/off；尊重 saveData 与慢网探测；后端对预取请求（purpose 头）降级只回摘要数据；每月复盘预取浪费率调参。 

**来源**： https://svelte.dev/docs/kit/advanced-routing#Preloading 
