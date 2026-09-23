# solid-typescript 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) 为什么 Solid 的 tsconfig 要用 `"jsx":"preserve"` 而不是 `"react-jsx"`？
**来源**：JSX 编译分工题的转述。

Solid 的 JSX 转换规则和 TypeScript 内置的 JSX 转换**不兼容**（Solid 要把 JSX 编成细粒度 DOM + 绑定 effect，而非 createElement）。所以让 TS 只"保留" JSX 做类型检查，真正的转换交给 babel-preset-solid/solid 编译器。再配 `"jsxImportSource":"solid-js"` 让 `JSX.*` 类型来自 solid。

### 2. (A) `createSignal<T>()` 和 `createSignal(初值)` 推断出的类型有何不同？
**来源**：signal 类型与 undefined 题的转述。

`createSignal<number>()`（无初值）→ `Signal<number|undefined>`，getter 是 `Accessor<number|undefined>`。给了初值 `createSignal(0)` → 推断为 `number`、getter `Accessor<number>`，**没有 `| undefined`**。经验：能给初值就别只写类型参数，省掉到处判空。存函数用 `setFn(()=>fn)` 回调形式（setter 无法区分"执行还是原样存"）。

### 3. (B) `useContext(Ctx)` 返回带 `| undefined`，团队想"要么拿到要么炸"，怎么标最稳？
**来源**：context 类型守卫题的转述。

别直接 `useContext(Ctx)!`。惯用：把 context value 造在一个工厂函数里、用 `ReturnType<typeof make>` 定义类型，`useXxx()` 里 `const v=useContext(Ctx); if(!v) throw new Error('必须在 Provider 内使用'); return v;`。这样调用方拿到**非空类型**、误用有可读运行时错误，胜过默默非空断言（默认值虽能消 `| undefined` 但可能掩盖"忘了套 Provider"的静默失败）。

### 4. (A) 能用 `Component<MyProps>` 写一个泛型组件吗？正确姿势？
**来源**：泛型组件类型题的转述。

不能——`Component`/`ParentComponent` 等系列类型承载不了"组件自身的类型参数"。要显式写泛型：`function List<T>(props:{items:T[]}): JSX.Element{...}`（函数声明最省心），或箭头 `const List = <T,>(props:{items:T[]}): JSX.Element => ...`（那个**尾逗号 `<T,>` 必须有**，否则 TSX 把 `<T>` 当 JSX 标签）。

### 5. (B) `{user() && user().name}` 为什么在 TS 里报 "possibly undefined"？React 里不是这样啊？
**来源**：accessor 收窄失效题的转述。

因为 `user()` 是**函数调用**，TS 不认为"两次调用返回同一个非空值"，`&&` 的收窄对普通对象有效、对 accessor 失效（React 里 `user` 是渲染期固定局部值，能收窄）。Solid 三种正解：可选链 `user()?.name`、`<Show when={user()}>{u=><>{u().name}</>}</Show>`（非 keyed 回调给非空 accessor）、`<Show keyed>`（给非空值但值变即重建）。

### 6. (C) 事件处理器类型 `JSX.EventHandler<T,E>` 里 `currentTarget` 和 `target` 分别是什么类型？
**来源**：事件类型题的转述。

`JSX.EventHandler<TElement,TEvent>`：`currentTarget` 恒为 `TElement`（处理器所挂元素、类型稳定），`target` 更泛（可能任意 DOM 元素）。Input/Focus 这类直接绑输入框的事件里 `target` 才被特化成 `HTMLInputElement`。所以拿"所挂元素"的 API（如 `.value`）优先用 `currentTarget`、类型才准；内联 `onInput={(e)=>...}` 会自动推断。

### 7. (A) `<div on:mousemove={...}/>` 原生事件为什么默认报类型错？怎么让它合法？
**来源**：on: 原生事件类型题的转述。

原生 `on:` 事件不在 Solid 默认的自定义事件类型表里，TS 不认。解法：`declare module "solid-js" { namespace JSX { interface CustomEvents extends HTMLElementEventMap {} } }`（放开全部原生事件），或 `extends Pick<HTMLElementEventMap,"mousemove"|"pointermove">` 按需放开；真正的自定义事件则在 `CustomEvents` 里声明 `Name: NameEvent` 这种条目来标 `detail`。

### 8. (B) 同事给 ref 写 `let el!: HTMLDivElement` 然后在 `<Show>` 里 `ref={el}`，运行时报 undefined，问题出在哪？
**来源**：明确赋值断言与条件元素题的转述。

`!`（明确赋值断言）只是"骗过" TS 说一定会被赋值，并不管运行时真不真。`<Show>` 关闭时那个元素根本没渲染、`el` 从没被赋值，读它就是 undefined。官方还提醒 TS 查不出 `createMemo`/`createRenderEffect`/`createComputed` 里对未赋值 ref 的误用。正解：条件存在的元素用 **signal-as-ref**，或老实 `let el: HTMLDivElement | undefined` + 判空。

### 9. (C) `Signal<T>`、`Accessor<T>`、`Setter<T>` 三个类型是什么关系？setter 的"函数形式"类型怎么理解？
**来源**：信号类型家族题的转述。

`type Signal<T> = [get: Accessor<T>, set: Setter<T>]`。`Accessor<T>` 就是 `()=>T`（读）。`Setter<T>` 复杂：既能接受一个直接值，也能接受 `(prev:T)=>T` 回调（拿当前值算新值），返回类型随传入值对齐（像一次赋值）。无参调用会把值重置为 `undefined`。存函数时因歧义要走回调 `set(()=>fn)`。

### 10. (D) 设计：一个组件 `<Select options={...}/>`, 想在 `T` 上泛型、options 携带 `value:T`、onChange 给回 `Accessor<T>`。类型怎么落地？
**来源**：泛型组件 API 设计题的转述。

用函数声明泛型避开 `<T,>` 尾逗号坑：`function Select<T>(props:{options:readonly {label:string;value:T}[]; onChange:(v:T)=>void}):JSX.Element`。props 类型用 `readonly`/`as const` 保 T 推断；回调参数保持 T 关联。若想复用可 `interface SelectProps<T>{...}` 再 `function Select<T>(p:SelectProps<T>)`——因为 Component 类型不能带组件级泛型，必须显式泛型签名。

### 11. (A) 混合 React/Solid 的仓库里，怎么让同一份 tsconfig 下两种 JSX 文件各自正确编译？
**来源**：多 jsxImportSource 共存题的转述。

tsconfig 设一个覆盖多数文件的默认 `jsxImportSource`，再在少数文件顶部用 **文件级 pragma** 覆盖：Solid 文件写 `/** @jsxImportSource solid-js */`、React 文件写 `/** @jsxImportSource react */`。注意选 React pragma 就要真的装好 React 及依赖、且构建链能处理其 JSX。`jsx:"preserve"` 前提不变。

### 12. (C) 迁移一个类型完善的 React 函数组件到 Solid，props 与事件类型上要注意哪几处"看着像其实不同"？
**来源**：迁移类型陷阱题的转述。

① `jsx` 从 react-jsx 改 preserve + jsxImportSource；② props 是 getter Proxy，**别解构**、用到的地方惰性读，`Component<P>` 不能带泛型；③ `React.ChangeEvent<HTMLInputElement>` 换成 Solid 的 `JSX.EventHandler`/`JSX.InputEventHandler`，注意 Solid 委托下 `currentTarget` 恒为元素类型、异步别引用；④ 收窄从 `state && state.x` 改为可选链/`<Show>` 回调（accessor 不收窄）；⑤ ref 用 `!` 或 `| undefined`、条件元素改 signal-as-ref（react-to-solid-migration 汇总）。

🚀 实操请去做 L4 作业：复现泛型组件尾逗号、accessor 收窄三解、on: 原生事件扩命名空间、ref `!` 运行时 undefined 四条线。
