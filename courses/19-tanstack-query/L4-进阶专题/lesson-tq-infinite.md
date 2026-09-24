# 无限与分页查询

## 一、InfiniteData：数据长什么样

```ts
const { data } = useInfiniteQuery({
  queryKey: ['feed'],
  queryFn: ({ pageParam, signal }) => fetchFeed(pageParam, signal),
  initialPageParam: 0,
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
});
// data: { pages: [page0, page1, page2], pageParams: [0, 'c1', 'c2'] }
```

一条查询、多页数组：`pages` 是各页响应原样收集的数组，`pageParams` 记录每页的游标。渲染就是 `data.pages.flat()`——没有魔法，只是「一个 key 下堆多页」的结构约定。

## 二、pageParam 契约：三行定生死

- `initialPageParam`：第一页的入参（0 或 null）；
- `getNextPageParam(lastPage, allPages)`：下一页游标，**返回 undefined/null 即「没有下一页」**——hasNextPage 全靠它；
- `getPreviousPageParam`：反向翻页（聊天记录向上加载）才需要。

游标、offset、时间戳都能当 pageParam——它只是被塞回 queryFn 的透明值，服务器说了算。

## 三、控制成员

`fetchNextPage / fetchPreviousPage`（手动加载下一批）、`hasNextPage / hasPreviousPage`（按钮该不该显示）、`isFetchingNextPage`（底部骨架专用，区别于整体 isFetching）、`isFetchedLastPage`（v5 细粒度）。无限滚动就是把 IntersectionObserver 的回调接到 fetchNextPage 上。

## 四、切换筛选条件的那一刻

换 filter=key 变=新查询，pages 从空数组开始——用户看到整页闪空。老配方：`placeholderData: keepPreviousData` 给无限查询同样有效，旧列表先顶着、新数据后台追；配合「加载中禁用滚动」防用户把占位当结果。

## 五、offset 分页还是 cursor 无限？

| 需求 | 选型 |
|---|---|
| 页码条「跳到第 7 页」 | 普通 useQuery，key 带 {page}（paginated-queries 官方姿势） |
| 下拉滚动加载、瀑布流 | useInfiniteQuery + cursor |
| IM 记录上下双向拉 | useInfiniteQuery + getPreviousPageParam |
| 表格排序/筛选+分页 | 每组合一条 useQuery（key 全含），别硬塞 infinite |

判据一句话：**「页与页之间有没有必须串行才知道的游标」**——有游标依赖才值得 infinite；能随机寻址的偏移分页，拆成独立 key 反而吃到各页独立缓存。

## 六、缓存与失效的行为

infinite 查询是**一个**缓存条目（一个 key 管所有 pages）：invalidate 后只重取**已加载的每一页**（用原 pageParams 逐页重放），不会自动帮你「滚回去」。所以高互动 feed 慎用 invalidate——一次失效= N 页重取，滚动位置还容易错乱；能用定点 setQueryData 的优先定点。

## 小结
useInfiniteQuery=「pages+pageParams」的结构约定：getNextPageParam 定终点、fetchNextPage 驱动滚动、keepPreviousData 防闪、单条目多页的失效代价心里要有数；能随机跳页的需求请回 useQuery。

## 部署预告
接一个 cursor 分页 API（如 reddit 式 after 参数）做无限滚动：IntersectionObserver 触底加载、hasNextPage 收口、切 tab 时 keepPreviousData 防闪；DevTools 里数一次 invalidate 重放了几页。
