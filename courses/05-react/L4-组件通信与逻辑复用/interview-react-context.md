# react-context 面试题精选

> 共 15 题，覆盖 A 基础 / B 性能陷阱 / C 缓解与模式 / D 边界与对照类。

## 一、基础（A 类）

### 1. Context 是什么？解决了什么问题？有何局限？
Context 提供跨组件层级"透传"值而无需逐层传 props，解决 prop drilling。局限：它本质是"发布订阅式广播"——value 一变所有消费者重渲染，不自带选择器/派生/中间件，不适合高频细粒度更新（呼应 react-context 第一、三节）。
**来源**：react.dev — Context、Passing data deeply

### 2. useContext 的查找规则？多个 Provider 嵌套时取哪个？
从当前组件向上找**最近的**对应 Provider，取它的 value；都找不到则用 createContext 的默认值。嵌套 Provider 时，消费组件看到的是离它最近的那层（呼应 react-context 第一节、vue-provide-inject 向上最近）。
**来源**：react.dev — 就近 Provider、Context nesting

## 二、性能陷阱（B 类）

### 3. 为什么"给 Provider 传内联对象"是 Context 第一大坑？
Provider 用 `Object.is(value)` 判断是否变化，内联对象每次渲染都是新引用 → 被判为"变了" → 广播重渲染全部消费者。修法：`useMemo` 稳定对象，或拆多个 context（呼应 react-context 第三、四节、react-memo-hooks）。
**来源**：react.dev — 优化 context 提供的值、Beware inline object value

### 4. React.memo 能阻止 Context 更新触发的重渲染吗？为什么？
不能。Context 变化是 React 内部的**强制传播**，会跳过 memo 的 props 浅比较直接重渲染消费者。所以优化 Context 要"少消费、拆 context、就近消费"，而非指望 memo（呼应 react-context 第三节、react-render-model）。
**来源**：react.dev — 性能与 context、Context 穿透 memo

### 5. "消费组件越多越危险"具体指什么？该如何设计消费粒度？
消费者越多、且都消费一个大 value，任何局部变化都牵动大片重渲染。设计：把大 context 按"变化频率/职责"拆小；只消费自己需要的部分；把 `useContext` 放进**尽量小的叶子组件**，让重渲染范围最小（呼应 react-context 第四节）。
**来源**：react.dev — 拆分 context、组件化下移消费

## 三、缓解与模式（C 类）

### 6. 把 state 与 dispatch/setter 拆成两个 Context 有什么收益？
`dispatch`（useReducer）或 setter 引用稳定，单独放一个 Provider 后，"只想触发更新、不读当前值"的组件消费 dispatch ctx，就不会随 state ctx 变化而重渲染（呼应 react-context 第四节、react-advanced-hooks）。
**来源**：react.dev — Managing state with a reducer + context 拆分实践

### 7. 为什么推荐把 useContext 包成 useXxx？
封装后：① 消费方 API 干净（`useTheme()` 而非记 context 对象）；② 内部判空 throw，缺 Provider 时报错清晰（fail-fast）；③ 便于以后替换实现。是社区通用模式（呼应 react-context 第六节、vue-provide-inject、react-custom-hooks）。
**来源**：react.dev — 自定义 Hook 封装 context、Context best practices

### 8. React 19 的 `use()` 读取 Context 有什么新能力？
`use(Ctx)` 可**条件地**读取 context（普通 useContext 不能放 if 里，因为它就是读 `.current`），也可读 Promise。让"根据参数决定是否读某 context"成为可能，但仍遵循 Hook 调用顺序基本规则精神（呼应 react-advanced-hooks、react-custom-hooks Rules of Hooks）。
**来源**：react.dev — use()、React 19 use API

## 四、边界与对照（D 类）

### 9. 什么时候该从 Context 升级到 Zustand/Redux？
当出现：高频更新触发大范围重渲染、需要**选择器做细粒度订阅**、需要中间件/时间旅行 devtools、跨很多不相关 feature 共享可变状态。Context 只解决"透传"，不解决"高效订阅"（呼应 react-context 第五节、react-state-mgmt）。
**来源**：Zustand 文档 — 为什么需要、Redux vs Context 讨论

### 10. Context 和 Vue 的 provide/inject 在性能模型上有何本质差异？
Vue 的 provide 传响应式源（ref/reactive），inject 到的组件只有真正用到的属性变了才更新（Proxy 依赖收集，细粒度）；React Context value 一变对全体消费者广播（粗粒度）。故 Vue 侧"传响应式对象"即可，React 侧要手动拆 context/稳定 value（呼应 react-context 第三节、vue-provide-inject）。
**来源**：Vue provide/inject 响应式 vs React Context 广播 对比

### 11. 用 Context 做多步表单/主题，你会怎么组织避免"一个巨型 Provider"？
按职责拆多个小 context（FormState/FormDispatch/Theme/User…），Provider 组合但不塞一个万能大对象；状态尽量放就近的容器组件、reducer 集中迁移；把消费下移到叶子。必要时局部用 store 而全局稳定项用 context（呼应 react-composition、react-state-mgmt）。
**来源**：react.dev — 组合多个 context、结构模式

### 12. Context 适合放函数（回调）吗？要注意什么？
适合放**稳定的**分发函数（dispatch、context 里 useMemo 包的 action）。若每次渲染新建函数当 value，会让消费者重渲染。把回调连同依赖一起 `useMemo`/直接暴露 `dispatch`，是常见做法（呼应 react-context 第四节、react-memo-hooks 第二节）。
**来源**：react.dev — Context 中放 action、useMemo 稳定回调

---

## 补充（新专题 13-15）

### 13.  从性能模型讲清 React Context 与 Vue provide/inject 的本质差异，为什么 React 侧要强调拆 Provider 粒度？

React Context：value 引用一变，所有 `useContext` 消费者重渲染，且不做字段级依赖追踪、React.memo 也穿不透——是「粗粒度广播」。Vue 的 provide/inject：默认传的值非响应式（就是个普通引用，注入方不会因为 provide 方重渲染就更新）；要响应需注入 ref/reactive，而一旦是 ref，消费者是「读了 .value 的 computed/render effect」按依赖精确重渲染，粒度天然是字段级。差异根源：Vue 有细粒度响应式依赖收集，React 靠「引用相等 + 广播」。所以在 React 里，把 state 与 dispatch/回调拆两个 Context、把高频值下沉到小 Provider、用 useMemo 稳 value，才成为必修课；而 Vue 里更多是「要不要给 ref」的问题。理解这条，能解释为何同一份「全局主题/用户」逻辑两框架优化重心不同。

**来源**：React Context 性能文档与 Vue provide/inject（ref 才能响应式）文档对照。

### 14.  React 19 的 `use()` 读取 Context（及 Promise）带来什么新能力与限制？

`use()` 是新的读取原语：`const value = use(SomeContext)` 等价 useContext，但关键增益是——`use()` 可以「条件调用」（不像 Hook 有严格顺序约束，它更像读取而非订阅 Hook），还能直接 `use(promise)`：若 Promise 未 resolve 会挂起最近的上层 Suspense、resolve 后返回其值，把「读 Context」与「读异步资源」统一。限制：读 Promise 需附近有 Suspense 边界兜 loading；`use()` 在并发语义下与 startTransition 配合、用于组件渲染期读取。它并不改变「Context 引用变化即广播」的性能模型——所以拆粒度、稳 value 的建议依旧成立，别把 use() 当成性能银弹。

**来源**：React 19 use() 文档（Context + Promise 读取、可条件调用）。

### 15.  Context + useReducer 这组合被称「轻量 Redux」，它的适用天花板在哪？何时必须转外部 store？

够用场景：中低频更新、消费面有限、不需要「字段级选择订阅」和中间件（持久化、日志、时间旅行、批处理）的全局状态，如主题、鉴权用户、多步表单向导、少量跨页共享配置。天花板出现在：① 消费者很多且各读不同切片——Context 广播导致「一处变、全体渲」，缺 selector 精细订阅；② 需要在组件外（事件、其它逻辑、路由守卫）读写同一状态；③ 高频更新（每帧）压垮 Provider 树；④ 需要持久化/撤销/DevTools 时间旅行。这些正是 Zustand（selector 订阅 + store 在 React 外）、Redux Toolkit（中间件+DevTools）的主场。判断线：先 Context+useReducer，出现「性能因广播失控」或「组件外要访问 store」即升级，别一上来就引入重库（对齐本包状态管理关的演进观）。

**来源**：React Context 与 useReducer 组合模式；「何时从 Context 升级到 Zustand/Redux」社区经验线。
