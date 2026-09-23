# Snippet 与 children

> 目标：掌握 Svelte 5 内容分发的核心新机制——**snippet**：用 `{#snippet name(...)}` 声明一段"可复用的模板"、`{@render name(...)}` 渲染它；父组件把 snippet 当 **prop** 传进子组件，`children` 本身也是一个 snippet prop。彻底对照 Vue 的 `<slot>`/具名插槽与作用域插槽、React 的 `children`/render props。（呼应 svelte-props 第五节、react-composition、vue 组件 slot）

---

## 一、snippet 是什么：把"一段模板"当值

snippet = **编译期的模板函数**。声明它不会渲染任何东西，只有 `{@render}` 才实例化一份：

```svelte
{#snippet row(item)}
  <li>{item.name} — ￥{item.price}</li>
{/snippet}

<ul>
  {#each items as item}
    {@render row(item)}
  {/each}
</ul>
```

- 参数支持默认值与解构：`{#snippet row({ name, price = 0 })}`。
- snippet 声明在**组件文件（.svelte）内**（顶层或嵌套），不能装进 `$state`、也不能从 `.svelte.js` 模块导出——它是模板层的东西，不是运行时值。
- 同一 snippet 可以 `{@render}` 多次，每次独立实例化。

---

## 二、children：内容默认就是一个 snippet prop

组件标签"包进去"的内容，Svelte 5 里统一作为 `children` prop 传入：

```svelte
<!-- Card.svelte -->
<script>
  let { title, children } = $props();
</script>
<section class="card">
  <h3>{title}</h3>
  {@render children?.()}
</section>
```

```svelte
<!-- 父组件 -->
<Card title="公告">
  <p>这段 <b>任意内容</b> 就是 children</p>
</Card>
```

- 这就是 Vue **默认插槽**、React `children` 的对应物。
- `children?.()` 的可选调用：父没传内容时 `children` 为 `undefined`，不判空会报错。

---

## 三、具名 snippet：多路内容分发

Vue 用具名插槽 `<slot name="header">`；Svelte 5 的做法是**声明多个 snippet prop**，父在组件标签内用 `{#snippet xxx}` 就近定义：

```svelte
<!-- Layout.svelte -->
<script>
  let { header, sidebar, children } = $props();
</script>
<header>{@render header?.()}</header>
<aside>{@render sidebar?.()}</aside>
<main>{@render children()}</main>
```

```svelte
<!-- 父组件 -->
<Layout>
  {#snippet header()}<h1>站点标题</h1>{/snippet}
  {#snippet sidebar()}<nav>菜单</nav>{/snippet}
  <p>主体内容（children）</p>
</Layout>
```

子组件里 `header`/`sidebar` 就是普通 prop——可以用 `{#if header}` 判断"父有没有传这一路内容"，再决定渲染不渲染包装标签（比 Vue 的 `v-if="$slots.header"` 更直白）。

---

## 四、作用域 snippet：带参渲染 = 作用域插槽

Vue 作用域插槽 `<slot :item="x">`；Svelte 5 里 snippet **本来就能带参数**——子组件在合适的位置、带着合适的数据 `{@render}` 它：

```svelte
<!-- Table.svelte -->
<script>
  let { rows, cols, cell } = $props();
</script>
<table>
  {#each rows as row}
    <tr>
      {#each cols as col}
        <td>{@render cell(row, col)}</td>
      {/each}
    </tr>
  {/each}
</table>
```

```svelte
<!-- 父：自定义每个单元格怎么画，拿到 row/col 作用域数据 -->
<Table {rows}>
  {#snippet cell(row, col)}
    <b>{row[col.key]}</b>
  {/snippet}
</Table>
```

这就覆盖了 React **render props**（`renderItem={(item)=><li/>}`）的全部场景，而且写法仍是模板、编译期优化。

---

## 五、snippet 的流动方向与边界

- snippet 是**向下传**的模板（父定义、子渲染），与"数据向上（回调 prop）"合起来就是 Svelte 5 的组件接口全貌：**props 传数据、回调传事件、snippet 传模板**。
- 子组件也可以**向上回传 snippet**？不常见——通常是父传子。若要把 snippet 存在别处再渲染，只能存普通变量/prop 传递，不能进 `$state`（编译器会拒绝）。
- `{@render}` 后面必须是 snippet 的调用表达式；渲染普通函数会报错（`@render_svelte_5_component_invalid` 之类）。

---

## 六、三框架内容分发对照

| 需求 | Svelte 5 | Vue 3 | React |
|---|---|---|---|
| 默认内容 | `children` + `{@render children?.()}` | `<slot/>` | `props.children` |
| 具名多路 | 多个 snippet prop | `<slot name>` | 多个 JSX prop |
| 作用域数据 | snippet 参数 | 作用域插槽 `v-slot:item` | render prop 形参 |
| 判断是否传入 | `{#if header}` | `$slots.header` | `header != null` |
| 本质 | 编译期模板函数 | 渲染函数 | 就是 JS 值 |

---

## 七、自检清单

- [ ] 会声明 `{#snippet}` 并用 `{@render}` 渲染，知道"声明≠渲染"。
- [ ] 知道 children 是 snippet prop，渲染写 `{@render children?.()}`。
- [ ] 能用多个 snippet prop 实现具名插槽，`{#if xxx}` 检测是否传入。
- [ ] 能用带参 snippet 实现作用域插槽 / render props 场景。
- [ ] 记住 snippet 不能进 `$state`、不能从 `.svelte.js` 导出。

---

🚀 **下一关**：`svelte-component-composition`——组件导入、`export function` 暴露实例方法、`bind:this` 调子组件、动态 import 懒加载，把"组合优于继承"落到 Svelte 写法上。
