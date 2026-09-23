# za-core 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。覆盖 Zustand 核心机制与外部 store 订阅模型。

### 1. (A) 一句话讲清 Zustand 的订阅模型，并说明 selector 在其中的双重角色。

**来源**：https://zustand.docs.pmnd.rs/

模型：store 保存一个 state 快照+监听者表；组件经 hook 注册『selector+上次产物』；每次 set 产生新快照后逐个 listener 执行 selector，产物与上次比较（默认 Object.is），不同则触发该组件重渲。selector 的双重角色：① 取数函数（决定组件拿到什么）；② 订阅谓词（决定组件何时被唤醒）——理解『selector 即订阅边界』就理解了 Zustand 的一切性能问题。

### 2. (B) 组件里 useStore((s) => ({ theme: s.theme, lang: s.lang })) 导致无关字段更新也重渲，给三种修法与取舍。

**来源**：转述自高频坑（za-core selector 节）

① useShallow 包裹（最省事，浅比较两字段引用）；② 拆两次单字段订阅（最省内存、语义最清，样板翻倍）；③ 中间件层预聚合（把 {theme,lang} 收进 store 时就用 immer 保证同内容同引用——治本但要架构改动）。取舍：字段少用①、热点组件用②、跨多组件复用同一组合用③。

### 3. (A) getState 快照为什么必须『同步且稳定』？useSyncExternalStore 对 getSnapshot 的契约是什么？

**来源**：https://react.dev/reference/react/useSyncExternalStore

契约：同一渲染轮次内多次调用 getSnapshot 必须返回相同值（引用级），且返回值只能在 store 变化时变——React 用它在渲染前/提交后两次取值做撕裂复核，违反契约即 'should be cached' 无限循环警告。推论：selector 派生新对象=破坏快照稳定性，必须 memo/useShallow——React 的契约倒逼 Zustand 用户学会『引用纪律』，这课其实是 React 性能心智的浓缩卷。

### 4. (C) Zustand 无 Provider 的模块单例模式，在什么场景下从优势变负债？两个对策是什么？

**来源**：转述自 SSR 与多实例文档（createStore/vanilla）

负债场景：① SSR——服务端模块单例=跨请求共享状态，串数据事故；② 同页多实例（一个组件树渲染两个独立列表、微前端多租户）。对策：vanilla store（createStore 造实例）+ Context 注入（zustand/traditional 的 createContext）——本质是放弃『全局唯一』换回每请求/每子树一份实例。答题金句：单例是免费午餐也是连环债，会造实例也要会注入。

### 5. (C) Redux 与 Zustand 在『更新判定』上的机制差异是什么？对 reducer/action 写法各有什么约束？

**来源**：转述自两家官方文档对照

机制相同点都是『新引用才算变』；差异在比较粒度：Redux 整 store 树+reducer 链，每个 reducer 必须返回全量 state 对象（default 分支都要 return state）；Zustand 浅合并 partial 即可、selector 粒度订阅。所以 Redux 强求纯函数 reducer+不可变全家桶，Zustand 只在『set 的产物』这一层要新引用——前者纪律更刚、样板更多，后者自由、坑位下沉到 selector（q2 的浅比较问题 Redux 靠 reselect 同款解决）。

### 6. (D) 为一个 SPA 设计 store 布局：登录态、主题、侧栏折叠、待办列表、草稿。哪些进 Zustand、哪些留在组件、哪些归服务端缓存？

**来源**：转述自本课与 L1 分层（sig-scenarios 预演）

Zustand（跨组件+客户端事实）：登录态（userStore）、主题（persist）、侧栏折叠（persist 可选）；组件 useState：草稿输入焦点、单表单项临时值——除非草稿要跨页恢复（则 persist 进 store）；服务端缓存：待办列表原始数据归 React Query（Zustand 不重复存），仅筛选条件等 UI 态进 store。判据三问复用 L1：谁同时读、谁是事实源、活多久——工具跟着分层走，不是一锅端。

### 7. (B) 高频更新（如拖拽每帧 setState）让组件树抖，给三层节流方案。

**来源**：转述自 transient subscriptions 实践（za-patterns 预热）

① transient 订阅：拖拽数据不进 React 渲染流，store.subscribe 里直接写 DOM 样式/transform（subscribe selector 版只订坐标）；② 数据源头降频：pointermove 合帧（rAF 节流）再 set；③ 拆分 store：坐标独立小 store+粗粒度 commit（松手才写回主 store），无关组件零波及。理念：不是『渲染更快』而是『根本不渲』——与 MobX 的 reaction 直改、signal 的 effect 直改同一直方（状态层绕开渲染层的三种方言）。

### 8. (A) set 浅合并只到一层，深层字段更新的三种姿势与各自成本？

**来源**：https://zustand.docs.pmnd.rs/integrating-with-immutability

① 手动展开 `set(s => ({ profile: { ...s.profile, address: {...} } }))`——免费但三层嵌套即地狱；② immer 中间件：`set(s => { s.profile.address.city = x })` 可变语法不可变产物（proxy 抄写，性能略税但工程完胜，za-middleware 专讲）；③ lens/工具函数自动深路径展开——引入依赖，小项目不值。生产默认答案：上 immer，三层嵌套一出现就该上。

### 9. (C) Zustand 的 action 与 MobX 的方法、signal 的 action 对象，三家『改状态的正确姿势』差异？

**来源**：转述自三家文档横向

Zustand：store 里定义闭包 action，内部 set 新快照——变更=快照替换，追踪靠订阅比较；MobX：类方法即 action，就地改字段——变更=字段读写，追踪靠读时登记；signal 生态（Angular/Preact）：写 .set，派生 computed——变更=容器写+标记传播。三家殊途：都要求『改的入口收敛』（别处裸改），差异只在收敛机制是 set 函数、action 装饰还是容器方法。这题答到收敛纪律层，面试官就知道你真用过三家。

### 10. (D) 写一个跨标签页同步主题的 Zustand store（思路+关键 API）。

**来源**：转述自 persist+broadcast 模式

主案：persist 中间件（localStorage）+ storage-event：监听 window 'storage' 事件（其他标签页写 key 时触发）→ setState 对齐；进阶：BroadcastChannel 自建通道，set 后 post 新值、onmessage 里 setState（防回环：比对来源或值等再吞）。坑：同步循环（A 页收事件又广播）与初始注水顺序。考点：getState/setState 旁路 API 在非 React 事件源里的运用——Zustand 当『跨上下文状态总线』的实战。

### 11. (B) TS 项目里 create<T>()(set...) 这种双重括号的写法是在解决什么？

**来源**：https://zustand.docs.pmnd.rs/typescript

中间件洋葱模型下泛型推断链太长，直接 create((set)=>...) 的 set 参数推断不出你的 State 类型——官方推荐 `create<State>()(...)` 带一个空参调用让 TS 先把显式泛型钉住再推断剩余参数（curried 技巧）。看不懂这行=被中间件+泛型双杀，面试常拿它探 TS 功底；答对 curried 动机后补一句『纯 JS 项目不需要』显功力。

### 12. (C) React Context + useReducer 能替代 Zustand 吗？边界在哪？

**来源**：转述自 react-context 关与此题高频性

能跑通小场景，但两个硬伤：① 粒度——Context value 一换全体消费者重渲，切细靠多 Provider 组合（样板指数涨），Zustand 的 selector 天然字段粒度；② 非 React 消费者——Context 只活在组件树里，getState/subscribe 的旁路（Worker、路由守卫、事件总线）Context 无解。选型线：低频小状态 Context 够用、高频/跨边界 Zustand 占优（L6 sig-scenarios 收）。

### 13. (A) 多个 store 互相调用（cartStore 读 catalogStore）怎么组织？和 MobX 的 RootStore 思路差在哪？

**来源**：转述自 zustand slices-pattern 与社区实践

模块级直接 import 对方 hook、在 action 里 `catalogStore.getState().price`——单向引用不成环（谁用谁 import），无需 RootStore 容器（每个 store 自带 getState 句柄）。对比 MobX 必须经 root 组装注入：Zustand 靠模块系统天然 DI（import 图=依赖图），测试时 mock 对方模块即可。代价：依赖关系藏在 import 里，架构边界要 lint 规则（import 白名单）兜——两套多 store 哲学，mobx-stores 的题在这有镜像答案。

### 14. (D) 设计『store 行为埋点中间件之前的裸机制』：不写中间件，用现有 API 给任意 store 加变更日志。

**来源**：转述自本课 subscribe 能力应用题

`const unsub = useStore.subscribe((s, p) => logger.push({ t: Date.now(), diff: shallowDiff(s, p) }))`——v4+ 的 subscribe 收 (state, prevState)，一处旁路即可全量记账，零侵入 store 定义。延伸讨论：为什么这是『中间件能做的事用 API 也能做』的样本（za-middleware 的机制预告）；diff 用浅比较列变化字段（可变快照制的福利：prev 与新 state 引用不同，能逐字段比）。

### 15. (C) 有人把 Zustand 叫『不可变版的 signal store』，这个说法对几成、错几成？

**来源**：转述自社区类比与 L6 预告

对：粒度与心智确实同构——selector≈computed（订阅面=比较面）、getState 直读≈signal.get、store 外可订阅≈effect，且都无 Provider/轻量。错：signal 的核心红利是惰性 glitch-free 计算图与表达式级更新，Zustand 是快照替换+组件级重渲、派生要手动 memo；称『signal store』容易误导读者以为有自动依赖追踪。公允版：Zustand 是『外部 store 复兴』浪潮与 signal 语义的并行发明，形似而机制异——L6 正式开庭。
