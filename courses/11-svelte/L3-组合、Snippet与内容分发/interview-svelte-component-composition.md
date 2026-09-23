# svelte-component-composition 面试题精选

> 共 15 题，覆盖 A 组件与注册 / B 接口设计 / C 实例与生命周期 / D 组合模式。

## 一、组件与注册（A 类）

### 1. Svelte 怎么"注册"组件？和 Vue 的全局注册有何不同？
ES `import` 即注册，没有 `app.component()`、没有 `components: {}` 清单——模板里出现的名字必须能在脚本作用域解析到。好处：依赖关系全在 import 里，tree-shaking 与代码分割自然发生（呼应 svelte-component-composition 第一节、vue-component-basics）。
**来源**：Svelte 官方文档 — 组件导入

### 2. 为什么组件名必须大写开头？递归组件怎么写？
编译器用大小写区分**组件**与小写**原生元素**（`<div>` vs `<Modal>`），这是语法级开关而非风格约定。递归/自引用直接 `import Self from './ThisFile.svelte'`（Svelte 5 标准 import 取代旧 `<svelte:self>`）（呼应 svelte-component-composition 第一节）。
**来源**：Svelte 官方文档 — 命名规则、组件引用

## 二、接口设计（B 类）

### 3. 说说 Svelte 5 组件接口的"三通道"。
① 数据：普通 prop（只读）/ `$bindable` 双向；② 事件：回调 prop `onXxx`（子调父给的函数）；③ 模板：snippet prop / `children`。三者都是 prop——组件的公开契约就是 `$props()` 的解构清单（呼应 svelte-snippet-children 第五节、svelte-props）。
**来源**：Svelte 5 官方博客 — props 统一接口设计

### 4. 多个组件要共享一份状态，Svelte 的选型阶梯是？
先**提升到最近公共父**（props 下发、回调/`bind:` 上报）；层级太深用 **context**（`setContext`/`getContext` 依赖注入）；真正全局（登录态、主题）才上 **`.svelte.js` 共享状态模块**或 store。不要一上来就引入状态库（呼应 vue-state-patterns、L4）。
**来源**：Svelte 官方 — 状态管理与组合指南

### 5. Vue 的 `$emit` 层层转发在 Svelte 里对应什么？
没有 emit——事件就是**函数 prop**：父传 `onXxx` 给子，子直接调用；跨多层就逐层传函数，或用 context 直接把函数"注入"给深处组件。函数是普通值，比字符串事件名更可追踪、可类型化（呼应 svelte-events 第四节、react-context）。
**来源**：Svelte 官方 — createEventDispatcher 迁移到回调 prop

## 三、实例与生命周期（C 类）

### 6. 父组件如何命令式调用子组件的方法？要注意什么？
子组件 `<script>` 里 `export function play() {...}`，父用 `<Video bind:this={v}/>` 拿实例后 `v.play()`。注意：**挂载前实例是 `undefined`**（判空或在事件/onMount 后调）；它是逃生舱，能用状态/props 表达的别走命令式（呼应 svelte-component-composition 第四节、react-refs）。
**来源**：Svelte 官方文档 — 组件实例 / export 函数

### 7. `{#if show}` 切走组件和 CSS `display:none` 隐藏，本质差别？
`{#if}` 是**真卸载**：组件实例销毁、`$effect` 清理执行、内部 state 全部丢失；CSS 隐藏则实例与状态都活着（定时器仍在跑）。要"隐藏但保状态"用 CSS/`hidden`，要"重置一切"用 `{#if}` 或 `{#key}`（呼应 svelte-template 第五节）。
**来源**：Svelte 官方文档 — if block 与组件生命周期

### 8. 表单/弹框这类"内部状态要能一键重置"的组件，有什么组合技巧？
`{#key sessionId}` 包住组件：key 一变即销毁重建，拿到全新实例——比命令式 `reset()` 方法更符合声明式（呼应 svelte-template 第五节、上一题）。
**来源**：Svelte 社区惯用法 — key block reset

## 四、组合模式（D 类）

### 9. React 的 render props / HOC，在 Svelte 里分别对应什么？
render props → **带参 snippet**（父传模板、子给数据）；HOC → Svelte 少用高阶组件，逻辑复用走 **`.svelte.js` 模块里的 runes 函数**（等价自定义 Hook，见 L4）+ 组合包装组件（呼应 svelte-snippet-children 第四节、react-custom-hooks）。
**来源**：Svelte/Vue/React 组合模式对照

### 10. 想做 `<Card><Card.Header/></Card>` 这种复合组件（compound），Svelte 怎么写？
两条路：① snippet props——`<Card>{#snippet header()}...{/snippet}正文{/Card}`（推荐，显式）；② 子组件 + context——`Card.Header` 通过 `getContext` 注册自己。①是 Svelte 5 的惯用解，几乎不需要 Vue 式 name 匹配（呼应 svelte-snippet-children 第三节）。
**来源**：Svelte 组件设计实践（社区/官方示例）

### 11. 懒加载一个重组件有哪些手段？各适合什么场景？
局部交互触发：`(await import('./X.svelte')).default` + `{#await}`（点开才加载）；路由级：交给 SvelteKit 的代码自动分割（进页面才加载）；首屏关键组件**不要**懒加载——瀑布流反而更慢（呼应 svelte-component-composition 第五节、10-vite、12-sveltekit）。
**来源**：SvelteKit 官方 — 代码分割；Vite 动态 import

### 12. 组合时如何避免"props 钻塔"（drilling）但又不过度全局化？
顺序是：合理**划分组件树**让共享状态停在恰当层级 → 一组相关 props 打包成对象/`$bindable` → 穿透层用 `{...$$restProps}` 或 context → 只有跨页面/持久化才上全局模块。判据："谁拥有这个状态"比"谁用到"更重要（呼应 svelte-spread-rest 第五节、L4、vue-state-patterns）。
**来源**：React/Vue/Svelte 通用状态分层最佳实践

---

## 补充（新专题 13-15）

### 13.  多个组件要共享一份状态，Svelte 给的选型阶梯是什么？每级的适用边界？

阶梯（从近到远）：① 父子直连——props 下传 + 回调/bindable 上送（最显式、类型最好、首选）；② 跨层避免 drilling——context 传值或传"操作函数"（setContext/getContext，适合插件式/注册式，对应 context 关选型题）；③ 多分支/远距离共享的响应式状态——.svelte.js 单例模块（$state 顶层导出，跨组件字段级响应，对应 global-state 关）；④ 需要跨路由/持久化/时间旅行——store（writable/derived，或第三方），或 URL/服务端；⑤ 组件实例方法命令式交互——bind:this（尽量避免，多为逃生舱）。每级边界："能用 props 不用 context、能用局部不用全局"——全局态是耦合源，只在"确实多消费者且生命周期超出父子"时升级；SSR 项目里 ③④ 有跨请求泄漏风险须走 ⑤ 之外的每请求实例化（呼应 global-state SSR 事故题）。决策树记忆：数据属谁？父给子→props；祖给孙且中间不关心→context；多个不相关组件同读写→全局 state；要持久/同步多端→store+持久化。加分句：这题的高分在"讲出升级的触发条件而非罗列 API"——Svelte 的哲学是"默认用最小作用域，出现痛点才升级到更宽的作用域"，能说出"什么时候这个方案不够用了要换下一个"才是真懂（对应 component-composition 与 context 两关的选型题体系）。

**来源**：Svelte 状态管理选型；props/context/store/全局态阶梯；既有"共享状态演进路径"深化

### 14.  父组件想命令式调用子组件方法（focus/play/submit），Svelte 5 的推荐做法和注意事项？

模型变化：Svelte 5 弱化了"bind:this 拿组件实例调其导出方法"的老模式（runes 下组件实例 API 不再鼓励）——推荐改为：① 子把能力做成"可传入的回调/操作对象"（子通过 context 或 prop 注册自己的 API 给父，父持有函数引用而非实例）；② 或用 action/store 桥接命令式信号（父写一个 $state 计数器，子 $effect 监听变化执行 focus/play——把"调用方法"转成"响应状态"）；③ 纯 DOM 命令（focus、scroll）优先用 action 直接操作节点而非"调组件方法"（focus 是 DOM 行为，use:focus 比父子传实例更地道，对应 actions 关）。注意事项：命令式跨组件调用破坏单向数据流、难测试、易产生"谁在何时触发"的隐式耦合——每用一次先问"能不能改成状态驱动（父改 state、子响应）"，声明式方案几乎总是更可维护。加分句：能点出"Svelte 5 的取向是把命令式调用重写成响应式协作（父设状态、子 effect 反应或 action 接管 DOM）"——这背后是所有响应式框架共同的"少命令多声明"价值观，把一次"调方法"需求翻译成"一次状态变更 + 一个订阅"，才是符合框架心智的解法。

**来源**：Svelte 5 移除组件实例 API 的迁移；export 函数与 action 模式；bind:this 现状

### 15.  {#if show} 切走组件与 CSS display:none 隐藏组件，在状态、性能、副作用上差异是什么？怎么选？

差异三维：① 状态——{#if} 条件为假会销毁块内组件（其 $state 全部丢失、effect 清理、DOM 移除），display:none 保留组件实例与状态（隐藏但活着，定时器/effect 继续跑）；② 性能——{#if} 卸载省内存/重排成本（大列表收起时真正销毁更省），代价是重新展开要重建（挂载开销、丢缓存）；display:none 保留 DOM 占内存但切换零重建成本，且隐藏内容仍参与某些计算（如布局测量拿不到、getBoundingClientRect 为 0）；③ 副作用——{#if} 卸载会触发组件销毁清理（关连接、停轮询），display:none 不触发（隐藏组件的 $effect/定时器继续，可能白耗资源，对应 lifecycle 关"旧页面定时器还在跑"事故）。选择：频繁切换 + 状态需保留 + 无副作用负担→display/visibility（或 keep-alive 思路）；不常展开 + 内容重 + 有订阅需真正停→{#if} 懒销毁；"展开时才是新的一次"（如每次打开弹框重置表单）→{#if} 或 {#key}。加分句：这道题本质是"组件的生命周期粒度由谁决定"——{#if} 让"是否挂载"随条件（生命周期短、状态易失），display 让"是否可见"独立于挂载（生命周期长、状态常驻）；选错方向的典型症状是"弹框关掉再开数据还在/还丢了"，判断标准是"隐藏期间它应不应该继续消耗与记忆"。

**来源**：Svelte if 块与组件生命周期；DOM 保留 vs 销毁权衡；既有"if 切走与 display 差异"深化
