# $$props / $$restProps 与透传

> 目标：封装"包装型"组件（Button、Modal、Field、链接卡片）时，常常不想逐个声明要转发哪些属性——本课讲 `$$props`（全部 props）、`$$restProps`（未声明的剩余 props）与 spread 展开 `{...obj}`，以及 class/style 的合并策略、事件透传。对照 Vue 的 fallthrough attributes（`inheritAttrs`）与 React 的 `{...props}` 惯用法。（呼应 svelte-props、react-composition、vue-component-basics）

---

## 一、双下划线 props：组件的"账本外"属性

组件收到的**所有**属性都能在脚本里拿到（它们是 Svelte 的内置变量，不用 rune 声明）：

| 变量 | 含义 |
|---|---|
| `$props()` | 你**解构声明过**的 props（正常通道） |
| `$$props` | 父传来的**全部** props（含未声明的） |
| `$$restProps` | 全部 props 中**减去已声明**的剩余部分 |

```svelte
<!-- Button.svelte：只关心 variant，其余全透传给原生 <button> -->
<script>
  let { variant = 'primary', children } = $props();
</script>

<button class={variant} {...$$restProps}>
  {@render children?.()}
</button>
```

父组件写 `<Button href disabled aria-label="删除" onclick={go}>`，`disabled`、`aria-label`、`onclick` 都没在 `$props()` 声明 → 全落进 `$$restProps`，被 spread 到原生 `<button>` 上，**行为与直接用原生按钮一致**。这就是 Svelte 版的"fallthrough attributes"。

---

## 二、spread 展开：`{...obj}` 能用在哪些位置

- **元素/组件属性**：`<div {...rest}>`、`<Comp {...obj} />`。
- **数组/对象字面量**：普通 JS 语义 `[...a, ...b]`、`{ ...o, x: 1 }`。
- **snippet 参数**：`{@render cell(...row)}` 少用但合法。

顺序即优先级：**后写的覆盖先写的**，可控"默认值 ← 用户覆盖"：

```svelte
<input type="text" {...$$restProps} class="ui-input" />
<!-- 用户传的 type 能覆盖默认 text；但用户 class 会被后面的 class 覆盖 -->
```

---

## 三、class / style 要手动合并（重点坑）

Vue 会把父传的 `class`/`style` **自动**落到子组件根元素；Svelte **不自动合并**——spread 里带 `class` 会直接**顶掉**你写的内部 class（或反过来）。标准写法是手动拼：

```svelte
<script>
  let { variant = 'primary', children } = $props();
  // 从 $$restProps 里单独拆出 class 来拼接（它需要“合并”而非“覆盖”，style 同理）
  let extraClass = $derived($$restProps.class ?? '');
</script>

<button
  {...$$restProps}
  class="ui-button {variant} {extraClass}"
>
  {@render children?.()}
</button>
```

- 用法 `<Button class="dangerous" style="margin-top:8px">` 时，外部类与内部类**共存**：显式 `class` 写在 spread 之后会接管合并，把 `$$restProps.class` 拼进去；`style` 若也要共存则同样拆出来拼。
- CSS 层面还有一个特性可借力：**父组件的作用域样式可以命中子组件的根元素**（Svelte 的 scoped 样式规则之一，呼应 svelte-styling 第一节），所以"只给根元素加样式"的诉求常不需要 prop 化。
- TS 下 `$$restProps.class` 需类型窄化（`/** @type {{class?: string}} */ ($$restProps)`），详见 L7 svelte-typescript。

---

## 四、事件也能 spread

事件本来就是小写属性（`onclick` 等，呼应 svelte-events 第一节），所以 `$$restProps` **天然携带事件监听**——上一节的 Button 例子里 `onclick={go}` 不需要任何额外代码就能穿透。

若要"拦截后再放行"，可显式接住再组合：

```svelte
<script>
  let { onclick } = $props();
  function handleClick(e) {
    if (e.currentTarget.disabled) return;
    onclick?.(e);
  }
</script>
<button {...$$restProps} onclick={handleClick} />
<!-- 注意：解构过的 prop 不再出现在 $$restProps，需手动 onclick={handleClick} 挂上 -->
```

---

## 五、`$$props` 的合理用途（及克制）

- **检测 prop 是否传入**：`'value' in $$props`（配合 `$bindable` 的可选双向）。
- **做高阶包装组件**：把 `$$restProps` 一部分转给自己、一部分转给内部元素/子组件。
- **不建议**：在模板里到处读 `$$props.xxx` 当"隐式接口"——公开接口应收敛到 `$props()` 解构 + TS 类型（呼应 svelte-props 第二节"显式化"精神）。
- `$$slots` 已成历史：snippet 就是普通 prop，用 `header != null`/`{#if header}` 判断即可（呼应 svelte-snippet-children 第三节）。

---

## 六、三框架透传机制对照

| 需求 | Svelte 5 | Vue 3 | React |
|---|---|---|---|
| 未声明属性落根元素 | `{...$$restProps}` 手动 | 自动（fallthrough） | `{...props}` 手动 |
| 关闭自动透传 | ——（本就手动） | `inheritAttrs: false` | ——（本就手动） |
| 拿全部属性 | `$$props` | `this.$attrs` / `useAttrs()` | props 对象 |
| class 合并 | 手动拼接 | 自动合并 | 手动/clsx |
| 事件透传 | 小写事件属性随 rest 走 | `v-on="$listeners"`(旧)/自动 | onXxx 随 props 走 |

Svelte 的"全手动"看似麻烦，实则**接口透明**：读组件模板就知道什么会被透传去哪，没有隐式魔法。

---

## 七、自检清单

- [ ] 分清 `$props()` / `$$props` / `$$restProps` 三个口径。
- [ ] 会写"声明少数、spread 其余"的包装组件。
- [ ] 记住 class/style 必须**手动合并**，spread 顺序决定覆盖。
- [ ] 知道事件监听天然包含在 `$$restProps` 里，拦截需显式接住。
- [ ] 用 `{#if header}` 检测 snippet prop，`$$slots` 已成历史。

---

🚀 **下一站 L4**：`svelte-context`——跨层级通信不只想 props 一层层传：`setContext` / `getContext` 依赖注入登场，与 Vue provide/inject、React Context 正面对照。
