# 控制流组件：For / Index / Show / Switch

> 目标：把 React 的 `.map`、`&&`、三元这三套"每次渲染重算"的写法彻底换掉——Solid 里 JSX 表达式只求值一次，条件与列表必须交给**会建立响应式订阅的控制流组件**。掌握 `<For>`（keyed，记忆 item→DOM，身份变了才重挂）与 `<Index>`（位置式，index 静态、item 是 accessor）的区别与选型、`<Show when>` 的 `fallback` 与 **keyed/非 keyed 收窄回调**、`<Switch>/<Match>` 多分支；理解它们内部都是 `createMemo`+`mapArray`/`indexArray`（呼应 solid-components、solid-memo、react-vs-solid 迁移）

## 一、为什么 `.map` / `&&` / 三元在 Solid 里会"冻结"

组件只执行一次，JSX 里的表达式也就只跑一次：

```jsx
// ❌ 列表：items 变了不会重画——.map 只在组件执行那刻算了一遍
{items().map(t => <li>{t}</li>)}
// ❌ 条件：&& 同理，once-and-done
{show && <Banner/>}
```

`.map` 返回的是**一个固定的元素数组**，之后 `items` 再变，没有谁去重跑这段——于是列表定格。Solid 的解法是：**别用数组方法，用控制流组件**，它们内部建 `createMemo`，`each`/`when` 变化时才做**最小 DOM 协调**。

> 例外：如果这个列表**永远不变**（一次性静态数据），`.map` 当然能用——问题只出在"它会变"。

## 二、`<For>`：keyed 列表（默认首选）

```jsx
import { For } from "solid-js";

<For each={props.todos()} fallback={<p>空</p>}>
  {(todo, index) => <li>{todo.text} #{index()}</li>}
</For>
```

- `each` 传**信号/访问器**（这里 `props.todos()`），children 是 `(item, index: Accessor<number>) => JSX` 回调；`index` 是**访问器**（要 `index()`）。
- 底层是 `mapArray`：为**每个 item 身份**建一份响应式并记忆 item→DOM。**item 换了引用才重挂那块 DOM；仅位置变化（增删/重排）只移动已有节点、更新 `index()`，不重建。**
- 整体包在 `createMemo` 里，只有 `each` 真正变化才协调。

**这就是"改一行不刷全表"的机制**：每行的 DOM 与它绑定的 item 一一锁定（solid-stores 表格里 `<For>` keyed 让 4999 行不动）。

## 三、`<Index>`：位置式列表（身份不稳定时用）

```jsx
import { Index } from "solid-js";

<Index each={props.items()}>
  {(item, index) => <li>{item().text} #{index}</li>}   {/* item 是 accessor，index 是静态数字 */}
</Index>
```

- 底层 `indexArray`：按**位置**绑定，children 回调拿到的是 `(item: Accessor<T>, index: number)`——注意这里 **`item` 是访问器（`item()`）、`index` 是普通数字**（与 `<For>` 正好相反）。
- 位置不换就不重建；**两个 item 交换位置时，它们的 accessor 指向新值、但 owner/DOM 留在原位**。

选型口诀：

| 场景 | 用 | 因为 |
|---|---|---|
| item 有稳定身份、会增删/重排 | `<For>` | keyed 记忆身份→DOM，重排只移动不重建，input 焦点/DOM 状态保住 |
| 列表按索引渲染、item 是原始值或无稳定 id | `<Index>` | 位置即身份，避免 keyed 比对开销 |

大多数业务列表用 `<For>`；只有"纯按下标、内容整体替换"时才考虑 `<Index>`。

## 四、`<Show when>`：条件渲染与 keyed/非 keyed

```jsx
import { Show } from "solid-js";

<Show when={user()} fallback={<Spinner/>}>
  <Profile name={props.user().name} />
</Show>
```

- `when` 为真才渲染 children，`fallback` 是假时的占位。它用 `untrack + createMemo(when)`，只在条件翻转时增删 DOM。
- **收窄回调**（v1.7+，给 TS 用）：children 写成函数时——
  ```jsx
  // 非 keyed：回调拿到"收窄后的 accessor"，条件转假后再读它会抛错，不重建节点
  <Show when={user()}>{u => <div>{u().name}</div>}</Show>
  // keyed：值一变就重建 children，回调拿到的是值本身
  <Show when={user()} keyed>{u => <div>{u.name}</div>}</Show>
  ```
  非 keyed 省重建、keyed 保证"值是新的那份"。

## 五、`<Switch>` / `<Match>`：多分支

```jsx
import { Switch, Match } from "solid-js";

<Switch fallback={<Unknown/>}>
  <Match when={status() === "loading"}><Spinner/></Match>
  <Match when={status() === "error"}><Err/></Match>
  <Match when={status() === "ok"}><Content/></Match>
</Switch>
```

渲染**第一个 `when` 为真的 `<Match>`**，都不真则 `fallback`。等价于一个惰性、按分支建订阅的 if/else 链——比嵌套三元可读、且不会"一次求值全展开"。

## 六、顺带认个脸（L5 细讲）

控制流家族里还有 `<ErrorBoundary fallback>`（捕获后代抛错、`fallback` 可为 `(err, reset)=>JSX`）、`<Suspense>`/`<SuspenseList>`（resource 挂起时显示 fallback）、`lazy()`（异步组件）。它们与 Owner/错误上下文交织，本关只需知道"它们也是响应式控制流组件、不是 React 那种每帧重渲"。

## 七、自检清单

1. 为什么 `{items().map(...)}` 和 `{show && <X/>}` 在 Solid 里对"会变的数据"会失效？组件只执行一次这个事实如何解释它？
2. `<For>` 的 children 回调两个参数分别是什么类型（谁要加 `()`）？`<Index>` 呢？为什么说它们"正好相反"？
3. 一个会被重排、含输入框的待办列表，该用 `<For>` 还是 `<Index>`？从"重排是否重建 DOM、输入焦点是否保住"解释 keyed 记忆 item→DOM 的价值。
4. `<Show>` 的 keyed 与非 keyed 收窄回调有何区别（是否重建、回调拿到值还是 accessor、条件转假后读会怎样）？
5. 多状态(loading/error/ok)渲染为什么优先 `<Switch>/<Match>` 而不是嵌套三元？`fallback` 何时显示？

🚀 下一关：solid-context-composition——多层组件传值不用一层层 drill，`createContext` 把 signal/store 注进 Owner 树让后代细粒度共享；并讲"组合优于配置"的组件拆分与逻辑复用函数。
