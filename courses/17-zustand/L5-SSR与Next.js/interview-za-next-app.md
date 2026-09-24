# 面试题：Next.js App Router 集成（za-next-app）

### 1. (原理类) 为什么 SSR 里全局 store 会跨请求泄漏？
**来源**：https://nextjs.org/docs/app

Node 进程复用模块作用域，单例 store 在所有请求间共享，上一请求写入被下一请求读到。

### 2. (实战类) App Router 里如何组织 Zustand？
**来源**：https://nextjs.org/docs/app/building-your-application/react/directives

use client 边界内用工厂 + Context 提供 per-session store，服务端组件不 import store。

### 3. (坑类) 不处理水合会看到什么错误？
**来源**：https://nextjs.org/docs/messages/hydration-failed

Hydration failed / text content mismatch，因服务端首帧与客户端 persist 值不同。

### 4. (实战类) skipHydration + rehydrate 完整流程？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

设 skipHydration:true→SSR 渲染初始态→client useEffect 调 useStore.persist.rehydrate()→订阅更新。

### 5. (设计类) RSC 时代还需要大 store 吗？
**来源**：https://react.dev/reference/react/server-components

服务端数据下沉 RSC/Query，Zustand 收敛为交互/UI 客户端态，体积更小更聚焦。

### 6. (对比类) App Router 与 Pages Router 用 Zustand 差异？
**来源**：https://nextjs.org/docs/pages

Pages 有 getServerSideProps 可在 server 初始化；App 是 RSC，store 只能在 client 边界，水合策略类似但边界更明确。

### 7. (坑类) 在 server 组件里 import persist store 会怎样？
**来源**：https://nextjs.org/docs/app

触发客户端/服务端混用报错或尝试访问 window 崩溃；store 文件应带 client 语境。

### 8. (综合类) 给“登录后购物车持久化 + SSR”设计水合方案。
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

cartStore persist(skipHydration)；SSR 骨架；client rehydrate；登录用户 id 拼进 name 防串号。

### 9. (性能类) 首屏避免 store 造成的重复渲染？
**来源**：https://react.dev/reference/react/Suspense

水合期用 skeleton，rehydrate 后一次到位；避免多次 setState 连续重渲。

### 10. (设计类) 多标签页 + persist 在 SSR 项目的一致性？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

配合 storage event/BroadcastChannel 同步，rehydrate 时机统一。

### 11. (实战类) StoreProvider 放哪一层？
**来源**：https://nextjs.org/docs/app

放需要共享 store 的最小 client 子树根，避免全局 client 化损失 RSC 收益。

### 12. (坑类) 把 useStore 用在 server 组件？
**来源**：https://react.dev/reference/react/directives

非法，hook 只能在 client 组件；需下移到 use client 子组件。

### 13. (对比类) 与 Redux 在 Next SSR 的 preloadedState 对比？
**来源**：https://redux.js.org/usage/server-rendering

Redux 有官方 per-request makeStore+preloadedState 范式；Zustand 靠工厂+Context 手动实现类似隔离。

### 14. (趋势类) React Compiler/缓存对 SSR store 的影响？
**来源**：https://react.dev/learn/react-compiler

减少手 memo，但跨请求隔离与水合正确性仍需 store 设计保障。

### 15. (综合类) 团队 Next+Zustand 的 checklist？
**来源**：https://nextjs.org/docs/app

① store 只 client ② 工厂 per-request ③ persist 配 skipHydration ④ server 数据走 RSC/Query ⑤ 骨架兜水合。
