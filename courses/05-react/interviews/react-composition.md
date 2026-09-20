# react-composition 面试题精选

> 共 12 题，覆盖 A 组合哲学 / B 插槽与 children / C render prop 与提升 / D HOC 与选型类。

## 一、组合哲学（A 类）

### 1. "Composition over Inheritance" 在 React 里具体指什么？
不通过 class `extends` 复用 UI/逻辑，而是把小组件/props/children 像搭积木一样组合成大树，用 props 配置差异。React 组件几乎不用继承复用（class 继承仅用于早期 PureComponent 之类），复用靠组合 + 自定义 Hook（呼应 react-composition 第五节）。
**来源**：React — Composition and Inheritance、GoF 组合优于继承原则

### 2. 为什么 React 不像 Vue 那样内置 slot/具名插槽语法？
React 里"插槽"就是 `props.children`/props 传 JSX——因为组件是函数、JSX 是表达式，把节点当值传来传去天然支持。Vue 模板是 DSL，需要专门 `slot`/`#name`/`v-slot` 语法表达同一件事（呼应 react-component 第三节、vue slot）。
**来源**：React — children as a prop、Thinking in React（Vue 对照）

## 二、插槽与 children（B 类）

### 3. 如何在 React 实现 Vue 的"具名插槽"？
把每个"洞"做成一个 prop，调用方传 JSX：`<Layout header={<Bar/>} aside={<Nav/>}>{body}</Layout>`。默认插槽对应 `children`。父组件决定这些 prop 渲染在哪里（呼应 react-composition 第二节）。
**来源**：React — Components as props / slots 模式、children

### 4. children 只有"节点"这一种吗？还能是什么？
可以是任意值：字符串、数组、函数（render prop）、甚至你自定义的数据结构。`props.children` 只是"标签之间的内容"这一约定 prop，类型不限，所以能玩出作用域插槽、列表式插槽等（呼应 react-composition 第二节）。
**来源**：react.dev — 通过 children 传递、Rendering children

## 三、render prop 与提升（C 类）

### 5. 什么是 render prop？给一个真实用途。
一个值为函数的 prop（常是 `children` 或 `render`），组件在内部调用它并把自身状态作实参传回，由调用方决定渲染。真实用途：`<Mouse>{({x,y})=><p>{x},{y}</p>}</Mouse>`、虚拟列表 `renderItem`、下拉把 open/close 交给外部渲染（呼应 react-composition 第二节）。
**来源**：React — Render Props 模式（renderprops.com）

### 6. "提升状态到共同父"的适用边界？太大了怎么办？
兄弟/近亲共享：提到共同父，父传 value + onChange。层级深、范围广：先 Context（低频广布），再外部 store（高频/大状态/需细粒度订阅）。别一上来全局化（呼应 react-composition 第三节、react-context、react-state-mgmt）。
**来源**：react.dev — Lifting state up、Managing state 选型

### 7. 受控 vs 非受控组件，从"组合"角度看本质是什么？
受控 = 把状态的"真相"提升到父（父传 value+onChange），符合单向流；非受控 = 状态留在组件自己/DOM 里，父用 ref 命令式读。选谁取决于父是否要"实时知道/干预"该值（呼应 react-composition 第三节、react-forms）。
**来源**：react.dev — 受控与非受控输入框、Lifting vs Local state

## 四、HOC 与选型（D 类）

### 8. 高阶组件（HOC）是什么？举两个经典例子。
输入一个组件、返回一个增强新组件的函数。经典：`React.memo`、Redux `connect`、`withRouter`、`withTheme`。用于横切关注（权限包裹、注入依赖、渲染守卫）（呼应 react-composition 第四节）。
**来源**：React — Higher-Order Components 模式、Redux connect

### 9. HOC 相比自定义 Hook 的劣势？为什么 Hooks 出现后 HOC 少了？
HOC 的名字/props 来源不显式（`Wrapped` 里 props 哪来的？）、要处理 ref 转发与 props 名冲突、层层包裹调试困难。自定义 Hook 让"来源显式"（`const {user}=useAuth()` 一眼看出）、可组合、无嵌套、天然可测——所以多数 HOC 场景被 Hook 取代（呼应 react-composition 第四、五节、react-custom-hooks）。
**来源**：React Hooks FAQ — 与 HOC/mixin 对比

### 10. 一个通用弹窗组件既要"默认结构可组合"又要"内部状态可自定义渲染"，怎么设计？
组合三件套：`children`/具名 prop 做结构插槽 + `open/onClose` 受控（提升状态）+（如需）render prop 或 `useDialog` 自定义 Hook 暴露 `{open,toggle,...}` 给消费方自由渲染。优先 children+props 组合，逻辑用 Hook（呼应 react-composition 第二、五节）。
**来源**：Headless UI / Radix 无头组件设计、React 组件 API 设计

### 11. 为什么组件 API 里"props 传节点"优于"配置对象 + 内部 switch 渲染"？
前者把渲染权交给调用方，扩展不需改组件源码（开闭原则），且类型/组合自然；后者"配置驱动"对少数固定场景更省事但易膨胀成 if/switch 地狱。取舍：固定不变用配置，多样可组合用 children/props（呼应 react-composition 第二节、react-architecture）。
**来源**：React — 组件设计：slots vs config、Composition 实践

### 12. 对比 Vue：slot/scope-slot/mixin 在 React 里的对应物分别是什么？
默认插槽↔`children`；具名插槽↔传节点 prop；作用域插槽↔render prop（children 为函数）；mixin↔**自定义 Hook**（且 Hook 来源显式、无命名冲突，正是为取代 mixin 类问题而生）（呼应 vue-composables、react-custom-hooks）。
**来源**：Vue slots/mixin vs React children/render props/hooks 对照
