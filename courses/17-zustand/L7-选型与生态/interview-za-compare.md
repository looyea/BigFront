# 面试题：选型矩阵（za-compare）

### 1. (选型类) 给一个判据口诀帮团队选 Zustand 还是 RTK？
**来源**：https://redux-toolkit.js.org/

中小团队、要快、少样板→Zustand；超大团队、要强制规范/重中间件/最强 DevTools→RTK。

### 2. (对比类) Zustand 与 Jotai 的路线差异本质？
**来源**：https://jotai.org/docs/introduction

Zustand 自上而下大 store + selector；Jotai 自下而上小原子 + 依赖图，异步/Suspense 更天然。

### 3. (设计类) 为什么说不存在“一个库通吃”？
**来源**：https://tkdodo.eu/blog/putting-js-in-react-states

数据分服务端/客户端/表单/URL 等类别，各有最优工具，强行合一制造反模式。

### 4. (对比类) Context 的性能短板在哪？
**来源**：https://react.dev/reference/react/useContext

value 变则整棵子树重渲，缺细粒度订阅；Zustand selector 精准到组件字段。

### 5. (选型类) 新项目从 0 到 1 你会先上什么？
**来源**：https://zustand.docs.pmnd.rs/

组件本地 useState/useReducer；出现跨页共享再上 Zustand；有远端数据即引入 Query。

### 6. (对比类) Zustand 借用 Redux DevTools 意味着放弃了什么？
**来源**：https://zustand.docs.pmnd.rs/middlewares/devtools

有 action 命名时间旅行，但没有 RTK 的 slice 规范/reducer 纯函数约束，需自律（呼应 za-compare）。

### 7. (设计类) 共存时如何避免状态重复？
**来源**：https://zustand.docs.pmnd.rs/limits/optimal-composition

先分类归属（server→Query、client→Zustand、form→RHF、url→router），一份数据一个权威源。

### 8. (对比类) MobX 相对 Zustand 的定位？
**来源**：https://mobx.js.org/README.html

MobX 面向对象 + 自动依赖追踪(可变风格)；Zustand 函数式 + 不可变 selector，心智更轻。

### 9. (选型类) 老 Vuex/Redux 项目值得迁 Zustand 吗？
**来源**：https://github.com/pmndrs/zustand/discussions

看收益：样板多/TS 差则收益大；已规范且稳定可渐进（呼应 pinia-migration 思路）。

### 10. (对比类) Jotai vs Zustand 谁更适合表单密集？
**来源**：https://jotai.org/docs/

字段级订阅都可用，但表单首选 RHF；Jotai focusAtom 对嵌套表单更贴，Zustand 需切片。

### 11. (设计类) 团队统一 store 用 Zustand 会缺什么，怎么补？
**来源**：https://zustand.docs.pmnd.rs/integrations/middleware

缺强制规范，用封装 createStore、lint 规则、命名与分层约定补齐。

### 12. (对比类) Recoil 与 Jotai 同思路，为何 Jotai 更流行？
**来源**：https://jotai.org/docs/introduction

Jotai API 更简、体积更小、无 Recoil 的复杂 selectorFamily/快照概念，迁移成本低。

### 13. (选型类) 需要 SSR 时选型有何变化？
**来源**：https://nextjs.org/docs/app

都得处理 per-request 隔离与水合；Zustand 工厂+skipHydration，Jotai 每请求 createStore+Provider（呼应 za-next-app/jo-ssr）。

### 14. (对比类) 为什么 Zustand 比 Redux 上手快？
**来源**：https://zustand.docs.pmnd.rs/integrations/redux

无 action type/reducer/dispatch 仪式，set 直改，hook 即用。

### 15. (综合类) 给一张最终选型决策树文字版。
**来源**：https://zustand.docs.pmnd.rs/

远端数据→Query；跨组件客户端态→Zustand；原子依赖/async→Jotai；表单→RHF；低频注入→Context；超大规范团队→RTK。
