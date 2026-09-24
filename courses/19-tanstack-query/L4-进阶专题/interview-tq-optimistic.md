# 面试题：乐观更新（tq-optimistic）

### 1. (实战类) 写出乐观更新的标准四步。
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

onMutate: cancelQueries→快照→setQueryData 打补丁并 return 快照；onError 回滚；onSettled invalidate。

### 2. (原理类) 为什么要先 cancelQueries？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

防止在飞的后台重取带着旧数据落地，把你的乐观补丁盖掉——时序竞态的预防针。

### 3. (设计类) onError 回滚用快照整替，有什么竞态缺陷？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

会把别人（更新的乐观态/真实数据）一并回滚；进阶用回滚表只撤销自己那笔增量。

### 4. (判断类) 哪些业务永远不该乐观？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

资金、库存、权限、审批状态机——回滚不只是难看，是错误或法律风险；老老实实 pending。

### 5. (实战类) 最终一致由哪个回调保证？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations

onSettled invalidate——成败都让服务器真相回流，乐观只是 UX 预支。

### 6. (对比类) 没有乐观时，pending 态怎么表达最省？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/useMutationState

按钮级 isPending 即可；跨组件才上 useMutationState——别为局部 loading 引入整套乐观。

### 7. (设计类) 乐观更新的「回滚闪现」怎么缓解？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

回滚加 transition/动画降级提示「操作未生效」toast，把数字变化解释给用户而不是默默跳变。

### 8. (实战类) 并发两笔点赞，服务器返回顺序乱了怎么办？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

每笔带自己的 variables+版本号，回滚表按笔 apply/revert；终态反正被 onSettled invalidate 校准。

### 9. (对比类) Zustand/Jotai 里做乐观与 Query 差在哪？
**来源**：https://tanstack.com/query/latest/docs/framework/react/comparison

状态库里快照回滚全手写且要自管「谁在消费这份数据」；Query 的 context 接力与 invalidate 把套路固化成生命周期。

### 10. (开放类) 让「点赞数」既乐观又不太离谱，你的完整方案？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

乐观 ±1 先爽；失败回滚自己那笔；onSettled 只在窗口空闲（或 debounce）后 invalidate 对齐，防重取风暴。

### 11. (坑类) 乐观改了缓存，staleTime 还没到，用户刷新页面看到旧值——矛盾吗？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults

不矛盾：缓存是内存态，刷新=新会话按服务器口径来；要跨刷新乐观体验得上持久化（tq-persist）。

### 12. (原理类) 为什么回滚信息走 context 而不是模块变量？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/mutations

context 与每次 mutate 一一对应（并发安全）；模块变量会被下一笔覆盖——这是 onMutate 返回值存在的全部意义。

### 13. (实战类) 拖拽排序的乐观方案有什么特殊考量？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

顺序是「相对结构」，快照要整表；松手即 invalidate 可能把动画拽回，等 settle 再校准更顺。

### 14. (对比类) 乐观 vs 预取，都在赌未来，赌注不同在哪？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/prefetching

预取赌「数据会被需要」——错了只浪费请求；乐观赌「操作会成功」——错了要当面撤销，UX 代价高一级。

### 15. (设计类) 如何给团队立「能不能乐观」的评审规矩？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

三问：失败回滚用户骂不骂？数据有没有强一致下游？有没有服务器权威值（计数/余额）？三否才放行。
