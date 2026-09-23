# sig-debug 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。覆盖四家调试装备、审计日志设计与线上排障。

### 1. (C) 四家各派一个代表工具回答『谁改了状态』，并说出各自的实现原理一句话。

**来源**：转述自本关 §二至 §四

Redux/Zustand：DevTools Action 日志——每次 dispatch/set 本来就该带语义标签，日志是变更通道的副产品；MobX：enforceActions 围栏+Proxy setter 断点——不记历史，把违规写入当场击毙在栈上；RxJS：marble 测试+rx-devtools——时间线在测试里重演，运行时面板只做旁观；signal 框架：devtools 图面板（Angular/Preact）——依赖图+写入订阅者的可视化。四种路线（日志/围栏/时间机/图）各答一遍同一问，这题在考你是否只在一个生态里待过。

### 2. (A) 为什么『给 set 第三参打标签』这种土办法被本关列进通用三板斧第一位？它的信息论依据？

**来源**：转述自本关 §五与 za-middleware 实践

trace 栈能答『哪行代码』但答不出『业务语义』（同一 setter 被五个场景复用）；标签是**写代码的人向查代码的人预留的语义指针**——信息论上这是唯一不可后推导的量（调用栈可重建意图的丢失信息）。成本=每 set 一个字符串，收益=日志从『state diff 天书』变『动作时间线』。工程加分表述：标签命名法要成规范（`域:动作`，如 `coupon:apply`），可 grep 可聚合——土办法用成制度才是三板斧。

### 3. (B) MobX 应用线上偶发错值，开发环境 enforceActions 全绿也没抓到，给两条升级手段。

**来源**：转述自可变系调试补课实践

① `onBecomeObserved`/`onBecomeUnobserved`+`spy` 事件流：MobX 全局 spy 记录所有 observable 变更（类型/路径/新旧值），线上降级为环形缓冲采样，反馈时导出——把『围栏』升级成『账本』；② 嫌疑字段单点埋雷：`observable.box` 包一层 Proxy 或 `intercept` 注册（拦截特定对象写入，异常时带栈上报）——intercept 的取消语义顺便回答『哪来的非法写』。教训句式：strict 模式防的是『不该有的写』，偶发错值要查的是『合法但错误的写』——两种 bug 要两种装备。

### 4. (D) 用 TestScheduler 给『搜索框：300ms 去抖+连续输入 abc 后停顿』写一条完整 marble 用例（含帧换算说明）。

**来源**：转述自本关 §三练习的笔试版

输入：`cold('---abc--------|')`——a@帧3、b@帧4、c@帧5（彼此间隔 10ms<去抖窗），complete@帧14；debounceTime(30)：a/b 被新值重置吞掉，c 的窗口到 80ms 无新值→输出@帧8；无 pending 时 complete 透传@帧14。`expectObservable(src.pipe(debounceTime(30))).toBe('--------c-----|')`（8 横杠后 c、再 5 横杠后 |）。换算说明必写：1 帧=10ms、所有事件必须落整数帧（否则测试假绿/假红）。这题面试官看三点：帧算对不对、complete 位置懂不懂、注释里有没有把换算讲给同事听。

### 5. (A) Redux DevTools 的『单步 dispatch 重放』为什么对 RxJS 驱动的状态更新不成立？

**来源**：转述自重放机制对流/副作用的不适用

重放的前提=**状态=f(action 序列) 的纯函数**：Redux reducer（及 Zustand 的确定性 set 链）满足，重放即重建；RxJS 更新由**时间、外部事件源、可变闭包（switchMap 取消语义依赖 in-flight 状态）**决定——重放 action 时间轴对不上真实事件时序，副作用（fetch/定时器）也不可重放。所以流系把确定性外包给测试（marble 虚拟时钟）而非面板。引申判据：**状态系统的可调试性≈可确定重放性**，给 sig-internals 埋点（自研 mini-signal 要不要留重放钩子）。

### 6. (B) 团队只开了 React DevTools Profiler 排查『MobX 页面卡顿』，本关观点为什么装备不足？补哪两件？

**来源**：转述自 mobx-react 调试链与此题干事故

Profiler 只答『哪些组件渲了多久』，不答『为什么渲』（MobX 重渲由字段读取驱动，React 视角看不到依赖边）。补：① `why-did-update`/mobx 插件的渲染原因打印（把『读的哪个 observable 变了』递到眼前——答『怎么传的』）；② MobX DevTools/`configure`+spy 看动作与反应时序。同类题眼：**框架自带面板的抽象层级≠状态库的抽象层级**，跨层 bug 必须跨层装备——Angular zoneless+signals 调试同理。

### 7. (C) 把『时间旅行面板』『strict 围栏』『marble 断言』『审计日志上报』按『证据留存时机』排个序，说明各自适用的 bug 类型。

**来源**：转述自本关 §六心法的四分法

排序（开发期本地→生产远端、事发前→事发后）：marble（**事前**固化预期，防时序回归）→ strict 围栏（**事中**拦截违规，当场栈）→ 时间旅行（**事后**本地回放，限可重放系统）→ 审计上报（**事后**远端取证，线上偶发唯一解）。每层防的 bug：时序错、越界写、逻辑错值、环境偶发——四层全上才是完整防线，单押任何一层都有盲区（本关统一心法的矩阵化表达）。

### 8. (D) 为 Zustand store 设计 40 行内的『生产审计环』：环形缓冲+脱敏+崩溃时导出。说出三个设计决策。

**来源**：转述自本关 q10 与 za-middleware q13 的合体实施

骨架：`subscribe((s,p)=>ring.push({t:Date.now(), diff:shallowDiff(s,p), tag:currentTag}))`，cap=200；决策：① 只存**浅 diff 与标签**不存全量快照（内存上限可控+脱敏天然——白名单字段才进 diff）；② 崩溃钩子（window error/unhandledrejection）里 `navigator.sendBeacon` 导出整环——事发前证据比事发后 dump 值钱；③ 环上覆盖策略丢旧保新，但保留最近一次 `clear/登录` 类里程碑事件（钉住起点）。加分点：与 devtools 的分工（本地全量 GUI vs 远端采样账本）。

### 9. (A) Solid devtools 的 owner 树与 effect 泄漏排查、MobX 的 finalizer、Zustand 的手动 unsubscribe——三家生命周期调试各自靠什么机制？

**来源**：转述自三家生命周期文档

Solid：owner 层级=dispose 树，devtools 直接可视化『谁该在哪一层被销毁』，泄漏=树上还在而逻辑已死；MobX：作者引用计数+FinalizationRegistry（GC 回收 observable 时 reaction 自动停），调试看『该死的没死』要靠 reaction 列表长度监控；Zustand：无所有权概念，退订责任在调用方——泄漏排查=自己维护订阅登记表（包装 subscribe 记账）。机制强弱排序 Solid>MobX>Zustand，代价是锁定度递增——生命周期调试是框架内置响应的隐形税单，sig-scenarios 保留地议题的又一面。

### 10. (B) 同事在 Angular 组件里 `effect(() => { console.log(this.user()) })` 调试后忘了删，线上引发连锁问题，指出问题与检测手段。

**来源**：转述自 Angular effect 滥用社区案例

问题：effect 建立了 user→该回调的订阅，每次 user 变即跑；更糟是回调里再读信号触发写入路径时撞『after signals updated』防护报错/循环。检测：① effect 数量 lint 规则（禁裸调试 effect 合入）；② Angular DevTools signals 图看新增依赖边；③ 开发期 `untracked()` 包调试读取（写日志不该建订阅——tc39-control 三控制阀在调试现场的复用）。本题题眼：**调试动作本身也是订阅动作**——加探针前先问『它在依赖图里留没留边』。

### 11. (C) 为什么『可序列化 state』被 Redux 奉为铁律而调试端回报最大？MobX/signal 各怎么补课？

**来源**：转述自三家序列化与调试对照

回报三连：快照可 diff（字段级变化视图）、可传输（复现器/审计上报零适配）、可持久（时间旅行+localStorage 调试桩）——不可序列化对象（函数/DOM/class 实例/Proxy）会把这三样逐个卡死。MobX 补课：toJS 出境快照+spy 事件账（不传对象传事件）；signal 系：.get 取值即序列化点（容器本身可 JSON 化的设计约束，提案 equals/get 分离的隐性红利）。一句话：**序列化不是洁癖，是调试与观测的地基**——za-middleware q14 的『存储只过值』是它的持久化分册。

### 12. (D) 面试官要求『不看面板，只用断点与 console 三板斧』现场定位：Zustand 页面某字段偶发被重置为初始值。给操作剧本。

**来源**：转述自本关 §五的实战编排

① 入口断点：`setState`/set 包一层条件断点（`partial[field]===初始值` 时停）——抓现行；② 标签考古：全局 grep 该字段的 set 调用点，给每处临时打标签（三板斧①的现场应用），复现路径上读日志定嫌疑；③ 切片复现：把嫌疑 action（常见：persist rehydrate 覆盖、测试桩、路由守卫重置）剥进单文件验证。高频真凶预告：persist 异步 rehydrate 晚到覆盖初始写（za-middleware q6 时序病）、函数式 set 里误 spread 初始对象。本题给『工具链之外』的纯手工通关能力打分。

### 13. (A) Preact DevTools 对 @preact/signals 能看到 signal 树，而 React 生态同类可视化要引库——两家 devtools 架构差在哪？

**来源**：转述自两家 devtools 设计文档

Preact devtools 是**框架内建的钩子通道**（options 对象暴露 diff/commit 事件，扩展直连）——signal 视图顺势读框架反应图；React DevTools 靠 hack 协调器内部 fiber 结构，第三方状态库不在 fiber 视野内，只能各自桥接（Redux DevTools 走 store 侧通道）。推论：**可视化能力是架构开放度的函数**——本关『内置信号补课 vs 第三方最成熟』的深层原因：开放度与生态错位。答到这一层的候选人极少，注意展开。

### 14. (C) 把『调试体验』纳入 sig-capstone 的选型记分卡：给三个可操作指标。

**来源**：转述自本课与 capstone 设计联动

① 首次定位成本：埋一个已知错值，从发现到定位到肇事行的分钟数（分工具齐备/需自装/纯手工三档）；② 线上可观测性：能否在生产拿到变更证据链（审计日志/上报钩子），拿不到记 0 分；③ 心智泄漏检测难度：制造一个漏订阅/漏退订，工具是否主动报（Solid disposer 树、MobX 引用计数、Zustand 靠人肉）。三指标各 1-5 分入记分卡——把『调试体验』从形容词变数字，这题就是 capstone 报告里那一列的填法。

### 15. (D) 综合设计：你的自研 mini-signal（L9 见内核）要预留哪些调试钩子？在不牺牲 60 行轻量目标的前提下给三级配置。

**来源**：转述自 sig-internals 预研（本关心法的收官应用）

一级（常开，<10 行）：每个 signal/computed/effect 挂 `_name`+全局 `counter`（id 自增）——断点与日志可读的地基；二级（dev 开关）：`window.__signals = new FinalizationRegistry` 风格活体登记表+`inspect()` 打印依赖边（图可视化的人肉版）；三级（可选插件形态）：变更事件总线（`set` 时 emit {id, prev, next}）——面板与审计都只是它的消费者。设计纪律：钩子全部 `if (DEBUG)` 编译期可剔除、事件总线**默认关且环形缓冲限长**——『面板只是日志的 GUI』翻译成架构语言：内核只产日志，GUI 是外挂。这题同时是 L9 的验收单。
