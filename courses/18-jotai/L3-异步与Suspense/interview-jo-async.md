# 面试题：Async Atom（jo-async）

### 1. (原理类) async atom 为什么能触发 Suspense？
**来源**：https://jotai.org/docs/utilities/transition

getter 返回 promise，Jotai 在 useAtom 读取时若 pending 就 throw 该 promise，React Suspense 捕获。

### 2. (实战类) 用 async atom 做详情取数完整示例？
**来源**：https://jotai.org/docs/

detailAtom=atom(async get=>(await fetch(...get(id))).json())，UI 用 Suspense+useAtomValue。

### 3. (对比类) 和 TanStack Query 的 useSuspenseQuery 异同？
**来源**：https://tanstack.com/query/latest

都能挂起；Query 额外给缓存/失效/重试/dedupe，async atom 更轻、缓存需自己配。

### 4. (坑类) async atom 每次读会不会重复请求？
**来源**：https://jotai.org/docs/utilities

同一依赖值下 Jotai 缓存该 promise，不会反复触发；依赖变才重取。

### 5. (性能类) 如何给 async atom 做缓存/失效？
**来源**：https://jotai.org/docs/utilities

配合 selectAtom/自定义，或用 atomWithQuery 集成 Query 能力。

### 6. (综合类) 设计 id 驱动的详情异步原子。
**来源**：https://jotai.org/docs/core/atom

idAtom + detailAtom=atom(async get=>fetch(get(idAtom)).then(r=>r.json()))，id 变自动重取。

### 7. (SSR类) SSR 下 async atom 的水合要点？
**来源**：https://jotai.org/docs/utilities/ssr

需 hydrateAtoms 预置 promise/结果，避免服务端未取到数据（呼应 jo-ssr）。

### 8. (设计类) 何时 async atom 够、何时该上 Query？
**来源**：https://jotai.org/docs/

简单依赖驱动取数用 async atom；需全局缓存/失效/分页用 Query。

### 9. (坑类) 读 async atom 的组件必须注意什么？
**来源**：https://jotai.org/docs/

要有 Suspense 边界，否则挂起冒泡到根导致不友好。

### 10. (对比类) async atom 的 loading 与 store 的 isLoading 心智差异？
**来源**：https://jotai.org/docs/

前者声明式（谁用谁挂起）、后者命令式集中标志（呼应 za-suspense）。

### 11. (实战类) 如何组合多个 async atom 并行？
**来源**：https://jotai.org/docs/advanced

派生 atom(get)=>Promise.all([get(a),get(b)]) 或各自挂起并行。

### 12. (趋势类) React 的 use() 对 async atom 的影响？
**来源**：https://react.dev/reference/react/use

use(promise) 提供统一挂起读取，Jotai 与之理念一致可互操作。

### 13. (综合类) 如何测试一个 async atom？
**来源**：https://jotai.org/docs/

store.get 拿 promise await 断言，或用 renderHook+Suspense。

### 14. (设计类) 多个组件读同一 async atom 会重复请求吗？
**来源**：https://jotai.org/docs/utilities

不会，共享同 dependency 的 promise 结果，一次取数多方消费。

### 15. (坑类) async atom 里忘了 await 直接 fetch 返回什么？
**来源**：https://jotai.org/docs/core/atom

返回的是未 resolve 的 promise，需正确 await 才有数据值。
