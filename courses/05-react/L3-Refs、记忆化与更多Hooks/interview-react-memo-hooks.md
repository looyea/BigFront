# react-memo-hooks 面试题精选

> 共 12 题，覆盖 A 概念 / B 引用与 memo / C 取舍与反模式 / D 编译器与对照类。

## 一、概念（A 类）

### 1. useMemo 和 useCallback 分别解决什么问题？关系是？
`useMemo(() => v, deps)` 缓存**计算结果**，deps 不变复用上次值，避免昂贵重复计算；`useCallback(fn, deps)` 缓存**函数引用**。`useCallback(f, d)` 等价 `useMemo(() => f, d)`。两者都是"按引用记忆"，本质是同一件事的不同糖（呼应 react-memo-hooks 第一节）。
**来源**：react.dev — useMemo、useCallback

### 2. 为什么 React 需要 useMemo，而 Vue 的 computed 不需要你手写？
React 每次渲染重跑函数、不做依赖追踪，简单派生值每帧重算；贵重要缓存就得手动 useMemo。Vue 的 computed 基于 Proxy 依赖收集，自动追踪依赖 + 惰性缓存，天然就是"自动的 useMemo"。二者哲学：框架代劳 vs 开发者显式（呼应 react-render-model 第三节、vue-reactivity-theory）。
**来源**：Vue computed 缓存原理 vs React useMemo 对照

## 二、引用与 memo（B 类）

### 3. React.memo 靠什么决定跳不跳过子组件渲染？为什么它常"不生效"？
`React.memo` 对 props 做**浅比较**，全等则跳过。失效主因：父每帧传**新的对象/数组/内联函数**引用（`style={{}}`、`onClick={()=>}`），浅比较永远不等。修法：useMemo/useCallback 稳定引用，或让被比较的是原始值（呼应 react-memo-hooks 第二节、react-render-model 第四节）。
**来源**：react.dev — React.memo、优化重渲染

### 4. useCallback 单独用有意义吗？什么情况下它才真正有用？
只有在①该函数作为依赖被 useMemo/useEffect/useCallback 使用，或②传给用 `React.memo` 包裹的子组件、需保持其引用稳定时才有意义。若只是普通事件处理器且不参与任何比较，用与不用无差别（甚至多余）（呼应 react-memo-hooks 第三、四节）。
**来源**：react.dev — 何时该用 useCallback

### 5. useMemo 依赖了一个每帧都变的对象，会怎样？怎么处理？
等于没缓存——deps 每帧不等就每帧重算。处理：把依赖**下钻到真正用到的原始值**（`[obj.id]` 而非 `[obj]`），或用 `useSyncExternalStore`/selector 从 store 里取原始值，或稳定住那个对象本身（呼应 react-memo-hooks 第四节、react-state-mgmt）。
**来源**：react.dev — deps 稳定性、Reselect/selector 思想

## 三、取舍与反模式（C 类）

### 6. "先 memo 再优化"对吗？正确顺序是什么？
不对。正确顺序：**先测量**（React DevTools Profiler 找真实瓶颈）→ 判断是"重渲染/重计算/DOM 多"哪一类 → 再对症下药（虚拟化、拆 state、memo、分包）。盲目 memo 增加复杂度和自身开销，是过早优化（呼应 react-memo-hooks 第三节、react-performance）。
**来源**：React 性能优化 — 先 profiling 再优化、Measuring React performance

### 7. useMemo 里做副作用为什么是错的？
useMemo 只为"算一个值并缓存"，其函数可能被 React 丢弃/重算（尤其并发），不保证只跑固定次数。把订阅/请求/setState 塞进 useMemo 会导致不确定次数执行。副作用归 useEffect，计算归 useMemo（呼应 react-effect-patterns、react-useeffect）。
**来源**：react.dev — useMemo 只用于计算、纯函数约定

### 8. memo 能"深层比较"吗？自定义比较怎么做、要注意什么？
默认浅比较。`React.memo(Comp, (prev,next)=>布尔)` 可给自定义比较器返回 true 表示跳过。但手写深比较易错、有成本、且可能让 memo 语义变得不可预测，优先用"稳定引用 + selector"而非自定义比较（呼应 react-memo-hooks 第四节）。
**来源**：react.dev — React.memo 自定义比较函数

## 四、编译器与对照（D 类）

### 9. React Compiler 会如何改变 useMemo/useCallback 的使用方式？
它在构建期自动做依赖推断与记忆化，等价于帮你到处插 useMemo/useCallback，无需手写、也不会漏依赖。开发者写纯组件即可，手动 memo 大幅减少；但理解原理仍用于读旧代码、排查、理解引用相等（呼应 react-memo-hooks 第五节）。
**来源**：React Compiler / React Forget 概览与 FAQ

### 10. React Compiler 为什么要求组件"纯"？不纯会怎样？
编译器会安全地**跳过、延后、重复调用**渲染，并对表达式做记忆化。若组件在 render 里读写外部可变状态或做副作用，这些假设崩塌 → 缓存结果错误或行为不一致。所以"渲染必须是纯函数"是编译优化的地基（呼应 react-component 面试题第10题）。
**来源**：React Compiler — 纯函数要求、Rules of React（eslint-plugin-react-hooks）

### 11. useDeferredValue 和 useMemo 是一类"优化"吗？区别？
不是一类。`useMemo` 优化的是**计算**（缓存值）。`useDeferredValue` 是**并发**能力：把某个值标记为"可以让 UI 用旧值先行渲染、新值稍后跟上"，用于把昂贵渲染降级为可打断的低优先级更新（`startTransition` 家族）（呼应 react-advanced-hooks、react-performance）。
**来源**：react.dev — useDeferredValue、useTransition

### 12. 项目里该不该全面上 React.memo？给出你的取舍建议。
不默认全面上。策略：① 组件小而纯、渲染便宜 → 不必 memo；② 大列表项、被频繁父更新波及的子树、传入引用型 props 的 → 配 memo + 稳定引用；③ 用 Profiler 定位后再加，避免到处 memo 带来的内存与比较成本。React Compiler 普及后更多交给编译器（呼应 react-memo-hooks 第三、五节、react-performance）。
**来源**：React — 何时使用 React.memo、性能最佳实践
