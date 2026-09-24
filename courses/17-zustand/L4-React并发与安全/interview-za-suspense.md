# 面试题：Suspense 边界里的 store（za-suspense）

### 1. (原理类) 为什么 Zustand 不能直接配 Suspense 取数？
**来源**：https://react.dev/reference/react/Suspense

Suspense 需要渲染期 throw Promise；Zustand set 是普通状态更新，不产生挂起语义。

### 2. (对比类) Zustand 与 Jotai 在 async/Suspense 上的差异？
**来源**：https://jotai.org/docs/utilities/async

Jotai async atom 天然 throw promise 可被 Suspense 捕获；Zustand 需借助 Query 或手写 loading。

### 3. (实战类) 用 Suspense 取列表 + Zustand 管筛选的组合？
**来源**：https://tanstack.com/query/latest/docs/react/reference/useSuspenseQuery

useSuspenseQuery 提供数据并挂起，筛选/分页 UI 态放 Zustand，二者互不越界。

### 4. (坑类) store 里存 fetch promise 会有什么坑？
**来源**：https://tkdodo.eu/blog/

竞态、缓存、重渲全要手搓，等于重造 Query；且不会自动触发 Suspense。

### 5. (设计类) 错误边界为什么要联动 store？
**来源**：https://react.dev/reference/react/Component#componentdidcatch

边界只能兜住渲染错误，但 store 里的 loading/error 标志需手动复位以免 UI 卡死。

### 6. (实战类) SSR 首屏数据如何进入 store？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

服务端序列化下发，客户端 effect 里 setState 水合一次，之后 store 管交互。

### 7. (对比类) useSuspenseQuery 与手动 isLoading 的取舍？
**来源**：https://tanstack.com/query/latest

Suspense 声明式、组件更干净但需注意边界粒度；手动 isLoading 灵活但样板多。

### 8. (综合类) 设计一个“详情页 + Suspense + Zustand”的数据流。
**来源**：https://react.dev/reference/react/Suspense

useSuspenseQuery(id) 拉详情并挂起，fallback 骨架；本地 tab/收藏放 Zustand；错误走 boundary 复位。

### 9. (坑类) Suspense 边界放太粗会怎样？
**来源**：https://react.dev/reference/react/Suspense

整页白屏/fallback 覆盖过多内容；应按区块细粒度包裹。

### 10. (设计类) store 该不该缓存服务端数据以加速二次访问？
**来源**：https://tanstack.com/query/latest

不该；缓存/失效是 Query 职责，store 再存一份就是第二真相。

### 11. (实战类) 如何测“加载失败清 loading”？
**来源**：https://zustand.docs.pmnd.rs/limitations

mock Query reject，渲染 ErrorBoundary 包住，断言 componentDidCatch 后 store.loading=false。

### 12. (趋势类) RSC 会削弱 store 与 Suspense 的关系吗？
**来源**：https://react.dev/reference/react/server-components

数据更多在 server 组件直接 await，client store 更聚焦交互态，Suspense 边界在 server/client 间协作。

### 13. (综合类) 何时干脆用 Jotai 而不是 Zustand 处理异步？
**来源**：https://jotai.org/docs/

依赖驱动的异步数据、需要天然 Suspense/竞态取消时，Jotai async atom 更贴合。

### 14. (对比类) retry 为什么不该写进 Zustand action？
**来源**：https://tanstack.com/query/latest

重试/退避/取消是数据层关注点，交给 Query 复用；store 重复实现易遗漏边界。

### 15. (设计类) 给团队定 Suspense 与 store 的边界口诀。
**来源**：https://react.dev/reference/react/Suspense

会挂起的归 Query/Jotai+Suspense；store 只存客户端态且负责 loading 标志与边界复位。
