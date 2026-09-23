# next-render-modes 面试题（12 题）

> 来源：整理自 CSDN、掘金、SegmentFault、知乎、InfoQ 等站点 Next.js 渲染模式高频面经，中文重述。

---

## A. 概念辨析

**1. 一句话区分 SSR、SSG、ISR、CSR，并各给一个适用页面？**
**来源**：知乎《Next.js 四种渲染方式》；CSDN《SSR/SSG/ISR 面试标配题》
SSG 构建时生成（营销落地页/文档）、ISR 构建生成+到期后台翻新（新闻列表/商品详情）、SSR 请求时生成（个性化仪表盘）、CSR 浏览器生成（登录后工具面板）。加分点：说明 App Router 下四者不是"选择"而是数据依赖推导的结果。

**2. 什么是 Hydration？为什么 Next 页面"能看到内容"了还需要它？**
**来源**：掘金《水合：从能看到能用》；SegmentFault《为什么 SSR 之后还要执行 React》
服务端 HTML 只是像素，没有事件与状态。水合让客户端 React 以同一份组件树接管 DOM：比对结构、绑定事件、恢复交互。没有水合，SSR 页面是"静态图片级"的体验；水合成本（JS 下载+执行）也是 SSR 并非万能的原因（呼应 next-render-modes 第二节）。

**3. 水合不一致（hydration mismatch）常见诱因与修复套路？**
**来源**：CSDN《Hydration error 大全》；知乎《React 18 水合警告为何变严重了》
诱因：`Date.now()`/`Math.random()`、读 `window/localStorage`、条件渲染依赖客户端状态、浏览器插件改 DOM、HTML 不合法被浏览器修复重排。套路：浏览器专属数据 useEffect 后再渲染、随机/时间类 UI 标记为纯客户端组件、SSR 关闭第三方插件干扰路径、严格校验 JSX 产出合法 HTML。

---

## B. 模式深挖

**4. ISR 的"过期后台重验证"里，触发重渲染的那次请求拿到的是新页还是旧页？**
**来源**：InfoQ《ISR 的 stale-while-revalidate 模型》
旧页。ISR 采用 SWR（stale-while-revalidate）语义：过期后的首个请求仍返回缓存旧内容，同时后台异步重渲染，完成后的后续请求才拿新页——用一次"陈旧容忍"换全站永不阻塞（呼应 node-deploy-perf 的 CDN stale 策略、mp-network 的缓存思想）。

**5. App Router 还有 getServerSideProps/getStaticProps 吗？数据获取模型变成什么样了？**
**来源**：掘金《从数据获取函数到 async 组件》；SegmentFault《App Router 数据获取范式》
没有了。任何服务端组件可直接 `async/await` 取数，渲染与取数合一；"模式"由段配置（`dynamic`、`revalidate`、`fetch` 的 cache 选项）与请求态 API（cookies/headers）共同决定（L4 展开）。思维从"页面级钩子"变为"组件级数据依赖"。

**6. Streaming SSR 解决了传统 SSR 的什么痛点？**
**来源**：InfoQ《Streaming 是 SSR 的第二次革命》；知乎《React 18 renderToPipeableStream 与 Next》
传统 SSR 要等**最慢的那份数据**就绪才能吐出第一个字节，TTFB 被木桶效应拖死。Streaming 把 HTML 分块：壳与已就绪部分先吐，慢的部分以占位符后补（配合 Suspense/loading.tsx），显著提前首屏与可交互（L3 next-context-streaming 主讲，呼应 vue-ssr-nuxt 的 streamed rendering）。

---

## C. 与 Vue/Nuxt 及手搓方案对比

**7. 你在 10-vite 里手搓过 SSR，Next 帮你省了哪些活？**
**来源**：CSDN《从零搭 SSR 与用框架的差距清单》
入口双构建（client/server bundle）、Node 服务里的 renderToString 与错误兜底、资源 manifest 注入、hydration 脚本编排、按路由的代码分割与预取、缓存头管理——手搓全要自己维护且极易在水合与缓存上翻车（呼应 vite-ssr 的教训：框架的价值=把这些变成默认值）。

**8. Nuxt 的 SSR/SSG/ISR/hybrid 与 Next 同名模式的实现差异？**
**来源**：InfoQ《Vue 与 React 全栈框架对照》；知乎（Vue 3 + Nitro 相关讨论）
Nuxt 靠 Nitro 引擎统一输出目标、`routeRules` 集中声明每路由模式；Next 靠段级配置与代码行为推断。Vue 模板编译器对 hydration 负担更小（可静态提升），React 的 RSC 则把"哪些代码根本不下发"做到组件级——两种流派，08-nuxt 会正面对照（呼应 vue-ssr-nuxt）。

---

## D. 决策与实战

**9. 产品说"商品详情要秒开、还要显示实时库存"，你怎么设计渲染策略？**
**来源**：掘金《电商详情页的 ISR + 边缘组件方案》；SegmentFault《静态壳+动态位》
骨架与主信息走 ISR（分钟级翻新足够、扛得住大促），实时库存/价格做成**独立的动态小组件**（客户端 fetch 或 Suspense 流式慢槽），必要时边缘渲染。这题考的是"页面可拆渲染单元"的现代心智（呼应 react-architecture 边界划分、mp-subpackage 按需思想）。

**10. 同一项目里可以同时存在四种模式吗？会不会互相打架？**
**来源**：CSDN《Next.js 混合渲染实践》
天然共存：博客列表 ISR、文章页 ISR、搜索页 SSR、后台管理 CSR 化片段。不打架的关键是缓存键隔离与跳转时的 Router Cache 行为（静态页的 RSC payload 也会被浏览器缓存，动态跳转感知靠版本与 revalidation，L4 细讲）。

**11. TTFB、FCP、LCP、hydration 时间，SSR 主要优化哪个、恶化哪个？**
**来源**：InfoQ《真实用户指标手册》；知乎《SSR 的性能账本》
优化 FCP/LCP（HTML 到达即有内容）；但服务器现算会**恶化 TTFB**（对比 CDN 直给的 SSG），且 JS 水合让"可交互"滞后于"看得见"——所以 INP/TTI 要单独盯（呼应 react-performance、mp-performance 的指标分层）。

**12. 怎么向不做前端的同事解释"为什么我们的网站搜得到内容了"？**
**来源**：知乎《如何通俗解释 SSR 对 SEO 的意义》
以前爬虫拿到的是空壳 DIV，内容要靠 JS 执行后才出现，很多搜索引擎的渲染队列有延迟甚至不渲染；现在 HTML 抵达即含正文与 meta，收录速度与排名可验证地提升——业务语言：搜索入口的免费流量从"看运气"变成"确定性"（呼应 next-overview 第一节、next-metadata 的 structured data）。
