# 面试题：并行与预取（tq-parallel）

### 1. (原理类) Query 里两个查询怎么并行？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/parallel-queries

并排写两个 useQuery 即可——hooks 同帧挂载天然并发；要治理的反而是瀑布。

### 2. (坑类) 典型瀑布的两副面孔？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/request-waterfalls

组件层级导致「父渲染完子才挂载取数」；和 key 依赖把可并行的拆成串行。

### 3. (实战类) useQueries 适合什么不适合什么？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/useQueries

适合动态小批量（6-20 个卡片）；几百项该后端聚合成一个接口，别用并发硬怼。

### 4. (实战类) prefetchQuery 的完整签名？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/prefetching

({queryKey, queryFn, staleTime...})——与 useQuery 同族选项，结果照常入缓存。

### 5. (设计类) 预取为什么必须配 staleTime？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/prefetching

staleTime:0 时预取完立刻变 stale，点击进页仍重取，预取白做；给「几秒内点击即秒出」的窗口。

### 6. (对比类) prefetch 与 initialData 谁适合路由数据？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/prefetching

能 await 的加载阶段（loader）用 ensureQueryData/initialData 路线；「大概率会点」用 prefetch 赌一把，输赢只是多一次请求。

### 7. (实战类) React Router 里预取放哪？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/prefetching

Route loader 内 prefetchQuery + 组件 useQuery；或 link onMouseEnter 预取详情——TanStack Router 集成后 usePrefetchQuery 更顺。

### 8. (原理类) invalidate + refetchType:none 的组合意义？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/prefetching

只标脏不发起——用户不在看的别浪费流量；配合后台 prefetch 做「预失效再预热」。

### 9. (对比类) prefetchQuery 与 fetchQuery？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient

fetchQuery 等结果可 await（阻塞路径）；prefetch 不管结果（机会主义）——loader 要数据选前者，hover 提示选后者。

### 10. (坑类) 并行请求都失败时 retry 会互相影响吗？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-retries

不会，每查询独立计数独立退避；全局并发风暴才需要 retry 上限+网络模式兜底。

### 11. (设计类) 无限流首屏怎么 prefetch？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/usePrefetchInfiniteQuery

prefetchInfiniteQuery 取首页入册，进页 useInfiniteQuery 秒出首屏再手动翻页。

### 12. (实战类) 怎么在代码里揪出瀑布？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/request-waterfalls

Network 面板看首屏请求起点是否齐平；瀑布=楼梯状；配合 DevTools 的 timing 列逐个对齐。

### 13. (对比类) SWR 有等价 prefetch 吗？
**来源**：https://tanstack.com/query/latest/docs/framework/react/comparison

SWR 提供 prefetchAll 与 mutate(data, {revalidate}) 的轻量预灌；能力面比 Query 窄，重预取场景 Query 选项更多。

### 14. (开放类) 预取的预算怎么定？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/prefetching

只对高概率动作预取（hover 100ms+、列表前 N 条）；预取请求要可取消、可降频，移动端配网络模式。

### 15. (实战类) useQueries 每项都想读 status 怎么映射？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/useQueries

返回数组直接 map 渲染，每项含独立 status/data/error——注意数组引用每次新，别整体 memo 误判。
