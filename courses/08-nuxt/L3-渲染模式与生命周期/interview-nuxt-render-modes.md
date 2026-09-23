# nuxt-render-modes 面试题（12 题）

> 主题：渲染策略、routeRules 治理、缓存安全与平台适配。

## A. 概念与对照

### A1. 解释 Nuxt 的四种渲染模式与各自代价。

**答**：SSR（默认）：每请求现渲染，HTML 即完整内容；代价是 TTFB 含数据等待、服务器常驻。SSG（prerender）：构建期出 HTML，CDN 秒出；代价是内容变更要重发布或配再生。SWR/ISR 化（swr:秒数）：缓存命中先给旧 HTML、后台再生成；代价是新鲜度窗口与缓存层复杂度。SPA（ssr:false）：只发外壳，内容全在客户端；代价是 SEO 归零、首屏依赖 JS（本质回到 07 包开局的 SPA 三座大山）。选型不是站队而是逐路由分配——混合渲染是现代站点的常态（呼应 next-render-modes、nuxt-render-modes 第 1 节）。

**来源**：掘金《四种渲染模式的成本表》；InfoQ《混合渲染：从口号到配置表》。

### A2. Next 用页面代码声明动态、Nuxt 用 routeRules 集中声明，两种设计的利弊？

**答**：Next（拉模型）：页面用 cookies()/dynamic APIs 自证动态——就近原则，改页面即改策略，不会"配置忘同步"；但策略散在代码里，全局审计要扫全仓。Nuxt（推模型）：routeRules 一张表管全站——可评审、可 codeowner、CI 可做规则 lint（比如"带 cookie 的路径段禁止 prerender"这种全局不变量）；但表与代码分离，新增页面忘配表=默默吃了默认 SSR，大流量页意外进缓存也可能只因通配符写宽。没有优劣只有团队适配：重集中治理选 Nuxt 风格，重就近自治选 Next 风格（呼应 nuxt-render-modes 第 1 节、next-fetch-cache 第 5 节）。

**来源**：知乎《集中式与分布式的渲染策略》；CSDN《routeRules 评审清单》。

### A3. swr 与 isr 两个 route rules 键的差别？

**答**：swr: N —— Nitro 内置的 stale-while-revalidate：命中即回旧+后台再生，本地可控，语义自洽。isr: N —— 面向平台 CDN 的提示（Vercel 系语义）：除浏览器/边缘的 SWR 窗口外，还会把缓存交给平台边缘层并透传 ISR 再生能力，preset 不同落地差异大。要点：两者都作用在 HTML 路由缓存层；数据层缓存要另配 defineCachedEventHandler/useCachedFunction（nuxt-server-routes）。答对这题的关键是把"缓存分两层"讲清楚（呼应 next-fetch-cache 三层金字塔的压缩版）。

**来源**：SegmentFault《Nuxt 缓存的两层结构》；掘金《swr 还是 isr：一个决策小抄》。

## B. 实战与陷阱

### B1. 上线后发现某些页面在 CDN 上串了用户数据，排查与修复路线？

**答**：串号=动态页进了共享缓存。路线：① 定位缓存层（浏览器 disk→CDN→Nitro 内存）：无 cookie 的 curl 从边缘打一遍，能拿到用户 HTML 即 CDN/Nitro 层问题；② 找漏配：routeRules 通配是否把 /user/** 罩进 swr、或页面用了 useRequestHeader 却仍 prerender；③ 修复：动态页退缓存 + 静态壳动态数据方案（外壳 prerender、数据客户端拉，ssr:false 区的变体）；④ 防再犯：CI 里 lint "prerender/swr 路径清单 ∩ 带 cookie 路径 = 空"。这类事故 Next/Nuxt 同配方排查，本质都是缓存安全线（呼应 next-fetch-cache 第 4 节、nuxt-render-modes 第 4 节）。

**来源**：CSDN《一次缓存串号事故的完整复盘》；InfoQ《HTML 缓存的安全审计方法》。

### B2. 迁移遗留系统，前端 Nuxt 但老接口在 Java 服务上，routeRules 能帮什么？

**答**：三板斧：① `proxy: '/api/legacy/**': { proxy: 'https://java-svc/legacy/**' }`——同源免 CORS、鉴权 cookie 自然流转、前端代码零改址；② `redirect`/`rewrite` 做旧 URL 兼容与灰度切流（rewrite 到 SPA 壳做按路径分流）；③ `headers` 统一挂 CORS/CSP/缓存策略。proxy 在 Nitro 层执行，SSR 内部取数也能命中（省一跳公网）。这组能力对应 Next 的 rewrites/redirects 但覆盖面更宽（含 headers/websocket 开关）——迁移项目的体验红利常在这几个旋钮（呼应 nuxt-render-modes 第 2 节、next-fetch-cache 段配置）。

**来源**：掘金《routeRules.proxy 干掉一层 BFF》；知乎《渐进迁移里的重定向工程》。

### B3. prerender + crawlLinks 很省事，为什么大站反而要慎用？

**答**：爬取清单的三大失控：① 规模失控——全站可达链接都被爬，十万级长尾页把构建拖到小时级（构建时间是发布体验的隐形税）；② 污染风险——爬到带参数的调试链接、用户生成的低质页，进了 SSG 就等于"永久收录"；③ 不可审计——清单是运行时涌现的，没人 review "这周怎么多出一万页"。大站做法：routes 显式函数化（从内容 API 拉白名单式清单，变更即 PR），crawlLinks 只在文档类封闭站点用；配 `ignore` 规则兜底。原则同 07 包：静态化的页面是资产也是负债（呼应 next-revalidate 第 5 节失效半径）。

**来源**：SegmentFault《crawlLinks 构建拖慢排查》；CSDN《预渲染清单的白名单治理》。

## C. 生命周期与请求链路

### C1. 画出一个 SSR 请求从进入到返回经过哪些关卡（routeRules 视角）。

**答**：链路：HTTP 进 Nitro → **Nitro server middleware**（全局请求钩子，可改写/短路）→ **routeRules 匹配**（redirect 直接终结；proxy 转发出去；缓存键命中则回缓存 HTML）→ 未命中进 Vue 应用：路由解析 → **route middleware**（鉴权/重定向，可 abort）→ app:created/render:3xx 等 Nuxt 钩子 → 组件树服务端渲染（useFetch 收集进 payload）→ HTML 流/字符串输出 → （若该规则可缓存）写回 HTML 缓存 → 响应带 headers 出栈。水合在浏览器继续：payload 注入 → Vue hydrate → 交互接管（呼应 nuxt-lifecycle 时间线、nuxt-hydration）。

**来源**：掘金《一次 SSR 请求的完整一生》；InfoQ《Nitro 请求管道解剖》。

### C2. ssr:false 区域的 SEO 与首屏怎么救？

**答**：承认这是"主动放弃 SSR 换取开发/运行简单"的区（登录后台本就 noindex，SEO 无需求）。真正要救的是"内容页因技术债 SPA 化"的过渡态：① 骨架壳 + routeRules.ssr:false 配 `payloadExtraction` 优化首包；② 关键内容改由构建期注入静态文案（prerender 的退化用法）；③ 中期计划还是回到 SSR——Nuxt 给的是"分区豁免"而不是"整站躺平"（全站 ssr:false 等于自废武功，回答时表态清楚）。对照 Next 的 CSR 页困境同款（呼应 next-render-modes 第 4 节、nuxt-perf）。

**来源**：知乎《后台页面要不要 SSR》；掘金《ssr:false 的正当与不正当用法》。

### C3. routeRules 能配 headers，布局/页面里也能 setHeader，冲突时谁赢？

**答**：分层语义：routeRules.headers 是路由级声明，Nitro 在响应组装时应用，适合"整棵子树的恒定头"（缓存策略、X-Robots-Tag）；页面/服务端中间件的 setResponseHeader 在渲染过程执行，后写覆盖前写——同键最终值看写入时机，Nitro 头合并对 cache-control 这类敏感键没有仲裁魔法。实践规则：**缓存与安全头只走 routeRules 单通道**（集中可审计），业务响应头才在代码里设——两处都能配的头最易埋雷（呼应 nuxt-server-routes、B2）。

**来源**：CSDN《响应头被谁改了：一次双通道冲突》；SegmentFault《routeRules.headers 治理规范》。

## D. 决策与方法论

### D1. 给内容站设计渲染分层：首页/列表/详情/专题活动页/搜索结果页，各配什么策略？

**答**：首页：prerender + 高频 revalidate（swr 短窗 60s，编辑发布走主动失效）；列表：swr 中窗（分类页流量大、分钟级新鲜度足够）+ 分页尾部降级 SSR；详情：SSR 兜长尾 + 热门 id 动态升级 swr（按 PV 榜单注入 routeRules——配置函数化的价值）；专题活动页：prerender（变更靠发布）；搜索页：**永不缓存**，SSR 或 SPA 二选一（带任意 query 的响应都不同，进缓存必串结果——安全线考点）。方法：先画"流量×新鲜度容忍"矩阵，再落到 routeRules——策略是矩阵的投影，不是框架的偏好（呼应 next-perf 第 3 节、nuxt-render-modes 第 4 节）。

**来源**：掘金《内容站渲染策略矩阵》；InfoQ《搜索页为什么不该进 CDN》。

### D2. 团队抱怨"routeRules 太多看不懂站点拓扑"，你怎么办？

**答**：把治理工具化：① 派生可视化——写脚本读 nuxt.config 生成"路径规则表"（正则/前缀、策略、headers、归属 owner）挂在内部门户，每次构建自动更新；② 规则收敛：通配层级 ≤3、重叠规则必须显式 `order` 注释、redirect 表单独文件管理；③ CI 检查不变量（动态路径∉缓存集、缓存路径有 owner、redirect 目标可达）；④ 季度清理：访问日志对账，没人访问的预渲染页退出清单（构建提速）。配置表是代码也是资产，资产要盘点（呼应 B2 的 proxy 表、D3 审计思路）。

**来源**：SegmentFault《把 routeRules 管成基础设施》；CSDN《预渲染清单的季度大扫除》。

### D3. 从 0 选型：什么信号让你果断选 Nuxt 而非 Next（或相反）？

**答**：正向 Nuxt 信号：Vue 团队背景（最大权重）、多平台部署不确定/私有化刚需（Nitro preset 广度）、想要低认知税的同构模型（无 RSC 边界）、轻量全栈（server/api 够用就好）。正向 Next 信号：React 生态绑定（组件库/招聘）、重内容站想要 RSC 的"零 JS 静态壳"红利、需要平台深度（Vercel 全家桶）、Server Actions 表单流契合产品。反信号同样有效：要极致 SEO 又大量动态→Nuxt 需要更多手工缓存功课；重实时协作→两边都别硬上（回 SPA）。一句话：先定团队与部署，再看范式口味——框架是最后一公里（呼应 nuxt-overview C1、next-architect B1）。

**来源**：知乎《Nuxt 与 Next 的决策树》；InfoQ《2025 全栈框架选型因子排序》。
