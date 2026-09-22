# TypeScript：给细粒度响应式标注类型

> 目标：把 Solid 的响应式与 JSX 心智翻译成类型——为什么必须 `"jsx":"preserve"` + `"jsxImportSource":"solid-js"`、`createSignal<T>` 的 `Signal/Accessor/Setter` 三元组与"默认值消除 `| undefined`"、`createContext<T>`/`useContext` 为何返回带 `| undefined`（工厂函数 + `ReturnType` 的惯用打法）；`Component<P>`/`ParentComponent`/`VoidComponent`/`FlowComponent` 与**泛型组件不能用 Component 类型**要显式 `<T>`；`JSX.EventHandler<T,E>` 与 `currentTarget` 恒为 `T`、自定义/原生 `on:` 事件如何扩 `JSX` 命名空间；以及 Solid 最反直觉的一条——**accessor 不能用 `&&` 做控制流收窄**（呼应 solid-components、solid-events、solid-signals）

## 一、两处必配：`jsx: "preserve"` + `jsxImportSource`

```jsonc
{ "compilerOptions": {
    "jsx": "preserve",              // 保留原始 JSX，不让 TS 转换
    "jsxImportSource": "solid-js"   // JSX 类型来自 solid-js
}}
```
为什么是 `preserve`：**Solid 的 JSX 转换与 TypeScript 自带的 JSX 转换不兼容**——转换交给 babel-preset-solid/solid 编译器做，TS 只保留 JSX 形态做类型检查。混合 React/Solid 项目可文件级 `/** @jsxImportSource solid-js */` 覆盖默认。完整推荐还含 `strict/target:ESNext/module:ESNext/moduleResolution:node/noEmit/isolatedModules` 等。

## 二、Signal 的类型：`Signal<T> = [Accessor<T>, Setter<T>]`

```ts
const [count, setCount] = createSignal<number>();   // Signal<number | undefined>
```
- getter `count` 是 `Accessor<number|undefined>`，即 `() => number | undefined`；
- setter `setCount` 是 `Setter<...>`：可直接给值，也可给 `(prev)=>next` 回调；无参调用会把值重置为 `undefined`；
- **给默认值就消掉 `| undefined` 并自动推断**：`createSignal(0)` → `Accessor<number>`。
- **存函数时** setter 无法区分"要执行还是原样存"，用回调形式：`setFn(() => value)`（呼应 solid-signals 相等短路/函数式更新）。

## 三、Context：`useContext` 为何带 `| undefined`

```ts
type Data = { count: number; name: string };
const dataContext = createContext<Data>();          // Context<Data | undefined>
useContext(dataContext);                            // Data | undefined —— 祖先链上可能没有 Provider
```
消掉 `| undefined` 两条路：① **给默认值** `createContext({count:0,name:""})`；② 更稳的**工厂 + ReturnType** 惯用法，再在 `useXxx` 里**抛错守卫**：
```ts
export const makeCtx = (c = 0) => { const [count,setCount]=createSignal(c); return {count,setCount}; };
type CtxT = ReturnType<typeof makeCtx>;
const Ctx = createContext<CtxT>();
export const useCtx = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCtx 必须在其 Provider 内调用");   // 比非空断言更安全
  return v;
};
```

## 四、组件类型与泛型组件

默认组件是 `Component<P>`（`P` 是 props 对象类型）；`JSX.Element` 表示"任何可渲染物"。类型能挡掉多余 prop/children：
```ts
const Counter: Component = () => <button>{count()}</button>;
<Counter/>;            // ✔️
<Counter initial={5}/>; // ❌ 没定义 initial
<Counter>hi</Counter>;  // ❌ 不接收 children
```
带 children 用 `ParentComponent`（含可选 `children?`），无 children 用 `VoidComponent`，`<Show>/<For>` 类用 `FlowComponent`。

**关键坑：`Component` 系列类型不能直接造泛型组件**，得显式写泛型：
```tsx
const MyList = <T,>(props: { items: T[] }): JSX.Element => /* ... */;   // 箭头函数要 <T,>（尾逗号避免被当 JSX）
function MyList<T>(props: { items: T[] }): JSX.Element { /* ... */ }    // 或函数声明，最省心
```

## 五、事件类型：`JSX.EventHandler<T, E>` 与扩命名空间

```ts
import type { JSX } from "solid-js";
const onInput: JSX.EventHandler<HTMLInputElement, InputEvent> = (e) => e.currentTarget.value;
```
`JSX.EventHandler<TElement, TEvent>` 让 **`currentTarget` 恒为 `T`**、`target` 更泛（Input/Focus 才特化成 `HTMLInputElement`）。内联 `onInput={(e)=>...}` 自动推断、无需标注。

**`on:` 原生事件默认会报类型错**（它们不在 Solid 自定义事件类型里），两种解法：
```ts
// 自定义事件：扩 JSX.CustomEvents
declare module "solid-js" { namespace JSX { interface CustomEvents { Name: NameEvent } } }
<div on:Name={(e) => e.detail.name} />
// 想让所有/部分原生事件可用：
interface CustomEvents extends HTMLElementEventMap {}          // 全部
interface CustomEvents extends Pick<HTMLElementEventMap, "mousemove"|"pointermove"> {}  // 按需
```
1.9+ 还能用 `JSX.EventHandlerWithOptions` 给监听器传 `{ once:true, handleEvent }`。

## 六、accessor 不能用 `&&` 收窄（Solid 独有反直觉）

普通对象能 `user && user.name`，但 **signal 的 `user()` 是函数调用，TS 不认为两次调用是同一个非空值**：
```tsx
const [user, setUser] = createSignal<User>();
return <div>{user() && user().name}</div>;   // ❌ Object is possibly 'undefined'
```
三种正解：
```tsx
{user()?.name}                                       // ① 可选链
<Show when={user()}>{(u) => <>{u().name}</>}</Show>  // ② 非 keyed 回调收窄（拿到非空 accessor）
<Show keyed when={user()}>{(u) => u.name}</Show>     // ③ keyed：拿到非空值，但值变即重建
```
要传进"只接受 `User` 不接受 undefined"的组件，用 Show 回调 `nonNullishUser()`；联合类型区分（Admin|OtherUser）用 `createMemo` 先窄化。`(user() as User).name` 强转可用但**异步再访问有运行时风险**（solid-events 的 currentTarget 同理）。

## 七、ref 的类型与 `!`

TS 严格空检查下 `let el: HTMLDivElement` 直接 `.focus()` 报错（可能未赋值）。三档处理：
```ts
let divRef: HTMLDivElement | undefined;                 // 老实判空：onMount 里 if(!divRef) return
let divRef!: HTMLDivElement;                            // 明确赋值断言（快但运行时可能真 undefined）
return <div ref={divRef!} />;                           // 或在 ref 处断言"之后会被赋值"，最贴合 Solid 机制
```
官方提醒：TS 目前**查不出** `createMemo`/`createRenderEffect`/`createComputed` 里对未赋值 ref 的误用，这几处要格外小心（solid-refs-styles 的 signal-as-ref 是更安全替代）。

## 八、自检清单

1. Solid 项目为何必须 `"jsx":"preserve"` 而不是 react 的 `jsx` 转换？`jsxImportSource` 起什么作用、混合项目怎么做文件级覆盖？
2. `createSignal<number>()` 与 `createSignal(0)` 的类型差别是什么（`| undefined` 从哪来、怎么消）？存函数时 setter 要注意什么？
3. `useContext(Ctx)` 的返回类型为什么带 `| undefined`？给出"工厂 + ReturnType + useXxx 抛错守卫"的完整套路，并说它比 `!` 强在哪。
4. 为什么不能用 `Component<{...}>` 写泛型组件？箭头函数版要注意什么语法细节？
5. `{user() && user().name}` 为什么报错？列出三种正确收窄写法并说明 Show 非 keyed 与 keyed 回调各自拿到什么、何时重建。

🚀 下一站 L5：异步、Resource 与错误——`createResource`/`createAsync`/Suspense 如何把 Promise 纳入细粒度系统，以及 `<ErrorBoundary>` 与 SSR 数据流式加载。
