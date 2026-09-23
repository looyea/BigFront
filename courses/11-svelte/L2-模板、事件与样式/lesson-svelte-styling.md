# 作用域样式与 CSS

> 目标：讲清 Svelte 的招牌特性——**组件作用域样式**：`<style>` 块在编译期自动给选择器加唯一哈希类，做到零运行时、天然隔离；掌握 `:global()` 逃生、**CSS 自定义属性从 JS 传值**、`@keyframes`、`class:` 指令在 Svelte 5 的变化，以及与全局样式的组织方式。对照 Vue `scoped` 与 CSS Modules。（呼应 vue-style-scoped、10-vite）

---

## 一、`<style>` 默认就是作用域的

```svelte
<style>
  button { background: #ff3e00; }
</style>
<button>点我</button>
```

编译后，选择器被改写成带**唯一哈希类**的形式（如 `button.svelte-a1b2c3`），并给本组件真实 DOM 节点加上该 `class`。效果：

- **只作用于本组件**里用到的元素，未用到的规则被**摇树删除**（不产物化，体积小）。
- **零运行时开销**：不像 Vue `scoped` 或 CSS Modules 那样在运行时注入属性/hash，Svelte 在**编译期**就完成改写（呼应 svelte-overview 编译器派心智）。
- 不用手写 BEM、不用担心类名撞车。

---

## 二、`:global()` 逃逸与全局样式

想影响第三方组件、或写全局规则，用 `:global()`：

```svelte
<style>
  /* 只让当前组件下的 .dark 生效于全局选择器 */
  .card :global(.third-party-widget) { border-color: red; }

  /* 整块全局 */
  :global(body) { margin: 0; }
</style>
```

- `:global(selector)`：该选择器**不加哈希**、按原样输出。
- 项目级全局样式建议单放一个 `app.css`/`global.css` 在入口 `import`，或 SvelteKit 的 `+layout.svelte` 里引（呼应 12-sveltekit、10-vite 资源引入）。

---

## 三、从 JS 向 CSS 传值：CSS 自定义属性

组件状态可直接喂给 CSS 变量，实现"数据驱动样式"，无需内联字符串拼接：

```svelte
<script>
  let hue = $state(200);
</script>

<!-- style:--hue 把 JS 值变成 CSS 自定义属性 -->
<div style:--hue={hue}>颜色随 hue 变</div>

<style>
  div { background: hsl(var(--hue) 70% 55%); }
</style>
```

- 也可在元素上直接写 `style="--hue: {hue}"`。
- 自定义属性会**继承**给子组件，是"主题/尺寸令牌"跨层传递的轻量方案（比 props 一路透传省事，呼应 L4 svelte-context）。

---

## 四、`@keyframes` 与动画类

`<style>` 里的 `@keyframes` 同样被作用域化；配合 `transition:`/`animate:`（见 L5 svelte-transitions-animations）：

```svelte
<style>
  @keyframes pop { from { transform: scale(.8);} to { transform: scale(1);} }
  .box { animation: pop .2s ease; }
</style>
```

---

## 五、条件类：`class` 表达式的变化

Svelte 5 里，给元素加**条件类**用普通 `class` 表达式；曾经的 `class:active={x}` 指令在**元素**上仍可用但语义微调，组件上的 `class:` 已废弃，改用普通 prop：

```svelte
<script>
  let { active = false } = $props();   // 组件：直接接收 class 相关 prop
  let on = $state(false);
</script>

<!-- 元素条件类：推荐用三元或 class: 皆可 -->
<div class={on ? 'on' : ''}>A</div>
<div class:on>B</div>            <!-- class: 简写，on 为真则加 .on -->

<!-- 合并外部传入的 class：用 $$restProps 或接收 children/class prop -->
```

> 要点：**元素**用 `class:x` 或 `class={...}`；**组件**不再用 `class:` 指令，改成把 class 当普通 prop 传（呼应 svelte-spread-rest）。

---

## 六、`<svelte:head>` 注入 head 样式/元信息

组件可把自己需要的 `<style>`/`<link>`/`<title>` 注入文档 head，SSR 时会一并渲染：

```svelte
<svelte:head>
  <title>我的页面</title>
  <link rel="stylesheet" href="/x.css" />
</svelte:head>
```

---

## 七、三框架样式方案对照

| 能力 | Svelte | Vue | React |
|---|---|---|---|
| 组件作用域 | `<style>` 编译期自动 | `<style scoped>`（加 data 属性） | 需 CSS Modules/styled |
| 未用规则删除 | ✅ 摇树 | 部分 | 取决于方案 |
| 逃逸全局 | `:global()` | `:deep()`/`::v-deep` | 天然全局 |
| JS→CSS 变量 | `style:--x={v}` | 内联/`v-bind()` in SFC | 内联 style |
| 运行时开销 | 无（编译期） | 极小 | 视方案 |

---

## 八、自检清单

- [ ] 能解释 Svelte `<style>` 是**编译期加哈希类**、零运行时、未用规则被删除。
- [ ] 会用 `:global()` 影响外部/全局选择器。
- [ ] 会用 `style:--x={v}`（CSS 自定义属性）做数据驱动样式与令牌继承。
- [ ] 知道元素条件类用 `class:x`/`class={}`，组件不再用 `class:` 指令。
- [ ] 知道用 `<svelte:head>` 注入 head 资源。

---

🚀 **下一站 L3**：`svelte-snippet-children` —— 用 `{#snippet}` / `{@render}` 把"一段可复用的渲染"当值传递，取代 slot，配合 `children` 完成内容分发。这是 Svelte 5 组件组合的核心新机制。
