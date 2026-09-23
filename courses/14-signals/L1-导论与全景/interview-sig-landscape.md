# sig-landscape 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) 为什么"状态管理"是 SPA 时代才出现的问题？
**来源**：https://redux.js.org/introduction/motivation ；架构演进高频开场题。

服务端渲染时代数据在数据库、页面每次请求重画，不存在长驻内存的共享可变数据。SPA 把 UI 状态搬进浏览器内存后，几十个组件并发读写同一份数据，"唯一真值源在哪、变了通知谁"才成为架构问题。一句话：状态管理是**长会话+共享可变数据**的产物。

### 2. (A) Flux 的单向数据流相比双向绑定治好了什么？
**来源**：https://facebookarchive.github.io/flux/docs/in-depth-overview ；经典对比题。

双向绑定允许"视图改模型、模型反改别的视图"，变更传播方向在大应用里不可预测。Flux 强制 Action→Dispatcher→Store→View 的单向环：任何数据变更都能倒溯到一个明确的 Action 入口。代价是样板与间接性——这个"自由 vs 可追溯"的取舍在后续所有方案里反复出现。

### 3. (A) Redux 为什么坚持不可变更新？换来什么、代价是什么？
**来源**：https://redux.js.org/usage/structuring-reducers/immutability-and-data-integrity ；Redux 核心追问。

坚持不可变是为了**引用可比较**：变化检测（shallow diff）、时间旅行调试、memo 优化都建立在"旧状态没被就地改掉"上。代价：改深层嵌套要层层造新对象（样板与心智负担）、误改即污染历史状态。Immer 与 MobX/Zustand 的兴衰都是围绕这笔账在做文章。

### 4. (C) MobX 和 Redux 的哲学分歧，用一句话怎么概括？面试官想听什么？
**来源**：两派论战主题的高频转述；https://mobx.js.org/the-mobx-and-redux-eye-test.html 。

一句话："MobX 相信自动追踪+可变对象，Redux 相信显式更新+不可变快照。"面试官想听的是你理解分歧的**下游后果**：MobX 代码像日常 OOP 但有魔法感、难"回放"；Redux 啰嗦但每次变更显式可审计。能推导出"复杂对象图选前者、扁平快照选后者"即加分。

### 5. (B) 团队说"上了 Hooks 就不需要状态库了"，你怎么回应？
**来源**：Hooks 时代经典争论题转述。

先承认对的部分：80% 的状态确实该留在组件里。然后指出剩下的结构性缺口：跨组件共享要么进 Context（Provider 值一变**所有消费组件重渲**，粒度粗），要么继续找库。2019 之后 Redux 复兴反而靠 RTK、外部 store（Zustand/Jotai）崛起，都是对"局部化过头"的修正。结论：Hooks 重新分配了状态的位置，没有消灭共享状态的需求。

### 6. (A) useSyncExternalStore 解决了什么问题，为什么说它是外部 store 复兴的地基？
**来源**：https://react.dev/reference/react/useSyncExternalStore ；React 18 机制题。

它把"订阅外部数据源"收编为官方 API：并发渲染下保证不读到撕裂的中间状态（tearing），并提供服务端渲染快照参数。此前社区库各自手写订阅+forceUpdate，正确性参差。Zustand/Jotai/Redux-Toolkit 都改用它实现绑定层——地基统一后，外部 store 才从"偏方"变成"正途"。

### 7. (C) Jotai 和 Zustand 都算"外部 store 复兴"，路线差异在哪？
**来源**：https://jotai.org/docs/introduction ；https://zustand.docs.pmnd.rs/ 对照题。

Zustand 是 **store 中心**：一个全局对象+selector 切片订阅，思想近 Redux；Jotai 是**原子中心**：每个状态是独立 atom，依赖关系组成隐式图、按需订阅，思想近信号/响应式编程。经验法则：状态间依赖浅、想快速上手→Zustand；派生关系密集、希望默认细粒度→Jotai。两者都能配 Immer/持久化。

### 8. (A) TC39 Signals 提案想解决什么？为什么说是给"库作者"的？
**来源**：https://github.com/tc39/proposal-signals ；提案定位题。

解决响应式原语的碎片化：Solid/Svelte/Vue/Angular 各造了一套 signal，逻辑库要发 N 个适配包。提案标准化 signal/computed/effect 的**语义**（惰性、即时一致、订阅自动追踪），让"写一次响应式逻辑、跨框架复用"成立。业务开发者短期感知不强，因为提案先服务的是生态层——答出这个"层"字就赢了。

### 9. (D) 面试官让你"设计 2015 年的 Redux 替代品"，你的演进复盘怎么讲？
**来源**：状态管理设计题高频变体；https://redux.js.org/introduction/history-of-react-and-redux 转述。

按"每代还掉什么债"讲：Redux 还了可审计债但欠下样板债→MobX 还了样板债但欠可审计债→Hooks 还了全局化过度债但欠共享债→Zustand 用 selector 同时还样板与粒度债、但放弃对象图→signals 试图还跨生态债。展示的是**取舍意识**而非站队，正是这题的考点。

### 10. (B) 老项目里 Redux/MobX/Zustand 三代方案并存，你的治理策略？
**来源**：多代方案共存现实题（迁移实战高频）。

先冻结：新需求按决策树定层入库（组件态/共享态/领域态/服务端态各归各位），禁止"顺手统一"大爆炸重写；再收敛：用双写桥让新旧 store 同步、按 feature 逐个搬迁、每步有回归测试；最后清理：旧 store 引用归零后删除。核心话术：**共存是常态，治理靠边界不靠换库**。

### 11. (C) "Action"这个词从 Flux 到今天的 Zustand，含义发生了哪些漂移？
**来源**：术语演化观察题转述。

Flux 里 Action 是要过 Dispatcher 的广播事件对象（type+payload）；Redux 里是 reducer 的输入信号；Zustand 里退化/演化为"store 上的方法"——`login(user)` 直接写新状态，不再广播、不再集中拦截。漂移方向是**从消息对象到普通函数**：纪律还在（改状态走方法），仪式感没了。能指出这点说明真读过各代源码。

### 12. (A) 为什么说 Redux 的"单一 store"既是优点也是枷锁？
**来源**：架构权衡经典题转述。

优点：全局状态一棵树，组合、持久化、回放、时间旅行全部免费；枷锁：树的形状是全局契约，feature 团队要协调命名空间、性能问题要在共享树上做全量 selector 优化、领域逻辑（对象行为）被压成哑数据+外挂 reducer。MobX 的多 store 对象图与 Zustand 的多小 store，都是对"单一"的反叛。

### 13. (D) 给一个从零起步的中型 React 后台（重表单+重列表+少量全局共享），你的状态架构初稿？
**来源**：架构设计场景题高频变体。

分层给答案：表单内部状态→非受控/react-hook-form（不进全局）；列表数据→React Query（服务端态）；跨页共享的少量 UI 态（主题、侧栏）→Zustand；真有复杂联动再加 MobX 或干脆没有。强调**默认不引库**、每引一个库要对应一类真实状态——面试官要的是克制，不是堆料。

### 14. (B) "我们的 store 里存了接口返回的用户列表，改一处要手动 set 新数组、还老忘更新加载态"——病根与药方？
**来源**：服务端状态误入客户端 store 的典型社区求助转述。

病根：把**服务端缓存状态**（有远端真值、会过期）当**客户端状态**（本地真值）管，于是缓存、失效、加载态、竞态全要手搓。药方：迁到 React Query/SWR 类方案，store 只留真正的客户端共享态。这题答出"两类状态"的边界即得分（L8 专关）。

### 15. (C) 对比 Redux DevTools 与 MobX 的调试体验差异，说明背后的范式原因。
**来源**：调试体验对比题转述；https://mobx.js.org/react-integration.html 等文档主题。

Redux 每次变更=一个 action+新状态快照，天然可序列化、可回放、可时间旅行；MobX 就地突变对象，事后"谁改了它"依赖 spy/patch 追踪器，回放困难。体验差异不是工具做得差，而是**不可变快照范式天然自带审计日志、可变范式要额外记账**——这正是当年 Redux 用复杂度换来的东西。
