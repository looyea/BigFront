# svelte-styling 面试题精选

> 共 15 题，覆盖 A 作用域原理 / B 逃逸与全局 / C 变量与主题 / D 生态对照与实践。

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

---

## 补充（新专题 13-15）

### 13.  Svelte 作用域样式与 CSS Modules、Tailwind、styled-components 相比，隔离机制与代价各是什么？

隔离机制光谱：① Svelte 作用域=编译期选择器改写 + 元素属性标记（自动、零运行时、无类名心智负担，但跨组件穿透要靠 :global）；② CSS Modules=编译期把类名哈希成唯一名（需 styles.xxx 引用、与 JS 耦合、工具链依赖）；③ Tailwind=不隔离而是"原子类复用"哲学（无自定义类名冲突焦虑，但类串长、需约定 purge 范围）；④ styled-components=运行时 CSS-in-JS（动态最灵活但有运行时成本、SSR 复杂度、bundle 增大——与 Svelte"零运行时"哲学正相反）。Svelte 的代价与优势：优势是默认隔离 + 死 CSS 裁剪 + 小产物；代价是"跨组件全局样式协作"要靠 :global 与自定义属性显式设计（不像全局 CSS 那样随便挂类）。选型读法：追求产物小/SSR 简单→Svelte 作用域或 Tailwind；追求主题动态切换/设计 token 强绑定→CSS-in-JS（但要付运行时税）。加分句：能把"隔离"与"复用"这对矛盾讲清——Svelte 选"默认隔离、复用显式"，Tailwind 选"默认复用、无隔离需求"，两种世界观都自洽，混用不当才是问题（呼应既有 CSS Modules/styled-components 对照题）。

**来源**：Svelte scoped styles 文档；CSS Modules 规范；Tailwind 原子类哲学；styled-components 运行时 CSS 对照

### 14.  想做一套跨组件的主题（暗色/品牌色切换），Svelte 里最省心的落地方案是什么？

核心方案：CSS 自定义属性作 token 层——在全局（:root 或 [data-theme=dark]）定义一组 --bg/--fg/--accent，组件作用域样式只消费 var(--xxx) 不硬编码颜色；切换主题只需在根元素改 data-theme 类，所有引用 var 的组件自动跟随（无需每个组件感知主题 state，也不需要重渲染）。落地要点：① token 定义放全局样式（app.css / <svelte:head> 注入 / 布局组件），不进组件作用域（否则被裁剪或隔离）；② 主题状态（当前是亮/暗）用全局 store 或 .svelte.js 单例 + 一个 action/directive 同步到 <html> 的 data-theme；③ 尊重系统首选项（prefers-color-scheme 做默认、允许用户覆盖并持久化，呼应 global-state 的 localStorage 题）；④ 组件级"局部覆盖主题"用嵌套 :root 作用域的自定义属性重定义（子树内 var 自动用新值）。反模式：把颜色当 props 一层层传（等于重造主题系统且失去级联优势）、用 JS 直接改 style（脱离 CSS 级联）。加分句：这题的分水岭是"你有没有把主题建成 CSS 级联里的一次声明而非 JS 状态同步"——用自定义属性走通，主题切换是零重渲染的（对比把 theme 对象塞 context 每处重算的方案，高下一眼可辨）。

**来源**：CSS 自定义属性主题化实践；:global 与 data-theme 模式；prefers-color-scheme

### 15.  SSR/hydration 下 Svelte 组件样式如何避免 FOUC（首屏裸样式闪烁）？

成因：Svelte 作用域样式默认由 JS 在组件挂载时注入 <style>（dev 与 SPA 模式）——SSR 首屏返回的 HTML 引用的组件还没执行 JS，样式未注入，用户先看到无样式内容（FOUC），JS 加载注入后才闪出。解法分层：① SvelteKit/构建期"CSS 提取"——生产构建把组件 CSS 静态抽取进 <head> 的 <link>（而非运行时注入），首屏即带样式（这是 Kit 默认做的，对应 deploy 关样式分包题）；② 关键 CSS 内联——把首屏临界的样式直接塞进 HTML head（进一步省一次往返）；③ <svelte:head> 里放全局 <link>（字体、reset）确保 SSR 就写进 head；④ 字体闪烁（FOUT/CLS）另需 font-display 与尺寸预留。诊断：DevTools Coverage/看首屏 HTML 里有无 <link rel=stylesheet>、样式是 head 里还是 JS 注入——裸样式多半说明 CSS 提取没生效或你在纯 SPA 模式配了 SSR 页。加分句：能区分"组件样式注入时机"与"字体加载闪烁"两类 FOUC/CLF，并指出"SSR 的价值之一就是让样式在 HTML 阶段就位"——把样式闪烁归到"SSR/构建产物策略"而非"CSS 写法"层面，是对的答案高度（呼应 vite-ssr/deploy 关的样式收集题）。

**来源**：SvelteKit 样式与 SSR 文档；vite-plugin-svelte CSS 处理；FOUC 成因分析
