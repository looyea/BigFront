# react-component 面试题精选

> 共 12 题，覆盖 A 组件与 props / B children 与组合 / C 渲染心智 / D 受控与规范类。

## 一、组件与 props（A 类）

### 1. React 中"组件"到底是什么？有无状态组件和有状态组件现在还有区别吗？
组件是接收 props、返回 React Element 的函数（或类）。Hooks 之后函数组件也能持有状态与副作用，"无状态函数组件 vs 有状态类组件"的二分基本消失——现在一律优先函数组件（呼应 react-component 第一、四节）。
**来源**：React 官方文档 — Components and Props、Composition vs Inheritance

### 2. 为什么组件不能修改自己的 props？数据要怎么流动？
props 应被当作只读，组件改 props 会破坏"父→子单向数据流"的可预测性（同一父渲染下子应产出一致结果）。要影响父，父传下 `onXxx` 回调、子调用它，写操作收敛到拥有状态的一方（呼应 react-component 第二节、vue-state-patterns）。
**来源**：React — Data Down, Actions Up、不可变数据原则

### 3. props 默认值 / 校验在 React 里怎么写？（含 PropTypes 现状）
默认值用解构默认值 `({ role='guest' })`；类型校验早期用 `prop-types` 包（PropTypes），如今主流转向 **TypeScript** 在编译期检查，运行时 PropTypes 多已弃用（呼应 02-ts、ts-project、vue withDefaults）。
**来源**：React — Default Props、prop-types 弃用公告、TypeScript + React

## 二、children 与组合（B 类）

### 4. children 有哪些形态？如何模拟 Vue 的具名插槽和作用域插槽？
children 可为节点、数组、函数。具名插槽：用额外 prop 传 JSX（`<Layout header={<H/>}>`）。作用域插槽：children-as-function（render prop）`{({ item }) => ...}` 把子数据回传渲染（呼应 react-component 第三节、react-composition）。
**来源**：React — Composition vs Inheritance、Render Props 模式

### 5. 为什么说"组合优于继承"？React 里怎么复用逻辑？
组件树天然靠组合（children、props 传子元素）。逻辑复用途径：自定义 Hook、render props、HOC、Context——而非 class 继承（继承在 React 里几乎不用，且难追踪）（呼应 react-composition、react-custom-hooks）。
**来源**：React — Composition and Inheritance、Hooks FAQ

## 三、渲染心智（C 类）

### 6. "函数组件每次渲染都重新执行"会带来哪些必须注意的点？
函数内 `const`/函数每次都是新引用（影响 `useMemo`/`useCallback`/子组件 `memo` 比较）；不能直接读写外部可变状态否则错乱；`useState` 值靠顺序缓存不丢；副作用必须放 `useEffect` 否则每次重跑（呼应 react-component 第四、五节、react-memo-hooks）。
**来源**：React — You Might Not Need an Effect、Thinking in React Hooks

### 7. 为什么 Hooks 不能条件/循环调用？违反了会怎样？
React 用**调用顺序**（而非变量名）为每个组件维护一条 Hook 链表，`useState` 第 N 个就是第 N 次渲染的状态槽。放 `if`/循环里，某次渲染少调一个 → 全部错位 → 状态张冠李戴、报错。把条件写进 Hook 内部而非包住 Hook（呼应 react-component 第四节、react-custom-hooks Rules of Hooks）。
**来源**：React — Rules of Hooks

### 8. 严格模式(StrictMode)为什么要双调用组件函数和 effect？
在开发环境故意**两次**调用组件函数、挂载→卸载→再挂载 effect，用来暴露不纯的渲染和缺失的清理。若你的代码因此出 bug，说明它本就不幂等/漏了 cleanup。生产构建不双调用（呼应 react-component 第五节、react-useeffect）。
**来源**：React 18 — StrictMode 双调用、Building UI with Strict Mode

## 四、受控与规范（D 类）

### 9. 受控组件与非受控组件各优缺点？
受控：值来自 state，易联动/校验/条件禁用，代价是每次输入触发渲染、样板多。非受控：DOM 自持值、`ref` 读，样板少、性能好、易集成非 React 库，代价是不易实时联动/校验，常配 `defaultValue`。表单多两者混用（呼应 react-component 第六节、react-forms）。
**来源**：React — Controlled vs Uncontrolled Components、Form Refs

### 10. 组件应该保持"纯"，为什么？React Compiler 与这有什么关系？
纯组件（同输入同输出、无渲染期副作用）让 React 能安全地跳过、重跑、并发渲染、记忆化。React Compiler 正是假设组件纯，自动插入 memo 化优化——非纯逻辑会让其优化失效或产生错误结果（呼应 react-memo-hooks、react-performance）。
**来源**：React Compiler 概览、纯函数与并发渲染

### 11. `key` 为什么写在列表元素上而不是列表容器上？和组件"身份"有什么关系？
key 帮 React 在**同一层的兄弟节点**间识别"哪个对应哪个"以复用/销毁。写在容器上无法区分内部各项。key 稳定=组件身份稳定；换 key 会重置该子树状态（呼应 react-jsx 第四节、react-render-model、react-lists-keys）。
**来源**：React Lists and Keys、Resolving element identity with keys

### 12. 一个组件渲染很多遍很卡，你第一步排查什么、用什么工具？
先确认是否真的多余重渲染（父渲染带动子、props 引用每次变）。用 **React DevTools Profiler** 录制、高亮重渲染，检查是否该 `memo`、props 是否新对象、状态是否放太高。区分"重渲染"与"重计算/重 DOM"（呼应 react-performance、react-memo-hooks）。
**来源**：React DevTools Profiler 文档、优化渲染性能
