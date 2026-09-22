# React → Solid 迁移 · 面试题

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (C) 从 React 迁 Solid，最先要"卸载"的心智是什么？

"状态一变组件就重跑"这件事在 Solid 不存在。于是 React 里为挡重渲染的 React.memo/useMemo/useCallback 大多要删——Solid 靠订阅精确更新，不靠"少重渲染"。唯一形似的 createMemo 是缓存昂贵计算，性质不同。
**来源**：React↔Solid 响应式模型根本差异的高频论题转述。

### 2. (B) `const {count} = props` 在两个框架里行为差在哪？

React 里 props 每次渲染是新对象、解构只是拿快照、下次渲染自然有新值；Solid 里 props 是稳定 Proxy、解构=只读一次 getter、之后源变化不再通知，直接破坏响应式（编译器告警）。迁移第一大返工点。
**来源**：官方 playground"Destructuring props breaks reactivity"警告与 React 语义对比转述。

### 3. (B) React 的 `useEffect(fn, [a,b])` 迁过来怎么处理？

去掉依赖数组——Solid createEffect 自动追踪回调里实际读到的信号；若确实只想订阅 a、b，用 `on(()=>[a(),b()], fn, {defer})` 显式声明。别把依赖数组的"漏写/多写"心智平移过来。
**来源**：官方 createEffect 自动依赖 + on 精确控制转述。

### 4. (B) `useEffect(()=>{const t=setInterval(...);return()=>clearInterval(t)},[])` 怎么直译？

Solid 没有"空依赖=只跑一次"这个惯用法，拆成 `onMount(()=>{ timer=setInterval(...) })` + `onCleanup(()=>clearInterval(timer))`。cleanup 返回函数式微变成显式 onCleanup。
**来源**：官方 onMount/onCleanup 生命周期与 React cleanup 对照转述。

### 5. (A) 派生状态：React 用 useMemo、Solid 用什么？反过来 React 里"effect 里 setState 同步派生"在 Solid 里应？

都倾向"计算属性"：Solid 用 `createMemo(()=>...)`。React 里那种 useEffect set 派生的反模式，在 Solid 更坚决反对——派生一律 memo，绝不在 effect 里 set 信号（易致额外渲染/无限循环）。
**来源**：官方"用 memo 而非在 effect 写信号"建议转述。

### 6. (C) `{ok && <X/>}` 与 `[...].map(...)` 为什么在 Solid 里不能照抄？

Solid 组件不重跑，`&&`/`.map` 是"渲染那一刻"的一次性 JS 求值，源变了不会自动重画。要用 `<Show when>`（每轮重读条件）与 `<For>`（keyed、复用 DOM、增量更新）。Index 处理"按位置"、For 处理"按身份"。
**来源**：官方控制流组件对 React 惯用表达式差异的说明转述。

### 7. (B) React 团队常把 `key={i}` 用得很随意，迁到 For/Index 要注意什么？

Solid 的 `<For>` 按 **item 引用** keyed、不需要你写 key；若列表"按位置更新、item 结构稳定"才用 `<Index>`，且它的回调参数是 `(accessorOfItem, index)` 与 For 正好相反。把 React 的 index-key 习惯硬套只会选错组件。
**来源**：官方 For vs Index（mapArray/indexArray、回调参数相反）转述。

### 8. (C) Context、ref、受控表单这三样，迁移时分别注意什么？

Context API 基本同名，但 Solid `useContext` 无内置默认值兜底、没 Provider 返回 undefined（类型带 `|undefined`，给个抛错的 useXxx）；ref 从 `useRef` 对象变成"直接 `let el`+`ref=` 或 `use:` 指令"；表单事件 `onChange` 语义不同（Solid 更接近原生、多数该用 `onInput`）。
**来源**：官方 context/ref/事件 与 React 差异综合转述。

### 9. (A) 异步取数从 `fetch+useState+useEffect` 迁过来分几步走？

客户端层先换 `createResource`（自带 loading/error、配 Suspense）；上 SolidStart 后进一步换 `query + createAsync`（具名缓存、`"use server"`、route.preload）。把"effect 里 fetch + set 两个 state"这套彻底退休。
**来源**：官方 Resource 与 Start query/createAsync 数据层演进转述。

### 10. (D) 给一个中型 React 应用做迁移评估，你会按什么顺序推进、先做什么？

先立骨架（组件=createSignal、删防重渲染优化）；再"响应式纪律"专项 review（搜全仓 props/state 解构、JSX 里提前 `foo()`、`&&`/`.map`），这是最高频返工；然后副作用归位（useEffect→onMount/onCleanup/createEffect，派生→memo，异步→resource）；数据/服务端上 Start；最后靠编译器 lint + testing-library 收口。
**来源**：面向团队的分阶段迁移实践归纳转述。

### 11. (B) 迁移后"界面不更新"，Solid 语境下的头号排查方向是什么？

"你是不是把响应式来源解构/提前求值了"——读了一次值、脱离 getter 登记，就不建立订阅。次之：异步里读信号（同步登记本质、丢追踪）、在非追踪作用域写 store 属性。先看"值是怎么被读出来的"，而非"渲染有没有触发"。
**来源**：Solid 社区最高频"why isn't it updating"答疑主线转述。

### 12. (C) "Solid 没有 hooks 规则、可以条件调用"这句对 React 老手意味着什么解放与什么陷阱？

解放：`createSignal/createMemo` 不是 hook，不受"顺序/不能在循环条件里"约束，可放进普通函数复用逻辑。陷阱：响应式的约束换了位置——**在什么作用域里读 signal（是否在追踪上下文、是否解构）决定订阅**，规则从"调用顺序"变成了"读写时机与位置"。
**来源**：Solid 非 hook 响应式对 React 心智的差异与常见误解澄清转述。
