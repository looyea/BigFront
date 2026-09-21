# svelte-reactive-runes 面试题精选

> 共 12 题，覆盖 A 状态 / B 派生 / C 副作用 / D 依赖与调试。

## 一、`$state`（A 类）

### 1. `$state` 和 `$state.raw` 有什么区别？分别何时用？
`$state` 对对象/数组做**深度响应式代理**，可直接改内部属性、push 数组即触发；`$state.raw` 只做**浅响应**，内部元素不被追踪，只有整体替换引用才触发。要改对象内部用 `$state`；存不可变数据/大对象/不需要深层追踪时用 `$state.raw` 省开销（呼应 svelte-reactive-runes 第一节）。
**来源**：Svelte 官方文档 — $state、raw

### 2. `$state` 能用在 `const` 上吗？能在 class、模块里用吗？
不能用于 `const`（要 `let`/`var`，因为要重新赋值）。可以在 class 字段用（`#x = $state(...)` / `x = $state(...)`），也可以在 `.svelte.js/.svelte.ts` 模块顶层用——这正是做"状态服务/全局 store"的基础（呼应 svelte-reactive-runes 第一节、L4）。
**来源**：Svelte 官方文档 — Where you can use runes

### 3. 和 React 的 `useState` 相比，`$state` 在更新对象上有什么不同？
React 要求**不可变整体替换**（`setUser({...user, name})`），否则同引用不重渲染；Svelte `$state` 因深代理可 `user.name = x` 直接改并触发。心智上更接近 Vue `reactive`（呼应 react-usestate、vue-reactivity-theory）。
**来源**：Svelte vs React 响应式对照（社区/官方）

## 二、`$derived`（B 类）

### 4. `$derived` 的"惰性求值 + 缓存"是什么意思？
`$derived` 只有在其值**被读取**时才计算，并缓存结果，依赖不变则不重算；没被任何地方读到的派生根本不跑。这和 Vue `computed` 一致，不同于 React `useMemo`（后者每次渲染都会评估依赖数组、仅用于跳过重算）。好处是无须手动依赖、天然按需（呼应 svelte-reactive-runes 第二节）。
**来源**：Svelte 官方文档 — $derived

### 5. `$derived(x)` 和 `$derived.by(() => {...})` 何时用哪个？
纯表达式用 `$derived(expr)`；需要多条语句、局部变量、显式调用函数拿返回值时用 `$derived.by(() => { ...; return v })`。两者都是"只读派生、不能有副作用"（呼应 svelte-reactive-runes 第二节）。
**来源**：Svelte 官方文档 — $derived.by

### 6. 能在 `$derived` 里发请求或改 `$state` 吗？为什么？
不应该。派生必须是纯计算；在里面写 `$state` 会造成"读依赖同时写依赖"的循环/不一致，发请求属于副作用应放 `$effect` 或事件处理里。Svelte 会对这种非法写入告警（呼应 svelte-reactive-runes 第二、三节）。
**来源**：Svelte 官方文档 — 派生只读约定

## 三、`$effect`（C 类）

### 7. `$effect` 什么时候运行？初始化会跑吗？和 DOM 更新的关系？
`$effect` 在组件挂载后、以及其依赖变化后运行；**初始也会跑一次**（用于建立依赖）。它在一批状态变更引起的 DOM 更新**之后**（flush 后）执行，读到的已是最新 DOM。区别于只在"值变化"时跑的旧版 `$:` 部分语义（呼应 svelte-reactive-runes 第三节、react-useeffect）。
**来源**：Svelte 官方文档 — $effect、lifecycle

### 8. `$effect` 里的清理函数是怎么工作的？
`$effect(() => { ...; return () => { /*cleanup*/ }; })` 返回的函数会在**下一次该 effect 重跑之前**、以及**组件销毁时**执行，用来清定时器/取消订阅/移除监听——等价 React `useEffect` 的 return、Vue `onCleanup`（呼应 svelte-reactive-runes 第三节）。
**来源**：Svelte 官方文档 — Effects cleanup

### 9. 为什么说 `$effect` 是"逃生舱"而不是默认选项？
多数"随状态变化派生 UI"的需求该用 `$derived` 或模板表达；把逻辑塞进 `$effect` 往往是命令式思维回潮，易引入循环、多余渲染。只有当你需要和**外部系统**（第三方库、localStorage、DOM 焦点、订阅）同步时才用 `$effect`（呼应 react-effect-patterns、svelte-reactive-runes 第三节）。
**来源**：Svelte 官方文档 — When to avoid effects

## 四、依赖与调试（D 类）

### 10. `untrack` 解决什么问题？举个例子。
当你想在 effect/派生里**读某个信号但不建立依赖**（不想它变化时重跑本 effect），用 `untrack(() => value)` 把这段读取"去响应化"。典型：effect 里读一个只用于日志、不该触发重跑的 prop（呼应 svelte-reactive-runes 第三节）。
**来源**：Svelte 官方 API — untrack

### 11. `$inspect` 是干什么的？生产会怎样？
`$inspect(value, ...)` 是调试用 rune，当被观测的信号变化时在控制台打印，类似"响应式 console.log/watch"，可带 `.with(tracker)` 自定义。它仅用于开发，构建时会被剥离/移除，不进生产（呼应 svelte-reactivity-internals）。
**来源**：Svelte 官方文档 — $inspect

### 12. 在 `$effect` 里给它自己读到的 `$state` 赋值会发生什么？
可能形成**无限循环**（写→触发同一 effect→再写）。Svelte 会检测到并抛错/告警。修法：把该写入移出 effect（放事件处理），或用条件守卫，或用 `untrack` 消除依赖（呼应 svelte-reactive-runes 第四、六节）。
**来源**：Svelte 官方文档 — effect_update_depth_exceeded 说明
