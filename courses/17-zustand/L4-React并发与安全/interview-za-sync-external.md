# 面试题：useSyncExternalStore 原理（za-sync-external）

### 1. (原理类) 什么是 torn read，为什么并发模式下更严重？
**来源**：https://react.dev/reference/react/useSyncExternalStore

一次渲染中不同组件/不同优先级读到外部状态不同时刻的值导致不一致；并发可中断渲染放大时间窗。

### 2. (原理类) useSyncExternalStore 三个参数各自职责？
**来源**：https://react.dev/reference/react/useSyncExternalStore

subscribe 建立订阅返回退订；getSnapshot 返回稳定当前值；getServerSnapshot 水合期稳定值。

### 3. (实战类) Zustand 是怎么用上它的？
**来源**：https://zustand.docs.pmnd.rs/integrations/... 

create 的 hook = useSyncExternalStore(store.subscribe, ()=>selector(store.getState()))，把 selector 结果当快照。

### 4. (坑类) 为什么 selector 返回新对象会死循环？
**来源**：https://react.dev/reference/react/useSyncExternalStore

getSnapshot 每次引用不同 → React 认为持续变化 → 重渲 → 又新引用，形成循环并告警。

### 5. (SSR类) getServerSnapshot 缺失会怎样？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

SSR 渲染无稳定值抛错或水合 mismatch；需提供与服务端一致的快照或用 skipHydration。

### 6. (对比类) 与 Redux 的 react-redux 订阅机制关系？
**来源**：https://react-redux.js.org/

react-redux v8 同样迁移到 useSyncExternalStore，思路一致：统一外部 store 的并发安全订阅。

### 7. (设计类) 订阅与渲染解耦带来什么好处？
**来源**：https://react.dev/reference/react/useSyncExternalStore

store 可脱离 React 存在、命令式读写，React 只作为订阅者之一。

### 8. (性能类) 细粒度订阅如何实现？
**来源**：https://zustand.docs.pmnd.rs/integrations/auto-render-optimizations

selector 决定订阅粒度，Object.is 判等只在选中值变时重渲该组件。

### 9. (坑类) 在 getSnapshot 里做副作用会怎样？
**来源**：https://react.dev/reference/react/useSyncExternalStore

getSnapshot 必须纯且幂等，副作用会导致不可预期重渲/无限循环。

### 10. (综合类) 写一个用 useSyncExternalStore 手绑 vanilla store 的最小 hook。
**来源**：https://zustand.docs.pmnd.rs/reference/hooks/use-store

useSyncExternalStore(store.subscribe, ()=>selector(store.getState()))，注意 selector 稳定。

### 11. (对比类) 它和 useTransition 一起如何保证一致性？
**来源**：https://react.dev/reference/react/useTransition

useSyncExternalStore 让外部 store 在过渡渲染中取同一快照，避免新旧混用。

### 12. (趋势类) 未来 Signal 提案会取代它吗？
**来源**：https://github.com/tc39/proposal-signals

Signal 可能内建订阅语义，React 或有原生适配，但当前 useSyncExternalStore 是标准外部桥接。

### 13. (实战类) 如何调试“组件异常频繁重渲”是否因快照不稳？
**来源**：https://react.dev/reference/react/useSyncExternalStore

看是否出现 cached 警告、用 Profiler 比对 store 未变时的渲染，检查 selector 返回引用。

### 14. (综合类) 给团队解释为什么 Zustand 不用 Provider 也并发安全。
**来源**：https://zustand.docs.pmnd.rs/

安全来自 useSyncExternalStore 的订阅契约，与 Context 无关；store 引用稳定即可全局订阅。

### 15. (设计类) getSnapshot 与 selector 结果缓存的关系？
**来源**：https://zustand.docs.pmnd.rs/limits/optimal-composition

需要 memoized selector 或 useShallow，使同输入返回同引用，满足 getSnapshot 稳定性。
