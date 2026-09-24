# 面试题：取消与竞态（tq-cancel）

### 1. (原理类) v5 的取消信号从哪来、怎么接？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation

queryFn context 自带 AbortSignal；fetch(url, {signal}) 一行接入。

### 2. (实战类) 哪些事件会触发 Query 主动 abort？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation

invalidate/refetch 挤掉在飞请求、依赖变化导致查询转 inactive、GC 移除、setActive(false) 等「请求已无意义」的时刻。

### 3. (概念类) 竞态处理与请求取消是一回事吗？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation

不是。竞态=结果正确性（旧执行被忽略），取消=资源治理（网络层掐断）；signal 只管后者。

### 4. (坑类) 不接 signal 的请求被「取消」后去哪了？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation

照常跑完，结果被丢弃——正确性不受影响，白花带宽与服务器成本。

### 5. (原理类) CancelledError 在 v5 的错误管道里享受什么特殊待遇？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/CancelledError

不置 error 态、不触发 retry、不进 onError——它被定义为流程事件。

### 6. (实战类) 想对取消埋点怎么办？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/isCancelledError

queryFn catch 里 isCancelledError(err) 判定后上报并 rethrow，保留框架语义。

### 7. (对比类) mutation 为什么不像 query 那样自动取消？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/mutations

写操作可能已落库，abort 造成「以为撤销」的假象；防重复提交应走 isPending 禁用+幂等键。

### 8. (对比类) retry 等待中被重新触发会怎样？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-retries

旧重试链整体作废，新执行接管计数——退避不会跨执行累积。

### 9. (设计类) 4xx 应该重试吗？怎么写规则？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-retries

不该（除非带退避的 429）；retry: (n, e) => e.status && e.status >= 500 ? 2 : 0。

### 10. (实战类) 搜索框快速输入，怎么让请求既对又省？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation

防抖后的值进 queryKey（正确性由执行槽保证）+ signal 透传（旧查询自动 abort 省资源）。

### 11. (对比类) AbortController 在 Jotai async atom 里要怎么做？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation

atom 世界没有内置 signal——自造 tick 原子+手动 controller.abort；这正是专业缓存层省下的样板。

### 12. (坑类) 在 queryFn 里 await 了别的 Promise 才用 signal，还能取消吗？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation

能，signal 在整个执行期有效；但你的 await 环节若不检查 signal，abort 后要等它完成才退出——长任务要自己 race。

### 13. (设计类) fetch 的 signal abort 后 promise 状态是什么？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation

reject AbortError；Query 将其识别为取消而非错误，UI 不应因此弹错误提示。

### 14. (开放类) 「取消反而有害」的场景有哪些？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation

幂等 GET 代价低、CDN 已回源中途掐断浪费更多；以及统计类请求——判断权在接不接 signal，框架不强迫。

### 15. (原理类) 为什么 v4 时代 infinite 的「更多」不取消上一发？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation

翻页语义允许并发在飞（第2页不等第1页）；v5 统一了 signal 模型，行为按触发类型区分，读文档别看老教程。
