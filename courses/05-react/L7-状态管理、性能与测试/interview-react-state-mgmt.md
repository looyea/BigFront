# react-state-mgmt 面试题精选

> 共 15 题，覆盖 A 是否需要全局态 / B Context / C 外部 store / D 单向数据流·Vue 对照四类。

---

## 一、需不需要全局状态（A 类）

### 1. React 项目什么时候才真正需要全局状态管理？

**答**：当一块状态**被多个不相关的组件、跨较深层级共享，且需要一致读写**时才有价值——如登录用户、主题、购物车、全局弹窗。判断顺序：① 能放局部 `useState` 就放局部；② 只父子几层 → 提到共同父传 props；③ 深层低频共享 → Context；④ 高频/细粒度订阅/需中间件与 devtools → 外部 store；⑤ 来自服务器的缓存数据 → Query，别当全局态。"过早引入 Redux"是常见反模式。

**来源**：React 官方文档 — You Might Not Need Redux / Managing State、Dan Abramov 同名文章

### 2. "把所有状态都塞进一个全局 store"有什么问题？

**答**：① 作用域失控——本该局部的 UI 态（某弹窗开合）被全局化，任何改动都可能牵连大范围重渲染；② 耦合升高、难以复用与测试组件（组件不再自包含）；③ store 膨胀、命名冲突、追踪困难；④ 违反"最小作用域 + 单向数据流"。正确做法是让状态**就近**、通过 props/context 显式流动，只把真正的跨切面全局态放 store（呼应 vue-state-patterns）。

**来源**：React 官方文档 — Managing State、Lifting State Up

---

## 二、Context（B 类）

### 3. Context 能替代 Redux 吗？它的局限是什么？

**答**：Context 提供"跨层传值"的**通道**，能承载简单的全局态（主题、语言、登录用户），但它**不是状态管理库**：① 没有选择器订阅——value 一变，**所有** `useContext` 消费者都重渲染（React.memo 也挡不住，因为它消费的是 value 本身）；② 无中间件/devtools/时间旅行；③ 更新逻辑要自己在 Provider 里用 useReducer 组织。所以低频读多写少适合 Context，高频细粒度更新需外部 store（呼应 react-context）。

**来源**：React 官方文档 — Context、When to use Context、useContext

### 4. 用 Context 时如何减少不必要的重渲染？

**答**：① `value` 用 `useMemo` 包，避免每次 Provider 渲染都造新对象触发全体更新；② **拆分 Context**：把"状态"和"dispatch/动作"分成两个 Provider——只需触发动作的组件订阅 dispatch（引用稳定、不随状态变），把广播面缩小；③ 把高频变化的 state 尽量下推到真正需要的子树，别放顶层 Context；④ 消费组件本身 `React.memo`（对未消费该 context 的 props 有效）。

**来源**：React 官方文档 — Context performance、Splitting contexts、useMemo

### 5. `useContext` 拿到的值和 Provider 是什么匹配关系？多个同类 Provider 嵌套会怎样？

**答**：`useContext(SomeCtx)` 沿组件树**向上**找**最近的** `SomeCtx.Provider`，用它的 value；找不到则用 `createContext(defaultValue)` 的默认值。嵌套同类 Provider 时，子组件读到的是**最内层（最近）**那个——可据此做"局部覆盖"（如某区块内主题不同）。这决定了"忘记套 Provider 会拿到默认值/undefined"是常见 bug。

**来源**：React 官方文档 — useContext、Provider 就近原则

---

## 三、外部 store（C 类）

### 6. Zustand 为什么能减少重渲染？和 Redux 的 useSelector 有何异同？

**答**：都靠**选择器订阅**——组件声明"我只关心 state 的哪一块"（`useStore(s=>s.count)` / `useSelector(s=>s.count)`），只有该切片变化才重渲染。异：Zustand 无 Provider、样板少、`create` 直接得 hook、内置中间件简单；Redux 需 `Provider`+`useSelector`+dispatch/action/reducer 约定，重但生态/devtools/规范强、适合大团队。核心机制一致：细粒度订阅优于 Context 的"value 变全体广播"（呼应 react-state-mgmt 第三节）。

**来源**：Zustand 文档 — Getting started / Getting slices、Redux Toolkit — useSelector

### 7. Redux Toolkit 相比老 Redux 改进了什么？现在还需要它吗？

**答**：RTK 用 `createSlice`（自动生成 action creators + reducer、集中一处）、`configureStore`（默认接 DevTools、去掉多中间件样板）、内置 Immer（可"直接改 draft"）、`createAsyncThunk` 处理异步，消除了大量样板。是否需要看团队：强规范、可预测、时间旅行、大协作 → RTK 仍合适；中小项目 Zustand/Jotai 或 Context+useReducer 往往更轻。服务端数据交给 Query 后，全局 store 的需求本身在缩小。

**来源**：Redux Toolkit 文档 — Why RTK、createSlice、Redux 官方 — 何时用 Redux

### 8. Jotai 的"原子化"和 Zustand 的"store"心智差别是什么？

**答**：Zustand 是**一个 store + 选择器**读切片；Jotai 是**多个原子(atom)**，组件按需订阅具体原子，派生原子可组合（一个 atom 依赖别的 atom），更像 Vue 的 `computed`/响应式源。Jotai 天然细粒度、无 Provider（有可选 Provider 做隔离），适合"许多独立小状态 + 派生"；Zustand 适合"一块内聚的领域状态 + action"。二者都避免 Context 式全量广播。

**来源**：Jotai 文档 — Introduction、Zustand 文档对照

---

## 四、单向数据流与 Vue 对照（D 类）

### 9. 什么是单向数据流？为什么组件"把 props 复制进 state 再 useEffect 同步"是反模式？

**答**：单向数据流=数据从父到子单向流、变更通过明确 action 回流到单一数据源，保证"一个值一处真相"。把 props 复制进本地 state 再 effect 同步，会造成**两份真相**、effect 时序导致不一致/额外渲染，且 props 变化时同步逻辑易漏。正确：直接用 props 渲染；要"以 props 为初值但之后本地可改"，用 `key` 重置组件，或在事件里改父级数据源，而非 effect 追赶（呼应 vue-state-patterns、react-usestate）。

**来源**：React 官方文档 — Lifting State Up、You Might Not Need an Effect、mdx：Derive state during render

### 10. 从 Pinia 迁到 React，你如何映射 store/state/getters/actions？

**答**：Pinia `state`+`getters`+`actions` 的模式在 React 拆成：① 真正的客户端全局态 → Zustand store（state + action 函数）或 Context+useReducer；② Pinia `getters`（派生）→ React 里 `useMemo` 或 store 选择器现算，不另存；③ Pinia 里在 action 手动 fetch 接口塞 state → 改为 TanStack Query，store 不再缓存服务端数据。核心是"Pinia 常把服务端数据也放 store，React 社区倾向分离"（呼应 vue-pinia-basics、react-data-fetching）。

**来源**：Pinia 文档 — Core concepts、TanStack Query — Server State、Zustand 文档

### 11. React 的 useState 和"响应式状态库"（如 MobX/Vue 响应式）有什么本质差异？

**答**：`useState` 是**快照式**：更新要 `setState(新值)` 触发**重新渲染**、返回新快照，组件函数重跑。MobX（`makeAutoObservable`）/Vue 响应式是**引用可变 + 依赖追踪**：直接改字段，靠 getter/setter 精确通知订阅者局部更新，组件不"重跑整个函数"。React 的函数式渲染模型（呼应 react-component）决定了它靠"重渲染 + diff"而非"精确响应式"，这也是为什么 React 需要 memo/选择器来避免多余工作，而 Vue 大部分是自动的（呼应 vue-reactivity-theory）。

**来源**：MobX 文档 — React bindings、Vue 官方文档 — Reactivity Fundamentals、React 官方文档 — useState

### 12. 面试问"Redux / Zustand / Context 你怎么选"，如何答得体系化？

**答**：给决策框架而非站队：① 先排除——服务端数据用 Query，不进任何这三者；② 低频、跨切面、天然属组件树（主题/语言/登录）→ Context（配 useMemo + 拆读写）；③ 高频、多处细粒度订阅、需持久化/中间件/devtools → Zustand（轻量）或 RTK（重规范、大团队）；④ 能用局部 state + props 数据流解决的绝不全局化。答题时强调"作用域最小化 + 更新粒度 + 团队规范"三维度权衡，最能体现工程成熟度（呼应 react-context、react-data-fetching）。

**来源**：React 官方文档 — Managing State、Zustand/Redux 文档、You Might Not Need Redux

---

## 补充（新专题 13-15）

### 13.  把 Jotai（自底向上原子）、Zustand（单 store+selector）、Redux（单 store+dispatch+中间件）作范式对比，各适合什么规模？

Jotai：以「atom」为最小单元、依赖自动串联，写起来最接近「派生即组合」，没有中心 store，天然细粒度、样板少；适合中等、状态图复杂、喜欢函数式组合的团队，缺点是跨切面调试/时间旅行不如 Redux 成熟。Zustand：一个（或多个）外部 store + hook selector，API 极简、无 Provider、可脱离 React 读写、按需订阅；适合绝大多数中大型 app 的全局客户端态，是当前性价比之王。Redux/RTK：单一 store + 严格 action→reducer 流 + 成熟 DevTools/中间件（ saga、审计、持久化、时间旅行）；适合超大型、要求强规范与可观测、多人协作、状态即产品核心的场景。选择不是「谁更强」而是「你要多少纪律换多少成本」：原子最轻、Zustand 居中、Redux 最重但最可审计。

**来源**：Jotai/Zustand/Redux Toolkit 各自设计理念文档；三者范式对比社区综述。

### 14.  给一份「让 Context 重渲染可控」的完整技术清单，并说明为什么外部 store 天然绕开这些麻烦。

清单：① value 用 useMemo 稳定，别传每帧新建对象；② 按变化频率拆分 Provider（低频 state 与恒定的 dispatch/回调分开）；③ 缩小消费面——把读 context 的组件做到尽量小的叶子，静态结构作为 children 从外部传入（不消费就不随广播重渲）；④ 派生值在消费者里用 useMemo 算、别塞进 value 造成更大广播面。即便如此，Context 仍是「引用变→全体消费者重渲」的粗粒度模型。外部 store 之所以绕开：它用 useSyncExternalStore + selector 做「按切片订阅」，组件只在自己选中的值变化时渲染，且 store 可在 React 外读写、支持时间旅行/持久化中间件——等于把「选择性订阅」这个 Context 天生缺失的能力补齐。所以不是 Context 不好，而是它的广播语义决定了大规模下要费劲。

**来源**：React Context 性能优化文档；外部 store（Zustand/Redux）selector 订阅模型对照。

### 15.  「state colocation」和「lifting state up」如何平衡？“能局部就局部”在组件设计上到底意味着什么？

两条相反方向的力：上提到共同父（兄弟共享）保证 SSOT，但提太高会让无关中间层被 re-render 与转发 props 拖累、组件耦合、复用变差；下沉到真正使用者（colocation）缩小重渲染半径、提高内聚，但过度下沉导致「同一份数据多处各存一份」的复制同步地狱。平衡判据：把状态放在「所有需要它的组件的最近共同祖先」——再高一点都算过度提升；能派生的不存；只在叶子关心的别提到路由层。操作层面：把「会变的一小块」连同它的 state 拆进独立子组件（本包性能关手法），父传下去的是不常变的 props/children；跨树共享又确实全局的才上 store/Context。所谓「能局部就局部」本质是「让状态离它驱动的最小渲染范围尽可能近」，与「别过早全局化」是同一原则的两面。

**来源**：React「Managing State / state colocation」指引；Keep it local 的组件设计社区共识。
