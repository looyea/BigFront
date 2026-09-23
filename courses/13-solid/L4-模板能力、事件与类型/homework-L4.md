# L4 阶段作业：样式、事件与 TypeScript

> 覆盖：solid-refs-styles / solid-events / solid-typescript

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**
```jsx
// 列表项随状态增删
const el = document.querySelector('.item');   // 想拿"我刚点的那个"
```
偶尔操作到别的元素。指出为何不推荐选择器、该用什么。

**Bug 2**
```jsx
let box;
<Show when={open()}>
  <div ref={box}>条件内容</div>
</Show>
// 关掉再打开后，box 指向已脱离文档的旧节点
```
指出 `let box` 形态在 `<Show>` 反复增删下的问题，换成哪种 ref 形态。

**Bug 3**
```jsx
<div ref={(el) => { console.log(el.offsetWidth); }}>…</div>
```
打印 `0`。指出 ref 回调的执行时机与"元素是否已在文档中"的关系、正确测量时机。

**Bug 4**
```jsx
<div style={"color:red;"} />
// 后来又想动态改宽度：
<div style={w() > 0 ? "width:10px;" : ""} />   // 想把 color 也保留
```
一旦走动态分支 color 就没了。指出字符串拼接样式的问题，改用哪种写法逐项更新更安全。

**Bug 5**
```jsx
// 父
<div on:click={() => console.log("父原生")}>
  <button onClick={(e) => { e.stopPropagation(); console.log("子"); }}>x</button>
</div>
```
点 button 仍先打印"父原生"再"子"。指出委托 `onClick`+`stopPropagation` 为何拦不住父元素原生监听、怎么改才只打"子"。

**Bug 6**
```jsx
const [fn, setFn] = createSignal(() => console.log("v1"));
<button onClick={fn} />           // 后来 setFn(新函数)，点击还用旧的
```
指出"事件处理器不是响应式的"这条铁律、给出能每次用最新函数的写法。

**Bug 7**
```jsx
<button onClick={(e) => {
  setTimeout(() => console.log(e.currentTarget.id), 100);   // 想看按钮 id
}}/>
```
报 `Cannot read id of null`。指出委托下 `currentTarget` 的生命周期、两处改法。

**Bug 8**
```jsx
<input onChange={(e) => setQ(e.target.value)} />   // 想"边打字边过滤"
```
要失焦才更新。指出 `onChange` 与 `onInput` 在 `<input>` 上的原生时机差别、该用哪个。

**Bug 9**
```tsx
const [user, setUser] = createSignal<User>();
return <div>{user() && user().name}</div>;   // TS 报 Object is possibly 'undefined'
```
指出为什么普通对象的 `&&` 收窄在 accessor 上失效、给两种修法。

**Bug 10**
```tsx
const List = <T>(props: { items: T[] }): JSX.Element => <For each={props.items}>{()=><li/>}</For>;
```
TSX 里 `<T>` 被解析成 JSX 标签、报错。指出泛型箭头组件的语法修法，并说明为何不能用 `Component<T>`。

## 二、手写改造（5 小题，写出关键代码）

**手写 1** 有一个按钮，点击后弹出一个 `<dialog>`（用 `<Show>` 控制存在与否），你要持有这个 dialog 元素调 `.showModal()`、关闭时引用自动失效。用 **signal-as-ref** 写出完整最小代码。

**手写 2** 写一个自定义指令 `highlight(el, accessor)`：元素背景随传入的布尔 signal 在黄/透明间切换（内部用 `createEffect` 读 `accessor()`）。给出 TS 里 `JSX.Directives`（或 `DirectiveFunctions`）的类型声明与 `<div use:highlight={on()} />` 用法。

**手写 3** 一个 5000 行的 `<For>` 表格，每行有"删除"按钮。用**数组绑定** `onClick={[remove, row.id]}` 减少闭包，并说明 Solid 为什么只需一个 document 级 click 委托就覆盖全表；给出 `remove(id, event)` 的签名。

**手写 4** 用 **ref 转发**写一个 `<Canvas>`：父组件 `let c; <Canvas ref={c}/>`，`Canvas` 内部把 `props.ref` 挂到自己的 `<canvas>` 上；父再拿 `c` 画东西。指出子组件收到的 `props.ref` 是什么形态、要不要 `typeof` 判断。

**手写 5（TS）** 给"主题 context"写类型：工厂 `makeTheme()` 返回 `{theme, setTheme}`（theme 是 signal），用 `ReturnType` 定 `ThemeCtx`，`createContext<ThemeCtx>()`，并写一个 `useTheme()` 在无 Provider 时抛出可读错误（不用 `!`）。

## 三、场景大题（1 题）

**场景：一个可拖拽、可折叠、带实时搜索输入的高级面板组件。** 需求逐条回答：

(a) 面板要能拿到根元素做位置计算、又要能被父组件转发引用、根元素还会在折叠时被 `<Show>` 卸载——三种 ref 能力各用在哪、如何共存？
(b) 面板标题点击展开/收起；点击内部按钮要 `stopPropagation` 冒泡；标题上的点击要"用到最新的回调 props"。分别该用 `onClick` 还是 `on:click`？动态类名（展开态）怎么写才不覆盖其它类？
(c) 面板里有个搜索框要"边打字边过滤"、还有一个"记住每行 hover 高亮"的复用行为。`onInput`/`onChange` 选哪个？hover 复用行为用回调 ref 还是 `use:` 指令、为什么？
(d) 用 TypeScript 给这个组件签名：它要泛型于"行数据类型 `T`"、props 里 `renderRow` 是 `(row:T)=>JSX.Element`。给出函数声明式的泛型签名，并解释为什么不用 `Component<Props>`、以及 `renderRow` 返回类型写 `JSX.Element` 的依据。

## 四、简答题（3 题）

**简答 1** 列表说明 `onClick`（委托）与 `on:click`（原生）在：监听器落点、大小写敏感性、`stopPropagation` 是否如你所愿、性能适用场景 四个维度的连锁差异，各给一句"何时用哪个"。

**简答 2** 为什么 `{user() && user().name}` 在 TS 里报错而 React 组件里不报？给出可选链、`<Show>` 非 keyed 回调、`<Show keyed>` 三种修法，并说清三种里回调拿到的分别是什么（值/非空 accessor）、哪种会随值变重建。

**简答 3** ref 的三种形态（变量 / 回调 / signal）各自适用场景是什么？为什么 `class={active()?'on':''}` 能在不重渲组件的情况下更新样式（从"属性绑定=render effect"角度答）？

## 五、挑战题 🏆

**"一个可折叠面板的四重问题"**：下面这段有四处各自独立的问题：
```tsx
function Panel(props: { onToggle?: (open: boolean) => void }) {
  const [open, setOpen] = createSignal(false);
  let box!: HTMLDivElement;                              // (A)
  return (
    <div
      ref={box}
      class={"panel" + (open() ? "open" : "")}           // (B)
      onClick={() => { setOpen(o => !o); props.onToggle?.(!open()); }}   // (C)
    >
      <Show when={open()}>
        <input on:input={(e) => props.onType(e.currentTarget.value)} ref={box} />  {/* (D) */}
      </Show>
    </div>
  );
}
```
(a) 指出 (A)+(D) 复用同一个 `let box` 且用在 `<Show>` 里的引用失效问题，给出正确持有"当前可见元素"的 ref 形态；
(b) (B) 的类名字符串拼接有什么隐患（空格/覆盖/动态性）？改用哪种属性写法能"只切 open 这一个类、保持响应式"？
(c) (C) 里 `props.onToggle?.(!open())` 传的是"取反前"还是"取反后"的值、为什么异步/闭包里读 `open()` 可能不是你想要的那个，给出稳妥写法（用 setter 回调里的新值）；
(d) 综合：把 (A)–(D) 修正成一份"折叠态类名响应式、根元素可安全持有、onToggle 拿到准确新值、搜索框输入即时更新且类型正确（`on:input` 是否需要、还是该用 onInput/委托）"的最终版，并用一句话总结 (A)(B)(C)(D) 分别对应本阶段哪条主线（ref 生命周期 / classList 响应式 / handler 现读最新 / input vs change + TS 事件类型）。

---

**本阶段关键词**：不推荐 querySelector、ref 三形态(变量赋值/回调/signal-as-ref)、赋值发生在入 DOM 前、Show 反复增删用 signal-as-ref、ref 转发子收到恒为回调、use: 指令(element,accessor)/多指令/吃响应式/入DOM前调用、onlyRemoveTypeImports 防树摇、JSX-as-value、Solid 不内置 CSS 方案、class/className、classList 布尔开关、style 对象逐项、属性绑定=render effect 故不重渲、onClick 委托 vs on:click 原生、委托大小写不敏感/原生敏感、委托事件清单、偶发事件用原生、每类型一个常驻 document 监听、stopPropagation 委托下失效、Portal 按组件树传播、onInput 即触发/onChange 失焦、handler 非响应式(包函数现读)、数组绑定 [handler,data] 省 bind、currentTarget 异步 null、jsx:preserve+jsxImportSource、createSignal<T> 的 |undefined、Signal/Accessor/Setter、createContext/useContext 带 |undefined、工厂+ReturnType+useXxx 抛错守卫、Component/ParentComponent/VoidComponent/FlowComponent、泛型组件不能用 Component 要显式 <T>/尾逗号 <T,>、JSX.EventHandler<TEl,TEv>、currentTarget 恒为 T、on: 原生事件默认报错需扩 CustomEvents/HTMLElementEventMap、accessor 不能 && 收窄(可选链/Show 非keyed/keyed)、ref 的 ! 明确赋值断言

**判分口径**：Bug 每题 3 分、手写每题 7 分、场景 20 分、简答每题 5 分、挑战加分 10 分（总分 100+10）。≥72 为合格；挑战题答出 (a)(b) 即得 4 分基础分，(c)(d) 各 +3。

交卷后自评三道小测各对 ≥5 题视为过关。

🚀 **下一站 L5**：异步、Resource 与错误——`createResource`/`createAsync`/`on` 源把 Promise 纳入细粒度系统，`<Suspense>` 流式与 `<SuspenseList>` 协调、`<ErrorBoundary>` 捕获与 `reset`，以及 SSR 数据加载与水合下的异步纪律。
