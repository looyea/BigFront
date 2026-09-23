# tc39-frameworks 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。覆盖提案在 Angular / Preact / Vue / Svelte / Solid 各家现状。

### 1. (C) 『Angular 支持 Signals』这句话，准确与不准确的理解分别是什么？

**来源**：https://angular.dev/guide/signals

准确：Angular 内建了语义与提案高度对齐的 signal/computed/effect API（17 引入、后续版本推为默认心智），且 Angular 团队深度参与提案生态。不准确：以为 Angular 引入了某个第三方 signals 库、或以为它就是提案的浏览器原生实现——实现是 Angular 自研的，与渲染变更检测深度耦合。

### 2. (A) Angular signals 为什么会与 zoneless 变更检测绑定在一起？

**来源**：https://angular.dev/guide/signals

传统 Angular 靠 zone.js 拦截所有异步源后做全树脏检查，粗且有性能税。signal 写入时能把『哪块状态变了』精确报告给视图层，渲染器只标脏、只检查受影响节点——这正好补上『没有 zone 之后怎么知道该检查什么』的缺口。所以 signals 是 zoneless 迁移的发动机，一件状态原语顺手改写了框架的变更检测模型。

### 3. (C) @preact/signals-core 与 @preact/signals 是什么关系？为什么值得单独发一个 core？

**来源**：https://github.com/preactjs/signals

core 是框架无关的纯 signal 实现（约 4KB）：signal/computed/effect batch 全在；官方包把它的读取接进 Preact 渲染（模板里放 signal 自动解包订阅）。单独发 core 的意义：证明 signal 语义可以脱离 Preact 存在——于是出现 signals-react、在 Node/Svelte 里当普通状态容器等用法，也是提案『实现可移植』论点的活广告。

### 4. (B) 你在 React 项目里引入 @preact/signals-react，同事以『破坏 React 心智』反对，怎么评估？

**来源**：转述自 signals-react 与 React 团队的公开争论

争议实质：signals-react 用 babel 编译器改写组件内 signal 读取，更新时可跳过组件函数重渲直接改 DOM 文本——收益是细粒度高性能；风险是绕开『UI=f(s)』契约后，任何依赖纯重渲的生态（memo 心智、时间旅行调试、并发渲染）都可能被打穿。评估路径：小范围性能热点引入带开关、团队统一心智文档、盯 React 官方并发路线；这不是对错之争是风险偏好之争，答题给出决策框架比给结论加分。

### 5. (C) Svelte 5 runes 为什么需要编译器？纯运行时的 @preact/signals 做不到吗？

**来源**：https://svelte.dev/blog/svelte-5-rethinking-reactivity

两者路径不同都成立。Preact 路线：显式容器（signal 对象、.value 读写），运行时订阅，无需编译器；Svelte 路线：作者体验优先——`let count = $state(0); count++` 看起来是普通变量，靠编译器把每个读写改写为 `signal.get/set` 调用（赋值追踪在 JS 运行时无法拦截，必须编译期）。代价是脱离编译器不能写 runes，收益是零样板语法。

### 6. (A) 为什么 JavaScript 运行时拦截不了 `count++` 这种写入，而 getter/setter 可以拦截 `.value = x`？

**来源**：转述自 Svelte 5 博客与提案 FAQ 关于语法层的讨论

`count++` 作用在裸标识符上，JS 没有变量级写钩子（Proxy 只能代理对象属性）；而 `count.value++` 是属性读写，对象 setter 天然可拦截。这就是三家分岔的根因：Preact/Solid/Vue 选择『显式容器+属性/函数语法』，Svelte 选择『编译器给裸变量造钩子』。提案接受两种形态共存，因为它标准化的是语义不是语法。

### 7. (C) Vue 3 响应式与 signal 系的关系：『同构但不同源』展开说说。

**来源**：https://vuejs.org/guide/essentials/reactivity-fundamentals

同构：ref≈signal、computed≈computed、watchEffect≈effect，惰性派生+自动追踪+批量调度俱全。不同源：Vue 基于 Proxy 的依赖收集体系 2019 年已成型（比提案早），强项是把 reactive 对象『深度自动响应』，而 signal 派坚持显式容器；Vue 未跟进任何改名对齐。加分句：提案对 Vue 的实际意义主要是 interop 话题里的互相承认，而不是 API 迁移。

### 8. (B) 技术选型会上有人说『选 Angular 因为 signal 是标准，选 React 会被淘汰』，你如何纠偏？

**来源**：转述自 L1 sig-map 需求反查法

两处偷换：其一，signal『标准』目前只是 Stage 1 语义共识，没有任何一家依赖它做生死决策；其二，状态原语的标准化不代表应用架构栈的胜负——React 生态照样能通过 Zustand/interop 用上 signal 语义。正确问法回到需求：团队栈、性能画像、数据形态（L6 sig-scenarios 决策树）——框架选型从『哪个原语更新』出发是最危险的理由。

### 9. (D) 设计一个 React+Vue 双栈中台的共享状态层，signal 在其中扮演什么角色？

**来源**：转述自 L1 挑战题与本包 sig-capstone

以 @preact/signals-core（或提案形状 polyfill）为『语言无关的状态内核』：业务状态与派生逻辑全写在 core signal 上；React 侧经 useSyncExternalStore 桥一个订阅（每组件一 snapshot effect），Vue 侧用 customRef/shallowRef 把 .value 直通。收益：一份领域逻辑两种渲染栈消费；成本：绑定层要自己维护到提案互操作成熟。这是『语义层统一、API 层各表』的现实样本。

### 10. (A) 各家 signal 实现的『批处理/调度』差异会带来什么真实体感差别？

**来源**：https://github.com/signaljs/proposal-signals（non-goals 讨论）

同一事件内连续写：Preact/Solid 效果在微任务或同步点统一 flush，Vue 走 nextTick 队列，Angular 默认与变更检测节奏挂钩（可 markAncestorsToCheck 后统一跑）。体感差别在：DOM 更新时机（同步 vs 微任务 vs tick 后）、读到中间值的窗口、effect 触发频率。跨库联调时这些差异就是『明明 set 了界面没变』类 bug 的土壤——学语义也要学它家的 flush 时机。

### 11. (B) 把一个 Preact signal 直接传进 Vue 组件当状态用，会发生什么？正确做法？

**来源**：转述自 interop 适配器生态（signal-cookbook）

不会联动：Vue 的 Proxy 追踪不认识 Preact signal 的 .value getter 调用约定，读一次拿快照，之后 Preact 侧写信号 Vue 毫无感知。正确做法：写适配——customRef 包一层（Preact signal subscribe → Vue trigger，Vue set → Preact signal.value 赋值），或直接用现成 interop 包。这题考的是『响应式不认门牌号只认协议』的直觉。

### 12. (C) 把五家读写形态一次性背下来：polyfill / Preact / Solid / Angular / Svelte runes。

**来源**：转述自本课对照表

polyfill：count.get 读、count.set = v 写；Preact：count.value 读写；Solid：count() 读、setCount(v) 写；Angular：count() 读、count.set(v)/count.update(fn) 写；Svelte：let c = $state(0) 后直接 c++（编译器代打）。面试金句收尾：形态五种、语义一部——惰性、读即订阅、glitch-free 全都一致。

### 13. (D) 面试官问『Signals-first 的 Angular 长什么样』，用两段代码外各讲三个工程含义。

**来源**：https://angular.dev/guide/signals

① 模板绑定自动追踪：模板读 signal 即订阅，组件不再无脑全量重检；② writable signal + computed 链替代大部分 ngrx 场景（配套 @ngrx/signals 库把 store 模式也 signals 化）；③ 异步封装 signalQuery/resource 把『请求态』做成一等公民——注意这与 React Query 的分层思想殊途同归（呼应 sig-server）。信号：原语层的标准化正在向上改写 store 层设计。

### 14. (A) 提案的『非目标（non-goals）』里为什么不规定调度器与批处理算法？

**来源**：https://github.com/signaljs/proposal-signals

调度器（何时 flush、effect 优先级、同步性）与各宿主框架的渲染模型强耦合——Angular 的 tick、React 的并发 lane、Solid 的微任务队列无法也不该被一个语言提案统一。提案只锁定可移植的部分：值语义与订阅语义。理解 non-goals 才能读懂标准化的边界：宪法管权利和义务，不管各州行政流程。

### 15. (D) 一年后你给团队做 signal 技术雷达，本课内容如何转化为三条环评？

**来源**：转述自 L9 sig-roadmap 预热

Adopt：Angular 项目 signals-first、非框架场景 @preact/signals-core 做领域状态；Trial：React 中台以 useSyncExternalStore 桥 interop 层试点、signal 形状 polyfill 进新模块；Assess/Hold：为了『赶上标准』重写存量（无收益风险）、把 signals-react 编译器玩法用于全量业务组件（心智争议未收口）。雷达模板的价值：把『框架新闻』翻译成『风险预算』。
