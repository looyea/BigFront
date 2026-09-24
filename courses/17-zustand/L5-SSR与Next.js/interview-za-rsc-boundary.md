# 面试题：RSC 与 Client 边界（za-rsc-boundary）

### 1. (原理类) 为什么 RSC 不能碰 Zustand？
**来源**：https://react.dev/reference/react/directives

RSC 不跑浏览器 hook/事件，也没有 localStorage；Zustand 依赖 client 运行时。

### 2. (实战类) Server Action 更新数据后如何让 client UI 更新？
**来源**：https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations

Action 返回结果 + revalidate/Query invalidate，客户端重取；不直接改 client store。

### 3. (设计类) server 下发→client 注入模式的注意点？
**来源**：https://nextjs.org/docs/app

只注入一次（effect 依赖稳定值）、别把可序列化数据变第二真相、复杂缓存仍交 Query。

### 4. (坑类) 在 RSC import 了带 persist 的 store 会怎样？
**来源**：https://nextjs.org/docs/messages/

尝试访问 window/localStorage 崩溃或报 use client 边界错误。

### 5. (对比类) getServerSnapshot 在 RSC 水合中的角色？
**来源**：https://react.dev/reference/react/useSyncExternalStore

提供服务端与水合首帧一致的快照，避免 mismatch。

### 6. (综合类) 设计一个 RSC + Query + Zustand 的详情页。
**来源**：https://tanstack.com/query/latest

RSC await 详情并传给 Query 作为 initialData；收藏/tab 等交互态 Zustand；mutation 后 invalidate。

### 7. (实战类) 哪些状态适合 server 下发注入 store？
**来源**：https://nextjs.org/docs/app

一次性初始化配置、feature flags、用户偏好首值；持续演进的仍归 Query。

### 8. (设计类) 如何避免 client 边界过大导致 bundle 膨胀？
**来源**：https://nextjs.org/docs/app/building-your-application/react/directives

把 use client 边界下沉到真正需要交互的最小叶子，store 只在其中。

### 9. (坑类) 把 fetch 结果 setState 进 store 代替 Query 的问题？
**来源**：https://tkdodo.eu/blog/

丢掉缓存/去重/竞态/失效，等于手搓一个残缺 Query。

### 10. (对比类) Zustand 与 next/recoil 在 RSC 下的适配难度？
**来源**：https://nextjs.org/docs/app

都需 client 边界；Zustand 无 Provider 更省事，但 per-request 隔离仍需工厂/Context。

### 11. (性能类) 频繁 server 下发注入会不会多次重渲？
**来源**：https://react.dev/reference/react/useEffect

应只在变化时注入，用依赖数组/浅比较控制，避免 effect 循环 setState。

### 12. (综合类) 如何在 mutation 成功后同步 store 里的“我的资料”？
**来源**：https://tanstack.com/query/latest

优先 invalidate 让 Query 重取；若资料是客户端态，用 action 返回 patch 再 setState。

### 13. (趋势类) RSC 让全局 store 变得更小，你认同吗？
**来源**：https://react.dev/reference/react/server-components

认同：大量数据读取下沉，Zustand 收敛到交互，符合分层原则。

### 14. (设计类) 给 client/server 状态归属定一条判据？
**来源**：https://nextjs.org/docs/app

“能否在服务端一次性确定并渲染”——能则 RSC/Query，否则交互期由 Zustand。

### 15. (综合类) 团队 RSC + Zustand 规范你会写什么？
**来源**：https://nextjs.org/docs/app

① store 文件顶部标 client 语境；② server 组件禁 import；③ 数据靠 props/Query；④ 注入 effect 一次。
