# next-dynamic 面试题（15 题）

> 来源：整理自 CSDN、掘金、SegmentFault、知乎等站点 Next.js 动态与高级路由高频面经，中文重述。

---

## A. 动态段基础

**1. [slug]、[...slug]、[[...slug]] 三种写法分别匹配什么？**
**来源**：CSDN《Next.js 动态路由三种括号》；掘金《App Router 路由匹配规则》
`[slug]` 恰好一段；`[...slug]` 一段及以上（params.slug 为数组）；`[[...slug]]` 零段及以上——`/docs` 与 `/docs/a/b` 同页。典型：最后一种做"文档站默认首页+任意深度路径"。

**2. 动态页要做 SEO，每个参数的 title 怎么独立生成？**
**来源**：知乎《generateMetadata 最佳实践》
页面旁写 `generateMetadata({ params })`，内部按参数查库返回 title/description——它与 generateStaticParams 一样在服务端执行，SSG 页会为每个预生成参数各跑一次（L6 next-metadata 主讲；对照小程序分享卡 onShareAppMessage 的逐页标题，呼应 mp-openapi）。

**3. 为什么 Next 15 把 params 改成异步 Promise？带来什么好处？**
**来源**：InfoQ《Next.js 15 变更解读》；SegmentFault（async params 讨论）
统一为异步后可在读取参数时做缓存策略/预取调度，避免渲染早期同步阻塞；也让 params 与 searchParams、cookies 的 API 形态一致（都是请求态异步源），为 PPR 与细粒度缓存铺路（呼应 next-revalidate）。

---

## B. 并行与拦截

**4. 并行路由（Parallel Routes）解决什么问题？和组件里直接渲染两个子组件有何区别？**
**来源**：掘金《并行路由到底香在哪》
价值在**每个槽独立拥有路由语义**：各自的 URL 联动（/dashboard/analytics 切左槽）、各自的 loading/error/default 边界、各自的导航刷新——组合组件做不到"槽级路由"。适合仪表盘多面板独立演进的场景（呼应 react-architecture 的故障隔离单元）。

**5. 拦截路由实现 modal 相比 useState 弹窗的优势在哪？刷新后会发生什么？**
**来源**：CSDN《用拦截路由做详情页弹窗》；知乎（Next Modal 模式讨论）
URL 反映弹窗状态：可分享、可前进后退、刷新后降级为整页（内容不丢）——而 state 弹窗刷新即失踪。刷新直达时命中的是真实 /posts/[id] 整页页，用户无感知差异（呼应 next-render-modes 的 URL 即状态、react-lists-keys 之外的另一个"状态放哪"命题）。

**6. 并行路由的槽匹配失败时渲染什么？activePath 是干什么的？**
**来源**：SegmentFault《@slot 与 activePath 配置》
槽内有 `default.tsx` 则渲染兜底，没有则该槽为 null；`{ activePath: '/other' }` 可强制该槽按另一路径渲染内容——用于"从 A 页进来也要显示 B 槽数据"的组合（本课第六节表格的补充细则）。

---

## C. 边界与坑

**7. generateStaticParams 返回一万个参数值，构建会怎样？工程上怎么办？**
**来源**：InfoQ《大规模 SSG 的构建时长问题》；CSDN《Next 构建卡在 Generating 怎么办》
一万个页面串行/低并发预渲染，构建可能拖到几十分钟。缓解：分批/fallback 语义（App Router 用 dynamicParams:true 现渲 + ISR 补缓存）、只预生成 Top N 热门、其余首访转 SSR——"枚举"与"按需"的权衡（呼应 vite-build 的构建耗时优化、mp-subpackage 按需加载哲学）。

**8. 动态段参数能拿到 undefined 或注入攻击值吗？校验责任在谁？**
**来源**：知乎《路由参数的安全边界》
能——URL 任意值都会进来（`/blog/../../etc`、超长串）。参数进入 DB 查询/文件读取前必须校验清洗：zod 解析、白名单正则、类型收窄；页面应对非法值 `notFound()` 而非 500（呼应 exp-validation 的"输入皆可疑"、next-error-loading）。

**9. 拦截路由和 middleware 都能"改写"请求，分工怎么划？**
**来源**：SegmentFault《rewrite 的两个层次》
middleware 在**边缘/请求层**改写（鉴权重定向、AB 分流、i18n 前缀），产出的是"另一份响应计划"；拦截路由在**渲染层**按导航来源选组件（同一 URL 两种呈现）。层次不同可共存，排障时先 curl 看服务端到底返回了什么（呼应 next-middleware-auth、node-http 的请求管线视角）。

---

## D. 综合场景

**10. 设计一个 i18n 路由：/zh/blog/[slug] 与 /en/blog/[slug] 共用逻辑，目录怎么组织？**
**来源**：掘金《App Router 国际化路由方案》；CSDN（next-intl 实践相关）
`app/[lang]/blog/[slug]/page.tsx` 单实现，`[lang]` 校验为 zh/en 否则 notFound()；layout 里按 lang 提供 Provider；配合 middleware 做默认语言重定向与 `<Link>` 拼 locale。备选 `[...catchAll]`+rewrite 不推荐——类型与可读性差（呼应 vue-router-guard-lazy 的 beforeResolve 方案对照）。

**11. 产品要求"同一个 /profile 页，从消息中心进来顶部显示未读面板、从导航栏进来不显示"，怎么实现最 Next？**
**来源**：知乎（并行路由 + 拦截组合相关讨论）
并行路由槽 `@panel` + `activePath` 按来源控制，或拦截路由配合 from 参数。得分点在拒绝"use globalState 记住来源"的脆弱方案——让**路由结构本身**承载来源语义（呼应 mp-communication 的判断轴：URL > 全局状态）。

**12. 十万级 slug 的商品站，SEO 页与性能如何兼得？给完整方案。**
**来源**：InfoQ《电商大站的混合渲染架构》
Top 热门 generateStaticParams 预生成 + ISR 定时翻新；长尾 dynamicParams 现渲 + 边缘缓存 + stale 容忍；参数校验防扫库攻击；sitemap 分片供爬虫；监控 404/500 比率反哺白名单——综合题，覆盖本课全部四节（呼应 next-revalidate、node-deploy-perf 的 CDN 分层）。

---

## 补充（新专题 13-15）

**13.  Next 15 为什么把 params / searchParams 改成 Promise？这与异步/流式渲染有什么关系？**
**来源**：Next.js 官方《Upgrading to Next.js 15: async params/searchParams》；Vercel 博客《Partial Prerendering 设计动机》
渲染本质是"把组件树产出成 HTML 流"。老模型里 params/searchParams 作为同步入参，框架必须在渲染开始前就备好它们（等 URL 解析、等 cookies/headers 就绪），这迫使整棵树的"起点"被这些数据卡住。Promise 化后，"这段渲染需要 params"变成组件内部的 await：在 await 之前，静态外壳可以先 flush 出去、把用到 params 的子树用 Suspense 边界挂起，等 params 就绪再流式补齐。这与 PPR（把静态/动态在同一页拼起来）是一体两面——静态段预渲染、动态段运行时补。工程影响：① 未 await 前不要访问其属性；② 顶层同步解构要改 async；③ 想继续"整页动态"就正常 await、想拿回预渲染收益就把 await 下推到小边界。一句话：Promise 化是"让数据依赖变成可延迟、可局部化"，从而打开流式与部分预渲染的空间。

**14.  并行路由(@) + 拦截路由(.) 组合出"模态详情"这套玩法，背后的 URL 语义权衡是什么？**
**来源**：掘金《用并行+拦截路由做图片模态》；Next.js 官方文档 Parallel Routes / Intercepting Routes
目标 UX：列表里点某项→详情以 modal 浮层展示（列表仍留在背景）、但详情又有独立可分享 URL、刷新/后退都正确。实现：详情页既是并行路由@folder 的槽位（覆盖渲染），又是拦截路由(.)photo/[id]（点击时不导航、原地弹出）；直接访问/刷新该 URL 时走全屏详情（full-page）。URL 权衡与坑：① modal 打开时 URL 变（可分享/可后退），但视觉仍是列表——后退应关 modal 而非离开列表，需要正确的关闭姿势（router.back()，不是硬 push 列表）；② 拦截路由只作用于站内 Link 导航、直接输入 URL 不被拦截，要保证"同一组件既能当 modal 又能当 page"的数据取用与默认值一致，避免水合不匹配；③ 并行 slot 的 default.tsx 缺失会白屏；④ 缓存/RSC payload 在多 slot 下更难推理。收益是"一套组件、两种呈现、URL 诚实"；代价是把导航语义复杂化，团队必须建立"关闭=后退、URL 始终是真相"的纪律。

**15.  大规模 SSG + dynamicParams=false 下，"生成时枚举"策略与降级你如何设计？**
**来源**：InfoQ《十万页预渲染：Next.js 大规模 SSG 实践》；SegmentFault《generateStaticParams 构建超时怎么办》
痛点：generateStaticParams 需在构建期枚举全部参数（如 10 万商品 id），构建时长/内存爆炸，且新商品不在清单→404。设计：① 分层生成——把"值不值得构建期预生成"按热度切分，热门前 N 千走 generateStaticParams 静态化、长尾不设 false 而允许运行时按需生成 + 首次 SSR 后 ISR 缓存（on-demand）；② 增量再生——发布新内容时调 revalidatePath/revalidate 或用"构建后 webhook 触发单页再生"，不靠全站重构建；③ 用 route segment 的 revalidate + stale-while-revalidate 把 CDN 变"陈旧可容忍 + 后台补"；④ 若坚持纯静态，把集合分页/分片给 generateStaticParams（支持多页枚举）避免一次撑爆；⑤ 兜底——为未预生成参数准备一个"稍后生成/重定向到搜索"的优雅 404 而非白屏。原则：dynamicParams=false 是"收紧攻击面/保证纯静态"的武器，但要用在枚举可控、更新能触达再生的场景，否则宁可 true + on-demand 缓存。
