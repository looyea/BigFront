# 面试题：失效与后台重取（tq-refetch）

### 1. (原理类) invalidateQueries 到底做了什么？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation

把匹配查询标 stale+invalidated；对 active 查询立刻重取（默认），inactive 等下次使用。

### 2. (实战类) 为什么优先 invalidate 而不是 setQueryData 手改？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations

让服务器做真相源：你只宣告过期，新状态（计算字段、关联数据）由重取带回；手改易漏字段造伪状态。

### 3. (设计类) refetchType 四个取值的场景？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient

active 默认只刷在看的；all 全刷（数据一致性极端要求）；none 只标不刷（登出前批量标脏）；inactive 留给下次挂载。

### 4. (坑类) invalidate 没触发重取的常见原因？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation

key 没匹配中（数组结构不符）；无订阅者且 refetchType:active；组件恰好卸载——先查匹配再怀疑人生。

### 5. (实战类) cancelRefetch 解决什么问题？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation

正在重取中又 invalidate 时，默认新 invalidate 被忽略；cancelRefetch:true 先 abort 当前请求再立即重取。

### 6. (原理类) refetchOnWindowFocus 为何默认开？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/window-focus-refetching

标签页回来是「用户重新消费数据」的高频时刻；默认保新鲜，离线/演示场景可关。

### 7. (实战类) 轮询与聚焦重取能共存吗？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/polling

能；refetchInterval 独立计时，聚焦仍按 stale 兑现；对账类页面常见组合。

### 8. (设计类) offlineFirst 与 online 模式的差异？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/network-mode

online 断网直接 paused；offlineFirst 允许请求尝试（RN 假离线/离线队列 mutation），恢复自动重放。

### 9. (实战类) 弱网大列表「后台刷新」的正确 UI？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/background-fetching-indicators

保留旧数据+角落 spinner+可选「N 条已更新，点击刷新」；忌整表骨架闪动。

### 10. (坑类) removeQueries 与 GC 的区别？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient

remove 立刻手动丢（有订阅也丢，组件变 pending 重取）；GC 是订阅归零后的自动延迟回收。

### 11. (对比类) refetch() 与 invalidateQueries() 怎么选？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation

当前查询自刷新用 hook 的 refetch；「我改了数据，影响哪些查询我不知道」用 invalidate 让匹配者各显神通。

### 12. (开放类) WebSocket + Query 怎么协同？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/updates-from-mutation-responses

socket 消息到达 setQueryData 精确定点改缓存（乐观式）或 invalidate 粗粒度标脏；高频消息走定点改，低频走失效。

### 13. (实战类) mutation 后想「先刷新再关弹窗」怎么 await？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient

await queryClient.invalidateQueries(...) 等重取完成；或 refetchType 控制范围后 await，弹窗关闭时机可控。

### 14. (设计类) 乐观更新失败后的一致性兜底？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

onError 回滚快照 + onSettled invalidate——回滚是 UX，失效才是最终一致。

### 15. (原理类) 多个组件订阅同一查询，焦点回来取几次？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/window-focus-refetching

一次；触发按「查询」不按「订阅者」，去重与 in-flight 合并保证单请求。
