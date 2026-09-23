# react-usestate 面试题精选

> 共 15 题，覆盖 A 基础与不可变 / B 更新技巧 / C 异步与批处理 / D 设计与对照类。

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

---

## 补充（新专题 13-15）

### 13. React 为什么对 useState 的更新只浅比较（Object.is）不做深比较？这个取舍买到了什么、又让人必须做什么？

深比较对大型/深层对象是 O(n) 且每帧都做，成本可能远超「直接重渲染」，且语义模糊（结构变了但值等价算不算变？函数怎么办？）。React 选择把「要不要更新」的决定权交还你：只保证同一引用（原始值相等或同一对象引用）能 bailout 跳过，代价是你必须用「不可变 + 新引用」来宣告变化（改嵌套对象要一路拷贝出被改路径的新对象，或用 immer）。买到的收益：可预测、低开销、与 memo「引用不变即不渲染」天然咬合。演进方向：结构共享库（immer）写起来像可变、实际产出新引用，缓解「深拷贝嵌套难受」；useReducer 把散在多处的更新收进 reducer 集中管理。这条讲清 = 讲清 React 的「变化即引用变化」根本契约。

**来源**：React useState 文档关于 Object.is bailout；Immer 与不可变更新的权衡；useReducer 迁移建议。

### 14. 把 useState / useReducer / useSyncExternalStore / 外部 store（Zustand 等）排成一条「状态来源光谱」，如何按来源与所有权选型？

按「谁是真相源」分档：① 组件内部瞬态（表单、开关、当前 index）→ useState，最小作用域；② 组件内但多字段强关联、转换规则复杂（ wizards、多步 reducer、需要时间旅行/集中测试）→ useReducer，把「怎么变」从「在哪变」里抽出；③ 属于服务端/URL/存储的缓存（列表、详情）→ 交数据层（useSyncExternalStore 之于外部 store、或 TanStack Query/React Router loader），它天生该有 stale/invalidation 语义而非 set 语义；④ 真·全局客户端状态（主题、登录用户、跨路由购物车）→ Context 起步、量大且要细粒度订阅时上 Zustand/Redux。红线：别把服务端数据塞进 useState 手写 fetch（等于重造半个查询库），也别把纯局部瞬态提升到全局（远程全局变量反模式）。这条光谱与本包状态管理关、数据获取关完全对齐。

**来源**：React「You Might Not Need an Effect」与 useSyncExternalStore 文档；「Global state vs server cache」社区共识综述。

### 15. useTransition 等并发更新下，useState 的「渲染可能被重放」给状态逻辑带来了什么新坑？

并发 render 可被打断重来，意味着一次用户操作里组件函数可能被调用多次、props/state 快照会被回读。踩坑点：① 渲染期读改外部可变状态（模块变量、ref.current）不再是幂等——重放会读到「上次中断留下的脏值」，所以要遵守 purity（render 不写 ref/全局）；② 需要「基于最新值」的判断不能在 render 里读 ref 猜测，要放进事件/effect；③ 乐观 UI 里把「用户输入」同时存进 state 又要喂给 transition 更新，可能不一致——正解是用 useDeferredValue 或直接读最新 props 派生，而非在 effect 里同步。React 19 的 `use()`、actions、`useOptimistic` 就是把这些模式收敛成官方原语。讲清这条，说明你不是只背「useState 三元组」而是理解并发模型。

**来源**：React Concurrent 渲染下 purity 要求；React 19 useOptimistic/use/useActionState 文档动机。
