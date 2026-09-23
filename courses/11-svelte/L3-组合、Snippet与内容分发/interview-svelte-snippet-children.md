# svelte-snippet-children 面试题精选

> 共 15 题，覆盖 A snippet 本质 / B 内容分发 / C 作用域与边界 / D 对照与迁移。

## 一、snippet 本质（A 类）

### 1. snippet 是什么？它和"把一个渲染函数存进变量"有什么区别？
`{#snippet name(args)}...{/snippet}` 是**编译期模板函数**：编译器把其中的标记编译成高效的 DOM 创建/更新代码，作用域遵循声明处的词法作用域。它不是普通 JS 函数——不能存进 `$state`、不能从 `.svelte.js` 导出、只能作为 prop 传递并被 `{@render}` 实例化（呼应 svelte-snippet-children 第一、五节）。
**来源**：Svelte 官方文档 — Snippets

### 2. 为什么声明了 snippet 页面上却什么都没有？
snippet 声明只是"定义"，必须用 `{@render name(...)}` 才会实例化渲染；同一 snippet 可被 render 多次，每次是独立实例。这与"组件模板自动渲染"心智不同（呼应 svelte-snippet-children 第一节）。
**来源**：Svelte 官方文档 — 声明与渲染分离

### 3. `{@render}` 能渲染一个普通函数或组件吗？
不能。`{@render}` 的表达式必须是 **snippet 的调用**（如 `{@render cell(row)}`），渲染普通函数返回的字符串/节点会抛运行时错误（`@render` 参数非法）。要渲染子组件用 `<Comp/>` 标签，不是 `{@render}`（呼应 svelte-snippet-children 第五节）。
**来源**：Svelte 官方文档 — render tag 约束

## 二、内容分发（B 类）

### 4. Svelte 5 的 children 和 Vue 的默认插槽怎么对应？
父组件写在标签之间的内容，在 Svelte 5 里就是名为 `children` 的 **snippet prop**；子组件 `let { children } = $props()` 后用 `{@render children?.()}` 放它——等价 Vue 的 `<slot/>`。`?.()` 是因为父可能不传内容（呼应 svelte-snippet-children 第二节、vue 组件 slot）。
**来源**：Svelte/Vue 官方文档对照 — children / slot

### 5. 具名插槽（header/footer 多路内容）在 Svelte 5 如何实现？
**每一路内容就是一个 snippet prop**：子声明 `let { header, footer, children } = $props()`，父在组件标签内写 `{#snippet header()}...{/snippet}`。比 Vue 的 `name` 属性更直白，且可用 `{#if header}` 判断该路是否传入（呼应 svelte-snippet-children 第三节）。
**来源**：Svelte 官方文档 — Passing snippets to child components

### 6. 作用域插槽（子把行数据交给父决定渲染）呢？
snippet 天生带参数：父定义 `{#snippet cell(row, col)}`，子在 `{@render cell(row, col)}` 处把**自己的数据**作实参传入——数据流向是"子给父数据、父给子模板"，一举覆盖 Vue 作用域插槽与 React render props 的场景（呼应 svelte-snippet-children 第四节）。
**来源**：Svelte 官方文档 — Snippets with arguments

## 三、作用域与边界（C 类）

### 7. snippet 里读的是谁的状态？更新由谁触发？
snippet 体按**声明处的词法作用域**执行：父定义的 snippet 读父的 `$state`——父状态变化时，即使 snippet 渲染在子组件的 DOM 位置里，也会正确更新。这就是"slot content 属于父作用域"的 Svelte 版本（呼应 vue 插槽作用域、svelte-reactive-runes）。
**来源**：Svelte 官方文档 — snippet scope 语义

### 8. snippet 能做条件声明吗？能在 `{#each}` 里声明吗？
可以嵌套在控制块里声明（作用域随块），但常见做法是**声明一次、多处 `{@render}`**；把 snippet 声明当"运行时值"到处搬运（存 state、放数组里循环注册）是不支持的——它是静态模板结构的一部分（呼应 svelte-snippet-children 第一、五节）。
**来源**：Svelte 官方文档 — snippet 位置规则

### 9. 一个组件既能收 children 又能收多个 snippet，接口上如何取舍？
默认内容走 `children`；"额外插槽点"各起一个显式 snippet prop 名。接口越显式越好：props 传数据、`onXxx` 回事件、snippet 传模板，三通道清清楚楚（呼应 svelte-component-composition 第二节）。
**来源**：Svelte 组件设计惯例（官方示例/社区最佳实践）

## 四、对照与迁移（D 类）

### 10. Svelte 4 的 `<slot>` / `<svelte:fragment slot="x">` 在 Svelte 5 怎么迁移？
`<slot/>` → `let { children } = $props()` + `{@render children?.()}`；具名 slot → 对应名字的 snippet prop；`slot="x"` 属性写法 → 在子标签内直接写 `{#snippet x()}...{/snippet}`；`$$slots` 对象判断 → `header != null`。旧 `<slot>` 语法在 legacy 模式仍可用，新代码一律 snippet（呼应 svelte-overview 第三节迁移话题）。
**来源**：Svelte 官方 — Svelte 5 迁移指南（snippets 取代 slots）

### 11. 相比 React 的 children/render props，Svelte snippet 的优势在哪？
写法仍是**模板**（不是 JS 回调），编译期就知道内容结构，能享受和组件同级的细粒度 DOM 更新优化；也不会有"每次渲染新建函数导致子树无谓重渲染"的 React 经典性能坑——snippet 的依赖是信号级追踪（呼应 svelte-overview、react-composition）。
**来源**：Svelte 5 官方博客 — snippets、React render props 性能讨论

### 12. 和 Vue 3.3+ 的 `<slot>`/`v-slot` 体系相比，两者的设计差异？
Vue 仍保留"插槽是组件内部概念"（`<slot>` 标签 + `v-slot` 指令 + `$slots` 对象）；Svelte 5 把内容分发**彻底 props 化**——没有专门的插槽系统，snippet 就是普通 prop，带参就是普通形参。前者对模板党友好，后者概念更少、正交性更强（呼应 vue 组件 slot、svelte-snippet-children 第六节）。
**来源**：Vue/Svelte 官方文档设计对照

---

## 补充（新专题 13-15）

### 13.  snippet 里读到的是谁的响应式状态？更新由谁触发？跨组件边界时依赖如何解析？

核心事实：snippet 是一个"闭包"——它捕获的是定义它那一侧（父组件）的作用域，{@render} 时读的是父的 state、依赖也登记在父的 effect 图上（即使它渲染在子的 DOM 位置里）。更新触发：① snippet 内引用的父 state 变化 → 该 snippet 的输出重渲染（由父侧响应式驱动，与子的渲染无关）；② 子通过 {@render row(item)} 传入的实参（item）变化 → 因为 render 表达式在子的作用域里被重新求值，snippet 收到新参数重渲染。跨边界依赖解析规则："自由变量按词法作用域解析到定义侧，参数按调用侧传入"——这与 React 的 render prop/children 闭包语义完全一致（children 捕获父作用域），Svelte 只是把它做成一等模板语法。坑：以为"snippet 渲染在子里所以读子的 state"——不，读父的；要读子的得靠子把数据当参数传进去。加分句：把 snippet 讲成"带词法闭包的一等模板函数"就通了——它的一切行为（捕获定义侧、参数来自调用侧、可条件声明、可在 each 里造多个实例）都是"函数 + 闭包"的自然推论，不是特殊魔法（对应既有"snippet 能条件声明/在 each 里吗"题）。

**来源**：Svelte snippet 作用域文档；closure 与响应式；既有"snippet 读谁的状态"题深化

### 14.  一个组件同时接收 children 和多个具名 snippet，接口如何设计才不打架？何时该用 children 何时该用具名？

并存机制：children 本身就是一个名为 children 的 Snippet prop——组件里 {@render children?.()} 渲染默认内容；具名 snippet（如 header/footer）是另外的 props。设计原则：① 单一"默认插入点"用 children（如 Card 的内容区、Button 的文本）——最符合直觉、调用方直接写在标签间；② 多个"平行/可选插入点"用具名 snippet（header/footer/actions）——调用方用 {#snippet header()}...{/if} 声明。判据：内容属于"组件的主体"用 children、属于"外围槽位"用具名。可组合性：children 可选（不传则 {@render children?.()} 短路不报错，用可选调用），具名 snippet 缺失要有合理默认或不渲染（对应既有"判断父有没有传 header"题）。与框架对照：React children + render props 混用、Vue 默认插槽 + 具名/动态插槽——Svelte 用"children 就是一个叫 children 的 snippet"把两者统一成同一机制（没有特殊插槽语法，都是 prop），这是它接口一致性的漂亮处。加分句：接口设计的成熟标志是"给默认、可选、可覆盖"——children 默认可选、具名槽位有兜底、都能被覆盖，把一个"能渲染但不强求"的契约写清楚（对应 snippet 关"三通道"既有题的落地）。

**来源**：组件 API 设计；children 与 snippet 并存模式；headless 组件接口设计

### 15.  snippet 相比 Vue 的 slot 语法和 React 的 render prop，在能力与限制上边界在哪？

能力对齐：① 默认内容——Vue <slot> / React children / Svelte children snippet 三家都有；② 具名——Vue slot name + v-slot:、Svelte 具名 snippet、React 用多个 render prop；③ 作用域/带数据——Vue 插槽 props、Svelte snippet 参数、React render prop 传参，三家都能"子给数据、父定渲染"。Svelte 的差异化：snippet 是"值"（可存变量、可条件生成、可在 each 里批量造、可作为普通 prop 传递/组合/转发），比 Vue 的模板指令 slot 更贴近 JS（不用 v-slot 特殊语法），比 React render prop 更贴近模板（{#snippet} 写起来像 HTML 不是箭头函数）。限制：snippet 必须在能编译 .svelte 的地方声明（不能在纯 .js 里用模板语法造，此时退回普通函数/组件）；条件声明/动态 snippet 要理解其"编译成闭包"本质（无 Vue 的 slot 名字符串动态机制那么灵活，反而更显式安全）。转发链：把收到的 snippet 原样传给更深层组件（slot forwarding）——Svelte 用 {@render inner(...args)} 转发，比 Vue 的具名动态插槽转发更直观。加分句：一句话说透——Svelte 把"插槽"从"模板 DSL 特性"降级成"就是个函数值 prop"，代价是少了点语法糖、收益是心智模型统一（插槽、children、片段渲染全是同一套"传递可调用模板"机制），这是"少即是多"的 API 设计取舍。

**来源**：Vue slot / v-slot 文档；React children 与 render prop；snippet 迁移指南
