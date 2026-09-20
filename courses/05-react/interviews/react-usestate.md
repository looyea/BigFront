# react-usestate 面试题精选

> 共 12 题，覆盖 A 基础与不可变 / B 更新技巧 / C 异步与批处理 / D 设计与对照类。

## 一、基础与不可变（A 类）

### 1. useState 返回的是什么？为什么用数组解构？
返回 `[当前state, setter函数]` 的二元组，用数组解构取两个值并自定义命名（`[count, setCount]`）。state 由 React 按 Hook 调用顺序在该组件实例上持久化，跨渲染保留（呼应 react-usestate 第一节、react-render-model 顺序）。
**来源**：react.dev — useState、Managing state

### 2. 为什么 React 强调 state 不可变(immutable)？直接改会怎样？
React 用 `Object.is` 比较新旧引用来决定是否重渲染，直接原地改对象/数组 → 引用不变 → 被视为未变、不更新；还会破坏时间旅行调试、memo 比较、并发安全。要更新就造新对象（展开/映射）（呼应 react-usestate 第二节）。
**来源**：react.dev — Updating objects/arrays immutably、Immutable Data

### 3. 更新一个嵌套很深的对象字段很难受，有什么方案？
浅层用展开 `{...state, nested:{...state.nested, x:1}}`；深层推荐 **Immer**（`produce` 里"看起来直接改"，内部生成新引用），或把状态结构**扁平化**。Immer 是 Redux Toolkit 默认依赖（呼应 react-state-mgmt、redux）。
**来源**：Immer 文档、Redux Toolkit — createSlice(produce)

## 二、更新技巧（B 类）

### 4. 什么时候必须用函数式更新 `setN(p => p+1)`？
新值依赖旧值、或在同一次事件/异步回调里要连续多次更新、或 setter 被放进闭包/`setInterval`/监听器读到的是陈旧值时。函数式更新保证基于"最新 pending state"计算（呼应 react-usestate 第三节、react-useeffect 闭包）。
**来源**：react.dev — Queuing state updates、Functional updates

### 5. 惰性初始化 `useState(() => expensive())` 解决什么问题？
`useState(x)` 里的 `x` 每次渲染都会重新计算（虽然只有首帧被用）。传函数形式，React 只在挂载时调用一次取初值，避免每次渲染都跑昂贵计算/重复 parse（呼应 react-usestate 第四节）。
**来源**：react.dev — useState lazy initialization

### 6. state 存对象 vs 拆成多个 useState，怎么取舍？
相关的、总是一起变的字段适合放一个对象 state；互不相关的独立字段拆成多个 useState 更清晰、少展开样板。别为"一个 state 管所有"把无关数据塞一起（呼应 react-advanced-hooks useReducer、state-patterns）。
**来源**：react.dev — Organizing state、One state or many

## 三、异步与批处理（C 类）

### 7. 为什么 set 之后立刻读 state 还是旧值？想在更新后执行该怎么做？
state 是本次渲染的常量快照，`set` 只排下一次渲染，当前作用域值不变。要在"应用了更新、DOM 改完后"执行，用 `useEffect`（依赖该 state），而不是紧跟 set 后（呼应 react-usestate 第五节、react-useeffect）。
**来源**：react.dev — Why isn't state updated immediately、Synchronizing with Effects

### 8. React 18 的自动批处理与旧版有何不同？一个例外或注意？
18 起同步/异步（Promise、setTimeout、原生事件）里的多次 setState 都合并为一次渲染，17 只批同步事件处理器。注意：需要"逐次中间值"的场景要显式 `flushSync` 打破批处理（罕见，且通常说明设计可优化）（呼应 react-usestate 第六节）。
**来源**：React 18 — Automatic batching、flushSync API

### 9. `Object.is` 相等就完全不重渲染吗？
不一定。React 可能在值相等时**提前退出(bailout)**跳过该组件及其子树的重渲染，但行为依赖实现与父是否已渲染；不要把它当可靠优化手段。想精确控制重渲染用 `React.memo`/状态提升设计（呼应 react-render-model 第六节）。
**来源**：react.dev — Bailing out of state updates、React.memo

## 四、设计与对照（D 类）

### 10. 派生值该存进 state 还是每次算？为什么？
能由现有 state/props 推出的值**不要另存 state**，渲染时直接算或用 `useMemo`。存副本会造成"两处真相要同步"的 bug 源。这与 Vue 用 computed 派生同理（呼应 react-usestate、vue-state-patterns 第四节）。
**来源**：react.dev — You Might Not Need an Effect / Storing information、Derived state

### 11. 大量 useState 让组件状态零散、联动复杂，怎么演进？
先用 useState；当"多字段一起变/转换逻辑复杂"时合并成 `useReducer`（一处 reducer 管迁移）；当"跨组件共享"时才升级到 Context 或外部 store（Zustand/RTK）。别过早全局化（呼应 react-advanced-hooks、react-state-mgmt）。
**来源**：react.dev — useReducer、Choosing the right state tool

### 12. 和 Vue 的 `ref`/`reactive` 相比，React state 心智差异在哪？
Vue 是可变代理：改 `.value`/深层属性即触发；React 是"快照 + set 新值 + 不可变"，靠重跑函数产生新 UI。React 无依赖收集，重渲染传播靠 memo/key 手动控制；Vue 编译期+Proxy 自动精确。理解这点能解释 React 更多的"手动优化"传统（呼应 react-usestate 第二节、vue-reactivity、react-render-model）。
**来源**：Vue 响应式 vs React 不可变状态 — 设计哲学对比
