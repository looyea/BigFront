# svelte-styling 面试题精选

> 共 12 题，覆盖 A 作用域原理 / B 逃逸与全局 / C 变量与主题 / D 生态对照与实践。

## 一、作用域原理（A 类）

### 1. Svelte 的 `<style>` 为什么是作用域隔离的？原理是什么？
编译器给每条选择器加上组件唯一的哈希类（如 `.button.svelte-xyz`），并给组件真实 DOM 节点加同名 class。因为是**编译期**改写、运行时零开销，天然隔离、无需 BEM 或 CSS Modules（呼应 svelte-styling 第一节）。
**来源**：Svelte 官方文档 — Scoped styles

### 2. 组件里没用到的 CSS 规则会怎样？
会被**摇树删除**——编译器分析模板里出现的元素/类，未匹配到任何节点的规则不进产物。这是 Svelte 体积优势的一部分（呼应 svelte-styling 第一节、svelte-overview）。
**来源**：Svelte 官方 — unused CSS 删除说明

### 3. 为什么 Svelte 作用域样式不需要运行时？和 Vue `scoped` 的差异？
Svelte 在构建期就把类写死进产物 DOM 操作；Vue `scoped` 在模板节点上注入 `data-v-xxx` 属性、运行时靠属性选择器隔离。结果类似，但 Svelte 无运行时开销、且未用规则可被静态删除（呼应 vue-style-scoped、svelte-styling 第七节）。
**来源**：Vue SFC scoped 与 Svelte scoped 官方文档对照

## 二、逃逸与全局（B 类）

### 4. `:global()` 用在什么场景？怎么和作用域选择器组合？
当要命中第三方组件内部类、或写全局规则时用 `:global(sel)`（该选择器不加哈希）。组合写法如 `.card :global(.widget)` = "本组件 `.card`（带哈希）之下的全局 `.widget`"（呼应 svelte-styling 第二节）。
**来源**：Svelte 官方文档 — :global(...)

### 5. 项目的全局样式/reset 应放哪里？
单独一个 `global.css`/`app.css`，在入口 `import './global.css'`；或 SvelteKit 在根 `+layout.svelte` 引入。避免把全局规则塞进组件 `<style>`（会被作用域化）（呼应 svelte-styling 第二节、12-sveltekit、10-vite）。
**来源**：Svelte/SvelteKit 项目结构惯例

### 6. `<svelte:head>` 和组件样式有什么关系？
组件可把只属于自己的 `<link>`/`<style>`/`<title>` 注入文档 head，SSR 阶段会随页面渲染输出，适合引入外部字体/一次性全局片段（呼应 svelte-styling 第六节）。
**来源**：Svelte 官方文档 — <svelte:head>

## 三、变量与主题（C 类）

### 7. 如何把组件的 JS 状态传给 CSS？为什么优于拼接内联样式？
用 CSS 自定义属性：元素上 `style:--x={value}`（或 `style="--x: {value}"`），CSS 里用 `var(--x)`。声明式、可继承给子组件、避免每次渲染拼字符串；常用于主题/尺寸令牌（呼应 svelte-styling 第三节、svelte-context）。
**来源**：Svelte 官方文档 — style attributes / CSS custom properties

### 8. 想做一套跨组件的主题（暗色/品牌色），Svelte 里怎么落地？
顶层组件用 `style:--brand/--bg` 把令牌设成 CSS 变量、靠继承下沉到子树；配合 class 或 `$state` 切换变量值即可换肤，无需层层透传 props（呼应 svelte-styling 第三节、L4）。
**来源**：CSS 自定义属性主题化模式（社区/官方）

## 四、生态对照与实践（D 类）

### 9. Svelte 5 里 `class:` 指令有什么变化？
**元素**上 `class:active={bool}` 仍可用（也可 `class={bool?'active':''}`）；但**组件**上的 `class:` 指令已废弃，改为把 class 当普通 prop 传、内部用 `$$restProps`/拼接合并（呼应 svelte-styling 第五节、svelte-spread-rest）。
**来源**：Svelte 5 迁移说明 — class 指令

### 10. 与 CSS Modules / styled-components 相比，Svelte 方案取舍如何？
CSS Modules：需构建配套、运行时注入类；styled-components：CSS-in-JS 灵活但有运行时开销与 SSR 复杂度。Svelte 内置编译期方案零运行时、就近书写；但若要用 Tailwind 等外部原子类需配合工具链（呼应 svelte-styling 第七节、10-vite）。
**来源**：样式方案横向对比（社区共识）

### 11. `@keyframes` 会被作用域化吗？跨组件复用动画怎么办？
组件 `<style>` 里的 `@keyframes` 名同样被改写为作用域内唯一，只在本组件用得到的动画才保留。要共享，放全局样式或用 Svelte 内置 transition 函数（`svelte/transition`）（呼应 svelte-styling 第四节、svelte-transitions-animations）。
**来源**：Svelte 官方 — keyframes scoping、transition 模块

### 12. SSR 下组件样式如何避免闪烁（FOUC）？
Svelte/SvelteKit 在 SSR 时收集各组件作用域样式并内联/注入到 HTML `<head>`，客户端 hydrate 复用同一套类，减少外链 CSS 到达前的无样式闪现。全局 CSS 走正常 `<link>` 或 `+layout` 引入（呼应 svelte-compiler-architecture、12-sveltekit）。
**来源**：SvelteKit 官方 — SSR 样式处理
