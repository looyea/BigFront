# 面试题：useQuery 初体验（tq-use-query）

### 1. (原理类) useQuery 返回的 status 有哪几种取值？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/useQuery

pending / success / error 三态，描述的是「数据」维度；请求维度另有 fetchStatus。

### 2. (坑类) isLoading 和 isPending 何时不相等？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/queries

有 placeholderData/initialData 或后台重取时：isFetching 为 true 但 isPending 为 false，isLoading=isPending&&isFetching 也为 false。

### 3. (实战类) queryFn 里怎么拿到当前 key？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/useQuery

context 参数解构 {queryKey, signal, meta}——key 变化重执行时自动带新值。

### 4. (实战类) 为什么 fetch 要把 signal 传进去？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation

Query 内部 abort 时通过它通知底层请求真正取消，省流量并杜绝卸载后写缓存。

### 5. (对比类) v5 为什么废除位置参数签名？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/queries

对象参数利于 TS 推断与扩展（v4 的多重载让类型系统苦不堪言），迁移工具可自动转换。

### 6. (坑类) 404 响应为什么默认被当成功？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation

queryFn 不抛错即 success；fetch 对 404 不 reject。要在函数里手动 if(!res.ok) throw。

### 7. (设计类) staleTime 和 gcTime 的区别一句话？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults

staleTime 管「多久算过期（要不要重取）」，gcTime 管「无人订阅后多久丢出内存」。

### 8. (实战类) 怎么在条件满足时才让 useQuery 发请求？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries

enabled: !!id；依赖前序结果的 dependent queries 也用它串。

### 9. (对比类) refetchOnMount 和 staleTime 怎么配合？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/window-focus-refetching

挂载时若数据已 stale 且 refetchOnMount 为 true 才重取；把 staleTime 调大，多数挂载直接吃缓存。

### 10. (原理类) 两个组件用同一 key 但 queryFn 不同会怎样？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults

第一次出现该 key 的 queryFn 生效，后来者的函数被忽略——key 相同的「身份」归先注册者，别踩。

### 11. (实战类) useQuery 的 data 会变 undefined 吗？何时？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/useQuery

pending/error 期没有 data（isDataPending 场景），渲染早返回 success 分支即可避开。

### 12. (设计类) 为什么返回值是一大盘 isXxx 而不是单一状态枚举？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/useQuery

数据维度与请求维度正交，枚举会爆炸；布尔组合让 UI 按需挑粒度（列表角标 isFetching、整页 isLoading）。

### 13. (坑类) retry 会把 4xx 也重试吗？怎么治？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults

默认全重试；retry: (count, err) => err.status < 500 ? 0 : 3 之类规则只对可恢复错误重试。

### 14. (实战类) 想在组件外「确保有数据」用什么？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient

client.fetchQuery / ensureQueryData：不存在或过期就取并返回 promise，路由 loader 常客。

### 15. (开放类) 你会怎么给 useQuery 写单测？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults

关 retry、包 QueryClientProvider（新 client per test）、mock fetch 层，断言状态流转而非实现细节。
