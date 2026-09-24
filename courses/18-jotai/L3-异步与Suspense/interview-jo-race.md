# 面试题：异步竞态与取消（jo-race）

### 1. (原理类) Jotai 如何自动防后发先至？
**来源**：https://jotai.org/docs/core/atom

以当前依赖值标识请求，只有匹配最新依赖的 promise 结果会被采纳，过期丢弃。

### 2. (实战类) 在 async atom 里正确接入 AbortController？
**来源**：https://jotai.org/docs/utilities

getter 建 controller 传 signal，配合一个变化触发点（依赖 atom/effect cleanup）在切走时 abort。

### 3. (对比类) Jotai 竞态忽略 vs Query 取消/竞态？
**来源**：https://tanstack.com/query/latest

都保证最新为准；Query 还能主动 cancel 请求、dedupe、后台重取。

### 4. (设计类) 何时把取数从 async atom 迁到 Query？
**来源**：https://jotai.org/docs/

出现全局缓存、失效策略、分页、乐观更新需求时迁 Query（呼应 za-layers）。

### 5. (坑类) 只忽略不 abort 有什么代价？
**来源**：https://jotai.org/docs/

过期请求仍占带宽/后端资源，敏感或贵请求应主动 abort。

### 6. (实战类) 做退避重试的 atom 设计？
**来源**：https://jotai.org/docs/advanced

attemptAtom 计数，getter 里 for 循环 await+背off 失败则 set(attempt) 触发重取（呼应 pinia-optimistic）。

### 7. (性能类) 高频依赖变导致频繁取数如何缓解？
**来源**：https://jotai.org/docs/utilities/debounce

debounce atom 节流，或用 query key 稳定化，减少无谓请求。

### 8. (综合类) 搜索框自动取数竞态方案。
**来源**：https://jotai.org/docs/

debouncedQueryAtom 派生 → resultsAtom(async) → 每次新值覆盖旧、忽略过期，可选 abort。

### 9. (TS类) async atom 的错误类型如何暴露？
**来源**：https://jotai.org/docs/typescript/typescript

结果仍是 data 类型，错误经 loadable/ErrorBoundary 捕获（呼应 jo-loadable）。

### 10. (对比类) transition 更新依赖与竞态的关系？
**来源**：https://react.dev/reference/react/useTransition

transition 保留旧结果渲染，新请求完成才切换，视觉无闪烁。

### 11. (设计类) 缓存策略该放 async atom 还是外层？
**来源**：https://jotai.org/docs/utilities

轻缓存放派生/自定义，复杂缓存/失效建议外层 Query。

### 12. (综合类) 如何测竞态（旧请求晚到不覆盖新值）？
**来源**：https://jotai.org/docs/

msw 控制两个请求返回顺序，断言最终值来自最新依赖。

### 13. (坑类) getter 里用组件级变量存 controller 的问题？
**来源**：https://jotai.org/docs/

atom 脱离组件、可能多实例，应用局部变量或依赖清理闭包持有 controller。

### 14. (趋势类) React 并发与 use() 会改变竞态处理吗？
**来源**：https://react.dev/reference/react/use

并发让旧结果可保留，use 统一挂起读取，竞态仍需数据层保证最新为准。

### 15. (综合类) 给 Jotai 取数定一份竞态守则。
**来源**：https://jotai.org/docs/

依赖即请求键、以最新为准、贵请求接 abort、复杂缓存上 Query。
