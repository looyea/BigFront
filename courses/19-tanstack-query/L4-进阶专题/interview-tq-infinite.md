# 面试题：无限与分页（tq-infinite）

### 1. (原理类) useInfiniteQuery 的缓存里存了什么？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries

单条查询：pages 数组（各页原样响应）+ pageParams（各页游标），一个 key 统管。

### 2. (实战类) getNextPageParam 怎么宣告「到底了」？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/useInfiniteQuery

返回 undefined（或 null）；hasNextPage 据此收起按钮/停止观察器。

### 3. (设计类) 为什么 pageParam 对 Query 是透明值？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries

offset/cursor/时间戳皆可——库只负责存进 pageParams 并原样回传，语义归服务器。

### 4. (实战类) 无限滚动组件怎么接线？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries

IntersectionObserver 触底调 fetchNextPage，isFetchingNextPage 渲染底部骨架，hasNextPage 决定去留。

### 5. (对比类) 页码分页为什么官方推荐普通 useQuery？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries

页可随机寻址→每页独立 key 独立缓存，跳页互不干扰；infinite 是串行游标的专用结构，硬用反受其累。

### 6. (坑类) infinite 查询 invalidate 的隐藏成本？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation

已加载 N 页就重放 N 个请求，且数据到达顺序可能打乱滚动位置；高互动 feed 优先定点 setQueryData。

### 7. (实战类) 切换筛选时列表闪空怎么办？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data

placeholderData: keepPreviousData——新 key 借旧查询 pages 占位，后台追真数据。

### 8. (原理类) 双向加载（聊天向上翻）如何建模？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/infiniteQueryOptions

getPreviousPageParam + fetchPreviousPage，pages 仍一维数组，渲染时区分两端游标按钮。

### 9. (坑类) 把游标塞进 queryKey 会发生什么？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-keys

每页一个新查询而非一条多页——分页语义散架，「加载更多」失去统一结构。

### 10. (实战类) 列表里某一条被删除，infinite 缓存怎么改？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

setQueryData 对 pages 做 map 内过滤（结构不变）；别 invalidate 重放所有页。

### 11. (设计类) 首屏与翻页的 loading 要一样吗？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/useInfiniteQuery

首屏 pending 给整页骨架；翻页用 isFetchingNextPage 只加底部条——两态分离正是 infinite 的状态设计。

### 12. (对比类) useQueries 并行 N 页 vs infinite 串行 N 页？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/useQueries

页参数可预先知道（offset 1..N）→ useQueries 并行；必须拿上一页才知道下一页→ infinite。

### 13. (开放类) 服务端只有 offset 接口，想做无限滚动怎么办？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries

pageParam 存当前 offset，getNextPageParam 用 lastPage.length 推算 next offset——游标契约照样成立。

### 14. (坑类) 滚动还原与 infinite 有什么协作难点？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/scroll-restoration

invalidate/重放导致数据换血，滚动锚点漂移；常见解法：进入即 initialData 首屏 + 触底追页，少整表失效。

### 15. (设计类) 大列表（千条）缓存策略？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries

只保留视口附近页（remove 旧页 key 或窗口化 state），配合 gcTime 让远页自然蒸发，防 JSON 驻留过肥。
