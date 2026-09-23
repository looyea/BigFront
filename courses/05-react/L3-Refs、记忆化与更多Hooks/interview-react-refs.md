# react-refs 面试题精选

> 共 15 题，覆盖 A ref 本质 / B 时机与 DOM / C 子组件与句柄 / D state vs ref 与对照类。

## 一、ref 本质（A 类）

### 1. useRef 返回什么？为什么说它是"逃生舱"？
返回一个跨渲染保持的同一对象 `{ current }`。它是 React 声明式模型的"逃生舱"，让你需要时命令式抓住 DOM 或存一个不参与渲染的可变值。正因为绕过了"数据驱动视图"，要克制使用（呼应 react-refs 第一、二节）。
**来源**：react.dev — useRef、Manipulating the DOM with ref

### 2. 修改 ref.current 为什么不触发重渲染？这是优点还是风险？
ref 只是一个普通可变对象，React 不追踪其变化，所以改了不重渲染。既是优点（存高频/无需渲染的值避免浪费渲染），也是风险（误以为改了 UI 会更新）。要驱动 UI 一律用 state（呼应 react-refs 第二节）。
**来源**：react.dev — refs are mutable、State vs refs

## 二、时机与 DOM（B 类）

### 3. `ref.current` 什么时候才有值？在渲染里能读吗？
DOM 挂载后（首次 effect 运行时已就绪）才有节点；首帧渲染期间是 `null`。渲染阶段不要读写它——React 要求渲染为纯函数，严格模式/并发会重跑渲染，读 ref 会得到不一致结果（呼应 react-refs 第五节、react-render-model）。
**来源**：react.dev — 只在组件渲染完成后才访问 ref.current

### 4. 对象 ref 和回调 ref 有何区别？回调 ref 何时被调用？
对象 ref 是 `useRef` 得到的 `{current}`，React 帮你填。回调 ref 是传给 `ref={fn}` 的函数，挂载时用节点调用 `fn(node)`、卸载时用 `null` 调用。适合"节点出现/消失时做点事"（观察、存进 Map）；React 19 回调可返回清理函数（呼应 react-refs 第四节）。
**来源**：react.dev — Refs with callback functions、React 19 ref cleanup

### 5. 如何在 React 里测量一个元素尺寸？
用 ref 拿到节点，在 `useEffect`/`useLayoutEffect`（或 ResizeObserver）里读 `offsetWidth`/`getBoundingClientRect()`。绘制前避免闪烁用 layout effect；持续监听尺寸变化用 `ResizeObserver` 并在 cleanup 断开（呼应 react-effect-patterns 第四节、vue-onMounted）。
**来源**：MDN getBoundingClientRect、ResizeObserver API

## 三、子组件与句柄（C 类）

### 6. 什么是 forwardRef？React 19 之后还需要吗？
≤18 中函数组件默认收不到 `ref` prop，需 `forwardRef((props, ref)=>...)` 把 ref 转发给内部 DOM/子组件。React 19 起 `ref` 成为普通 prop，函数组件可直接 `({ ref })` 接收，`forwardRef` 大多可去掉（仅少数高阶场景保留）（呼应 react-refs 第三节）。
**来源**：React 19 — ref as a prop、remove forwardRef codemod

### 7. 直接暴露整条 ref 到 DOM 有什么问题？useImperativeHandle 怎么改善？
把内部 DOM 节点整个交出去，父可任意命令式操作，破坏封装、易产生副作用。用 `useImperativeHandle(ref, ()=>({ focus, reset }))` 只暴露受控方法，形成"公共 API"，等价于 Vue `defineExpose` 白名单（呼应 react-refs 第三节、vue-refs-expose）。
**来源**：react.dev — useImperativeHandle、控制暴露的句柄

### 8. ref 能被"透传"多层吗？组合组件里怎么处理？
可层层转发（父的 ref → 中间组件 props.ref → 底层 DOM）。React 19 支持在 Fragment 上用 ref、合并多 ref。写通用组件应记得把 `ref` 继续传给真正需要的节点，否则会"断链"（呼应 react-composition）。
**来源**：React 19 — Passing ref through Fragment、ref forwarding

## 四、state vs ref 与对照（D 类）

### 9. 一个值到底该放 state 还是 ref？给决策依据。
会**渲染到界面上**、变了要更新视图 → state；只在**事件/effect 里读写的临时可变值**（定时器 id、上次值、库实例、是否首挂载标志）→ ref。二义时问："这个变了，画面该跟着变吗？"该→state（呼应 react-refs 第二节）。
**来源**：react.dev — ref vs state、When to use a ref

### 10. 为什么不能用 ref 替代 state 来"躲开重渲染"？
若 UI 依赖该值，ref 不触发渲染 → 界面停留在旧值，出现"数据对、视图错"。正确做法是缩小 state 作用域、拆分组件、必要时 memo，把重渲染控制在最小范围，而非用 ref 隐藏状态（呼应 react-performance、react-memo-hooks）。
**来源**：react.dev — You probably don't need a ref、Optimizing re-render 范围

### 11. 对比 Vue 的模板 ref 与 defineExpose，React 的 ref 体系差异在哪？
Vue 3.5 `useTemplateRef`/`ref` 属性绑定、`<script setup>` 默认封闭要 `defineExpose`；React 用 `useRef` + `ref` prop、≤18 要 `forwardRef`、19 起直接传。Vue 有 `expose` 默认白名单，React 默认暴露 DOM，需 `useImperativeHandle` 收敛。理念相通（命令式逃生 + 控制暴露）（呼应 vue-refs-expose）。
**来源**：Vue — 模板 refs / defineExpose、React refs 对照

### 12. 高频场景里 ref 能帮你省掉哪些渲染？举两例。
① 记录鼠标/滚动坐标做节流计算，只存 ref 不 setState，需要时再同步到 state；② 集成 Canvas/ECharts，实例与句柄存 ref，靠命令式 `chart.setOption` 更新而非 React 重渲染整树（呼应 react-effect-patterns、react-performance）。
**来源**：web.dev — 节流、ECharts + React 集成实践、React 性能模式

---

## 补充（新专题 13-15）

### 13. 对象 ref、回调 ref、以及「在 effect 里读 ref」三者时机差异是什么？测一个元素尺寸该选哪种？

对象 ref（useRef）：commit 时被赋值，之后任意时刻（事件/effect）可读，但 render 里读到的是上帧值。回调 ref：在 DOM attach 的瞬间被调用，比被动 effect 更早，适合「拿到节点立即做件事」（如自动聚焦、初次测量）。在 effect 里读 ref：DOM 已就位，被动 effect 在 paint 后、layout effect 在 paint 前。测量尺寸若关系到「绘制前就要据其定位、不能闪」→ useLayoutEffect + ref；若只是异步统计（如上报元素尺寸、懒加载可见性）→ 被动 effect 或直接上 ResizeObserver（放进 effect 订阅、cleanup 里 disconnect）。选型关键：读 DOM 的时机是否影响「用户看到的第一帧」。

**来源**：React refs / callback ref 文档；ResizeObserver API 与「测量后同步改 DOM 用 layout effect」指引。

### 14. 用 ref 命令式改 DOM（手动加 class、改 style、插入节点）为什么会和 React 打架？怎么安全地做？

React 的协调基于「虚拟 DOM 与它自己认为的真实 DOM」做 diff，它不知道你手改了什么。你若绕过它改同一节点的受控属性（className、style、children），下次该组件 render 时 React 可能按 props 把你的改动覆盖、或在 diff 时做出错误最小化决策，导致闪烁/丢状态/难以复现的 bug。安全边界：① 只操作 React 不管的「外部注入」子树（如挂载一个第三方库的容器 div，React 对该 div 内部用 suppressHydrationWarning 或空 children 保持不碰）；② 改的属性不是任何 prop 驱动的（如给 canvas 画东西）；③ 需要 React 感知的结果就 setState 让它重渲染，而非手改。原则：ref 是逃生舱，用来「出 React 的世界」，不是「在 React 的世界里手动干 React 的活」。

**来源**：React refs 文档与 DOM 不可变性约定；社区「手动操作 DOM 与 reconciliation 冲突」案例。

### 15. 把「组件方法」暴露给父组件调用，除了 ref + useImperativeHandle 还有更 React 化的替代吗？

useImperativeHandle（配 ref）能定义对外暴露的最小命令式接口（如 `focus()`、`reset()`），但它是「命令式」范式。更 React 的路子是「把控制权交回数据」：受控化——父用 state 驱动，子只渲染（如 `<Modal open={open}/>` 而非 `modalRef.current.open()`）；或用「回调 + 事件」把子内部状态提升；或用声明式 props 表达意图（`<Video playing/>`）。命令式 ref 保留给「无法/不该被状态化」的浏览器原生能力：focus、scrollIntoView、播放/暂停媒体、测量。取舍判据：能表达成「一个值」就别用 ref 方法，只有「瞬时动作」才走 imperative handle。这与本包组合关「props 传节点优于配置对象」是同一种「让数据流表达意图」的哲学。

**来源**：React refs 与「Imperative Functions」文档；受控组件设计优先于命令式 ref 的社区共识。
