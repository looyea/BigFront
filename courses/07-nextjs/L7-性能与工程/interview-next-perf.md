# next-perf 面试题（15 题）

> 主题：Core Web Vitals、包体优化、渲染与数据通路性能。

## A. 概念辨析

### A1. 请解释 Core Web Vitals 的三个指标以及各自的优化抓手。

**答**：LCP（最大内容绘制，≤2.5s）关注"主要内容多久出现"，抓手是 HTML 快（缓存/并行取数）、首屏图优化（next/image）、字体不阻塞（next/font + size-adjust）；INP（交互到下次绘制，≤200ms）关注"点了有没有反馈"，抓手是缩小 'use client' 边界、next/dynamic 延迟大 JS、减少主线程长任务；CLS（累计布局偏移，≤0.1）关注"版面抖不抖"，抓手是给图片/异步内容预留尺寸（next/image 自动占位、dynamic 的 loading 占位）、字体度量补偿。

**来源**：掘金《深入理解 Core Web Vitals 与 Next.js 性能优化实战》；SegmentFault《INP 取代 FID 后我们该做什么》。

### A2. Next.js 应用相比纯 SPA 在性能上天然赢在哪、输在哪？

**答**：赢在首屏——SSR/SSG 直接吐 HTML，LCP 不依赖 JS 下载执行完才开始；Link 视口预取让二次导航近乎瞬时；三层缓存（记忆化/Full Route Cache/unstable_cache）可把数据成本摊平。输在复杂度高——服务端渲染有 TTFB 开销、Hydration 要再执行一遍 JS 造成水合期主线程繁忙（INP 风险）、缓存策略配错还会返回过期内容。所以 Next 的性能是"设计出来的"，旋钮配错比 SPA 还慢。

**来源**：知乎《Next.js 的性能优势到底体现在哪里》；CSDN《SSR 与 SPA 首屏性能对比实测》。

### A3. Lighthouse 跑分很高，线上用户却反馈卡，为什么？如何定位？

**答**：Lighthouse 是实验室数据（固定设备/网络、无缓存场景），真实用户受设备性能、弱网、浏览器插件、缓存状态影响，两者可能严重背离，尤其 INP 几乎只能在真实用户数据里暴露。定位方法是接 web-vitals 上报（Next 里用 next/script 或自建 /api/metrics 收点），按路由、设备等级、地域分桶看 p75，找出真实慢页面再回到实验室复现。

**来源**：InfoQ《真实用户监控：为什么 Lighthouse 分数不可全信》；掘金《web-vitals 上报在 Next.js 中的落地》。

## B. 包体与加载

### B1. next/dynamic 的 ssr: false 解决什么问题？滥用有什么副作用？

**答**：解决"组件依赖 window/document 等服务端不存在的环境"以及"体积大且首屏不可见"的模块（地图、编辑器、图表）不该进服务端渲染路径的问题。副作用：该组件内容在服务端 HTML 中缺席，用户白屏等 JS 下载执行——用多了会拖 LCP、放大 CLS（若不配 loading 占位）。原则：只给"首屏不可见"或"纯客户端能力"的组件用，且永远配 loading。

**来源**：SegmentFault《next/dynamic 使用姿势与坑》；CSDN《ssr:false 对 SEO 与 LCP 的影响分析》。

### B2. 如何系统地分析并缩小 Next.js 的 First Load JS？

**答**：四步：① 看 next build 日志的路由级 Size 列，锁定超 200KB 的路由；② 上 @next/bundle-analyzer 打 Treemap，找到占比最大的依赖；③ 对症处理——重组件移出首屏（next/dynamic）、重依赖替换（moment→dayjs、lodash 按需、图标改 SVG）、检查是否不小心把服务端大依赖引到了 'use client' 组件里；④ 回归构建日志对比前后。核心心法：客户端 bundle 大小由 'use client' 边界决定，缩边界就是缩包体。

**来源**：掘金《Next.js 包体积优化：从 build 日志到 bundle analyzer》；知乎《'use client' 与打包产物大小的关系》。

### B3. Link 的 prefetch 原理是什么？页面里链接很多时要注意什么？

**答**：Link 在目标链接进入视口时，用浏览器空闲时间预取目标路由的 RSC Payload 并放进 Router Cache，点击时直接渲染，实现"秒开"。链接海量时（长列表、站点地图页）全部默认预取会造成带宽与源站风暴，应对：非首屏链接 prefetch={false}、或新版本用悬停预取策略；同时意识到预取的是 RSC Payload 不是完整 HTML，动态页（ƒ）预取仍会打到服务端。

**来源**：InfoQ《Next.js 预取机制与 Router Cache 详解》；掘金《长列表里 Link 的正确打开方式》。

## C. 渲染与数据

### C1. 服务端组件里的\"取数瀑布\"是怎么形成的？有哪些解法？

**答**：连续 await 且后一个依赖前一个的结果之外的独立请求，串行执行导致 TTFB 是各请求之和。解法：① 独立请求 Promise.all 并行；② 非关键数据下推到 Suspense 边界流式输出，首屏只等 LCP 关键集（呼应骨架屏三标准）；③ 数据本身可缓存的走 unstable_cache / Full Route Cache，让第二次请求根本不回源；④ 接口聚合：多个小请求合成一个批量接口（呼应 next-route-handlers）。

**来源**：掘金《App Router 数据获取的瀑布与流水线》；SegmentFault《Streaming SSR 缓解慢接口实战》。

### C2. 三层缓存金字塔分别是什么？优化时优先争取命中哪层？

**答**：从上到下：请求记忆化（同一次渲染内同 URL fetch 去重，React 猴子补丁 fetch）、Full Route Cache（构建期/ISR 生成的静态路由直接 CDN 命中）、unstable_cache（跨请求的函数级缓存，tag 失效）。优化优先争取 CDN 层命中——成本最低、TTFB 接近纯静态；动态个性化页面退而求其次靠记忆化与函数缓存；真正每次必须回源的越少越好。判断标准是\"响应与请求者是否无关\"，无关才有资格进 Full Route Cache（呼应 next-fetch-cache 第 4 节安全线）。

**来源**：CSDN《Next.js 缓存体系全景图》；知乎《unstable_cache 与 Full Route Cache 如何选》。

### C3. INP 很差，页面是 Next 应用，你的排查思路是？

**答**：INP 差说明主线程被长任务占住。排查：① Performance 面板录制慢交互，找长任务归属——常见是超大 hydration（客户端边界画太粗，整页 'use client'）；② 检查是否有同步大 loop、频繁 setState 引发的重渲染风暴（React Profiler 佐证，呼应 react-performance）；③ 三方库（富文本、图表）在主线程初始化；④ 确认不是网络慢被误判——INP 只算主线程。处理顺序：拆边界、懒加载重组件、把纯展示的搬回服务端组件让客户端少执行 JS。

**来源**：掘金《INP 优化实战：从火焰图到架构调整》；InfoQ《React 长任务与交互延迟》。

## D. 工程与决策

### D1. next/image 与 next/font 分别治什么性能病？

**答**：next/image 治图片病：自动 WebP/AVIF、按设备 DPR 与容器出对应尺寸、懒加载、width/height 占位防 CLS、远程图可代优化——LCP 元素常是首图，图片瘦身直接抬 LCP。next/font 治字体病：构建期自托管零外链（消掉第三方字体 CDN 的 TTFB 抖动）、size-adjust 度量补偿防字体交换引起的 CLS、display:swap 策略可控。两者都是"默认配置即最优"的旋钮，属于低成本高收益优化，应最先做。

**来源**：SegmentFault《Next.js 图片与字体优化最佳实践》；CSDN《CLS 元凶：图片占位与字体回退》。

### D2. 自建部署（Node/Nginx）时如何在传输层继续榨性能？

**答**：① 开启 brotli（静态资源压缩率优于 gzip 约 15-20%），但跳过已压缩的图片/webp；② /_next/static 保留内容哈希 + immutable 长缓存，任何情况下不要动；③ ISR 页面把 stale-while-revalidate 透传给 CDN/Nginx 缓存层，让边缘节点顶住回源；④ HTTP/2 或 H3 复用连接；⑤ 上传大文件走对象存储直传，不要挤占应用服务器带宽（呼应 next-deploy）。注意 standalone 输出减小 Docker 镜像也属于部署侧性能（预习 next-deploy）。

**来源**：掘金《Next.js + Nginx 生产环境缓存与压缩调优》；知乎《brotli 与静态资源长缓存实践》。

### D3. 给你一个"慢"的 Next 站点，如何给出有优先级的优化方案？

**答**：先测后医：真实用户数据（web-vitals p75 按路由分桶）找出最痛的 Top 3 路由 → 归因分层：HTML 慢（数据/缓存层）、JS 多（边界/包体层）、资源重（图片字体层）、交互卡（主线程层）→ 按 ROI 排序执行：通常先做零风险默认项（next/image、next/font、并行取数），再做策略项（ISR/缓存层级、prefetch 调整），最后动结构（拆 'use client' 边界、组件下沉服务端）→ 每项改动后回归 build 日志与真实指标，防止按下葫芦浮起瓢（如 ssr:false 加多反而 LCP 变差）。

**来源**：InfoQ《性能优化项目的推进方法论》；掘金《一次 Next.js 站点性能治理复盘》。

---

## 补充（新专题 13-15）

### D4.  对慢路由做性能审计，按 RSC 架构你会检查哪些层？各用什么工具？

**答**：分层清单：① 度量层——先接 Vercel Analytics 或自建 web-vitals 上报，按路由模板拿 LCP/INP/CLS 分位数 + Next 15 的 cache 命中率指标，定位"哪类页慢"而非猜；② 渲染层——React DevTools Profiler 含水合火焰图（哪棵树重渲）、next build 日志看路由被标静态还是动态（ƒ vs ○）、Suspense 边界 flush 时序（performance.mark 打点）；③ 数据层——Data Fetching 瀑布：layout/page 链上 await 是否并行、重复 fetch（memoization 键是否被新对象 options 打断）、缓存命中（x-nextjs-cache）；④ 包体层——@next/bundle-analyzer 看客户端岛 import 图与第三方贡献、字体/图片体积；⑤ 传输层——预取是否过激（/_next/data 或 RSC 请求占带宽比例）、CDN 命中、压缩、HTTP 版本；⑥ 基础设施——函数冷启动、边缘区域回源延迟。工具随层走，先 ① 定嫌疑再下钻，别一上来开 analyzer。

**来源**：Next.js 官方 Analytics / Debugging 与生产指标指南；InfoQ《App Router 性能审计分层法》。

### D5.  预取（prefetch）是性能优化还是性能负债？给你一个"治理预取带宽"的操作手册。

**答**：手册：① 定性——预取换"点击后时延"，成本是"点击概率×payload 体积"，导航链接高概率值、内容条目低概率亏；② 测量——Network 面板/服务端日志统计 RSC 预取请求 vs 真实导航的比值（>3:1 即过度）、CDN 出带宽按路径归因；③ 分级——主导航/面包屑/上一页下一页保持默认，搜索结果列表/商品流/带参筛选链接 prefetch={false}，长列表里"前 K 项预取"可自定义（进视口+停留再预取的小封装）；④ 降本——把动态段的预取成本压小（RSC 壳轻、重数据 Suspense 后懒取）、静态段预吃 CDN 缓存；⑤ 预算——预取带宽占比写进发布检查，改版复测。收口句：prefetch 默认值是"导航站善意"，流量大站必须自己掌勺——一句话把"为什么"与"怎么办"都占了。

**来源**：Vercel 官方 <Link> 预取文档；掘金《列表页带宽翻倍的真凶是 prefetch》。

### D6.  把"构建时长从 25 分钟压回 6 分钟"的工程任务交给你，按 Next 项目常见病因开药。

**答**：病因与药：① 页面生成量爆炸——SSG 页 × locale × 分页全枚举：generateStaticParams 按热度分层（长尾让 dynamicParams 运行时生成 + CDN 缓存首访），或构建期分批/增量站点；② 类型检查——大仓 tsc 占半壁：next build 里 typescript.ignoreBuildErrors + 把 tsc 拆成并行 CI job（lint/type/test 解耦），ESLint 同理可 noEmit 并行；③ 依赖图与缓存——monorepo 里大量无 shared 缓存的重复编译：Turbopack（实验稳定化路线）或至少开启 .next 与 node_modules 的 CI 缓存、锁文件级增量；远程缓存（Vercel 自建 runner 缓存/自定义构建缓存实验）；④ 数据预取进构建——build 时 fetch 外部服务拉全站数据（一慢全慢、一挂构建挂）：改为构建产物只出壳、首请求 SWR 填充，或数据层加本地快照；⑤ 图片/字体下载——Google Fonts 构建期网络抖：CI 内网镜像/本地化字体文件；next/image 远程图构建期优化关掉。度量先行：build --debug + 阶段日志分清"编译/类型/生成"三堆时间再动刀，25 分钟的项目常常 15 分钟在类型、8 分钟在页面生成——药方完全不同。

**来源**：InfoQ《Next.js 构建提速实录》；SegmentFault《next build 慢在哪：依赖图/类型/SWC》。
