# 模板语法：{#each}/{#if}/{#await}/{#key}

> 目标：掌握 Svelte 模板里的**控制块**（`{#if}`/`{:else}`、`{#each}`/`{:else}` 与 keyed each、`{#await}`/`{:then}`/`{:catch}`）、插值与 `{@html}`、模板内常量 `{@const}`、元素引用 `bind:this`。理解它们如何被编译成精确 DOM 操作，并与 Vue 模板指令、React 的 `&&`/`.map()`/三元写法对照。（呼应 vue-template-syntax、react-lists-keys、svelte-reactive-runes）

---

## 一、插值 `{表达式}`

模板里 `{ }` 内是**任意 JS 表达式**（不是语句），编译器把结果写进文本节点、并在依赖变化时只改这一处：

```svelte
<script>
  let name = $state('world');
</script>
<h1>Hello {name}!</h1>
<p>{1 + 2}</p>
<p>{new Date().toLocaleDateString()}</p>
```

- 字符串属性可直接写 `attr={expr}`，布尔/对象同理。
- 想输出**原始 HTML**（会被转义时）用 `{@html expr}`——注意 XSS 风险（等价 React `dangerouslySetInnerHTML`，呼应 react-jsx）：

```svelte
{@html userComment}   <!-- userComment 里的标签会被当真 HTML 渲染，需自行消毒 -->
```

---

## 二、条件：`{#if}` / `{:else if}` / `{:else}`

```svelte
{#if user.loggedIn}
  <p>欢迎，{user.name}</p>
{:else if user.isNew}
  <p>请先激活账号</p>
{:else}
  <p>请先登录</p>
{/if}
```

和 Vue `v-if/v-else` 几乎同形；对比 React 的 `cond ? <A/> : <B/>` 与 `{cond && <A/>}`（后者遇 `0`/`false` 会渲染出来，是常见坑，呼应 react-jsx）。Svelte 的 `{#if}` 是**块级**、不渲染多余假值。

---

## 三、列表：`{#each}` 与 keyed each

```svelte
{#each todos as todo}
  <li>{todo.text}</li>
{:else}
  <p>暂无待办</p>
{/each}
```

- `as todo, i` 可拿到索引：`{#each todos as todo, i}`。
- **解构**直接用：`{#each todos as { id, text }}`。
- 括号里给 **key**（强烈推荐，等价 React `key`，决定复用/移动）：

```svelte
{#each todos as todo (todo.id)}
  <li>{todo.text}</li>
{/each}
```

- **对象**版 keyed each：`{#each map as [key, value] (key)}`。
- `{#each x as item}` 用**索引**当隐式 key 时，插入/删除/排序会出现"状态串位"——和 React 的 index-key 陷阱同源（呼应 react-lists-keys）。keyed each 让编译器知道"哪个 DOM 对应哪条数据"，只做移动而非销毁重建。

---

## 四、异步：`{#await}` / `{:then}` / `{:catch}`

直接对 **Promise** 建模，天然覆盖 loading / success / error 三态：

```svelte
{#await fetchUser(id) then user}
  <p>{user.name}</p>
{:then user}
  <Profile {user} />
{:catch error}
  <p style="color:red">加载失败：{error.message}</p>
{/await}
```

- `{#await expr then v}` 只写成功分支；要 loading 就 `{#await expr}`（pending 块）`{:then v}`（成功）`{:catch e}`（失败）。
- 心智等价 Vue 的 `<Suspense>` + 手动 error 处理，但**语法内建**、无需额外库（呼应 vue-effect/async-suspense、react-effect-patterns）。

---

## 五、`{#key}`、`{@const}`、`{@debug}`

- `{#key value}`：`value` 变化时**销毁并重建**内部块（强制重置组件/动画）：
  ```svelte
  {#key userId}<Profile {userId} />{/key}
  ```
- `{@const}`：模板块内的局部常量（不污染脚本作用域）：
  ```svelte
  {#each items as item}
    {@const price = item.qty * item.unit}
    <li>{item.name} — {price}</li>
  {/each}
  ```
- `{@debug a, b}`：开发期在状态变化时打印到控制台，构建时被移除（呼应 `$inspect`）。

---

## 六、元素引用：`bind:this`

拿到 DOM 节点（或子组件实例）引用，**不触发渲染**，只在挂载后可用：

```svelte
<script>
  let canvas;
  $effect(() => { if (canvas) draw(canvas); }); // 挂载后 canvas 才有值
</script>
<canvas bind:this={canvas}></canvas>
```

对标 Vue 模板 ref、React `useRef`（呼应 vue-refs-expose、react-refs）。取子组件实例则配合 `export function`（见 L3 svelte-component-composition）。

---

## 七、三框架模板心智对照

| 需求 | Svelte 5 | Vue 3 | React |
|---|---|---|---|
| 插值 | `{name}` | `{{ name }}` | `{name}` |
| 条件 | `{#if}` | `v-if` | 三元/`&&` |
| 列表 | `{#each ... (key)}` | `v-for :key` | `.map` + `key` |
| 异步块 | `{#await}` | `<Suspense>`+手撸 | 手撸/use |
| 原 HTML | `{@html}` | `v-html` | `dangerouslySetInnerHTML` |
| 元素引用 | `bind:this` | `ref` | `useRef` |

---

## 八、自检清单

- [ ] 会用 `{#if}/{:else}`、`{#each}`、`{#await}` 三种块及各自的 `{:else}/{:then}/{:catch}`。
- [ ] 知道 keyed each `(item.id)` 与 React `key` 同源，能解释 index-key 串状态。
- [ ] 会用 `{@const}` 做块内常量、`{#key}` 强制重建、`{@debug}` 调试。
- [ ] 理解 `{@html}` 的 XSS 风险与消毒责任。
- [ ] 会用 `bind:this` 拿 DOM/组件引用且不触发额外渲染。

---

🚀 **下一关**：`svelte-events` 讲事件——`on:click`、事件修饰符、Svelte 5 把 DOM 事件当**小写属性**（`onclick={...}`）的新写法，以及事件转发。
