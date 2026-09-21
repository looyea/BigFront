# $props 与组件输入输出

> 目标：讲清 Svelte 5 组件怎么"收参数"——用 `let { ... } = $props()` 声明 props、解构给默认值、props 只读、双向绑定用 `$bindable()`、往上传递用"回调 prop"（取代 `createEventDispatcher`）、以及 `$props()` 里还包含 `children` 等特殊成员。对照 Vue 的 `defineProps/defineEmits/v-model` 与 React 的 props/回调（呼应 react-component、vue-props-emits、svelte-reactive-runes、svelte-snippet-children）

---

## 一、声明 props：`$props()` + 解构

Svelte 4 用 `export let size`；**Svelte 5 统一用 rune**：

```svelte
<!-- Button.svelte -->
<script>
  let { size = 'medium', disabled = false } = $props();
</script>

<button class={size} {disabled}>按钮内容</button>
```

父组件：`<Button size="large" />`

- **解构 + 默认值**是标准写法（`size = 'medium'`）。
- 解构出来的变量**保持响应**：父组件改了 `size`，子组件的 `size` 会跟着更新——因为编译器把每个 prop 处理成 getter，不是取一次快照。
- 想拿到"全部 props"（含未声明的）用 `const props = $props();` 再 `props.xxx`，或用解构 rest：`let { size, ...rest } = $props();`（rest 透传见 L3 svelte-spread-rest）。

---

## 二、props 是只读的：单向数据流

```svelte
<script>
  let { count } = $props();
  // count += 1;           // ❌ 报错：不能给 prop 重新赋值
  let local = $state(count); // ✅ 要本地可变，就拷进 $state
</script>
```

纪律与 React/Vue 一致：**数据向下流（props），变化向上传（回调）**。若要把 props 初值作为本地可变状态，显式 `let x = $state(prop)`，别指望直接改 prop（呼应 react-component "props 只读"、vue-props 单向流）。

---

## 三、往上传：用回调 prop，而不是 emit

Svelte 5 弃用 `createEventDispatcher`，改用**把函数当 prop 传下去再调用**（就是 React 的做法）：

```svelte
<!-- 子 SearchBox.svelte -->
<script>
  let { onsubmit } = $props();
  let q = $state('');
</script>
<form onsubmit={(e) => { e.preventDefault(); onsubmit?.(q); }}>
  <input bind:value={q} />
</form>
```

```svelte
<!-- 父 -->
<SearchBox onsubmit={(query) => doSearch(query)} />
```

命名约定：常用 `onXxx`（也可 `onclick` 这类原生事件名直接透传，见 L2 svelte-events）。

---

## 四、双向绑定：`$bindable()`

要让父组件 `bind:` 一个 prop，需在子组件把该 prop 标成 `$bindable()`：

```svelte
<!-- Input.svelte -->
<script>
  let { value = $bindable('') } = $props();
</script>
<input bind:value />
```

```svelte
<!-- 父 -->
<script>let name = $state('');</script>
<Input bind:value={name} />   <!-- 子组件改 value，父的 name 同步 -->
```

- 没标 `$bindable` 的 prop 只能父→子（只读）；标了才能 `bind:` 双向。
- 语义等价 Vue 3.4 的 `defineModel()` / React 的"受控 value + onChange"（呼应 vue v-model、react-forms）。
- `$bindable()` 有默认值 `= $bindable('')`；不加默认则要求父必须绑。

---

## 五、props 里还有什么：children / 特殊成员

组件能接收的内容也走 `$props()`：

- `children`：标签之间的内容（snippet），`<slot>` 的 Svelte 5 替代——`let { children } = $props();` 再 `{@render children?.()}`（详见 L3 svelte-snippet-children）。
- 其余自定义 props 同理解构。

```svelte
<script>
  let { title, children } = $props();
</script>
<section>
  <h2>{title}</h2>
  {@render children?.()}
</section>
```

---

## 六、三框架 props 心智对照

| 需求 | Svelte 5 | Vue 3 | React |
|---|---|---|---|
| 声明 | `let { a = 1 } = $props()` | `defineProps` | 函数形参 `({a})` |
| 只读 | 是 | 是 | 是 |
| 默认值 | 解构 `= 1` | `withDefaults` | 形参默认值 |
| 往上传 | 回调 prop `onXxx` | `defineEmits` | 回调 prop |
| 双向 | `$bindable()` + `bind:` | `defineModel` / `v-model` | 受控 value+onChange |
| 内容分发 | `children` + snippet | `<slot>` | `children` |

---

## 七、自检清单

- [ ] 会用 `let { a = 默认值 } = $props()` 声明并给默认值，知道解构仍保持响应。
- [ ] 记住 props 只读，要在本地可变就拷进 `$state`。
- [ ] 往上传用回调 prop（`onXxx?.(...)`），不再用 `createEventDispatcher`。
- [ ] 双向绑定用 `$bindable()` + 父组件 `bind:`。
- [ ] 知道 `children` 也是 prop，用 `{@render children?.()}` 渲染。

---

🚀 **下一站 L2**：`svelte-template` 进入模板层——`{#each}/{#if}/{#await}/{#key}` 控制块、插值与 `{@html}`、`bind:this` 元素引用。至此 L1 的"脚本三件套（state/derived/effect/props）"已齐。
