# L4 作业：进阶专题

## 一、知识回顾
1. InfiniteData 的 pages/pageParams 结构与 getNextPageParam 终止契约。
2. 竞态正确性（内建）与请求取消（signal）两层分离；CancelledError 的事件语义。
3. 乐观更新四拍：cancel→快照→补丁→(回滚|失效)，以及适用边界三问。

## 二、代码实操
1. 用 jsonplaceholder 或自建 cursor API 做无限滚动 feed：触底加载、到底收口、切 tab 用 keepPreviousData 不闪空。
2. 慢速搜索接口上对比「接/不接 signal」两种实现的 Network 表现（canceled 计数截图）。
3. 实现乐观点赞：30% 随机失败率，验证失败只回滚自己那笔、onSettled 对齐真数；页头做「同步中」横幅。

## 三、思考题
1. invalidate 一个已加载 8 页的 infinite 查询会发生什么？给出两种降低代价的替代方案。
2. 「先乐观后失效」与「先转圈后刷新」各适合什么产品气质？各举一例。

## 四、延伸阅读
- TanStack Query 官方：guides/infinite-queries、paginated-queries、query-cancellation、optimistic-updates
- reference/classes/CancelledError、reference/functions/useMutationState

## 五、自查清单
- [ ] infinite 的页码条需求已改回普通 useQuery+key page
- [ ] 所有 fetch 透传 signal
- [ ] 乐观操作列过「三问」评审
- [ ] 每个乐观 mutation 都有 onSettled invalidate
