# 面试题：useMutation（tq-mutation）

### 1. (原理类) 为什么写操作不缓存结果？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/mutations

每次变更都是新意图，响应不是可共享的查询状态；缓存会制造「重复提交同一响应」的假象。

### 2. (实战类) invalidate 为什么常放 onSettled 而非 onSuccess？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations

失败也可能已改变服务器状态（部分成功）；成败都对齐一次真相，比赌「错误=没发生」稳。

### 3. (设计类) onMutate 的返回值给谁用？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

作为 context 依次传给 onSuccess/onError/onSettled——乐观更新在那里回滚快照。

### 4. (实战类) 响应就带新实体，要不要 setQueryData 省一次重取？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/updates-from-mutation-responses

列表小、响应完整可打补丁；否则让服务器说话（invalidate）；省的是请求，赔的是口径漂移风险。

### 5. (对比类) mutate 与 mutateAsync 的选择依据？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/mutations

事件回调式 UI 用 mutate（onError 兜底）；async 流程要 await 用 mutateAsync+try/catch。混用会造成双重错误处理。

### 6. (实战类) A 组件触发的删除，B 组件怎么显示 loading？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/useMutationState

给 useMutation 配 mutationKey+context，B 里 useMutationState 按 key 过滤读 pending 集合。

### 7. (坑类) useMutation 的 isPending 为什么「到处都不转圈」？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/useMutation

isPending 是实例局部状态，跨组件不共享——误以为全局是新手第一课，解法即上题。

### 8. (设计类) 401/500 的统一 toast 写在哪一层？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/MutationCache

QueryClient 构造里 MutationCache 钩子全局兜底；业务错误处理留 onError——两层各管各的粒度。

### 9. (对比类) Query 的 mutation 与 Redux 的 thunk 发请求？
**来源**：https://tanstack.com/query/latest/docs/framework/react/comparison

thunk 手写 pending/成功/失败三态与重取；useMutation 内置生命周期+缓存联动，写请求的心智模型完全不同。

### 10. (实战类) mutationKey 不写会怎样？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/mutationOptions

devtools 认不出是谁、useMutationState 无法过滤；v5 惯例给每类变更一个稳定 key。

### 11. (原理类) variables 与 context 的分工？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/mutations

variables 是调用方给的输入；context 是 onMutate 产出的中间态（快照/计时器）——一个进一个出别混。

### 12. (实战类) 防止重复提交的常规做法？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/mutations

isPending 禁用按钮 + 幂等键（uuid 随请求带上）——前者 UX 层，后者对抗网络重试/双击穿透。

### 13. (坑类) v4 起 query options 里的 mutation 配置去哪了？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5

useQuery 第三参的 mutation 段被移除——写操作请老实 useMutation，别借查询壳。

### 14. (设计类) 批量提交：一个 mutation 打包还是 N 个并行 mutate？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/mutations

服务器有批量接口一个搞定（原子性+少请求）；没批量就 Promise.all(mutateAsync...) 并自担部分失败补偿。

### 15. (开放类) 乐观、失效、手改三种「写后同步」怎么排优先级？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

默认 invalidate 保正确；响应完整用 setQueryData 省流量；UX 要求即点即变才上乐观三件套——复杂度与风险递增。
