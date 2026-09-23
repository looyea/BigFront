# solid-effect-tracking 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) 不看文档，手搓一个"能通知依赖者"的最小 signal+effect，并指出依赖是在哪一步被登记的。
**来源**：白板实现响应式题的转述。

用 `let currentSubscriber`，`createSignal` 的 getter 里 `if(currentSubscriber) subscribers.add(currentSubscriber)`，setter 里值不同就 `for(s of subscribers) s()`；`createEffect(fn)` 里 `prev=currentSubscriber; currentSubscriber=fn; fn(); currentSubscriber=prev`。**依赖登记发生在 fn 同步执行期间读 getter 的那一刻**；跑完立刻还原 currentSubscriber 以支持嵌套。

### 2. (B) `createEffect` 里 `await` 之后读一个 signal，为什么它变化时 effect 不重跑？给两种修法。
**来源**：异步追踪丢失题的转述。

追踪只在回调**同步执行段**有效；`await` 之后代码在微任务里执行，此时 effect 早已跑完注销、`currentSubscriber` 为 null，那次读不建边。修法：① 用 `on(dep, ...)` 或 `createMemo` 把依赖声明式定在同步段；② 用 `createResource` 把异步本身变成可追踪的 signal（source 变自动重取）（呼应 solid-resource）。

### 3. (C) `createEffect`、`createMemo`、`onMount` 分别负责什么，各举一个误用的后果。
**来源**：三类原语职责辨析题的转述。

createMemo=派生值（返回 signal、依赖变才重算）；createEffect=副作用/与外界同步；onMount=挂载后跑一次的一次性逻辑。误用：拿 effect 算派生 → 多占一次渲染间隙且语义错误、别人还无法当值读；拿 memo 做副作用 → memo 可能被"无人读就不跑"、副作用丢；拿 createEffect 当 onMount → 依赖一变又跑，非一次性。

### 4. (A) "过度订阅（over-subscription）"在 Solid 里怎么产生？怎么用 memo 收敛？
**来源**：细粒度陷阱题的转述。

在会被频繁重跑的 consumer（如某个大 effect 或每帧求值的表达式）里读了很多 signal，任何一个变都触发它重跑——即便你只用到其中一个的下游结果。收敛：用 `createMemo` 把"真正参与判断的值"算成派生，让 effect 只订阅这个 memo；早返回也能天然减少被追踪依赖（memo 里 `if(!open()) return;` 则关掉时不再追 unit/temperature，呼应 fine-grained 文档的温度例）。

### 5. (B) 为什么"用 effect 把 A 同步到 B"往往不如"直接 B = memo(A)"？给一个会引发时序抖动/循环的例子。
**来源**：effect 派生反模式题的转述。

`createEffect(()=>setB(a()))` 比 `const b=createMemo(()=>a())` 慢一拍：effect 在订阅变化后的更新阶段跑，B 会有一帧是旧的；若两个 effect 互相写 A↔B 还可能形成回环反复通知。用 memo 直接派生：B 恒等于计算值、无中间态、无自激。原则：**能声明式派生就别命令式同步**（呼应 solid-memo）。

### 6. (A) `on(deps, fn, {defer:true})` 和裸 `createEffect(fn)` 行为差在哪两点？
**来源**：on 语义题的转述。

① 依赖范围：`on` **只按显式列的 deps 触发**，fn 里读的别的 signal 不会自动订阅；裸 effect 则订阅回调内所有同步读到的 signal。② `defer:true` 让首次不执行、只有 deps 之后变化才跑；裸 createEffect 首次必跑。适合"只关心 a 变化、顺手读 b 拿值"的场景。

### 7. (D) 需求：输入框防抖搜索，输入变化停止 300ms 后才发请求。用 signal + effect 的思路怎么落地、注意什么？
**来源**：防抖与追踪综合题的转述。

用 `createSignal` 存 query；对 query 做 `debounce`(Solid utilities 提供 debounce/createComputed 思路)或在 `on(query, ...)` 里配定时器；关键坑：`setTimeout` 回调里读 query 不被追踪，所以要在同步段拿好值、或用 `on` 显式声明依赖、或用 resource 发请求。发请求本身交给 `createResource(source=query)` 最地道——source 变自动重取（呼应 solid-resource）。

### 8. (C) React 的 `useEffect` 有"依赖数组 + 每次渲染后执行"，Solid 的 `createEffect` 与之最本质的不同是什么？
**来源**：跨框架 effect 语义对比题的转述。

React effect 依附于"每次渲染"这一节奏、靠你手写依赖数组决定重跑；Solid 没有"每次渲染"（组件只跑一次），`createEffect` 靠**自动收集回调内同步读到的 signal** 建立订阅、这些 signal 真变才重跑，且**无需依赖数组**。本质不同：React 是"渲染后同步副作用 + 手动声明依赖"，Solid 是"响应式订阅驱动的副作用 + 自动按读追踪"（依赖数组在 Solid 是 `on` 才需要）。

### 9. (B) 一个 effect 里读了一个 store 的深层路径，另一处只在用别的字段，为什么这个 effect 被意外触发了？怎么修？
**来源**：store 追踪粒度题的转述。

若在 effect 同步段读了那个深层路径 getter，就订阅了它——即使你"逻辑上"主要关心别的字段，只要**读过的**都会触发。修法：把"只为拿值、不希望触发重跑"的读包进 `untrack`，或把真正关心的判断抽成 `createMemo` 只订阅 memo（呼应 solid-stores、untrack）。

### 10. (D) 你要在组件卸载后停止某个轮询，Solid 里怎么保证 effect/timer 被清理干净？
**来源**：生命周期与 Owner 作用域题的转述。

Solid 靠 **Owner 树**界定作用域：组件/`createRoot` 建立的 reactive root 在 dispose（如路由离开、组件卸载）时会连带销毁其下所有 observer/effect 及其建立的订阅。在 effect 里 `onCleanup(()=>clearInterval(id))` 注册回收器，root dispose 时自动调用。异步回调若跑在已销毁作用域，要 `createRoot`/手动清理避免泄漏（呼应 solid-lifecycle）。

### 11. (A) 官方为何强调"追踪是同步的"？这个设计带来了什么好处、又埋了什么坑？
**来源**：同步追踪设计权衡题的转述。

好处：**无需依赖数组、无需静态分析**，运行时按"实际读了哪些"精确建边，动态依赖天然正确（如 memo 早返回时少订阅）。坑：任何把"读"推迟到同步段之外的写法（setTimeout/await/微任务）都会**静默地不建立订阅**，表现为"改了不更新"——这是 Solid 最隐蔽的一类 bug（本课反复强调的点）。

### 12. (B) 把三关（overview/signals/effect）串起来：为什么"组件只执行一次 + 同步按读追踪"能同时解释 (a) 必须用 For/Show、(b) 解构丢响应、(c) await 里读不更新？
**来源**：综合自洽性检验题的转述。

一条主线：Solid 靠"在同步执行窗口里读 getter 建立订阅"来更新一切。(a) 组件只跑一次，故 `&&`/`.map` 的首跑求值之后无人重跑，必须靠 `<For>/<Show>` 这类**内部会持续订阅并协调 DOM** 的响应式组件；(b) 解构/`const c=count()` 是**在窗口外把 getter 求成了定值**，自然不再订阅；(c) await/setTimeout 里读发生在**同步窗口关闭之后**，无人在追踪。三者是同一机制的三个切面。

---

## 补充（新专题 13-15）

### 13.  一个 effect 意外不重跑，你的排查清单？ 

 依次看：依赖读取是否被 untrack 吃掉、分支是否早退跳过了读、信号是否被复制成普通值（解构快照）、写入是否绕过 setter（内部突变）；根因几乎都在追踪是运行期行为这一事实。 

**来源**： https://www.solidjs.com/docs/latest/api#createeffect 

### 14.  把 RxJS/外部响应式接进 Solid 信号体系，桥接层放哪、订阅归谁？ 

 用 createSignal + onCleanup 包裹外部订阅（observable.subscribe 的 unsubscribe 交给 onCleanup），对外暴露只读 accessor；桥接只出现在 $lib 工具层，禁止在 JSX 表达式里直接订阅。 

**来源**： https://www.solidjs.com/docs/latest/api#createSignal 

### 15.  SSR 阶段 createEffect、onMount 各自行为？对写同构逻辑意味着什么？ 

 二者服务端均不执行：浏览器专属副作用天然被隔离在挂载后；但 memo/信号计算照常运行，所以纯派生逻辑同构安全，涉及 window 的必须落在 effect/onMount 或 import.meta.env 守门内。 

**来源**： https://www.solidjs.com/docs/latest/guides/ssr 
