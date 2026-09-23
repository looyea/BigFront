# react-composition 面试题精选

> 共 15 题，覆盖 A 组合哲学 / B 插槽与 children / C render prop 与提升 / D HOC 与选型类。

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

---

## 补充（新专题 13-15）

### 13. 「组件作为 prop」（`<List Item={Row}/>`）与「节点作为 prop / children」两种组合 API 的差异与选型？

children/节点传的是「已经决定好的实例」——父组件负责渲染那一刻的内容，子只负责摆放（对应具名插槽，简单直观）。组件作为 prop 传的是「构造器/类型」——子组件掌握何时、用什么 props 去实例化它（`<Item data={x}/>`），把渲染时机与数据注入权留给子（对应作用域插槽但更结构化）。选型：需要子组件决定「传什么数据、渲染几个」→ 传组件；只是父排布好静态内容 → 传节点。传组件的坑：别在 render 里内联定义该组件（新引用→类型变化→重挂），要提到外部或用 useMemo 稳定。这与本关「配置对象+内部 switch 不如传节点」互补：传组件介于两者之间，比配置对象灵活、比裸节点可控。

**来源**：React 组合文档（component as prop / "slots via composition"）；社区对 render prop vs component-as-prop 的权衡。

### 14. HOC 时代的高阶组件要处理 props 注入、displayName、静态方法 hoist、ref 转发——这些税从何而来？Hooks 消掉了哪些、留了哪些？

税来自「HOC 生成了一个新组件层」：① 名字——新组件默认匿名，DevTools 里全是 `Connect(Comp)`，要手工设 displayName；② 静态属性——`Comp.xxx`（如 propTypes、自定义静态方法）不会自动出现在包装件上，要用 hoist-non-react-statics 拷贝；③ ref——包装层截断了 ref，需 forwarding；④ props 名冲突——注入的 prop 与原组件同名会被覆盖或遮蔽，要命名空间。Hooks 用「函数里直接调用」替代「包一层组件」，一次性消掉以上全部（没有新组件=没有命名/静态/ref 问题，返回值显式赋名=无隐式冲突）。HOC 仍留的价值：跨「class 组件」的复用、以及「渲染劫持/权限外壳」这类需要包裹渲染输出的场景（如 ErrorBoundary、懒加载 HOC）。

**来源**：React 高阶组件文档（displayName/hoist/refs forwarding 约定）；「Why Hooks replace HOCs & mixins」官方动机。

### 15.  从「开放 vs 封闭」看组件 API：配置对象驱动 与 组合（传节点/子组件）驱动 各自利弊？

配置对象（`<Table columns={[{...}]} />`）是「封闭扩展点」：行为由内部 switch/映射解释配置，收敛、易序列化、易给默认，但表达力受限于你预先想到的字段，遇到「某列单元格要完全自定义渲染」就得开 escape hatch（render 字段）。组合（传节点/组件）是「开放」：调用方直接用 JSX 表达任意结构，无限灵活、无需为每种变化加字段，代价是难给默认、难序列化、校验弱。成熟设计常常两者分层：用配置描述「结构与数据」（列定义、行数），用组合覆盖「外观与特例」（cell render、slot）。判据：可枚举、可默认、需远程下发的用配置；需要任意 UI 组合、编译期类型可推的用组合。

**来源**：组件 API 设计：configuration vs composition 的通行权衡；React「props 传节点」组合哲学。
