# react-render-model 面试题精选

> 共 12 题，覆盖 A 更新流程 / B diff 算法 / C 重渲染控制 / D 批处理与对照类。

## 一、更新流程（A 类）

### 1. React 渲染的 render 阶段和 commit 阶段分别做什么？
Render 阶段：从触发更新的组件起重新执行函数、生成新 Element 树并与旧树 diff，得出"变更清单"，纯计算、可被中断/延后（并发）。Commit 阶段：把变更同步应用到真实 DOM、更新 refs，随后触发 effect。`useLayoutEffect` 在 commit DOM 变更后、绘制前同步跑，`useEffect` 在绘制后异步跑（呼应 react-render-model 第一节、react-useeffect）。
**来源**：React — Rendering Life Phases、react.dev 渲染与提交

### 2. 虚拟 DOM 一定比直接操作 DOM 快吗？它的真正价值是什么？
不一定——纯快慢上直接操作局部 DOM 可能更快。虚拟 DOM 的价值是**声明式 + 可预测 + 跨平台**：你只管描述 UI=f(state)，diff 保证最少 DOM 触碰、避免手写命令式更新的 bug，同一套协调算法还能跑在 DOM 之外（React Native/SSR）。代价是重跑 render 函数的开销（可用 memo 缓解）（呼应 react-performance）。
**来源**：React — Virtual DOM and Reconciliation、"Real DOM vs Virtual DOM" 讨论

## 二、diff 算法（B 类）

### 3. React 协调算法的两条核心策略是什么？
① 不同类型元素产生不同树 → 直接销毁旧子树、重建（state 丢失）；② 同类型 DOM 元素 → 只 diff 变化的属性、复用节点；列表则用 key 匹配子节点。二者配合"只同层比较"把复杂度降到 O(n)（呼应 react-render-model 第三节）。
**来源**：React — Diffing Algorithm、Lists and Keys

### 4. 为什么 React 不做跨层移动节点，而选择"换父即重建"？
通用树最小编辑是 O(n³)，实时渲染不可接受。React 观察到跨层移动极少，故只同层比较——移动 = 卸载 + 挂载。要保留状态就别换父，或用稳定 key 在同层 reorder（呼应 react-render-model 第三节、react-lists-keys）。
**来源**：React — Forces Re-rendering / 同层 diff 假设

### 5. 改变组件的 key 会发生什么？这是"重置组件"的正确姿势吗？
是的。key 变化时 React 视其为不同元素，卸载旧子树、以全新 state 挂载新子树。刻意用 `key={id}` 强制"切换对象时重置内部状态"是官方推荐的正当技巧（表单换用户重置等）（呼应 react-render-model 第五节）。
**来源**：React — Using key to reset state、Essentially Different Elements

## 三、重渲染控制（C 类）

### 6. 哪些情况会导致一个组件重新渲染？
自身 state 变、props 变（父传新值）、父组件重渲染（默认向下传导）、所消费的 Context 值变、强制更新。注意：重渲染只是重跑函数，不一定改 DOM（diff 后相同就跳过 commit）（呼应 react-render-model 第四节）。
**来源**：React — Why is my component re-rendering、Reconciliation

### 7. 如何避免子组件无谓重渲染？memo 的坑是什么？
用 `React.memo(Comp)` 对 props 做浅比较，props 引用不变就跳过。坑：传入对象/数组/内联函数每次是新引用 → memo 失效，需配合 `useMemo`/`useCallback` 稳定引用；浅比较也不检测深层变化。先 Profiler 定位再优化，别到处 memo（呼应 react-memo-hooks、react-performance）。
**来源**：React — React.memo、优化渲染 use-memo/use-callback

### 8. `key` 用 index 在什么操作下会出问题？为什么？
在**插入/删除/重排**列表时，index 与数据不再对应，React 按位置比对会错误复用/更新错节点，导致非受控输入串值、动画错乱、多余重渲染。用稳定唯一 id 才安全（呼应 react-render-model 第五节、react-lists-keys、vue-conditional-list）。
**来源**：React — Index as a key is an anti-pattern

## 四、批处理与对照（D 类）

### 9. React 18 的自动批处理和 17 有何不同？
17 只在同步事件处理器里批处理，`setTimeout`/Promise/原生监听里的多次 setState 会分别渲染。18 起在**任何上下文**都自动批处理（一次微任务合并为一次渲染），得到一致性能。需读"渲染后"值用函数式 `setState(prev=>...)`（呼应 react-render-model 第六节、react-usestate）。
**来源**：React 18 升级指南 — Automatic Batching

### 10. `setState` 之后马上 `console.log(state)` 为什么是旧值？怎么拿新值？
state 更新是异步的、当前渲染周期内变量仍是本次渲染快照，改的是"下一次渲染"的值。要基于旧值算用函数式更新；要在更新后做事用 `useEffect`（依赖该 state）而非紧跟其后（呼应 react-usestate、react-useeffect 闭包陈旧值）。
**来源**：react.dev — State is asynchronous、Queuing state updates

### 11. 对比 Vue 的响应式更新，React 的"手动"体现在哪？
Vue 靠 Proxy 依赖收集 + 编译期 patchFlag，自动精确更新、组件级也会跳过；React 靠"你告诉我何时重跑/复用"——默认父渲染带动子、需要 key/memo/useMemo 主动提示。两种心智：Vue 更自动、React 更显式（呼应 vue-reactivity-theory、vue-performance）。
**来源**：Vue 响应式原理 vs React reconciliation 对比

### 12. 并发渲染(concurrent)给 render 阶段带来了什么能力？
可**中断/恢复/丢弃**正在进行的一次渲染，让高优先级更新（用户输入）插队，低优先级（大列表）延后，配合 `useTransition`/`useDeferredValue`/Suspense 保持响应（呼应 react-advanced-hooks、Suspense）。commit 仍不可中断。
**来源**：React 18 Concurrent Features、useTransition/useDeferredValue
