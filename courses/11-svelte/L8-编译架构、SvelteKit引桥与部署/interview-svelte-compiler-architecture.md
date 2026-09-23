# svelte-compiler-architecture 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区深度文章高频主题的转述。

---

### 1. (A) "Svelte 没有 VDOM"——那它靠什么完成更新？请从编译产物层描述一次 count++ 之后发生的事。

**来源**：Svelte 官方文档与 FAQ — 编译器定位叙述的高频转述

编译期模板进 `$.template` 字符串、每个动态绑定拆成微 effect 并登记依赖；`count++` 触发信号写→标记依赖它的 effect 脏→微任务批量执行这些 effect→`$.set(text, ...)` 只改那一个文本节点。全程无虚拟树构建、无 diff。加分点：更新成本从"组件重渲"转移到"effect 数量与订阅维护"，所以 effect 泛滥是 Svelte 的性能反模式（呼应 L6 性能课）。

### 2. (A) $state 编译后就剩一个普通 let，那"响应式"到底是谁在管？runes 为什么被称为"编译器关键字"？

**来源**：Introducing runes 官方博客 — 语法非库的论证

编译器识别 `$state` 后：声明处还原为普通变量、**所有读写点**织入运行时信号操作（读要 `$.get` 登记依赖、写要标记脏）；对象/数组再配 Proxy 化与细粒度追踪。"关键字"含义：不能 import、不能赋值传递、只在合法位置生效——像 `async` 一样是语言层扩展，非法用法编译期直接报错，这是 runes 比运行时魔法更可静态分析的根因。

### 3. (A) hydration 在 Svelte 编译产物里是怎么做到的？为什么 SSR 模板里常见注释节点？

**来源**：Svelte 文档 SSR/hydration 章 + 社区对产物锚点的解剖文

带 hydrate 编译时，`$.template` 的克隆路径切换为"认领"：以注释锚点（区块边界标记）对位 SSR DOM，把已有节点接进组件树、跳过创建、只补挂 effect 与事件。注释是**对位协议的边界符**——服务端渲染写进去、水合时消费掉，类似 Vue 的 `<!--[-->`。追问点：认领失败（DOM 被扩展/脚本改过）会走降级重建并告警（呼应 08-nuxt 水合脆弱话题）。

### 4. (B) 同事把 Svelte 4 项目升 5，指着产物里再没有 create_fragment 说"编译器坏了没生成更新代码"。怎么解释，去哪自证？

**来源**：升级排障社区答疑精选 — 产物形态换代困惑

5 的 client 产物用 template+effect 模型取代 create/update/apropos 一族，更新代码没消失、换了组织形式。自证三步：playground 同一段代码切 4/5 版本对照 client 输出；`npm ls svelte` 确认编译器版本（mismatch 另有专坑，呼应 svelte-tooling 作业题）；跑一个交互看 DevTools Performance 里命中的是 effect 微函数。顺带科普：思想（定向更新）从 3 到 5 一脉相承，术语换代是断代线索。

### 5. (B) 有人说"产物里 $state 变成了普通变量，那我把编译后 JS 拿去全局搜 signal 搜不到，说明 Svelte 5 没上信号架构，官网在骗人"。错在哪？

**来源**：对内部实现命名的误读类社区争论的转述

信号实现就在运行时里，只是内部函数被 mangle/集中在 `svelte/internal/client` 模块，产物里以 `$.xxx` 短名调用；"变量是普通的"指**声明形态**，读写早被改写成信号访问。教训：验证架构要看行为（更新粒度、依赖追踪）与官方源码，而不是对压缩产物做字符串搜索（呼应 L6 内核课直接读 internal 源码的正确路径）。

### 6. (C) React 说"UI = f(state)"，Svelte 的产物结构说明它把这条公式改成了什么？

**来源**：跨框架范式对比高频论述的整合转述

Svelte 是"组件 = 一次搭建 + 一组定向修补函数"：f 只在挂载时跑一次建 DOM，之后由 state→effect 的边决定谁被调用。React 的 f 每次都重跑、由 diff 决定 DOM 动不动；Vue 介于中间（render 重跑但 patch flags 省对比成本）。加分点：这个差异决定了三家"什么时候贵"——React 组件树大且杂、Vue 深层级 render、Svelte effect 与订阅多。

### 7. (C) 运行时体积论：Svelte 的"框架基数"小，那它是不是必然比 React/Vue 首屏快？给出你的条件清单。

**来源**：bundle size 与真实性能关系的面经辩证题

不一定。框架基数小是**下限优势**，实际首屏还取决于：应用代码量（Svelte 无运行时兜底，动态表格类代码自己写出来了）、依赖图与分包（L10/10-vite 的 chunk 策略同一套）、SSR/预渲染与否、effect 初始化成本。诚实结论：交互密集且团队克制时优势明显；重度第三方生态场景（React 组件库海）换算成 Svelte 手写成本未必划算（呼应 svelte-performance、react-performance 选型章）。

### 8. (C) generate: client/server/customElement 三目标意味着"一份源码多形态"。React/Vue 有对应物吗？差在哪？

**来源**：编译器多后端架构对比（社区深度文主题转述）

React：同份 JSX 由 react-dom/server、react-native 渲染器、自定义 reconciler 消费——差异在**换运行时宿主**；Vue：`@vue/server-renderer` 同一运行时加字符串渲染、编译器有 `ssr` 模式。Svelte 独特点是差异发生在**编译目标层**：server 产物连 effect 模型都换掉（直接吐 HTML 字符串的渲染器），customElement 产物外包注册逻辑。一句话：框架派换宿主，编译器派换剧本。

### 9. (D) 设计一个 15 分钟的内部工作坊，让 React 老手亲眼相信"没有 VDOM"。列演示步骤与每步的"啊哈点"。

**来源**：技术布道/团队培训场景设计题（大厂内训面经变体）

①playground 打开 client 输出，指认 `$.template` 与 `$.set`（啊哈：DOM 操作明写在产物里）；②Performance 面板录一次状态更新，调用栈只见微 effect 无 diff/reconcile 帧；③同屏开 React DevTools Profiler 演示 re-render 与 Svelte 组件函数不再执行的对照；④故意写 1000 个 `$derived` vs 1000 个组件的 React 树，比较火焰图形状（啊哈：Svelte 的代价轴是 effect 数）；⑤收尾立规矩：把"看产物"纳入 code review 工具链。

### 10. (D) 面试官问："你们组件里一个 200 行的响应式表格，产物会不会爆炸？" 从编译策略角度回答体积都花在哪、什么写法会显著膨胀。

**来源**：编译产物体积焦虑类社区讨论转述

产物是"模板克隆 + 每个动态绑定一个 effect + 你的 JS 原样保留"：体积主要花在你写的逻辑与 effect 数量，模板本身极便宜（字符串+克隆）。膨胀触发器：一个巨型 `{#each}` 里塞满表达式（每处动态点都是 effect）、大量 `{#if}` 区块（锚点与认领逻辑）、逐属性内联复杂表达式（该提成 `$derived` 或 action）。加分：用 playground 量化、build 后 gzip 验证，别凭感觉（呼应 svelte-performance 测量章）。

### 11. (A) mount/hydrate/unmount/flushSync 这组客户端 API 相比 Svelte 4 的 `new App({target})` 解决了什么？

**来源**：Svelte 5 文档 mount 章动机段转述

组件从 class 实例变为函数+effect 图后需要统一的生命周期入口：`mount` 承载 props/context/锚点选项；`unmount` 显式拆树（class 时代靠 `$destroy`，现在没有实例可方法调用）；`flushSync` 给"我要立刻看到 DOM 结果"的场景（测试、量测、第三方库喂参）提供同步刷新出口；`hydrate` 是 SSR 接管专用入口。迁移映射表在 L10 会全量展开（呼应 svelte-lifecycle）。

### 12. (D) 终题：让你给"C 端低配安卓机 + 弱网"的政企项目做选型，团队只熟 React。用本课的架构知识给一份负责任的评估提纲。

**来源**：架构选型综合面经（高级/资深轮常见收官题）

提纲五块：①成本模型换轴——把"VDOM 有没有"翻译成三条可测指标（JS 总量/主线程交互延迟/内存驻留），用弱网真机跑 PoC 而非引用博客；②生态税清单——项目需要的组件库/监控 SDK 在 Svelte 侧的自建成本（React 生态优势的真实来源）；③团队曲线——runes 心智迁移成本与 lint 执法（svelte-tooling）能否兜住；④混合策略——核心链路 Svelte 微前端嵌入或 Web Components 编译产物复用（L10），不赌全仓重写；⑤回退与度量——上线后 INP/内存指标基线归因到框架假设本身（呼应 vite-ci-perf 的 Field 数据观）。要点：**用工程证据替代宗教战争**。

---

## 补充（新专题 13-15）

### 13.  Svelte 没有 VDOM，那"更新"到底靠什么完成？把编译产物结构讲清楚。

靠"编译期生成的细粒度 DOM 更新代码 + 运行期信号图"：① 静态部分——编译成 $.template（一次克隆）；② 动态部分——编译成 effect，effect 体内 $.get(signal) 读值、写 DOM（$.set/text_attr）；③ 派生——$.derived 惰性；④ 依赖——effect 运行时读哪个 signal 就订哪个（无静态依赖数组）。当 signal 变，只有读它的 effect 重跑，直接改对应 DOM——没有"生成新树 → diff → patch"这三步，是"数据变 → 订阅它的闭包重跑 → 就地改节点"。产物里没有"下一次渲染的虚拟 DOM"可供比较，因为压根不做比较。加分句：讲清"VDOM 解决的是『不知道哪变了所以整棵重算再 diff』，Svelte 靠编译器+信号图在源头就知道『这个 signal 影响这几个 effect』所以不需要 diff"——把 VDOM 定位成"依赖追踪缺失时的补偿机制"，就理解了编译器系框架"用编译期信息换运行期开销"的核心命题（呼应既有"UI=f(state) 对照"题）。

**来源**：Svelte 编译器输出结构；$.template/$.set/$.derived 运行时 helper；signals 运行时；既有"没 VDOM 靠什么更新"深化

### 14.  generate: client / server / ssr 各产出什么？一份 .svelte 如何同时服务浏览器与 Node？

三态：① client——产出操作真实 DOM 的代码（template 克隆、effect 写 DOM），用于 mount/浏览器；② server（render）——产出把组件序列化成 HTML 字符串 + head 信息的代码（无 DOM 操作，用 $.render_*），用于 Node 端 render()/SSR；③ 组件级 hydrate 编译旗标（data-svelte-h 等）让 client 能认领 server 产出的 DOM 而不重建（水合，呼应 ssr-hydration 关）。同一份源码分叉：编译器按 generate 走不同 codegen（模板→DOM 操作 vs 模板→字符串拼接），但响应式/表达式解析共享（这是"编译器系"的好处——一份 AST 两种后端）。加分句：这解释了"为什么 SSR 下 onMount/$effect/action 不跑"（server codegen 里根本没生成 DOM 相关代码，对应 lifecycle SSR 题），也解释"为什么 head（<svelte:head>）要在 SSR 单独收集"（render 输出里 head 是独立字段，呼应 special-elements head 题）——把"两套 codegen"当作理解 Svelte 行为的万能钥匙，SSR/水合/action 那些零散规则全串起来了。

**来源**：Svelte compile options generate；SSR 编译；isCustomElement/hydratable 编译旗标；既有 generate 三态题深化

### 15.  运行时体积论：Svelte 框架基数小，是不是应用一定就小？编译产物体积由什么决定？

澄清："运行时小"只意味着"框架代码基数小"，不等于"你的产物小"。产物构成：① 框架运行时（小，几 KB 级）；② 每个组件编译出的代码——静态模板字符串、effect 函数、信号声明（组件越多、模板越复杂、动态绑定越多，这部分越大，可能超过框架本身）；③ 依赖（第三方库仍是主体，与框架无关）。所以：① 大量小组件 + 复杂模板可能让"编译出的组件代码"成为大头（class 提取/静态优化能压）；② 用 Svelte 但引了 moment/大型 UI 库，产物照样爆（框架帮不了你）；③ 好处在"没有 VDOM/协调运行时"这块固定开销小，利好多体现在小应用与交互轻的页（对应 overview"小应用 bundle 更小"题）。加分句：正确的性能预期是"Svelte 降低了框架固定成本、但把体积主导权交给了你的依赖选择与组件复杂度"——bundle 分析要看"框架运行时 vs 组件编译码 vs 第三方"三段占比，别拿"框架小"当"我的包一定小"的免检金牌（呼应 deploy 关"bundle 分析里什么最意外"题）。

**来源**：Svelte bundle 分析；编译产物体积构成；既有"运行时小是否产物一定小"深化
