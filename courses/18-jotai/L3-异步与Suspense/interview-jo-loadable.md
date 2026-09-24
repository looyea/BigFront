# 面试题：loadable / unwrap（jo-loadable）

### 1. (设计类) 为什么提供 loadable 而不只用 Suspense？
**来源**：https://jotai.org/docs/utilities/loadable

有时要局部 loading、精细错误处理或不便设 Suspense 边界，loadable 给命令式三态控制权。

### 2. (实战类) loadable 做局部 spinner 示例？
**来源**：https://jotai.org/docs/utilities/loadable

const v=useAtomValue(loadable(dataAtom)); v.state==="pending" 渲染骨架，否则渲染 v.data。

### 3. (对比类) unwrap 和 loadable 何时各用？
**来源**：https://jotai.org/docs/utilities/unwrap

需要挂起语义用 unwrap、需要判态用 loadable，可组合切换风格。

### 4. (坑类) 用 async atom 但不想整块白屏怎么办？
**来源**：https://jotai.org/docs/utilities/loadable

用 loadable 拿 pending 自行渲染局部 loading，避免粗粒度 Suspense。

### 5. (实战类) 接 WebSocket 到 Jotai？
**来源**：https://jotai.org/docs/utilities/observable

atomWithObservable(sub=>{const ws=new WebSocket();ws.onmessage=e=>sub(next(e.data));return ()=>ws.close()})。

### 6. (对比类) loadable 三态与 Query 的 status 异同？
**来源**：https://tanstack.com/query/latest

都暴露 loading/error/success；Query 还带 isFetching/isError 更多态与失效。

### 7. (设计类) 错误处理放 loadable 还是 ErrorBoundary？
**来源**：https://jotai.org/docs/

loadable 给局部可控错误 UI；全局兜底仍可用 ErrorBoundary。

### 8. (TS类) loadable 返回类型如何判别？
**来源**：https://jotai.org/docs/typescript/typescript

discriminated union by state，switch(v.state) 自动收窄 data/error。

### 9. (综合类) 把 asyncAtom 接进既有非 Suspense 组件。
**来源**：https://jotai.org/docs/utilities/loadable

const s=useAtomValue(loadable(asyncAtom))，按三态 return，不改上层 Suspense。

### 10. (性能类) loadable 会引入额外重算吗？
**来源**：https://jotai.org/docs/

它只是包装派生，缓存源 promise 结果，开销极小。

### 11. (坑类) observable atom 忘记退订会？
**来源**：https://jotai.org/docs/utilities/observable

订阅泄漏，需返回 teardown（unobserve/close）。

### 12. (对比类) loadable 与手写 useEffect fetch 优劣？
**来源**：https://jotai.org/docs/

loadable 声明依赖、自动重取、去重；手写易竞态/重复/样板。

### 13. (实战类) 如何重试失败的 async atom？
**来源**：https://jotai.org/docs/

触发依赖 atom 变更（如 retryCountAtom++）令 getter 重跑。

### 14. (趋势类) use() 普及会取代 loadable 吗？
**来源**：https://react.dev/reference/react/use

use 简化挂起读取，但显式三态需求下 loadable 仍有价值。

### 15. (综合类) 给异步看板选 Suspense 还是 loadable？
**来源**：https://jotai.org/docs/

列级统一 loading 用 Suspense；卡片各自 loading/错误用 loadable。
