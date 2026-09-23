# tc39-core 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。覆盖 TC39 Signals 提案核心三件套。

### 1. (A) 请介绍 TC39 Signals 提案目前标准化到了什么程度、标准化了什么。

**来源**：https://github.com/signaljs/proposal-signals

提案处于 Stage 1，核心交付是三件套的 API 形态（signal/computed/effect）、响应语义（惰性求值、自动依赖追踪、glitch-free 即时一致）以及跨实现的互操作契约（统一 Signal 接口让不同库的 signal 可互相读取）。语言引擎内置没有时间表，但参照实现 signal-polyfill 已可作为 npm 包在生产使用。加分点：说明『先统一语义、再谈内置』的路径判断。

### 2. (A) signal、computed、effect 各自的职责边界是什么？

**来源**：https://github.com/signaljs/proposal-signals

signal 是当下值容器（读可追踪、写会广播）；computed 是惰性派生值（只在被读且依赖脏时执行，产出新的可追踪读取）；effect 是响应式世界到命令式世界的出口（运行副作用、建立真订阅、返回 dispose 函数）。边界口诀：值进 computed、事进 effect、容器放 signal。

### 3. (A) 什么是『推标记、拉计算』？它解决了什么问题？

**来源**：转述自 L1 sig-paradigms 与提案语义

写 signal 时不立刻重算任何派生值，只把下游依赖标脏；真正的重算延迟到有人读取时才发生。解决的问题有二：无人消费的派生链白算（性能），以及同一事件内多次写入导致的中间态暴露与重复执行（正确性）。effect 是唯一的『主动拉』方——调度器在写入后安排脏 effect 重跑。

### 4. (A) glitch-free（即时一致）是怎么做到的？举一个非 glitch-free 系统的翻车例子。

**来源**：转述自 signals 系列技术博客对依赖图更新一致性的讲解

a、b 连续变化后读 sum，依赖图通过『先全部标脏、读取时自顶向下确认版本再计算』保证要么全旧要么全新。反例：朴素发布订阅——a 变触发一次打印（b 还是旧值）、b 变再触发一次，中间出现两个『半更新』瞬间（glitch）。面试延伸：RxJS 多源 combineLatest 默认同样有 glitch，需要审计。

### 5. (B) 裸用 signal-polyfill 时最容易泄漏的资源是什么？怎么治理？

**来源**：https://github.com/signaljs/proposal-signals

effect 的订阅。它返回 stop 函数，如果不保存不调用，effect 会永远挂在依赖图上（回调闭包连带组件引用全保活）。治理：封装作用域（effect_scope / 框架生命周期钩子），在组件卸载或路由销毁的确定时点调用 stop；computed 若无人读不会泄漏，但也会被上游长期持有引用，重大对象注意及时断开。

### 6. (B) 代码审查时发现 `count.set = count.get + 1` 写在 effect 里，你判断有什么问题？

**来源**：转述自提案 FAQ 关于循环更新的约束

effect 里读 count 即订阅 count，随后又写 count，写入再次触发本 effect——形成循环更新，实现要么栈溢出要么报警终止（『读即是订阅』的自伤姿势）。修法：自增逻辑挪到事件回调等命令式位置；确实要派生状态则改用 computed 表达『值』而不是 effect 表达『事』。

### 7. (B) computed 函数体里有条件分支（if 走了 A 分支），下一轮走 B 分支时 A 分支读过的 signal 还会触发重算吗？

**来源**：https://github.com/signaljs/proposal-signals

不会。依赖是每次执行时动态重建的：本轮读了谁就依赖谁，A 分支的旧依赖自动解除。这是自动追踪优于静态 deps 数组之处（useMemo 手写字面依赖做不到的动态收窄）。但反向坑是：分支条件本身必须被读到，隐依赖变化而无人读时惰性 computed 不会预知。

### 8. (C) signal-polyfill、@preact/signals、Solid 的 createSignal 三者在 API 形状上有什么区别？语义呢？

**来源**：https://github.com/signaljs/signal-polyfill

形状：polyfill 用 `.get` 属性读写对（count.get / count.set = v）；@preact/signals 用 `.value`（count.value）；Solid 的 signal 本身是 getter 函数（count() 读、setCount(v) 写）。语义：三者都是惰性、自动追踪、glitch-free 的同一族语义，Solid 的调度器与细粒度更新是其独有工程实现。一句话：形状各异、宪法同一部。

### 9. (C) 为什么说提案的部分语义基因来自 Solid？这带来什么争议？

**来源**：转述自社区综述，提案仓库 https://github.com/signaljs/proposal-signals

提案冠军与参考实现作者多出自 Solid/Preact 阵营（SolidJS 作者 Ryan Turner 深度参与），其『signal 是一等公民、框架只是渲染消费者』的世界观直接投射进提案语义。争议在于：以 React 虚拟 DOM 心智主导的社区担忧『组件级重渲』与『表达式级更新』两种模型谁能代表未来。面试答题姿态：讲清血统、不下宗教结论。

### 10. (C) Vue 3 的 ref/computed/watchEffect 与提案三件套概念同构吗？为什么 Vue 不参与对齐？

**来源**：https://vuejs.org/guide/essentials/reactivity-fundamentals.html

概念高度同构（ref≈signal、computed≈computed、watchEffect≈effect），但 Vue 的响应式建立在自研 reactivity 系统（Proxy 依赖收集）上且早于提案成型，API 命名、.value 规则、批量调度（nextTick）都已自成生态，对齐收益小、迁移成本高。Vue 团队对提案的态度是『关注但不跟进改名』。加分：这正是『标准化语义易、标准化实现难』的实例。

### 11. (D) 给你一个不用任何框架的后台组件（实时仪表盘），用提案三件套设计状态层。

**来源**：转述自本课练习

数据源写入 signal（每秒行情 set 一次）；面板派生值全部 computed（涨跌幅、格式化文本）；渲染出口只有一层 effect 写 DOM 文本；跨面板共享放模块级 signal 单例。论证要点：粒度天然到表达式、写一次广播一次无中间态、effect 数量=DOM 触点数量便于审计。

### 12. (D) 如果提案明天到 Stage 3，你的现有 Zustand/Redux 应用要改吗？

**来源**：转述自 L6 sig-scenarios 选型框架

不必恐慌式重构。Stage 3 落地的是原语层，store 组织、action 语义、持久化/中间件生态都在其上——原语换血不等于应用架构换血。现实路径：新模块试 polyfill/interop 包、selector 保持纯函数以便日后平移、观察 @reduxjs/toolkit 与 Zustand 官方是否发布 signals 绑定层（L5、L6 详述）。

### 13. (A) effect 和 computed 都在函数体里读 signal，两者行为有什么本质区别？

**来源**：https://github.com/signaljs/proposal-signals

读取机制相同（都登记依赖），下游不同：computed 的『执行』产出值并缓存，是否重跑取决于将来是否有人读（惰性）；effect 的『执行』本身就是目的，依赖变则被调度器安排重跑（主动）。记法：computed 回答『值是多少』，effect 回答『该做点事』。

### 14. (B) 如何在控制台快速验证一个实现是『惰性』的？

**来源**：转述自本课实验

在 computed 函数体里加 console.log 或 counter++，然后连续写上游多次而一次都不读派生值——日志应为 0 行；再读一次派生值，日志恰好 1 行。若每次写都打日志，该实现是 eager（提前计算型），语义上更接近 MobX 默认 reaction 或 Angular 的某些模式，选型时要小心这一差别对大计算图的成本影响。

### 15. (C) 有人断言『Signals 会取代 Redux 和所有状态库』，请从分层角度评述。

**来源**：转述自社区论战文章（如《Why Signals Will Replace Redux》一类观点文及其反驳）

混层了。Signals 是原语层（如何高效表达『会变的那个值』），Redux/Zustand 是 store 组织层（单一真相源、action 流水、时间旅行、中间件生态）。历史证明每代方案互相吸收（L1 sig-landscape），Redux 的订阅机制本就可以建立在 signal 上，Zustand 的 selector 已是『手动版 computed』。原语变标准是好事，『取代应用层库』是把宪法说成了政府。
