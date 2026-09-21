# 事件处理与自定义事件

> 目标：掌握 Svelte 的事件绑定——传统 `on:click`、事件**修饰符**（`|preventDefault`/`|stopPropagation`/`|once`/`|capture`/`|passive`/`|self`/`|trusted`）、Svelte 5 推荐把 DOM 事件当作**小写属性 prop**（`onclick={...}`）来写、带参数的处理函数、以及事件/处理函数的**转发**。对照 React `onClick`、Vue `@click`/修饰符。（呼应 react 事件、vue-events、svelte-props 第三节）

---

## 一、两种写法：`on:` 与小写属性 prop

Svelte 5 里给元素绑事件有**两种等价写法**：

```svelte
<button on:click={increment}>＋</button>      <!-- 传统指令 -->
<button onclick={increment}>＋</button>        <!-- Svelte 5：DOM 事件即小写属性 -->
```

- `on:click` 是历史指令写法，仍然可用。
- **小写 `onclick`** 其实是把 `click` 事件当成一个普通 **prop** 传给元素（DOM 事件属性本就叫 `onclick`）——这正是 Svelte 5 "一切都是 props" 心智的体现，也便于**转发**（见第四节）。
- 注意大小写陷阱：`onclick`（DOM 原生事件属性）vs `onSubmit`/`onXxx`（你自己约定的回调 prop，见 svelte-props），两者语义不同（呼应 svelte-props 第十题）。

---

## 二、事件对象与带参处理

处理函数默认收到原生 `Event` 对象：

```svelte
<script>
  function handleClick(event) {
    console.log(event.target, event.currentTarget);
  }
</script>
<button onclick={handleClick}>go</button>
```

需要传额外参数时，用**内联箭头函数**包一层（否则会被立即调用，和 React 同坑，呼应 react-jsx 找 bug）：

```svelte
<!-- ✅ 正确：包一层 -->
<button onclick={() => remove(todo.id)}>删</button>

<!-- ❌ 错误：render 时就执行了 remove -->
<button onclick={remove(todo.id)}>删</button>
```

---

## 三、事件修饰符

用 `|` 链式修饰，省去手写 `preventDefault`/`stopPropagation`（对标 Vue `.prevent`/`.stop`，呼应 vue-events）：

```svelte
<form on:submit|preventDefault={submit}>...</form>
<div onclick|stopPropagation={inner}>内</div>
<button onclick|once={claim}>只领一次</button>
<input on:keydown|capture={log} />
```

| 修饰符 | 作用 |
|---|---|
| `preventDefault` | `event.preventDefault()` |
| `stopPropagation` | 停止冒泡 |
| `stopImmediatePropagation` | 立即停止后续同节点监听 |
| `passive` | 声明不会 preventDefault，提升滚动性能 |
| `capture` | 捕获阶段触发 |
| `self` | 仅当事件目标是本元素本身才触发 |
| `trusted` | 仅用户真实操作触发（`dispatchEvent` 触发的不算） |
| `once` | 只触发一次后自动解绑 |

> 小写属性 prop 写法（`onclick={...}`）**不带**修饰符语法；需要修饰符时用 `on:xxx|mod` 指令形式。

---

## 四、事件转发与自定义事件

**转发原生事件**：直接在下层元素/组件上写同名事件属性即可，父组件传进来的 handler 会顺着 prop 流下去：

```svelte
<!-- Button.svelte：把 onclick prop 透传到内部 <button> -->
<script>
  let { onclick } = $props();
</script>
<button {onclick}>点我</button>
```

父：`<Button onclick={() => console.log('父收到')} />`

**自定义"事件"= 回调 prop**：Svelte 5 弃用 `createEventDispatcher`，直接用函数 prop（呼应 svelte-props 第三节）：

```svelte
<!-- Search.svelte -->
<script>
  let { onsubmit } = $props();
  let q = $state('');
</script>
<form onsubmit|preventDefault={() => onsubmit?.(q)}>
  <input bind:value={q} />
</form>
```

> 迁移提示：旧教程里的 `createEventDispatcher()` + `dispatch('submit', data)` 在新代码里改成"父传 `onsubmit` 回调、子直接调用"。

---

## 五、window / document / svg 上的事件

指令可作用在 `<svelte:window>`、`<svelte:document>` 等特殊元素上，或直接绑定：

```svelte
<svelte:window onkeydown={handleKey} />   <!-- 监听全局键盘 -->
```

（`svelte:window`/`svelte:document`/`svelte:body` 是内置的"全局元素"，避免手动 `addEventListener` + 清理，呼应 svelte-lifecycle。）

---

## 六、自检清单

- [ ] 知道 `on:click` 与小写 `onclick={...}` 两种写法及各自适用（修饰符只能配 `on:`）。
- [ ] 会用 `() => fn(arg)` 传参，避免"渲染即执行"的坑。
- [ ] 记住常用修饰符：`preventDefault`/`stopPropagation`/`once`/`capture`/`self`/`trusted`。
- [ ] 会用**回调 prop**（`onXxx`）取代 `createEventDispatcher`，能透传 `onclick`。
- [ ] 知道用 `<svelte:window>` 绑定全局事件、免手动增删监听。

---

🚀 **下一关**：`svelte-styling` 进入 Svelte 的另一大卖点——**组件作用域样式**：`<style>` 编译期加类隔离、`:global()`、CSS 自定义属性从 JS 传值。
