# svelte-snippet-children 面试题精选

> 共 12 题，覆盖 A snippet 本质 / B 内容分发 / C 作用域与边界 / D 对照与迁移。

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
