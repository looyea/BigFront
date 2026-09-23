# next-dynamic 面试题（12 题）

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
