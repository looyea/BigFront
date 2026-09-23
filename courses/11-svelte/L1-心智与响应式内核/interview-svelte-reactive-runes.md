# svelte-reactive-runes 面试题精选

> 共 15 题，覆盖 A 状态 / B 派生 / C 副作用 / D 依赖与调试。

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

---

## 补充（新专题 13-15）

### 13.  $derived 的"惰性 + 缓存"与 $effect 的"立即调度"是两套时机模型，说清各自何时求值，以及为什么 derived 里不该有副作用。

求值时机对比：$derived 是惰性（lazy）——声明时不求值，只有在"被读取的那个时刻"且"自上次读以来依赖已变"才重新计算，中间多次写 state 不会触发它（甚至没人读就永不计算）；这与 $effect 相反，effect 是"依赖变则被调度到 flush 队列、在 DOM 更新前后特定时点必然运行"。把两者混记的后果：在 derived 里发请求/写 state → 因为惰性你可能得到 0 次或多次调用（不可预测），且 derived 应引用透明（同依赖同结果），带副作用就破坏了"可以安全重复计算/可缓存"的前提。为什么这样设计：derived 的缓存价值正是建立在"纯函数"假设上——只有无副作用，运行时才有资格"跳过重算/复用上次结果"；一旦有副作用，缓存优化就变成 bug。正确分工：数据变换用 derived（纯、可缓存、惰性），对外部世界的影响用 effect（显式承认时机不保证、需要 cleanup）。加分句：能把 derived 的"惰性"讲成"为了拿到缓存权而放弃执行控制权"，就把设计取舍说透了（呼应 reactive-runes 既有的惰性求值题）。

**来源**：Svelte 5 runes 文档（$derived 惰性求值）；Svelte RFC（effect 调度）；Vue computed 惰性对照

### 14.  同样是响应式，Svelte 5 的 $state 与 Vue 3 的 ref/reactive、Solid 的 createSignal 在三处关键设计上有何差异？

三条轴：① 访问形态——Solid/Vue 的 signal/ref 是"函数或 .value 包裹"（createSignal 返回 getter、ref 需 .value），因为它们是运行时原语、语言无法拦截读取；Svelte 用编译器把 $state 还原成"普通变量读写"（count++ 直接生效），代价是 runes 必须在能被编译器处理的文件里（.svelte/.svelte.js）。② 粒度与追踪——Vue reactive 是 Proxy 深响应、Solid 是显式 signal 图（读即订阅）、Svelte 5 借鉴 signal 内核（读决定依赖、写传播）但对外伪装成普通赋值；三者都放弃了 Svelte3/Vue2 的"编译期静态分析找依赖"走向运行期信号订阅。③ 更新时机——Solid/Svelte 是同步写、异步（microtask/flush）批量应用；Vue 也是 nextTick 批量；差异在 Svelte 的 flush 与 DOM 更新绑定更紧（$effect 在 DOM 更新后跑，衍生值惰性），Vue 有显式 watch 的 flush 档（pre/post/sync）。收口句：这道题的高分点是"为什么 Svelte 能用裸变量而 Vue/Solid 不能"——答案是"编译器介入深度不同"，Svelte 把 signal 的 getter/setter 在编译期织进了你的赋值语句里，这是它编译器系身份的集中体现。

**来源**：Vue 3 响应式文档（ref/reactive 与 .value）；Solid createSignal 文档；Svelte 5 runes 设计说明

### 15.  一个 .svelte.js 模块导出的响应式状态被多个组件共享，可能出现"意外互相干扰"，你怎么设计共享边界？

问题本源：.svelte.js 模块的顶层 $state 是"模块单例"——所有 import 它的组件共享同一份实例，改一处处处变（这正是全局态想要的，但误用会造成耦合污染，呼应 global-state 关的 SSR 泄漏与 HMR 清零题）。设计边界三招：① 分清"真全局"与"每组件一份"——需要每组件独立状态时用工厂函数（createCounter() 每次返回新 $state），需要单例才在模块顶层导出（导出函数比导出裸 state 更可控）；② 控制可写面——对外只暴露 derived/方法而非裸 $state（用闭包封住内部 state，防止消费方直接改字段，呼应 overview 的"对象字面量防外部乱改"题）；③ SSR 边界——单例在 SSR 跨请求泄漏是硬约束，服务端绝不放请求级数据到模块 state（放 locals/depends）。测试面：模块单例让测试相互污染（前一个用例改了状态、后一个读到脏值），必须提供 reset 或在 beforeEach 重建工厂实例（与 testing 关呼应）。加分句：判断"这段状态该不该做成单例"的准绳是"它是否携带用户/请求身份"——无身份的 UI 偏好（主题、侧栏开合）适合单例，有身份的数据（购物车当前用户）绝不单例，这条线在 SSR 项目里是安全线不是风格。

**来源**：Svelte 模块状态作用域文档；global state singleton 模式；Vite HMR 与模块单例讨论
