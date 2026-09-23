# react-render-model 面试题精选

> 共 15 题，覆盖 A 更新流程 / B diff 算法 / C 重渲染控制 / D 批处理与对照类。

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

---

## 补充（新专题 13-15）

### 13. React 的列表 diff 为什么能退化成 O(n) 单趟？它靠哪些假设、又用什么手段补回被牺牲的准确性？

经典 tree diff 是 O(n^3)。React 用三条启发式降到 O(n)：① 不同类型元素=不同树，直接重建，不跨类型比；② 通过 key 让「同一元素在列表中挪了位置」仍能被识别为可复用；③ 只做同层比较、不做跨层移动（换父即重建）。牺牲的准确性靠 key 补回：单趟同层遍历里，React 用一个 Map 记录旧 key→节点，遇到新节点查表复用，并把「最小移动」问题近似为「遇到更靠后的旧索引就更新 lastIndex，否则记为需要移动」，最后按最长递增子序列(LIS)思路减少实际 DOM 搬移。这解释了为什么 key 用 index 在增删/重排时会误导复用、以及为什么 key 只需同层兄弟间唯一而非全局唯一。

**来源**：React「Reconciliation」文档（三条策略）；源码 beginWork/beginChildFibers 与 placeChild 的 lastIndex/移动标记逻辑。

### 14. Fiber 架构用哪些数据结构支撑可中断渲染？current、workInProgress、alternate 是什么关系？

一次协调同时存在两棵 Fiber 树：current（屏幕上已渲染的）与 workInProgress（内存里正在构建的），二者通过 `alternate` 指针互为镜像、反复交替复用（双缓冲，避免每次更新重新分配 Fiber 节点）。每个 Fiber 记录 type/key/stateNode/props、child/sibling/return（用「链表式」child-sibling-return 代替递归栈，使遍历可暂停可恢复）、以及 effects 侧链（effectList 只收集需 commit 的变更节点）。调度层用 Lane 模型表示优先级，把 render 切成时间片，高优更新可打断低优的 WIP 并丢弃重算。commit 时顺着 effectList 同步打 DOM、跑布局/被动 effect。讲清 current/WIP/alternate，就讲清了「为什么 render 必须纯且可重放」。

**来源**：The Road to React（MaxDM）与源码 react-reconciler 的 Fiber/alternate/effectList；React Fiber 架构解析博客。

### 15. 并发渲染的优先级（Lane 模型）大致怎么工作？为什么 commit 一定要同步、不能也做成可中断？

每个更新被分配一个 Lane（位掩码，越多越细的优先级通道，取代旧的 expirationTime）。调度器比较 sync / input / default / transition / idle 等 Lane，渲染时用时间片跑最高优先级那批，期间若来了更高优（如用户输入、setState sync）可中断当前 WIP、把过期工作丢弃、优先渲染新的——这就是 useTransition 把更新标为「可打断的 transition Lane」、让输入不卡的基础。commit 必须同步的理由：它是「对用户可见」的原子切换，若中断在应用了一半 DOM 的窗口里，用户会读到撕裂的界面、layout effect/第三方 DOM 操作会基于半成品状态工作、measure/写回会错乱。所以 React 把「昂贵但可投机重算」的部分（render/diff）做成可中断，把「必须原子」的部分（commit）保留同步——这是并发设计的关键取舍。

**来源**：React Concurrent Features / Lanes 设计文档与源码 react-reconciler/ReactFiberLane；useTransition 优先级语义。
