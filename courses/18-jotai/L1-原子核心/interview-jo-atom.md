# 面试题：Atom 原语（jo-atom）

### 1. (原理类) 一句话定义 atom。
**来源**：https://jotai.org/docs/core/atom

一个可被组件订阅、可读写、可派生的最小状态单元，脱离组件树独立存在。

### 2. (对比类) atom 与 useState 何时该选哪个？
**来源**：https://jotai.org/docs/advanced/atoms-in-array

组件局部一次性用 useState；需跨组件共享或派生用 atom。

### 3. (对比类) Jotai 自下而上 vs Zustand 自上而下的实际影响？
**来源**：https://jotai.org/docs/introduction

Jotai 拆分天然、订阅细；Zustand 集中便于跨域协作但需 selector 控粒度。

### 4. (设计类) 为什么说 atom 是“可组合”的？
**来源**：https://jotai.org/docs/core/atom

一个 atom 的 getter 可依赖其它 atom，形成依赖图，派生与写入都能组合。

### 5. (实战类) 把 useState 逻辑迁移成 atom 的判断标准？
**来源**：https://jotai.org/docs/utilities

出现 prop drilling 或多个组件需要同一值时，把该状态下沉为 atom。

### 6. (坑类) 在组件里 new atom 会怎样？
**来源**：https://jotai.org/docs/advanced/atom-lifecycle

每次渲染新 atom 等于每次新状态，丢失共享与持久，应在模块作用域创建。

### 7. (原理类) Jotai 的订阅为什么天然细粒度？
**来源**：https://jotai.org/docs/core/use-atom

组件按用到的 atom 订阅，依赖图中未涉及的 atom 变化不触发其重渲。

### 8. (对比类) atom 与 signal 提案的关系？
**来源**：https://github.com/tc39/proposal-signals

理念一致（响应式值 + 自动依赖），Jotai 的 getter 类似 computed signal。

### 9. (实战类) 给一个 counter 例子并说明读写。
**来源**：https://jotai.org/docs/core/atom

const countAtom=atom(0); 读用 useAtomValue(countAtom)，写用 useSetAtom(countAtom)(c=>c+1)。

### 10. (TS类) atom 的类型如何推断？
**来源**：https://jotai.org/docs/typescript/typescript

由初值或 getter 返回类型推断，派生 atom 只读类型自动确定。

### 11. (设计类) 为什么推荐小 atom 而非一个巨型对象 atom？
**来源**：https://jotai.org/docs/advanced/atom-patterns

小 atom 订阅更精准、避免无关更新；巨型对象又回到粗粒度问题。

### 12. (坑类) 模块级 atom 在多实例/SSR 的隐患？
**来源**：https://jotai.org/docs/utilities/ssr

全局 store 会跨请求/跨实例共享，需 Provider/createStore 隔离（呼应 jo-store/jo-ssr）。

### 13. (趋势类) React 官方对这类外部原子的态度？
**来源**：https://react.dev/reference/react/useSyncExternalStore

鼓励用 useSyncExternalStore 桥接；Jotai 内部即如此，保证并发一致。

### 14. (综合类) 什么场景 Jotai 明显优于 Zustand？
**来源**：https://jotai.org/docs/introduction

依赖派生多、组件树状态密集、需要天然 async/Suspense 的场景。

### 15. (综合类) 如何向 Redux 背景的人解释 atom？
**来源**：https://jotai.org/docs/introduction

每个 atom 像一个自动 selector + reducer 的微 store，组合成图，无中央 dispatch。
