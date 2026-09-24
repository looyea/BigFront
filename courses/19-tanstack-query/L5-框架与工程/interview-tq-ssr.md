# 面试题：SSR 与水合（tq-ssr）

### 1. (原理) Describe the full SSR data flow of TanStack Query from server to browser.
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/ssr

Server side: new QueryClient per request, prefetchQuery warms the cache, dehydrate(queryClient) serializes finished queries into JSON embedded in HTML. Client side: QueryClientProvider + HydrationBoundary state=dehydratedState calls hydrate to refill the memory cache, so first render hits cache without refetching.

### 2. (原理) 为什么每个请求要 new 一个 QueryClient？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/ssr

QueryClient 内部持有 QueryCache/MutationCache，模块级单例等于所有请求共享一份缓存——用户 A 的请求可能读到用户 B 的数据，既是内存泄漏也是安全事故。每请求 new 保证隔离，dehydrate 后随请求销毁。

### 3. (对比) dehydrate 与 hydrate 分别发生在哪端、做什么？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/dehydrate

dehydrate 在服务端：把 client 里已完成的查询状态导出为可序列化的 DehydratedState（查询结果+ mutation 快照）。hydrate 在客户端：由 HydrationBoundary 调用，把这份 JSON 写回新建 client 的缓存。一出一回，方向唯一。

### 4. (进阶) streaming SSR 相比传统 SSR 改善了什么？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr

传统 SSR 要等所有数据就绪才能吐 HTML，TTFB 被最慢接口拖住。streaming 先 flush 框架外壳，慢查询挂 Suspense 边界，数据到达后把片段流式补进文档；配合 useSuspenseQuery + 不 await 的 prefetch，用户更早看到可交互骨架。

### 5. (坑) 水合后页面仍然发了一次请求，可能原因？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/ssr

① server 与 client 的 queryKey 不一致（拼参顺序/默认值差异）；② prefetch 未完成就 dehydrate，缓存里没这条；③ staleTime 为 0 且组件挂载时机在 hydrate 之前——默认挂载即重取属正常后台验证，但首帧不应白屏。

### 6. (框架) Next.js App Router 里 Query 怎么放？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr

RSC 侧 prefetch + dehydrate，把 dehydratedState 作 prop 传给客户端组件里包的 QueryClientProvider + HydrationBoundary；每请求 new client。data fetching 放 RSC 就不需要 useQuery，放客户端组件才用 hooks——两种模式可混用，团队内定调即可。

### 7. (安全) SSR 场景下 persistQueryClient 要注意什么？
**来源**：https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient

persist 只能在客户端跑：服务端无 window，且服务器共享存储等于跨用户数据泄漏。常见做法是判断 typeof window 后仅在浏览器侧注册 persistQueryClient，或用框架构建期钩子。

### 8. (对比) Query 的 SSR 方案与手写 __INITIAL_STATE__ 注入的区别？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/ssr

手写注入要自己约定 JSON 结构、自己写灌回逻辑、自己处理失效与重试。Query 的 dehydrate/hydrate 保留了完整查询状态（staleness、fetch 状态、观察者语义），灌回后缓存行为与 CSR 完全一致——序列化的是「缓存模型」而不只是数据。

### 9. (原理) HydrationBoundary 的原理？为什么不是直接 hydrate(client)？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/HydrationBoundary

直接调 hydrate 时机难管：脚本可能早于组件挂载执行、streaming 片段到达顺序不定。HydrationBoundary 在自身挂载/更新时按 React 提交时机调 hydrate，多边界可排队合并，把「灌回」纳入渲染生命周期管理。

### 10. (坑) useSuspenseQuery 和错误边界怎么配合？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/useSuspenseQuery

数据未决时 suspend 最近 Suspense 边界；请求失败则向上抛给 ErrorBoundary。Suspense 管「没好」、ErrorBoundary 管「坏了」，两件事不能省一个；重试耗尽才会被抛出，所以 ErrorBoundary 看到的基本是终态错误。

### 11. (实战) SEO 落地页首屏数据必须完整，streaming 还是传统 SSR？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr

对 SEO 爬虫，streaming 的片段最终也在同一文档里，主流爬虫可执行 JS 后拿到全量。但要求「源码级首屏全量」的审核/老爬虫环境，保守选传统阻塞式 SSR（await 全部 prefetch 再出 HTML），TTFB 用 CDN 边缘渲染补偿。

### 12. (对比) 三家状态库的 SSR 姿势有什么共性？（联想 zustand/jotai）
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/ssr

共性一：每请求新建实例防串数据；共性二：服务端取好的状态序列化为 JSON 随 HTML 下发；共性三：客户端注水后组件透明命中。差异只在粒度：Query 注的是「带新鲜度语义的缓存」，zustand/jotai 注的是裸 state/atom 值，要自己管二次验证。

### 13. (坑) 水合数据的 JSON 里可能有什么敏感内容？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/dehydrate

dehydrate 会带 mutation 的进行中快照，且缓存里的一切都会原样进入 HTML 源码——所有能看页面的人都拿得到。个人数据、内部字段要在 shouldDehydrateQuery 白名单里挡掉；默认全带是「先方便后安全」，公开页必须反着配。

### 14. (原理) 为什么 prefetchQuery 在 SSR 里比 fetchQuery 更顺手？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient

两者都会填充缓存，但 prefetch 语义是「有货就跳过、失败也不抛」——服务端预热要的就是幂等宽容；fetchQuery 每次强制走一遍且错误要接。SSR 代码里 prefetch + 统一 dehydrate 心智最简单。

### 15. (架构) SSR + 客户端导航之后，数据新鲜度谁管？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/ssr

水合只是起跑线。进入 SPA 模式后一切照旧：staleTime、聚焦重取、invalidate 决定何时向服务器再验证——SSR 数据同样带 staleness 标记。这正是 Query 方案的优势：SSR 与 CSR 在同一个缓存模型下无缝接力。
