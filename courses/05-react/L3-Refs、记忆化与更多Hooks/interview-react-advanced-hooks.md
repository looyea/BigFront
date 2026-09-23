# react-advanced-hooks 面试题精选

> 共 15 题，覆盖 A useReducer / B useId 与 a11y / C 外部 store / D 并发类。

## 一、useReducer（A 类）

### 1. useReducer 和 useState 的关系与取舍？
useState 本质是 useReducer 的特例（默认 reducer 直接替换）。迁移逻辑简单用 useState；当一个 state 是对象、多字段联动、转换规则集中且想可测试时用 useReducer——把"怎么变"收进纯函数 reducer，dispatch"发生了什么"（action）（呼应 react-advanced-hooks 第一节）。
**来源**：react.dev — useReducer、Managing state with a reducer

### 2. 为什么说 reducer 让状态逻辑更好测、更可预测？
reducer 是纯函数 `(state, action) => newState`，不依赖组件、可脱离渲染单测（给定输入断言输出）；所有迁移集中一处，避免 set 散落各处导致的"多写入点"bug。这正是 Redux 的核心思想（呼应 react-state-mgmt、node-testing）。
**来源**：Redux 文档 — Reducers 是纯函数、可预测状态更新

### 3. dispatch 传给子组件为什么比传 setter 更适合配 React.memo？
`dispatch` 在组件生命周期内**引用恒定**，不像普通回调每次渲染新建，因此放进 memo 子组件的 props 浅比较不会因它变化而失效（呼应 react-memo-hooks 第二节、react-advanced-hooks 第一节）。
**来源**：react.dev — useReducer dispatch 稳定、优化重渲染

## 二、useId 与无障碍（B 类）

### 4. useId 生成的是什么？为什么不能自己用计数器/random 生成？
生成在整个组件树中唯一、且**服务端渲染与客户端水合一致**的稳定字符串（形如 `:r0:`）。random/外部计数器在 SSR 与 CSR 会算出不同值 → 水合 mismatch、且并发下不唯一（呼应 react-advanced-hooks 第二节、vue-ssr-nuxt 水合）。
**来源**：react.dev — useId、无障碍关联 label/aria

### 5. 哪些场景需要 useId？
给 `<input id>` + `<label htmlFor>`、`aria-describedby`/`aria-labelledby`、`role`、`<details name>`、向 DOM 注入唯一 CSS 类/属性等——凡是要"稳定唯一且两端一致"的标识符（呼应 react-advanced-hooks 第二节）。
**来源**：react.dev — useId 用例、MDN aria-*

## 三、外部 store（C 类）

### 6. useSyncExternalStore 的签名与三个参数分别是什么？
`useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot?)`。`subscribe(cb)` 注册变化回调、返回退订函数；`getSnapshot()` 返回当前值（须稳定，值没变返回同引用）；`getServerSnapshot()` 用于 SSR/水合的首屏快照（呼应 react-advanced-hooks 第三节）。
**来源**：react.dev — useSyncExternalStore API

### 7. 不它的话，用 useEffect 手动订阅外部 store 会有什么问题？
React 并发/渲染可重入，"渲染中读 store + effect 里订阅"可能在一次渲染里读到不同版本造成 **tearing（界面不一致）**。useSyncExternalStore 内建"读快照 + 订阅 + 变化触发一致重渲染"，消除撕裂。库绑定（Redux/Zustand）都基于它（呼应 react-advanced-hooks 第三节、react-state-mgmt）。
**来源**：react.dev — 从外部系统同步、tearing 问题

### 8. getSnapshot 为什么"值没变必须返回同一引用"？
React 用 `Object.is` 比较前后快照决定要不要重渲染；若每次返回新对象（即使内容相同）会误判为变化 → 无限重渲染。要缓存快照或在 store 层返回稳定值/用 selector 取原始值（呼应 react-memo-hooks 第四节、react-usestate 不可变）。
**来源**：react.dev — getSnapshot 必须返回缓存值

## 四、并发（D 类）

### 9. React 18 并发渲染给 useTransition/useDeferredValue 提供了什么基础？
render 阶段**可中断/恢复/丢弃**——一次昂贵渲染可让位于更高优先级更新（如用户输入）。startTransition 把 setState 标记为"非紧急过渡"，useDeferredValue 提供一个允许滞后的值，二者都靠"优先级 + 可中断"实现保持响应（呼应 react-advanced-hooks 第四节、react-render-model 第六节）。
**来源**：React Concurrent Features、useTransition 文档

### 10. useTransition 的 isPending 有什么用？和 loading 有何不同？
`const [isPending, startTransition] = useTransition()`，isPending 标记"有过渡正在进行"，用于给**过渡更新**区域显示"稍旧内容 + 半透明/加载"提示，而不是整页 loading。它与数据请求的 loading 语义不同（那是异步 I/O，这是渲染优先级）（呼应 react-advanced-hooks 第四节）。
**来源**：react.dev — isPending、非阻塞 UI 模式

### 11. 虚拟滚动 / 大列表卡顿，并发 Hook 能直接解决吗？该配合什么？
并发 Hook 只能"降低更新优先级、保住输入流畅"，不能减少 DOM 数量。真正的万级列表要 **虚拟滚动**（只渲染视口）+ 稳定 key + 必要 memo；再把触发大重渲染的 state 更新包进 transition。二者互补（呼应 react-performance、vue-performance 虚拟滚动）。
**来源**：react.dev — 列表与性能、虚拟滚动实践

### 12. useTransition 和 useDeferredValue 该怎么选？
你能控制更新源头 → `useTransition`（把 setState 包进 startTransition，常用于自己写的筛选）。值来自外部/props、你不直接控制其 setState → `useDeferredValue`（把该值滞后一份给昂贵子树）。isPending 用前者，输入即时回显 + 列表滞后渲染用后者（呼应 react-advanced-hooks 第四节）。
**来源**：react.dev — 在 transition 中使用 deferred value

---

## 补充（新专题 13-15）

### 13.  useReducer 相比一堆 useState 到底买到了什么？为什么说 reducer 让状态逻辑更可测、更易优化？

买到三点：① 集中转换规则——多字段、相互关联、跨处触发的状态更新收进一个纯 reducer，「怎么变」与「在哪触发」解耦，避免 setState 散落导致的遗漏/不一致；② 可测——reducer 是纯函数 `(state, action) => next`，无需渲染就能喂各种 state+action 断言输出，天然适合单测（对齐本包测试关）；③ 优化——`dispatch` 引用在整个生命周期内恒定（React 保证），把它传进 memo 子组件不会因函数变化击穿 memo，也可安全放进 effect 依赖。代价：样板多、异步/副作用不能写在 reducer（要保持纯），需配合 thunk 或在事件里编排。判据：「多个 state 联动、转换逻辑复杂、需要时间旅行或集中审计」才上，简单两三个独立值用 useState 更清爽。

**来源**：React useReducer 文档（dispatch 恒定、reducer 纯）；何时选 useReducer vs useState 的官方指引。

### 14.  React 19 的 useActionState / useOptimistic / useFormStatus 把手写表单状态机简化了什么？

过去写「提交中/成功/失败」三态 + 防重复提交 + 乐观更新，要在事件里手动 setPending、try/catch setError、成功后 setList。React 19 的 Actions 原语把这些内建：useActionState 让你传一个 async 函数作为表单 action，自动提供「当前 state、是否 pending、返回的新 state」，表单 submit 期间天然 pending、天然序列化错误；useFormStatus 让「提交按钮」在所属 form 的 action 运行期间读到 pending（无需层层透传）；useOptimistic 提供「先行乐观值 + action 失败自动回滚到真值」。本质是把「异步状态转换」这一最易写错的部分收进框架，配合 startTransition 让提交可打断不卡输入。迁移时理解这套，就理解了 React 想让你少写 effect/手动 pending。

**来源**：React 19 useActionState/useFormStatus/useOptimistic 文档与 Actions 动机。

### 15.  什么是并发渲染下的「tearing」？useSyncExternalStore 靠什么机制消除它？

tearing = 同一次渲染过程中，因读到外部可变 store 在并发被打断/重渲染之间发生了改变，导致一棵树里不同组件「基于不同版本的外部状态」渲染，出现撕裂画面（如 A 组件读到旧值、B 读到新值）。在引入可中断 render 前不成问题（一次渲染原子跑完），并发特性把它暴露。useSyncExternalStore 的解法：订阅 store 变化 + 提供 getSnapshot；React 在 render 里「读一次快照值」并在校验阶段比对——若 render 期间外部值变了，它会强制重新渲染并确保整棵树用同一个快照提交，从而消除撕裂。这要求 getSnapshot 在值没变时返回同一引用（否则误判为一直变化→死循环）。这是把「外部可变源」安全接入并发 React 的唯一正解，替代手写 useEffect+forceUpdate。

**来源**：React「useSyncExternalStore」文档关于 tearing/concurrent reading；社区对外部状态源并发安全的技术剖析。
