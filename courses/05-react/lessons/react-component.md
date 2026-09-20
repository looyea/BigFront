# 函数组件与 props

> 目标：React 里**组件就是一个函数**——接收 `props`、返回 JSX（UI = f(props)）。本课讲清：函数组件的书写与调用、`props` 只读（不可变）、`children` 与组合、组件命名大写约定、为什么"每次渲染函数都重新执行"（这与 Vue 的 setup 只跑一次根本不同，是理解 Hooks 一切规则的钥匙），以及受控/非受控的最初印象（呼应 react-jsx、react-usestate、vue-component-basics、react-render-model）。

---

## 一、组件是函数，props 是入参

```jsx
function Welcome(props) {
  return <h1>Hello, {props.name}</h1>;
}
// 也可箭头 + 解构
const Welcome = ({ name, role = 'guest' }) => <h1>{name} · {role}</h1>;

<Welcome name="Ada" />   // 使用：大写开头 = 组件，小写 = 原生标签
```
- **首字母必须大写**：React 靠大写判断"这是组件还是 `<div>`"（小写会当字符串标签）；
- `props` 是一个对象，含所有属性 + `children`；解构 + 默认值即"props 默认值"（对照 vue props default、withDefaults）。

---

## 二、props 只读：单向数据流

```jsx
function Badge(props) {
  // props.count = 5;   ❌ 禁止：不得改 props
  return <span>{props.count}</span>;
}
```
组件**绝不能修改自己的 props**（像函数参数应被当作只读）。数据由父→子单向流，子要改就调用父传下来的回调（`onXxx`）——与 Vue 的 props-down/events-up 完全同构（呼应 vue-component-basics、vue-state-patterns）。React 靠"父重新渲染传新 props"驱动子更新，而非子自改。

---

## 三、children：标签之间就是插槽

```jsx
function Card({ title, children }) {
  return <section className="card"><h3>{title}</h3>{children}</section>;
}

<Card title="简介">
  <p>这段成为 props.children</p>   {/* 类似 Vue 默认插槽 */}
</Card>
```
`children` 可以是节点、数组、函数。具名插槽用普通 props 传 JSX（`<Layout header={<Bar/>}>{body}</Layout>`），作用域插槽用 **render prop / children-as-function**（`{({x}) => ...}`）——组合代替继承（呼应 vue slot、react-composition）。

---

## 四、核心心智：组件函数每次渲染都重新执行

**这是 React 与 Vue 最大的一处分野。** Vue 的 `setup()` 在组件实例创建时跑一次；React 函数组件在**每一次渲染**时从头到尾**重新执行一遍**：

```jsx
function Counter() {
  console.log('每次渲染都打印');       // 状态每变一次就重跑
  const [n, setN] = useState(0);       // useState 靠"顺序+位置"记状态
  return <button onClick={() => setN(n + 1)}>{n}</button>;
}
```
- 重新执行 → 函数内所有变量/函数**每次都是全新的**；
- 但 `useState` 的值**不丢**——React 按 Hook 调用顺序在内部为每个组件缓存状态槽；
- 这解释了为什么 **Hooks 必须在顶层、不能条件调用**（顺序变了就错位，呼应 react-custom-hooks 的 Rules of Hooks）。
理解了"函数每次重跑"，就理解了陈旧闭包、为什么要依赖数组、为什么要 useMemo（呼应 react-useeffect、react-memo-hooks）。

---

## 五、纯渲染，别在 render 里做副作用

组件函数应当是**纯函数**：给定 props/state 返回相同 JSX，不在其中直接 `fetch`、改全局、`setState` 别的组件、读写 DOM。副作用要放进 `useEffect`（渲染"之后"执行），否则会重复触发或撕裂渲染（呼应 react-useeffect、react-effect-patterns）。React 严格模式还会故意**双调用**组件函数来帮你暴露非纯逻辑。

---

## 六、受控 / 非受控的第一面

表单输入有两种接管方式，贯穿到 react-forms 详解：
```jsx
// 受控：值来自 state，onChange 回写——数据在 React 手里
<input value={text} onChange={e => setText(e.target.value)} />
// 非受控：值在 DOM 里，React 用 ref 读——数据在 DOM 手里
<input defaultValue="x" ref={inputRef} />
```
受控是 React 主流（呼应 vue v-model 的"值+事件"），非受控更贴近原生、少重渲染（呼应 react-refs）。

---

## 七、自检清单

- [ ] 组件首字母为什么必须大写？React 怎么区分组件和原生标签？
- [ ] 为什么不能直接改 props？子要影响父该怎么做？
- [ ] `children` 对应 Vue 的什么概念？具名/作用域插槽在 React 怎么写？
- [ ] "函数组件每次渲染重新执行"和 Vue 的 setup 有何本质不同？它解释了哪些规则？
- [ ] 受控与非受控的核心区别是"数据握在谁手里"？

---

## 🚀 部署预告

- 本课"函数每次重跑"是 **react-render-model（L1 收官）** 谈"重渲染/reconciliation"的前提；
- 也是 **react-usestate / react-useeffect（L2）** 所有 Hook 规则的根因：状态靠顺序缓存、副作用靠依赖数组；
- props 单向流、默认值、children 插槽与 **vue-component-basics** 一一对应，可对照记忆。

下一关进入 **react-render-model**：渲染时机、reconciliation 协调、虚拟 DOM 与 diff、key 如何决定复用、什么情况下组件会重渲染。
