# next-overview 面试题（15 题）

> 来源：整理自 CSDN、掘金、SegmentFault、知乎、InfoQ 等站点历年 Next.js 高频讨论与面经，中文重述。

---

## A. 定位与选型

**1. 为什么企业级 React 项目大多用 Next.js 而不是裸 Vite + React Router？**
**来源**：SegmentFault《Next.js 与 CRA/Vite 的选型对比》；知乎《如何理解 Next.js 的价值》
裸骨架要自己解决 SSR、代码分割、图片优化、预取、路由级缓存等一整套工程问题，Next 将这些做成框架默认值；对内容型/To C 项目，SEO 与首屏是硬需求，自研 SSR 方案的维护成本远高于直接用 Next。

**2. Next.js、Nuxt、Remix/React Router v7 的定位差异？**
**来源**：InfoQ《主流 React/Vue 全栈框架对比》
Nuxt 是 Vue 阵营的等价物（本包 08）；Remix 强调基于 Web 标准（Request/Response、并发加载）与嵌套路由数据；Next 的差异化在 RSC 与缓存体系、以及 Vercel 托管生态。选型看团队栈、部署环境与对"框架接管深度"的接受度。

**3. 什么场景下你反而会建议不要用 Next？**
**来源**：知乎《Next.js 有什么缺点或局限？》；掘金《我们为什么从 Next.js 迁走》
纯内网中后台（无 SEO、登录后才谈首屏）用 SPA 更简单；强依赖浏览器扩展/纯客户端能力（如复杂画布工具）时 RSC 反而碍事；以及需要极度定制构建链的项目——框架的"魔法"越深，逃生通道越贵。

---

## B. 架构与心智

**4. Next.js 项目没有 index.html，那浏览器拿到的文档从哪来？**
**来源**：CSDN《Next.js 渲染流程源码解析》；掘金《SSR 到底渲染了什么》
由服务端渲染管线生成：SSG 在构建时预生成静态 HTML 文件；SSR 每次请求执行 React 服务端渲染输出 HTML；之后浏览器加载 JS 做 hydration 接管。文档模板由框架内置，可用自定义 document（Pages Router）或 layout（App Router）影响结构。

**5. App Router 与 Pages Router 的本质区别？**
**来源**：SegmentFault《App Router 和 Pages Router 怎么选》；知乎《React Server Components 落地形态》
Pages Router 每页独立、浏览器数据获取为主；App Router 以嵌套布局为单位、支持服务端组件与流式渲染，数据获取下沉到组件层。官方以 App Router 为未来主线，存量 Pages 项目可共存迁移（呼应 next-architect）。

**6. `npm run build` 之后 Next 都产出了什么？**
**来源**：掘金《next build 产物目录 .next 解读》
.next 目录：客户端 chunk（按路由分包）、服务端渲染用的 JS bundle、静态页面 HTML（SSG 页）、manifest（路由与预载资源映射）、以及 API/middleware 的独立构建产物。start 时按 manifest 决定每类路由走静态文件还是动态渲染。

---

## C. 与 Node/部署的关系

**7. Next 应用本质上还是一个 Node 服务吗？serverless 托管时呢？**
**来源**：InfoQ《前端框架的部署形态演化》；CSDN《Vercel 上 Next 是怎么跑的》
`npm start` 就是一个 Node HTTP 服务（next/server 提供的 requestHandler）。上 Vercel/云函数时，动态路由被拆成函数粒度部署、静态产物走 CDN——同一份构建被"拆开卖"，这就是官方推荐 standalone/分阶段产物的原因（呼应 next-deploy、node-deploy-perf）。

**8. 从 Express 后端视角看，Next 的哪些能力是"抢生意"？**
**来源**：知乎《Next.js 能替代 Node 后端吗？》；SegmentFault《BFF 与全栈框架的边界》
API 路由（Route Handlers）、中间件、会话鉴权、模板渲染——这些正是 09-express 的主场。但 Next 的定位是 BFF/产品级全栈，重业务后端（消息队列、定时任务、多服务共享的领域层）仍该独立服务（呼应 next-route-handlers、exp-server）。

**9. 为什么 create-next-app 默认就把 TypeScript 与 ESLint 配好？**
**来源**：掘金《Next.js 的工程化默认值》
框架接管了工具链编排：tsconfig 自动注入路径别名与 JSX 配置、ESLint/SWC 规则内置，降低"初始化正确性"成本——这也是 10-vite 中 vite-plugin 生态思想的官方一体化版本（呼应 vite-plugin-api、ts-project）。

---

## D. 综合场景

**10. 老板问：上 Next 重构能带来什么可量化收益？你怎么答？**
**来源**：知乎《SSR 对转化率的影响有数据吗？》；InfoQ《性能即业务指标》
给三类指标：① LCP/白屏时长下降（预渲染直接改善）；② 搜索流量/收录页数（内容页 SEO 从 0 到 1）；③ 工程成本收敛（一套部署、跨端类型共享，对照原来前后端两仓库）。用 mp-performance 的"度量五步工作流"思路先测基线再谈收益。

**11. 大前端团队推 Next 落地，最大的阻力通常在哪？**
**来源**：CSDN《团队引入 Next.js 踩坑记录》；掘金《RSC 学习曲线是真的》
不是技术而是心智：客户端工程师要接受"这个组件不在浏览器跑"、后端边界要重新划分（数据获取上移）、调试链路变长（服务端 HTML→水合→交互三段，对应真机调试三层定位思路，呼应 mp-publish）。培训计划应优先攻克 RSC 边界（本包 L3）。

**12. 为什么说"Next 让 React 组件变成了服务端可编程单元"？**
**来源**：InfoQ《RSC 标志着前端框架进入第二幕》；知乎《如何理解 Server Components 的历史意义》
组件既可在服务器执行（直接查库、读文件、持有密钥），又把结果作为流式 HTML/RSC Payload 下发——"组件"从纯 UI 函数升维为跨端计算单元，这是 07 包 L3/L4/L5 全部内容的底层逻辑，也是面试拉开差距的分水岭。

---

## 补充（新专题 13-15）

**13.  把 Next 与 Astro、Remix、纯 Vite SPA 放在"复杂度/首屏性能/SEO/生态/团队心智"五个维度上对比，你会怎么打分？**
**来源**：InfoQ《主流前端框架选型报告》；知乎《Astro、Remix 与 Next.js 到底怎么选》
五轴简评：① 复杂度——Vite SPA 最低（只有 bundler+router），Astro 中（ islands 心智需理解），Next 与 Remix 都高（Next 高在 RSC+缓存三层，Remix 高在并发 loader/action/Web 标准）；② 首屏——Astro 最强（默认零客户端 JS）、Next SSG/ISR 紧随、Remix SSR 流式与 Next SSR 相当、Vite SPA 最弱；③ SEO——Astro/Next SSG 优、Remix/Next SSR 良、Vite SPA 差（除非 prerender）；④ 生态——Next（React 全生态）> Remix（同为 React）> Vite SPA（无框架绑定）> Astro（跨框架 islands 生态在长）；⑤ 团队心智——Vite SPA 最平（人人会 React），Astro 需接受模板化，Remix 需接受 Web 标准+并发心智，Next 需接受 RSC 边界+缓存模型（学习曲线最陡）。结论：没有"最优"、只有"最合适"——按项目主导矛盾（SEO/首屏 vs 交互密度 vs 团队栈）选。

**14.  有人说"Next 太重、我只要个静态导出站"，你怎么回应？哪些是 Next 可以关掉的、哪些是关不掉的？**
**来源**：掘金《Next.js 静态导出能做什么、不能做什么》；Next.js 官方文档 output: export 限制清单
可以关/裁剪：① 渲染模式——output:export 直接产出纯静态 HTML+JS，不要 Node 服务、无 ISR/无 Route Handlers/无 middleware/无 headers/rewrites，够用就把它当"带文件路由和 <Image> 优化的静态生成器"；② 客户端 JS——用 RSC + 少 'use client' 边界，页面几乎不下载组件 JS；③ 数据层——不用 fetch 缓存/不用 revalidate 就退化成"普通文件读写"。关不掉的底层：文件路由的目录约定、build 期扫描、SWC/Turbopack 编译链、app 与 pages 两套语义、Next 自己的 <Image>/<Link> 组件与其打包产物结构。所以"轻"是有边界的：Next 的"轻"是"运行时轻"（可以静态托管），但"构建期/心智"不会比 Vite 轻。真要极简，Astro/纯 Vite+构建脚本才是答案——这题考点是"你能否说清框架哪部分是产品价值、哪部分是实现细节"。

**15.  RSC 时代，Next 与"前端 = 客户端"这一老心智决裂在哪里？代价是什么？**
**来源**：InfoQ《RSC 标志着前端框架进入第二幕》；Dan Abramov《React as a UI Architecture》相关讨论
决裂点三条：① "组件"从"永远在浏览器跑的函数"变成"运行位置是架构决策"——服务端组件、客户端组件、共享组件三态，作者要为每段代码选运行位置；② "数据获取"从"客户端 useEffect 里发请求"回到"组件里 await 直连数据源"，前端重新拿回了"渲染即数据"的能力，但也意味着前端要理解连接池、密钥、SQL 边界这些"后端手艺"；③ "状态"从"一个大 store 全局响应式"退回"URL/服务端是真相 + 客户端只留交互局部"。代价：① 心智曲线陡——客户端工程师要接受"这段代码不在浏览器执行"的抽象、要理解 RSC Payload 与 hydration 的两阶段；② 调试链路长——服务端 HTML→水合→交互，三段各有报错，Source Map 与断点跨端；③ 生态摩擦——三方库默认假设 window/DOM 存在，需要打边界、加 wrapper；④ 缓存复杂度——三层缓存 + revalidate 语义把"数据为什么是旧的"变成日常问题。这些代价不是不能扛，而是要团队清楚"换来了什么"。
