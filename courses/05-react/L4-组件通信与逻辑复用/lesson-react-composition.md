# 组合模式与 props 传递

> 目标：React 官方口号是"**组合优于继承**"——不靠 class 继承复用 UI/逻辑，而靠**把组件当函数拼装**。本课系统梳理四大复用手段：**children 插槽**、**render prop（children-as-function）**、**提升状态 + 受控/非受控**、**HOC（高阶组件）**，各自的适用与代价，并给出"现在优先用哪个"的判断（自定义 Hook 胜出）。这些正是 Vue 的 slot 体系在 React 里的对应物（呼应 react-component、vue slot、react-context、react-custom-hooks）。

---

## 一、children：默认插槽

```jsx
function Panel({ title, children }) {
  return <section className="panel"><h3>{title}</h3>{children}</section>;
}
<Panel title="设置"><Form/></Panel>     {/* <Form/> 成为 children */}
```
最基础的组织方式：父组件留一个"洞"，调用方填内容（呼应 vue 默认插槽、react-component 第三节）。

---

## 二、具名插槽 = 传元素 prop；作用域插槽 = render prop

```jsx
// 具名插槽：用多个 prop 传不同的子元素
<Layout header={<TopBar/>} sidebar={<Nav/>} main={<Content/>} />

// 作用域插槽（render prop）：把内部数据"回传"给调用方渲染
<DataLoader url="/api">
  {({ data, loading }) => loading ? <Spin/> : <List items={data}/>}
</DataLoader>
```
- **具名插槽**：把子节点作为普通 prop（`header`/`footer`）传入，父决定渲染位置；
- **render prop**：prop（常叫 `children` 或 `render`）是个**函数**，父调用它并把内部状态作参数传回，实现"逻辑在父、视图由消费方定"（呼应 vue 作用域插槽）。

---

## 三、提升状态（lifting state up）

两个组件要共享一份状态 → 提到**共同父**持有，父下传值 + 回传变更回调（`value` + `onChange`）。共享范围再大 → Context 或 store（呼应 vue-state-patterns 第五节、react-context）。"受控组件"就是提升状态的典型：值握在父手里（呼应 react-forms）。

---

## 四、HOC：高阶组件（理解为主）

```jsx
function withAuth(Wrapped) {                  // 输入组件、返回增强后的新组件
  return function Authenticated(props) {
    const user = useContext(AuthCtx);
    return user ? <Wrapped {...props} /> : <Login/>;
  };
}
const Dashboard = withAuth(RawDashboard);
```
HOC 是"包一层复用逻辑/渲染守卫"的经典模式（redux `connect` 就是）。但缺点明显：**props 透传易忘、嵌套地狱、来源不显式**——这些正是自定义 Hook 要解决的（呼应 vue 里 mixin 的痛点被 composables 取代）。

---

## 五、演进结论：优先"组合 + 自定义 Hook"

| 手段 | 复用的是 | 现状 |
|---|---|---|
| children / 具名 prop | UI 结构 | 一直好用 |
| render prop | "父给子渲染回调" | 仍用于极端灵活组件 |
| HOC | 组件增强 | 大多被 Hook 取代 |
| **自定义 Hook** | **有状态逻辑** | **首选**（来源显式、可组合、可测）|

心智：**能用 props/children 组合结构就别继承；能抽自定义 Hook 就别 HOC/render prop**（呼应 react-custom-hooks 下一段）。

---

## 六、自检清单

- [ ] children、具名 prop、render prop 分别对应 Vue 的哪种插槽？
- [ ] 提升状态的触发条件与升级路径？
- [ ] HOC 解决了什么、又带来了什么新问题？
- [ ] 为什么说"组合优于继承"？React 里几乎不用 class 继承复用，对吗？
- [ ] 现在复用一段有状态逻辑，你首选什么？为什么？

---

## 🚀 部署预告

- 本课把"逻辑复用"引到终点的候选者——**react-custom-hooks（L4 收官）**：`useXxx` 如何以显式来源取代 HOC/render prop（对照 vue-composables 取代 mixin）；
- render prop/children 与 **react-component** 的 children、**vue 的 slot/scope slot** 一一对照；
- 提升状态、Context、store 三者的作用域阶梯，是 **react-state-mgmt（L7）** 与 **react-architecture（L8）** 的基石（呼应 vue-state-patterns）。

下一关进入 **react-custom-hooks**：Rules of Hooks、命名约定、返回什么、如何组合与测试。
