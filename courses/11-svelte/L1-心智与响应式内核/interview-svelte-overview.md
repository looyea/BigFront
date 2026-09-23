# svelte-overview 面试题精选

> 共 15 题，覆盖 A 编译器心智 / B runes 概览 / C 响应式底层 / D 选型与生态。

## 一、编译器心智（A 类）

### 1. Svelte 和 React/Vue 最根本的区别是什么？
Svelte 是**编译器**：`.svelte` 在构建期被翻译成直接操作 DOM 的 JS，产物运行时几乎没有框架、没有虚拟 DOM、没有 reconcile 循环；React/Vue 是**运行时库**，浏览器里真跑着引擎，靠重新渲染 + 虚拟 DOM diff 打补丁（呼应 svelte-overview 第一节、react-render-model、vue-reactivity-theory）。
**来源**：Svelte 官方文档 — Compile time、How Svelte works

### 2. "没有虚拟 DOM"具体意味着更新是如何发生的？
编译期就算好了"哪个状态变化要改哪个节点"，运行时对应 `$state` 一写，就精确执行诸如 `textContent = count`、`setAttribute`、增删节点等命令式操作，跳过"生成新树→diff→patch"整段开销。代价是编译器要理解模板结构（呼应 svelte-overview 第一节）。
**来源**：Svelte 官方文档 — Reactivity、DOM 更新原理

### 3. 说 Svelte "小应用 bundle 更小"，那产物里到底还有什么？
仍有极少量 Svelte 运行时 helper（创建节点、effect/scheduler、store 等），但远小于 react-dom/vue 引擎；随组件数量线性增长的是你的业务代码而非框架基座。大型应用差距会缩小（呼应 svelte-overview 第一、五节、10-vite）。
**来源**：Svelte Bundle Sizes 讨论、svelte.dev 官方博客

## 二、runes 概览（B 类）

### 4. Svelte 5 为什么要引入 runes？解决了 Svelte 4 什么问题？
Svelte 4 的响应式是**隐式魔法**：顶层变量重新赋值才响应、改 `obj.x` 不响应、`$:` 靠标签推断依赖、响应式锁死在 `.svelte` 文件内。边界模糊、大对象与跨文件难推理。runes 把"什么可变、什么派生、什么有副作用"**显式**标出，并让响应式能进 `.svelte.js` 模块（呼应 svelte-overview 第三、四节）。
**来源**：Svelte 5 官方博客 — Svelte 5: Rethinking reactivity

### 5. 用一句话说清 `$state` / `$derived` / `$effect` / `$props`。
`$state` 声明可变状态；`$derived` 声明依赖其它信号自动算出的派生值；`$effect` 声明"读信号→同步外部世界"的副作用；`$props` 声明组件从父接收的只读输入。分别对标 Vue 的 ref/computed/watchEffect/defineProps、React 的 useState/useMemo/useEffect/函数参数（呼应 svelte-overview 第三节）。
**来源**：Svelte 官方 Reference — Runes

### 6. Svelte 4 的 `export let`、`$:`、store `$` 前缀在 Svelte 5 各变成什么？
`export let a` → `let { a } = $props()`；`$: y = f()` → `const y = $derived(f())`；`$: { 副作用 }` → `$effect(() => {...})`；store 仍可用但官方首选 runes + `.svelte.js` 做共享状态，`$store` 自动订阅属 legacy（呼应 svelte-props、svelte-stores）。
**来源**：Svelte 官方 — Svelte 4 to 5 迁移指南

## 三、响应式底层（C 类）

### 7. 什么是"信号（signal）"式细粒度响应式？Svelte 5 与 Vue/Solid 的关系？
信号 = 一个可被"读时订阅、写时通知"的最小响应单元；依赖图按读取自动建立，更新只波及真正读它的派生/effect，这就是"细粒度"。Vue 3 的 ref/computed、Solid 的 createSignal、Svelte 5 的 runes 同属这一范式；Solid 把细粒度做到极致，Svelte 再叠加编译期优化（呼应 svelte-reactive-runes 第四节、13-solid）。
**来源**：Reactivity 通用论述、Svelte/Vue/Solid 各自官方文档

### 8. 为什么说 runes 的依赖是"读决定、写传播"？
在 `$derived`/`$effect`/模板里**读到**哪个 `$state` 就登记为依赖（读决定）；某 `$state` **被写**时把下游标脏、flush 时按拓扑序重算（写传播）。因此不需要 React 那样手写依赖数组，也没有"漏写依赖"的 bug 类别（呼应 svelte-reactive-runes 第四节）。
**来源**：Svelte 官方文档 — Effect sequencing

### 9. `.svelte.js` / `.svelte.ts` 是什么，为什么重要？
带该后缀的普通模块允许在顶层使用 runes，于是响应式状态可以脱离单个组件、封装进可复用模块/class，成为跨组件共享状态（全局 store、领域服务）的一等公民；这是 Svelte 5 相对旧版最大的工程能力增强之一（呼应 svelte-overview 第四节、L4 svelte-global-state）。
**来源**：Svelte 官方文档 — Modules and runes

## 四、选型与生态（D 类）

### 10. Svelte 与 Vite、与 SvelteKit 是什么分工？
组件编译由 `@sveltejs/vite-plugin-svelte` 在 Vite 里完成；Svelte 本身只管组件/响应式，**不含路由、SSR、表单端点**——这些属于 SvelteKit（基于 Vite + Svelte 的全栈框架）。本包讲纯 Svelte，全栈在 12-sveltekit（呼应 10-vite、svelte-sveltekit-bridge）。
**来源**：SvelteKit 官方文档、vite-plugin-svelte README

### 11. 什么场景适合 / 不适合选 Svelte？
适合：交互型中小型应用、追求体积与开发体验、喜欢"写普通 JS"、可上 Svelte 5 新项目。不适合/需权衡：需要庞大现成组件生态与企业栈招聘、深度依赖 React/Vue 专属库、团队只熟旧 Svelte 语法。
**来源**：技术选型综合讨论（社区共识）

### 12. 老 Svelte 4 项目迁移到 5 的风险点主要在哪？
主要在三处隐式响应式假设被打破：改对象不响应变成响应（语义变化）、`$:` 与 store 混用需逐处理解、组件 props `export let`→`$props`；Svelte 5 保留了兼容模式（legacy 模式）分步迁移，但混用两套心智是最大坑（呼应 svelte-overview 第三节、svelte-stores）。
**来源**：Svelte 官方 — Migration/Svelte 5 迁移指南

---

## 补充（新专题 13-15）

### 13.  Svelte、Solid、Qwik 都被称"编译器系"框架，它们的编译产物与响应式模型差异在哪？

共同点：都把"声明式 UI"编译成细粒度命令式 DOM 操作，运行期不做虚拟 DOM diff。分野在响应式内核与职责边界：① Solid=显式信号（createSignal/createMemo）+ 编译只做 JSX→template 与依赖静态化，响应式是运行时的一等公民（不靠编译器魔改语义，函数体只跑一次），心智是"信号 + 受控的 effect"；② Svelte 5=runes 语法（$state/$derived/$effect）经编译器把普通变量赋值升级为信号读写、把模板表达式编译成 effect，是"编译器改写语义"路线（同名的 let 在 .svelte.js 与 .svelte 里被区别对待即证据）；③ Qwik=可恢复性（resumability），几乎不 hydrate——服务端序列化应用状态到 HTML，客户端按事件"解块"加载所需代码，响应式是 signal（QRL 延迟引用），主打"零启动 JS"。选型读法：Solid 给最强响应式原语但要求你手动管粒度、Svelte 给最顺手的语法糖、Qwik 给极致首屏但生态最不成熟。收口句：三家都在解决"React 用 VDOM 兜底重渲染"的成本，区别只是"把复杂度放在编译期、运行期信号、还是序列化边界"——理解这条光谱比记 API 有价值。

**来源**：Svelte 5 runes 文档；Solid signals 论文（server/primitives）；Qwik resumability 文档；ThePrimeagen 与 Ryan Carnato 的编译器框架对比演讲

### 14.  Svelte 长期强调"渐进增强 / 无 JS 也能用"，这个传统从哪来、和 SvelteKit 什么关系？

根源：Svelte 诞生于 Guardian 新闻站背景（Rich Harris），核心诉求之一是"内容站要在 JS 失败/受限环境仍可用"，因此 SvelteKit 把"HTML 表单 + 服务端 action"作为一等公民（form actions）：一个 <form method=POST action=...> 不写一行 JS 也能提交并生效，装了 JS 后 Kit 自动升级为 fetch 提交 + 乐观更新 + 保留回退（progressive enhancement 的实现）。技术支点：① 表单用原生 submit 而非 onclick 处理器承载 mutation（这样禁用 JS 也能走）；② 增强用 enhance(use:form) 只在 JS 环境接管；③ SSR 首屏始终渲染真实内容（非空壳）。与框架哲学的关系：Svelte 运行时小，使得"只在需要处加载交互 JS"成本更低，渐进增强是自然延伸而非额外负担（对比 SPA 默认全 JS）。诚实边界：真正要求"零 JS 可用"的场景在减少（目标环境都有 JS），但 form actions 的"服务端优先 + 无 JS 回退"仍是构建 CRUD/表单密集应用的稳健默认（呼应 sveltekit-bridge 关）。加分句：这道题的深层是"Web 的韧性（resilience）"——能用 HTML 默认行为解决的别抢给 JS，Svelte 是把这条老原则用编译器与 Kit 重新制度化了一遍。

**来源**：SvelteKit form actions 文档（渐进增强）；Rich Harris 早期 Svelte 设计论述；webkit 无 JS 回退实践

### 15.  让你在一个成熟 React 团队里推动 Svelte 试点，你会怎么设计低风险路径与成功度量？

反模式先立：不要开"重写大赛"、不要拿核心业务当小白鼠、不要让试点变成"证道"运动（技术选型失败的最大来源是把它当信仰辩论）。低风险路径设计：① 选"绿项目"（新页面/新微前端子应用，无迁移债）而非改造存量；② 选"有代表性的中等复杂度"（带表单 + 列表 + 一次数据获取，能暴露响应式/表单/SSR 真问题，太简单的 todo 无信号价值）；③ 时间盒（2-3 周一人或两人，产出可运行 demo + 书面评估，到期强制复盘不续命）。度量维度（要量化才可比）：首屏 JS 体积（对 React 基线）、开发速度主观评分（同复杂度需求对比）、构建时长、上手培训成本（第二个人从零到独立提交的天数）、遇到的框架 workaround 数（踩坑密度是长期维护成本的前兆）。决策出口：三选一（扩大试点 / 维持观察 / 放弃）并显式写下"什么信号会让我们放弃"——避免沉没成本绑架。组织面：给试点者"允许失败"的公开授权（否则没人报真实问题）、让 React 资深者参与评估（不是外行评内行）。加分句：技术试点的真正产出不是那个 demo，是"一份让没参与的人敢做决策的评估文档"——把这一点讲出来，面试官就知道你经历过真实的选型治理而非追新。

**来源**：CSS 团队 Svelte 采用案例；ThoughtWorks 技术雷达对 Svelte 的评级论述；前端技术试点（pilot）方法论
