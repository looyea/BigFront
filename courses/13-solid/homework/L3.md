# L3 阶段作业：组件、模板与组合

> 覆盖：solid-components / solid-control-flow / solid-context-composition

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**
```jsx
function Card({ title }) {          // 父组件会更新 title
  return <h1>{title}</h1>;
}
```
标题只显示首值、之后不更新。指出这行错在哪、两种改法。

**Bug 2**
```jsx
function Greet(props) {
  const name = props.name;          // 想在下面用
  return <p>Hi {name}</p>;
}
```
`props.name` 变了页面不动。指出与 Bug 1 是否同因、正确写法。

**Bug 3**
```jsx
const [items, setItems] = createSignal(['a','b']);
return <ul>{items().map(x => <li>{x}</li>)}</ul>;
```
`setItems([...items(),'c'])` 后列表不变。指出为什么 .map 失效、改用哪个组件。

**Bug 4**
```jsx
return <div>{isOpen && <Panel/>}</div>;   // isOpen 是 signal，会切换
```
面板一直不出现/不消失。指出 `&&` 为何不行、换成什么。

**Bug 5**
```jsx
<For each={props.list()}>
  {(item, i) => <li>{i + 1}. {item.text}</li>}   // 想显示序号 1、2、3
</For>
```
序号显示成 "NaN" 或 "[object Object]"。指出 `<For>` 的 `i` 是什么类型、怎么修。

**Bug 6**
```jsx
<Index each={props.rows()}>
  {(row, idx) => <td>{row.value}</td>}          // 想读每行 value
</Index>
```
单元格空白/报错。指出 `<Index>` 的 `row` 是什么、怎么读，并对比 Bug 5 里 For 的参数。

**Bug 7**
```jsx
const view = createMemo(() => list().map(x => ({ id: x.id, label: x.label.toUpperCase() })));
<For each={view()}>{v => <Row v={v}/>}</For>
```
每次 label 变，**整表所有 Row 全部重挂**。指出身份问题与修法（尽量复用原对象引用）。

**Bug 8**
```jsx
const [count, setCount] = createSignal(0);
<Ctx.Provider value={{ count: count(), setCount }}>   // 注意 count()
  <DeepChild/>
</Ctx.Provider>
```
DeepChild 里读到的 count 恒为 0。指出放进 context 的是 signal 还是快照、怎么改。

**Bug 9**
```jsx
function useNow() {
  const [t, setT] = createSignal(Date.now());
  const id = setInterval(() => setT(Date.now()), 1000);   // 组件卸载后还在跑
  return t;
}
```
指出资源未回收的根因、该用哪个原语包一层、写在哪。

**Bug 10**
```jsx
function Child(props) {
  props.value = props.value + 1;      // 想"回传给父"
  return <button onClick={() => props.value}>...</button>;
}
```
改 props 无效/报错。指出 Solid 的单向流原则、数据回流父级的两条正路。

## 二、手写改造（5 小题，写出关键代码）

**手写 1** 有一个 `<Button>`，希望父没传 `size` 时默认 `"md"`、传了则覆盖，并保持响应式。用 `mergeProps` 写出实现，说明为什么不能 `{ size:'md', ...props }`。

**手写 2** 写一个 `<Field>`，它吃掉 `label` 这个 prop，把**其余全部 props** 转发给内部 `<input>`。用 `splitProps` 实现，并解释用 `{...props}` 手动 spread 会丢什么。

**手写 3** 用 **render prop** 实现 `<DataList rows={rows()} renderRow={(row,i)=>JSX} />`：由父决定每行怎么画、子负责 `<For>` 遍历，让"列表结构"与"行渲染"解耦。

**手写 4** 用 **Local Context** 模式写一个 `<TodoProvider>`：内部 `createStore` 建 todos、通过 context 把 `store` 与 `add`/`toggle` 提供出去，导出 `useTodos()` 收口 `useContext`。让深处两个组件分别只订阅它们用到的部分。

**手写 5** 把 Bug 3 的静态 .map 列表改成 `<For>`，并说明当某行增删时"为什么其余行不重建"；再把它换成 `<Index>`，指出含输入框时会有什么不同。

## 三、场景大题（1 题）

**场景：全站主题 + 局部覆盖 + 分散字段表单。** 需求：顶层共享 `theme`（浅/深）与 `notifications`（一个 store 数组）；某块区域要**强制浅色**而不影响外层；一个跨多层的大表单，各字段组件分散各处，既要共享同一个表单 store，又要能"往表单注册一个校验器"，最后提交时统一跑校验。请只用本阶段三关知识给出方案并逐条回答：

(a) theme、notifications 分别放进 context 的 value 里应该是**什么形态**（signal？store？它们的快照？）？为什么这样切主题时只有真正读 theme 的文字更新、而读 notifications 的组件不动？
(b) "这块区域强制浅色"用什么机制实现、不改任何组件的 props？给出嵌套写法。
(c) 分散字段如何共享表单 store 又保持细粒度更新（提示：store 按 path 读）？字段"往表单注册校验器"用什么、为什么它仍符合单向流？
(d) 有人提议"把表单大对象每次 setState 成新引用再放 context，好让提交处能拿到最新"。指出这会引发的过度订阅问题，给出正确做法。

## 四、简答题（3 题）

**简答 1** 用"组件只执行一次"这一事实，解释为什么 props 要"用到时才惰性读"，以及 `const {x}=props`、`const x=props.x`、`<For>`/`.map` 三者里有几个会"冻结"、分别为什么。

**简答 2** 一张表说明 `<For>` 与 `<Index>` 的：底层(mapArray/indexArray)、两个回调参数的形态（谁要加 `()`）、绑定依据（身份 vs 位置）、各自适用场景。再点出"含未提交输入的可重排列表为何必须用 For"。

**简答 3** 对比 React Context 与 Solid Context 在"value 变化时消费者如何更新"上的根本区别，并据此说明：为什么 Solid 应把 **signal/store 本身**而非其快照放进 context value？`useContext` 在什么情况下直接抛错？

## 五、挑战题 🏆

**"一个复用函数的四重问题"**：同事把 React 习惯带进来，写了下面这段跨多层组件共享的"购物车逻辑"，功能勉强能跑但有四处独立问题：
```jsx
// store 每帧/每次渲染都重建
function Cart() {
  const items = props.items;                    // (A) 顶部解构
  const ctxValue = { items: props.items(), add: (x)=>props.setItems([...props.items(), x]) }; // (B)
  return <CartCtx.Provider value={ctxValue}>     // (C) 每次渲染 new 一个 value
    {props.items().map(it => <Row it={it} key={it.id}/>)}   {/* (D) */}
  </CartCtx.Provider>;
}
function Row(props){
  const {add} = useContext(CartCtx);
  return <div>{props.it.name}<button onClick={()=>add(props.it)}>+</button></div>;
}
```
(a) 指出 (A) 解构 `props.items` 的冻结问题，以及 (B) `ctxValue.items` 存的是快照还是响应式——两者都会让深处读到旧值，给出正确"往 context 放 signal/store 本体"的写法；
(b) (C) 每次渲染都 new 一个 `ctxValue`，在 React 里会广播重渲，在 Solid 里问题略有不同——说明 Solid 消费者为何仍可能被无谓惊动，应如何把响应式留在 signal 层、context 只传引用；
(c) (D) 用 `.map` + `key` 是 React 肌肉记忆，指出它在 Solid 为何不成立，改用什么、`key` 还需不需要、增删行为会怎样变；
(d) 综合：把这段重写成"购物车 store 经 Local Context 提供、Row 按身份 keyed 渲染、add 走 store 路径更新只动对应行"的正确版，并一句话总结 (A)(B)(C)(D) 分别落在本阶段哪条主线（惰性读 props / context 放响应式引用 / 组合优于配置 / 控制流 keyed）。

---

**本阶段关键词**：组件是只执行一次的函数、createComponent 建子 Owner+包 Proxy、props 是惰性 getter/Proxy、三条铁律(不解构/不提前求值/用到才读)、props.x vs x() 手感差、单向数据流(改 props 禁止/回调回流)、children 父作用域求值、render prop 回填、mergeProps(逆序取第一有值+保响应)/splitProps(转发 rest)、组件类型(Component/ParentComponent/VoidComponent/FlowComponent/ComponentProps)、.map/&&/三元对会变数据会冻结、For(mapArray/keyed/index 是 accessor/记忆 item→DOM/身份变才重挂)、Index(indexArray/位置式/item 是 accessor/index 静态)、For vs Index 选型、Show keyed vs 非keyed(收窄 accessor/转假读抛错)、Switch/Match(第一个真/fallback)、Suspense/ErrorBoundary 同族、createContext 沿 Owner 树/useContext 无 Provider 无默认值抛错、context value 放 signal/store 本体而非快照、Local Context(Provider 建状态+useXxx 收口)、组合优于配置(拆小组件零成本)、逻辑复用=普通函数(owner 内调用/onCleanup 回收)、嵌套 Provider 局部覆盖

**判分口径**：Bug 每题 3 分、手写每题 7 分、场景 20 分、简答每题 5 分、挑战加分 10 分（总分 100+10）。≥72 为合格；挑战题答出 (a)(b) 即得 4 分基础分，(c)(d) 各 +3。

交卷后自评三道小测各对 ≥5 题视为过关。

🚀 **下一站 L4**：样式、事件与 TypeScript——`ref` 拿 DOM、类名/内联样式的响应式写法、事件（`on*` vs `on:*`、绑 accessor 才动态、事件委托），以及 `ComponentProps`/泛型组件/`JSX.Element` 的类型面。
