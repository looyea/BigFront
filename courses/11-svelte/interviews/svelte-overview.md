# svelte-overview 面试题精选

> 共 12 题，覆盖 A 编译器心智 / B runes 概览 / C 响应式底层 / D 选型与生态。

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
