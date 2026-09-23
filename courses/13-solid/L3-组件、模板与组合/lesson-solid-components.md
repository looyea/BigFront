# 组件是只执行一次的函数，props 是惰性 getter

> 目标：把 React 的"组件=随状态反复重执行的渲染函数"改写成 Solid 的"组件=只在创建时执行一次、把响应式交给 props getter 与内部订阅"——掌握 **props 是一个 Proxy/getter 对象**（因此绝不能解构、不能提前存普通变量、必须在真正要用时惰性读）、**单向只读数据流**（往上走靠回调或共享 signal，而非改 props）、`mergeProps`/`splitProps` 两个保响应式的 props 工具，以及组件类型（`Component`/`ParentComponent`/`VoidComponent`/`ComponentProps`）与 children 的求值时机（呼应 solid-overview、solid-signals、svelte-components）

## 一、组件是普通函数，只跑一次

Solid 官方对组件层的定性：**"Components in Solid are plain functions that run once. Their reactive behaviour comes from the signals/memos/effects they read at render time, not from a re-render loop."**

```jsx
function Greeting(props) {
  console.log("Greeting 执行");      // 只打印一次
  return <h1>Hello {props.name}</h1>; // name 变化时，只有这个文本节点更新，函数不再执行
}
```

编译器把 `<Greeting name={x()} />` 变成 `createComponent(Greeting, props)`：它**新建一个子 Owner、把 props 包成 getter/Proxy、然后 `untrack(()=>Greeting(props))` 调用一次**。"更新"根本不发生在组件调用这一层，而在它返回的那些订阅了 signal 的 DOM 绑定上（solid-overview 的编译派心智落到组件层）。

## 二、props 是惰性 getter —— 三条铁律

props 不是普通对象，编译器为**每个 prop 生成 getter**，这样组件内**读它的动作**才能订阅到上游 signal。由此推出 Solid 组件的第一号纪律：

```jsx
// ❌ 解构 = 在函数执行那一瞬把值定格，之后永远不更新
function C({ title }) { return <h1>{title}</h1>; }
// ❌ 提前存普通变量，同理冻结
function C(props) { const t = props.title; return <h1>{t}</h1>; }
// ✅ 惰性读：在 JSX/effect/回调里用到时才 props.title()…… props 读起来不用加()，关键是"在用的地方读"
function C(props) { return <h1>{props.title}</h1>; }
```

- **别在组件顶部解构 props**（会把值冻结在首次读取）；
- **别把 props 的值提前赋给普通变量再用**；
- **始终在真正要用它的作用域里读 `props.foo`**（JSX 表达式、`createEffect`、事件回调里现读）。

> 注意：props 读起来是 `props.title`（属性访问即触发 getter），不像 signal 要 `title()`。这是 props Proxy 与 signal getter 的手感差异。

## 三、children 在父作用域求值

`props.children` 是父组件传进来的 JSX，**在父作用域里就已经求值**（作为 prop 传入）。所以子组件里 `{props.children}` 只是把它插入到 DOM 的某位置。若你要"子组件把某些值回填进 children"，React 那种 `props.children(item)` 克隆做法在这里不适用——Solid 用 **render props / 显式回调函数 prop** 表达：

```jsx
<List items={data()} render={(item) => <Row item={item} />} />
// List 内部：{props.render(item)}
```

## 四、单向数据流：props 只读，往上走有两条路

Solid 官方鼓励 **one-way data flow**：props 是从父到子的**只读/不可变**值。子组件不该改 props。数据要"往上/横向"传递，两条正路：

1. **回调 prop**：父把 `onXxx` 函数传下来，子调用它（最直接的受控写法）；
2. **共享 signal/store**：把状态提升到共同父级，或用 Context 注入（下一关）。

```jsx
function Counter({ onChange }) {
  const [n, setN] = createSignal(0);
  return <button onClick={() => { const v = n() + 1; setN(v); onChange?.(v); }}>{n()}</button>;
}
```

绝不要写 `props.count = 5` 之类的改 props——Proxy 只读，且改了也不符合单向流。

## 五、mergeProps / splitProps：不破坏响应式的 props 操作

普通对象展开 `{...props}` 会**立刻求值**所有 prop、丢掉 getter 的惰性。Solid 提供两个保住 Proxy 契约的工具：

```jsx
import { mergeProps, splitProps } from "solid-js";

// ① 合并默认值 / 多来源 props（后者优先，按逆序找到第一个有值即返回，且保持响应式）
const merged = mergeProps({ size: "md" }, props);

// ② 拆出你要用的，剩余转发给内部元素（等价 React 的 ...rest，但不丢响应）
const [local, rest] = splitProps(props, ["type", "onClick"]);
return <input {...local} {...rest} />;
```

`splitProps` 常用于"组件想吃掉几个 prop、把其余原样 spread 到根 DOM 元素"。两者都返回 Proxy，维持惰性订阅。

## 六、组件类型（标注用，L4 细讲）

- `Component<P>`：`(props: P) => JSX.Element`，最基础。
- `ParentComponent<P>`：带可选 `children` 的组件。
- `VoidComponent<P>`：禁止 children。
- `FlowComponent<P, C>`：要求特定形状 children（如 `<For>`）。
- `ComponentProps<T>`：从组件反推它的 props 类型。

```tsx
const Greeting: ParentComponent<{ name: string }> = (props) => (
  <h1>Hello {props.name}{props.children}</h1>
);
```

## 七、自检清单

1. 为什么说 Solid 组件"只执行一次"？props 变化时到底什么在更新——是组件函数重跑，还是别的？
2. 写出 props 的"三条铁律"，并解释为什么 `const {title}=props` 和 `const t=props.title` 都会让标题冻结，而 `{props.title}` 不会。
3. props 读起来是 `props.x`，而 signal 读起来是 `x()`——这个手感差异从何而来（Proxy get vs 显式 getter 函数）？
4. 子组件想把数据"传回"父组件，两条正路是什么？为什么绝不能 `props.count = 5`？
5. `{...props}` 和 `splitProps`/`mergeProps` 的关键区别是什么（提示：立即求值 vs 保住 getter）？给一个用 `splitProps` 转发剩余 props 到 `<input>` 的例子。

🚀 下一关：solid-control-flow——既然组件不重渲，列表和条件就不能用 `.map`/`&&`/三元"每次重算"，必须交给 `<For>`/`<Index>`/`<Show>`/`<Switch>` 这些会建立响应式订阅的控制流组件。
