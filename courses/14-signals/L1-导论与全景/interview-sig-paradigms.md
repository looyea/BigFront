# sig-paradigms 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) 用一句话区分 signal 和 stream，再各举一个对方擅长、自己别扭的场景。
**来源**：范式对比开场题转述；https://rxjs.dev/guide/observable 与 https://github.com/tc39/proposal-signals 主题。

signal 是"带订阅名单的盒子，只有当下值"；stream 是"随时间流逝的事件序列"。signal 别扭的：新请求到达即丢弃上一个未完成请求（switch 语义）、"最近 1 秒内的点击"这类窗口问题；stream 别扭的：取"当前值"（可能从没发过）、大量派生值得靠 scan/BehaviorSubject 攒伪 signal。

### 2. (A) "读即订阅"意味着什么？给出三个它的直接后果。
**来源**：细粒度响应式核心机制题；https://docs.solidjs.com/signals/reactive-functions 主题转述。

后果一：依赖是**运行期动态**收集的——分支没走到的读取就不算依赖；后果二：追踪作用域外读（setTimeout、事件回调）建立不了订阅，是最常见的"界面不更新"病根；后果三：解构/提前求值把响应式读成了普通值，响应链断裂。三个后果分别对应各家文档里的三个高频坑。

### 3. (A) 为什么说 signal 家族是"推标记+拉计算"的混合模型？和 RxJS 的纯推差在哪？
**来源**：响应式执行模型深度题；https://github.com/tc39/proposal-signals 语义章节主题。

写 signal 时只沿依赖图把下游**标脏**（推的部分），computed 真正重算发生在**有人读它**时（拉的部分）——所以没人订阅的派生链零成本。RxJS 纯推：next() 一路推到 subscriber，下游不关心也在算，才有 shareReplay/多播这类"止损"操作符。两种模型对"白算一场"的处置方式完全不同。

### 4. (C) 把同一个"搜索框去抖+竞态处理"分别用 RxJS 与 signals 思路写出口头代码，比较行数与心智。
**来源**：两范式实战对比高频题。

RxJS 约三行管道：`valueChanges.pipe(debounceTime(300), switchMap(search), takeUntil destroy$)`——时序关系全在操作符名字里。signals 思路要手写：effect 里读关键词、存 setTimeout 句柄、代际计数比对丢旧响应、AbortController 断旧请求——每件事都能做，但**时间关系散落在命令式代码里**，review 负担就是差异。结论话术：事件关系多用流，状态快照用信号。

### 5. (B) 候选人说"Zustand 就是更小的 Redux"，你怎么追问出他是否真懂？
**来源**：概念辨析连环追问转述。

追问点：① 绑定机制——Redux 靠 Provider+Context 风格注入，Zustand 的 create 直接返回全局 hook，可脱离任何 Provider（真外部 store）；② 选择器——React-Redux 的 useSelector 与 Zustand 的参数化 hook 都走 useSyncExternalStore，但 Zustand 默认引用比较、多值要 useShallow；③ 中间件定位——Redux 是 dispatch 洋葱，Zustand 是 store 包装器。能接住任意两问才算真懂。

### 6. (A) 细粒度订阅和粗粒度订阅的性能模型差异，各自在什么负载下翻车？
**来源**：粒度权衡题转述。

细粒度（MobX/signal）：更新成本≈O(真实受影响订阅者)，翻车在**订阅者数量爆炸**（万行表格每行若干派生）与依赖图内存；粗粒度（Redux/Context）：翻车在**无关组件被连坐重渲**，靠 memo/selector 手工收窄但漏一个就退化。一句话：细粒度把成本花在"记账"，粗粒度把成本花在"比对"。

### 7. (D) 用 BehaviorSubject 存用户登录态 vs 用 signal/Zustand，从语义上说出 BehaviorSubject 的三个不贴切。
**来源**：状态原语匹配度讨论题（RxJS 误用高发区）。

① BehaviorSubject 的 complete/error 通道对"一个值"毫无意义却必须处理；② 它的订阅者自己负责退订，漏一次 unsubscribe 就泄漏，而 signal 的订阅随作用域自动回收；③ "当前值"要靠 `getValue()` 或快照技巧获取，和"读即订阅"的派生体系不兼容。本质：**拿时间序列的原语硬当当下值的原语用**。

### 8. (C) MobX 的 observable、Solid 的 signal、Vue 的 ref，三个"响应式盒子"最主要的两个差异维度是什么？
**来源**：三大家对照题；https://mobx.js.org/observables.html 等文档主题。

维度一：**容器显式度**——Solid/Vue 要显式调用读取（count()/count.value），MobX 把代理藏在普通属性后面（this.count 直接读）；维度二：**写协议**——MobX 鼓励就地突变+action 纪律，signal/ref 是整体 set（值语义）。显式度决定"魔法感 vs 可静态分析"，写协议决定"可变派 vs 值容器派"。

### 9. (B) 为什么"selector 每次返回新对象"会造成 React/Zustand 的重渲风暴？signal 家族为何没这个坑？
**来源**：引用比较范式实战坑（社区高频答疑转述）。

快照比较派靠 `Object.is(prev, next)` 决定是否重渲，`s => ({a:s.a,b:s.b})` 每次都是新引用，比较永远"变了"。修法：useShallow/原子化多个 selector/浅比较自定义。signal 家族在**字段级**建订阅、值走 getter，压根不做整快照比较，自然没这坑——这是"比较策略"决定"API 风格"的活例。

### 10. (A) "可变 vs 不可变"之争里，Immer 到底站在哪边？为什么说它是"语法层和解"？
**来源**：https://immerjs.github.io/immer/ 主题转述。

Immer 运行时产物是**不可变**的（结构共享的新对象），写法上是**可变**的（draft 里随便赋值）。它没有调和两条通知模型——MobX 的真可变+代理追踪它做不到；它只是让不可变派在"更新语句"层面获得可变派的手感。所以 Zustand 用 immer 后仍是快照比较，通知粒度没有变细。

### 11. (D) 面试白板：给你"拖拽排序+实时协作光标+本地表单草稿"三份状态，各选什么方案？说理由。
**来源**：状态分层场景题高频变体。

拖拽排序：高频瞬时写→signal/细粒度（或干脆 DOM 直改+落库时提交），全量快照方案会重渲风暴；协作光标：真·事件流+时间窗口语义→RxJS（或 Yjs 自带响应）；表单草稿：低频、要持久化→Zustand+persist。三份状态三个工具、互不越位——考的就是"按状态性质选原语"而非"一把梭"。

### 12. (B) 同事把 solid 的 `const [v] = useMySignal()` 再解构一层、或把 `count()` 的结果存进普通变量，界面不更新。解释病根。
**来源**："读即订阅"事故第一高频；https://docs.solidjs.com/ 官方指南主题。

`const snapshot = count()` 在**追踪作用域外**执行时只是一次普通函数调用，取到当下值后与 signal 再无关系；之后 setCount 的通知名单里没有它。修法：在 computed/effect/JSX 表达式内**读函数本身**（`count`），让"读"发生在被追踪的位置。同一个坑在 MobX 解构 observable、Vue 解构 reactive 各有一套变体。

### 13. (C) 从"背压"视角对比 RxJS 与 signal：谁是真问题、谁基本免疫，为什么？
**来源**：流控深度讨论转述；https://rxjs.dev/guide/scheduler 主题。

纯推模型下源头产速可以超过下游消费能力，积压/白算就是背压问题（RxJS 靠 windowTime/buffer 等操作符手动应对）；signal 的"写只标脏、读才计算"天然**合并了生产与消费**——上游连写一百次，下游一次读只算一次，背压问题在结构上不成立。这是惰性拉取模型被各家采用的原因之一。

### 14. (A) 为什么说"时间维度"决定了 stream 更适合建模日志、动画帧、WebSocket，而 signal 不适合？
**来源**：原语选型理论题。

这些场景的**历史本身携带信息**：日志的值是序列、动画关心帧间隔、WebSocket 要求消息不丢序。signal 的语义是"旧值被新值覆盖"，写入即丢弃历史，要保留序列只能把 signal 当容器塞数组（自造垃圾与内存问题）。一句话记忆：**signal 是寄存器，stream 是磁带的比喻虽旧但准**。

### 15. (D) 设计决策：团队要在一个 React 大型项目里同时服务 CRUD 页（多）和实时交易页（少），你的状态技术栈？
**来源**：多技术栈共存架构题。

分层+分域：全局基座选 Zustand（轻量、覆盖 CRUD 的共享态）+React Query（服务端态）；实时交易页的事件流密集，局部引入 RxJS 并封装成 hook 边界，禁止跨域蔓延；不引入 MobX 避免三套可变/不可变心智打架。要点：**主栈唯一、例外收口在特性目录**，并给例外区性能数据背书。
