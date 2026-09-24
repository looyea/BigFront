# ng-zoneless 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕 zone.js 工作原理、zoneless signal 通知取代脏检查、markForCheck 兜底与 effect/afterNextRender 调度的题组。

### 1. (A) 用 80 字给非前端同事解释 zone.js 做了什么。

**来源**：转述自本关 §一 zone.js 时代变更检测流程图

zone.js 劫持了浏览器所有异步 API（定时器/Promise/事件），任何异步操作完成时它告诉 Angular『有事情发生了你检查一下页面要不要更新』。Angular 收到通知后从根组件开始遍历整棵组件树，发现哪个数据变了就更新对应的 DOM。好处是全自动，坏处是哪怕只有一个小数字变了也要检查所有组件。

### 2. (A) zoneless 模式下 ApplicationRef.tick() 还会被调用吗？谁来调度？

**来源**：转述自本关 §二 zoneless 精确通知流程与 §七澄清段

仍然调用——zoneless 不是没有变更检测。调度者从『zone.onMicrotaskEmpty 事件』变成『signal 写后的微任务 drain』：signal.set() → 标记订阅者脏 → schedule 一个微任务 → 微任务 drain 时 ApplicationRef.tick()（或等效的增量刷新）执行 → 只处理标脏的绑定。tick 频率从『每次异步完成』降到『有 signal 写且微任务 drain 时」——调用次数大幅减少。

### 3. (B) 同事从 zone.js 模式切到 zoneless 后，第三方图表库（ECharts）的回调里 `this.selectedData = newPoints` 视图不更新。给两行修法与一条长期建议。

**来源**：转述自本关 §四 markForCheck 兜底段

修法一（快）：`this.selectedData = newPoints; this.cdr.markForCheck();`（注入 ChangeDetectorRef）。修法二（好）：`selectedData = signal<Point[]>([]); ... chart.onClick = (points) => this.selectedData.set(points);`——用 signal 写替代普通赋值。长期建议：把与第三方交互的回调**全部包成 signal 写**——zoneless 世界不认识普通属性突变；用 signal 统一数据入口是根治方案。

### 4. (C) zoneless+signal 的变更检测与 SolidJS 的『无 CD 概念』有什么本质差异？

**来源**：转述自本关 §二与 13 包 solid-internals 对比（呼应 solid-internals、solid-signals）

Solid 没有 ApplicationRef.tick() 这一层——createSignal 写→精确 createEffect/JSX 表达式回调直接跑→DOM 操作在**同一微任务**里完成（无『检查谁脏』的中央调度步骤）。Angular zoneless 保留了一个**增量刷新调度**：signal 标脏→微任务 drain→ApplicationRef 集中处理本轮所有脏 signal→执行 effect+模板更新。差异根源：Solid 编译器让每个 JSX 表达式自己管订阅（去中心化）、Angular 框架层集中调度（ApplicationRef 是中央管理器）。应用层效果相似（都是精确更新），但 Angular 保留了集中调度的好处：批处理更确定、DevTools hook 可追踪本轮刷新了哪些。

### 5. (D) 面试官问『你怎么评估一个工程能不能切 zoneless』——给五条检查项与各自的 blocker 级别。

**来源**：转述自本关 §三 checklist 段与 §四非 signal 路径

五条：① **状态全 signal 化？**（blocker——大量普通属性突变 = 切后白屏）；② **第三方库回调是否写 signal？**（blocker——不写要全加 markForCheck）；③ **是否有 setTimeout/setInterval 里直接改视图数据？**（blocker——zoneless 不捕获这些）；④ **AsyncPipe 使用密度？**（中——改 toSignal 工作量大但有自动化工具）；⑤ **测试 detectChanges 依赖度？**（低——改 whenStable 是机械替换）。判据：1-3 是 blocker 必须先解决、4-5 是成本项可评估。

### 6. (A) eventCoalescing（v18 引入的 zone 模式优化）与 zoneless 的关系是什么？

**来源**：转述自本关 §一 zone.js 时代的全树扫描问题

eventCoalescing 是 zone 模式的**中间优化**：同一个帧内的多次异步事件（如 click+mouseover+setTimeout 同帧完成）合并成**一次** ApplicationRef.tick——减少全树扫描次数。zoneless 是**终极优化**：不合并而是**取消全树扫描本身**——每个 signal 独立通知自己的订阅者。eventCoalescing 是『从 100 次扫描降到 1 次』、zoneless 是『从 1 次全扫描降到 0 次全扫描』——后者是前者的终态方向。v21 zoneless 默认后 eventCoalescing 配置无意义了。

### 7. (B) 切 zoneless 后单测全部通过但 E2E（Playwright）里点击按钮后断言失败——视图延迟了一帧才更新。为什么？

**来源**：转述自本关 §五 effect 调度时机与 §三测试迁移

zoneless 下 signal.set → 微任务调度 → 视图更新在**下一个 microtask drain**。单测里 `await fixture.whenStable()` 等了微任务。E2E 里 Playwright click → 页面 JS 里 signal.set → 微任务没 drain 完 Playwright 就断言了。修法：E2E 里 click 后加 `await page.waitForTimeout(0)` 或 Playwright 的 `expect(locator).toHaveText(...)` 自带 auto-retry（推荐用 web-first assertions）。本质：zoneless 的视图更新不再是同步的。

### 8. (C) Vue 3 的 scheduler（nextTick）与 Angular zoneless 的微任务调度有什么异同？

**来源**：转述自本关 §二与 Vue reactivity 对比（呼应 vue-reactivity-theory）

相同：都是**异步批处理**——响应式值变→标记→微任务 drain→统一更新 DOM。不同：① Vue 用 `Promise.resolve().then()` 调度 nextTick 跑 flushJobs（组件级更新队列）；Angular 用 signal 的内部 scheduler + ApplicationRef.tick；② Vue 的 flushJobs 有 **pre/post 队列**（watch 先于渲染）；Angular 的 effect 在微任务里、afterNextRender 在渲染后——两者类似；③ Vue 没有 markForCheck 概念（所有组件都是『精确的』——proxy get 拦截建立订阅）；Angular zoneless 仍保留显式 signal 边界——非 signal 不通知。

### 9. (D) 设计一个迁移自动化方案：把 200 个组件从 zone.js+OnPush 切到 zoneless，哪些可以 codemod、哪些必须人工？

**来源**：转述自本关 §三 checklist 在大规模迁移中的应用（呼应 sig-migrate）

可 codemod：① 删 app.config 里 provideZoneChangeDetection（或加 provideZonelessChangeDetection v20-）；② polyfills 里删 zone.js；③ 把 @Input/@Output 转 input()/output()（signal-input-migration schematic 已有）；④ AsyncPipe→toSignal 的机械替换（grep + regex）。必须人工：① ngOnChanges 里的副作用逻辑→effect 改写（需理解业务语义）；② 第三方回调里的普通属性赋值→signal.set（要改接口）；③ setTimeout 里的逻辑（要包 signal 写或 markForCheck）；④ 复杂 RxJS 管道组件（保留 or 桥需决策）。节奏：先自动后人工，自动 PR 过 ng build（类型检查）、人工 PR 过 E2E（视觉回归）。

### 10. (A) afterNextRender 的 write/read/mixedRead 三阶段设计灵感来自哪里？在 zoneless 下它解决了什么问题？

**来源**：转述自本关 §五 afterNextRender 用法段

灵感来自浏览器渲染流水线的三阶段：**Read**（读布局/尺寸）→**Calculate Style**→**Write**（改 DOM/触发重排）。分三阶段是为了避免 read-write 交替导致的 **layout thrashing**（强制同步重排）。zoneless 下 afterNextRender 解决的是：① DOM 操作要在 view attach 之后（constructor/ngOnInit 时 DOM 可能还没上树）；② 不依赖 zone 的 onStable 通知（旧 ngAfterViewInit 时机等价保证）；③ 微任务调度后组件视图已更新到真实 DOM。phase 参数让你声明回调是 read 还是 write——框架按序编排避免 thrashing。

### 11. (B) zoneless 下 markForCheck 仍然能工作吗？它的调度路径是什么？

**来源**：转述自本关 §四 markForCheck 兜底段

能工作。路径：`cdr.markForCheck()` → 标当前组件到根路径为 dirty → 如果本轮无 signal 写触发的调度，框架仍需一个 tick 来跑——zoneless 下 markForCheck 触发 `ApplicationRef.tick()` 的微任务调度（与 signal 写相同的微任务入口）。效果：下一次微任务 drain 时 dirty 组件被检查→更新 DOM。与 zoneless 前的区别：不再遍历全树只查标脏路径。性能：比 signal 精确通知慢（多一次增量检查）、比 zone 全树快（不扫无关组件）。结论：**能用但应尽量避免**——signal 才是 zoneless 的快车道。

### 12. (C) 为什么 Angular 的 zoneless 比 React 的 React Compiler 自动化更彻底？两条路线各自的核心赌注是什么？

**来源**：转述自本关 §二精确通知与 React 优化策略对比（呼应 react-render-model）

Angular zoneless 赌注：**数据源是显式的（signal）→通知路径可静态确定→去中心化订阅精确到每个绑定**。只要所有数据走 signal，视图更新完全不需要遍历/检查/比较。React Compiler 赌注：**数据源仍是隐式 state（useState）→编译器通过分析 hooks 依赖图自动插入 memo→减少不必要的子树重渲染但无法完全消除**。差异：React 即使 Compiler 全开仍需『render → diff → commit』三步（虚拟 DOM 模型固有）；Angular zoneless 跳过 diff 直接写 DOM。React 的自动化是『减少不必要的 render』、Angular 的自动化是『消灭 render 本身』。

### 13. (D) 面试官给一段 v20 工程代码里有 3 处 `setTimeout(() => this.value = 'x', 0)` 和 1 处 `setInterval` 里 signal.update——问切 zoneless 后哪些正常、哪些要改。

**来源**：转述自本关 §三迁移 checklist 与 §四非 signal 路径

分析：① `setTimeout(() => this.value = 'x')`——value 是普通属性→zoneless 不认识→**视图不更新**→3 处都要改成 `this.value.set('x')`（value 先声明为 signal）；② `setInterval(() => this.count.update(c=>c+1))`——**正常**：setInterval 回调在 zoneless 下不被拦截没问题，signal.update 会触发通知→视图自动更新。一句话：**谁写值（signal vs 普通属性）决定能不能触发更新，异步 API 类型不影响 signal 通知链**。

### 14. (A) 本关说 dev mode 下 zoneless 有『单通道无需二次验证』的性能优势——解释这个差异。

**来源**：转述自本关 §六性能对比表 dev mode 行

zone.js 模式 dev 跑**两遍**脏检查：第一遍正常更新、第二遍再检查一遍看有没有『检查后又有值变了』（ExpressionChangedAfterItHasBeenCheckedError 的来源）——这是 zone 全树扫描无法证明一致性的兜底。zoneless 下：signal 写→微任务 drain→更新→**没有第二遍**——因为 signal 的写入是原子的（一个 set 内完成）、不存在『检查期间又有别的异步改值』的竞态（所有 effect 已排好序）。dev 与 prod 行为一致、性能翻倍。加分：zoneless 下如果 markForCheck + 在检查回调里又写 signal——框架检测循环并 warn（替代旧 ExpressionChanged 报错）。

### 15. (D) 设计一个『变更检测性能审计工具』：帮团队发现哪些组件的 signal 订阅者过多、哪些仍有非 signal 突变。给出采集指标与展示方案。

**来源**：转述自本关 §六性能变化与 DevTools hook（呼应 sig-perf、ng-perf）

采集指标：① **每个 signal 的下游订阅者数**（computed/effect/模板绑定 count）——超 50 标黄（扇出爆炸）；② **非 signal 属性被模板读取后 markForCheck 次数**——高则该组件仍是 zone 遗留模式；③ **effect 执行频率**（每秒跑几次）——高频可能 signal 过粗或缺 debounce；④ **每轮 microtask drain 的 dirty signal count**——全局健康度。展示：Angular DevTools 扩展——选组件时 overlay 显示其 signal 图（输入→computed→输出）+ 订阅者数；全局 dashboard 按页面分桶列 Top-20 热点。实现：利用 Angular 内部 SignalNode 链表（`@internal` API）+ monkey-patch signal.set 计数器——工具层非侵入。
