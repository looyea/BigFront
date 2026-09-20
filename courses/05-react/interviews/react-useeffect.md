# react-useeffect 面试题精选

> 共 12 题，覆盖 A 语义与时机 / B 依赖与清理 / C 闭包与严格模式 / D 反模式与对照类。

## 一、语义与时机（A 类）

### 1. useEffect 的定位是什么？它和"值变化回调"有何不同？
useEffect 表达"**本次渲染后，把组件和外部系统同步**"。它每次相关依赖变化都会重跑整段（先清理再执行），而不是像 watch 只在你指定的回调里拿 (新值,旧值)。心智是"同步(synchronization)"而非"响应事件"（呼应 react-useeffect 第一节）。
**来源**：react.dev — useEffect 描述同步、Synchronizing with Effects

### 2. useEffect 和 useLayoutEffect 区别？什么时候用后者？
`useLayoutEffect` 在 DOM 变更后、浏览器**绘制前同步**执行（会阻塞绘制）；`useEffect` 在绘制后异步跑。需要"读布局并同步改 DOM 以避免闪烁"（测量元素、滚动位置恢复）才用 useLayoutEffect，日常副作用一律 useEffect；SSR 下 useLayoutEffect 会告警（呼应 react-useeffect 第四节、react-effect-patterns）。
**来源**：react.dev — useLayoutEffect、When to useLayoutEffect

### 3. 为什么 effect 设计成"渲染之后"跑而不是渲染之中？
渲染必须保持纯函数（可被 React 中断/重跑，尤其并发下），若在 render 里做订阅/改 DOM/请求，重复执行会造成重复副作用与竞态。放"提交后"保证真实 DOM 已就绪、且只在确定要展示时同步一次（呼应 react-component 第五节、react-render-model）。
**来源**：react.dev — 渲染应纯、Effects run after commit

## 二、依赖与清理（B 类）

### 4. 依赖数组是怎么被比较的？为什么传对象/内联函数常导致 effect 狂跑？
React 每轮用 `Object.is` 逐项比较依赖。对象/数组/箭头函数每次渲染都是**新引用** → 永远"变了" → effect 每轮重跑。解法：把用到的原始值列进依赖，或用 `useMemo`/`useCallback` 稳定引用（呼应 react-useeffect 第二节、react-memo-hooks）。
**来源**：react.dev — 依赖数组、You Might Not Need an Effect

### 5. 清理函数解决什么问题？漏写会怎样？
用于撤销上一次 effect 建立的"外部连接"：取消订阅、清定时器、`AbortController.abort()`、断开 WS。漏写在依赖变化/卸载时旧连接仍在 → 内存泄漏、重复触发、对已卸载组件 setState 警告（呼应 react-useeffect 第三节、node-events off、vue-events）。
**来源**：react.dev — Cleaning up an effect、泄漏案例

### 6. 空依赖 `[]` 一定"只跑一次"吗？有什么陷阱？
语义上"挂载后一次、卸载时清理"。陷阱：① 闭包里用到的 props/state 会**永远是初始快照**（stale closure），后续变化不感知；② 严格模式开发下 setup→cleanup→setup 会跑两遍。别用 `[]` 逃避依赖，缺啥补啥或用函数式更新（呼应 react-useeffect 第五、六节）。
**来源**：react.dev — Effect with empty dependencies、stale closure

## 三、闭包与严格模式（C 类）

### 7. 什么是 stale closure？给出最小复现与修法。
effect/handler 闭包捕获了"某一次渲染"的变量快照，之后 state 变了它仍读旧值。复现：`useEffect(()=>{const t=setInterval(()=>setN(n+1),1000);return()=>clearInterval(t)},[])` → n 恒为 1。修法：函数式 `setN(x=>x+1)`，或把 `n` 列入依赖并正确清理（呼应 react-useeffect 第五节）。
**来源**：react.dev — How to read latest state in interval、A Complete Guide to useEffect

### 8. "A Complete Guide to useEffect" 里说 effect 像快照，怎么理解？
每一轮渲染都有"属于自己的" effect 和 cleanup，它们闭包捕获该轮的值。依赖变了 → 上一轮的 cleanup 先跑、这一轮 effect 用这一轮的值跑。所以 effect 不是"一个长期存在的回调"，而是"每轮渲染与外部世界的一次同步记录"（呼应 react-render-model 每次重跑）。
**来源**：Overreacted — A Complete Guide to useEffect（Dan Abramov）

### 9. 如何拿到"最新的 state/props"而不用把它塞进依赖？
用 `useRef` 存最新值（在渲染或 effect 里 `ref.current = value`），effect 里读 `ref.current`（改 ref 不触发渲染）。适合"事件式读取最新值但不想让 effect 因它重跑"的场景（呼应 react-refs）。
**来源**：react.dev — useRef、读写最新 state 模式

## 四、反模式与对照（D 类）

### 10. "props 变化时用 effect setState 重置内部 state" 为什么是坏味道？怎么办？
会多一次渲染、且难维护。首选**派生直接在 render 算**；若确要"换了对象就整体重置"，用变化的 `key` 强制重挂载子树，让 React 帮你重置 state，而不是 effect 里 set（呼应 react-useeffect 第七节、react-render-model key 重置）。
**来源**：react.dev — Resetting state with a key、You Might Not Need an Effect

### 11. 数据获取写在 useEffect 里要注意什么？（引到下一课）
要处理：加载/错误态、组件卸载后不再 setState、**竞态**（慢请求覆盖快请求）——用 `AbortController` 或 `ignore` 标志丢弃过期结果；重复逻辑宜抽成数据层。这正是 TanStack Query 替你解决的（呼应 react-effect-patterns、react-data-fetching、vue-async-suspense）。
**来源**：react.dev — You Might Not Need an Effect(数据获取)、Synchronizing with Effects

### 12. 对比 Vue 的 watch/watchEffect，React useEffect 的心智差异？
Vue `watch` 天生是"值变回调"、能拿 (new,old)、可配 flush/deep/immediate，且由响应式系统自动追踪依赖；React effect 是"每轮渲染后按依赖数组同步"、要手写全依赖、靠重跑+cleanup 建模、无自动追踪。Vue 更声明自动化，React 更手动/显式（呼应 react-useeffect 第一、二节、vue-watch）。
**来源**：Vue watch API vs React useEffect 设计对比
