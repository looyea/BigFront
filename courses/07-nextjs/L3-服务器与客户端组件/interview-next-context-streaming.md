# next-context-streaming 面试题（15 题）

> 来源：整理自 CSDN、掘金、SegmentFault、知乎、InfoQ 等站点流式渲染与 Suspense 高频面经，中文重述。

---

## A. 机制原理

**1. Streaming SSR 的原理？为什么说 HTML 是'一条流'？**
**来源**：InfoQ《React 18 renderToPipeableStream 解读》；CSDN《流式 SSR 字节级演示》
服务端以分块传输（chunked）持续写响应：先 flush 文档壳与就绪片段，未就绪处留占位注释/模板标签；数据完成后把片段与内联补齐脚本继续 flush，浏览器边收边渲染、脚本把片段替换进占位。HTTP/1.1 chunked 与 HTTP/2 流式都为它让'完成'不再是单点事件（呼应 node-http 的分块传输）。

**2. RSC Payload 的流式和 HTML 流式是一回事吗？**
**来源**：掘金《两种流：外壳与载荷》
同机制不同载体：首访走 HTML 流（含内嵌 payload），客户端导航走 RSC Payload 流（flight 数据流，`$?` 占位 `$L` 补齐）。共同点是"渲染单元独立就绪独立下发"，所以 Suspense 边界在两种导航路径下都有骨架效果（呼应 next-link-router 预取）。

**3. 多个 Suspense 边界串行还是并行解析数据？**
**来源**：SegmentFault《Suspense 瀑布与并行 await》
边界只保证"各自就绪各自输出"，不自动并行取数：同一父级里顺序写两个 await 仍是瀑布。并行要显式构造——先发起 Promise（不 await）、分发给各子组件 await，或 React 19 的 `use()`。这是"框架给机制、并发靠自己"的经典辨析题（呼应 es-async 的 Promise.all 章、next-server-client 面试 7）。

---

## B. Next 集成

**4. loading.tsx 和手写 <Suspense> 冲突吗？展示优先级？**
**来源**：CSDN《Next 的三层加载边界》
不冲突，是嵌套关系：路由段级（loading.tsx）⊃ 页内面板级（Suspense）。导航到动态段时先命中段级骨架；段 HTML 开始流后，页内细边界接管局部慢件。用户体验呈'粗到细'的接力（呼应 next-context-streaming 第三节分工）。

**5. 为什么流式页面建议配置 flushInitialHeaders / 静态壳相关选项？（结合 CDN 缓冲）**
**来源**：知乎《流式被 CDN 缓冲卡住的排障实录》
流式要求首块尽快出网关；某些 CDN/反代会攒满 4KB/64KB 才转发，壳被憋住=用户仍白屏。排障：curl -N 直连源站对比经 CDN 的首字节时间；对动态页关闭缓冲或调小。加分：知道"流式是链路属性，不止是框架 API"（呼应 node-deploy-perf、exp-deploy）。

**6. loading.tsx 里放 spinner 被 UX 评审打回，为什么？骨架的'便宜'指什么？**
**来源**：掘金《骨架屏设计规范在前端框架的落地》
全屏 spinner 制造'卡住感'且无法预留布局（CLS），骨架形状传递进度预期；便宜=内联 CSS 实现、零额外依赖、体积小（它在最关键的 shell 字节里）。同思路验证过小程序启动骨架与 mp-performance（呼应 next-context-streaming 第五节）。

---

## C. 水合与时序

**7. 流式+水合的组合里，慢组件的 hydration 发生在什么时候？**
**来源**：SegmentFault《水合时机与 selective hydration》
该片段 HTML 到达并触发其 JS 就绪后即可水合，且 React 支持选择性地优先水合用户已交互的片段（点进慢区单子的点击会抢占水合）。不必等全页——这解释'长页面上方先能用'（呼应 react-render-model）。

**8. Suspense 边界下的组件报错，error.tsx 放在哪一层才接得住？**
**来源**：CSDN《错误边界的冒泡路径》
错误向上冒泡穿过 Suspense（Suspense 不接错误），到最近的 error.tsx 段边界——通常在 Suspense 的**外层或同层再包一个**。工程约定：每个面板级 Suspense 配同级的局部 error，页面级兜底放段 error.tsx（L7 主讲，此处先埋点，呼应 react-effect-patterns 的错误观）。

---

## D. 综合场景

**9. 首屏关键数据（价格）与推荐位（慢 2s）同页，给出渲染策略并说明每个用户各时刻看到什么。**
**来源**：知乎《电商详情的流式编排》
价格随 shell 同步 await（关键信息宁慢勿缺位）或放边界内但设极短超时+兜底；推荐位 Suspense+骨架，2s 后原位补入。时刻表：0.x s 壳+价格，推荐位骨架至 ~2s。评分点：区分'可见性关键'与'渐进增强'两类数据（呼应 next-render-modes 第四节、react-performance）。

**10. 如何度量流式是否真的生效？给三个手段。**
**来源**：InfoQ《真实用户监测 Streaming》
① curl -N / devtools network 看首块与后续块的到达时间差；② RUM 拆 TTFB 与'首块 FCP'、面板级 LCP；③ 压测看慢依赖注入时首字节是否稳定（应不随最慢源漂移）。杜绝'感觉快了'（呼应 mp-performance 度量五步、react-architecture 的度量观）。

**11. PPR（Partial Prerendering）把本课机制推进到哪一步？静态壳和动态hole什么关系？**
**来源**：掘金《PPR：SSG 与流式的合体》；知乎（Next 15 experimental_ppr 讨论）
构建期预渲染静态壳（含标记好的动态 hole 占位），请求时只流式补动态部分——SSG 的 TTFB + 流式的局部动态，静态壳可走 CDN、payload 与缓存分层协同（cacheLife/cacheBoundary 控制 hole 的数据复用）。面试价值：说清它是 Suspense 边界'从运行时前移到构建时'（呼应 next-revalidate、react-router-basics）。

**12. 从 CSR 迁移到流式 SSR，老代码里的 useEffect 取数怎么处置？给迁移三步。**
**来源**：SegmentFault《CSR 到 RSC 的取数迁移剧本》
① 纯展示数据上移为服务端组件 await+Suspense 包裹慢源；② 交互态数据保留客户端（乐观更新、轮询），配 use() 或数据库；③ loading 分支 JSX 删除，由 fallback 接管——多数 CSR 骨架代码是被手工模拟的 Suspense。收尾判断标准：客户端 bundle 是否下降+首帧是否含内容（呼应 next-server-client、react-data-fetching）。

---

## 补充（新专题 13-15）

**13. "Context 能穿透服务端组件"是常见误解——讲清 Context 的真实作用域，以及跨 server/client 共享状态的三条合法通道。**
**来源**：React 官方 Server Components 上下文说明；Next.js 官方 Passing State 文档
Context 是客户端运行时的订阅机制，服务端组件在请求期一次性渲染、根本没有"Provider 树被读取"的运行时——所以不存在"服务端组件读 Context"。三条合法通道：① 序列化 props——服务端读好的值以 props 下发给客户端岛（岛内再用 Context 扩散）；② 请求域隐式上下文——cookies()/headers() 在任意服务端组件直接读（如 locale、session），等价于"请求级 Context"；③ 特殊引用——Server Actions 这类可序列化的"函数引用"跨界。Provider 模式在客户端岛内部完全可用，"全站一个大 Provider 让服务端组件消费"才是要放弃的幻觉。误解来源多是 React 18 客户端文档与 RSC 提案早期的表述混读；答出"请求级 vs 会话级状态各归何处"即可拉开差距。

**14.  loading.tsx、Suspense、PPR 三者都在解决"慢内容体验"，分别在哪一层起作用？**
**来源**：Vercel 博客《Partial Prerendering》；Next.js 官方 Streaming / PPR 文档
三个层：① loading.tsx 在客户端导航层——Router 拿到段更新前展示段级 UI，改善"感知"，对直达刷新几乎无首字节贡献；② Suspense 在服务端响应流层——决定 HTML flush 的分段粒度，shell 先到、边界后补，改善 TTFB/FCP 与慢边界的隔离；③ PPR 在构建产物层——把"静态段进预渲染产物、动态边界留占位"，让运行时只流式补动态部分，兼得静态托管与动态能力。关系：PPR 以 Suspense 边界为切分依据；loading.tsx 的骨架与 Suspense fallback 最好同构（尺寸一致）否则 CLS。加分句：三者分别优化"感知性能、首字节、产物形态"——只提其中一个说明对流式管线理解不完整。

**15.  一个流式站点在弱网下 TTFB 很好但 LCP 反而变差，可能的原因与验证方案？**
**来源**：web.dev LCP 与流式渲染的交互；InfoQ《流式 SSR 的性能陷阱》
可能原因：① LCP 候选被关在 Suspense 边界里、其数据在 shell 之后串行取（shell 里的取数未并行、await 瀑布），动态段很晚才补上；② 边界过多过小，HTML 分块+RSC payload 重复传输使总字节显著增加，弱网下每块都要排队；③ 骨架到真实内容的尺寸变化使视口内布局跳动，候选元素位移被重新计时；④ HTTP/1.1 下分块与预取资源抢连接；⑤ LCP 记录了 shell 内某大图但真正主体内容更晚——度量口径本身要复核。验证：Lab（Lighthouse/自定义 trace 打 performance.mark 对比各边界 flush 时间）+ RUM 按"边界数量开/关、压缩、HTTP/2"做 A/B；修复方向：慢边界数据与 shell 取数并行化（先 kick off promise 再 await）、合并碎片化边界、骨架尺寸对齐、检查 CDN 是否吞掉 flush（关闭 proxy buffering）。能把"流式不是免费"讲清楚即高分。
