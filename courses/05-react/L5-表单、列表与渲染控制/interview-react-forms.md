# react-forms 面试题精选

> 共 12 题，覆盖 A 受控/非受控本质 / B 状态与更新陷阱 / C 校验与提交 / D 与 Vue v-model·React19 对照四类。

---

## 一、受控与非受控本质（A 类）

### 1. 什么是受控组件？为什么说 React 里表单的"唯一数据源"是 state？

**答**：受控组件指 input/textarea/select 的当前值由 React state 决定（`value={text}`），用户每次输入触发 `onChange` 回写 state，再由 state 重新渲染出 value——DOM 的显示永远等于 state，所以 state 是唯一真相。好处是任何时刻都能从 state 读到最新值、做联动/校验/受控清空。若只给 `value` 不给 `onChange`，输入框会变"只读"（敲不进字），因为 value 每次都被旧 state 覆盖。

**来源**：React 官方文档 — Controlled Components、Uncontrolled Components

### 2. 受控 vs 非受控如何取舍？各自适合什么场景？

**答**：
- **受控**：需要实时校验、字段联动、根据输入即时禁用按钮、动态格式化——值必须在 React 里；代价是每次按键都重渲染。
- **非受控**：值只在提交时读一次、集成非 React DOM、`<input type="file">`（其 value 只能由用户设置、无法受控）。用 `ref` 读取、`defaultValue` 给初值，重渲染更少。
大表单为了性能常用非受控思路（React Hook Form 即基于 ref + 订阅）。二者不是对立，可按字段混用。

**来源**：React 官方文档 — Uncontrolled Components、React Hook Form 文档

### 3. checkbox、select、file input 在受控写法上有什么特别注意？

**答**：checkbox 用 `checked`（布尔）而非 `value`；radio 同理用 `checked`；`<select>` 把 `value` 放在 select 上、option 只给 value；`<input type="file">` 的 value 是只读的（浏览器安全），**无法做成受控**，只能用非受控 + ref 读 `files`。

**来源**：React 官方文档 — Forms、Making a form controlled

---

## 二、状态与更新陷阱（B 类）

### 4. 用一个对象 state 管理多个字段，`onChange` 里 `setForm({ ...form, [name]: value })` 和 `setForm(f => ({ ...f, [name]: value }))` 有何区别？

**答**：前者直接用闭包里的 `form`（本次渲染的**旧快照**），若同一事件里连续多次 setState 或存在异步，会基于过期值计算、丢掉其它字段的更新；后者是**函数式更新**，参数永远是最新 state，避免覆盖。多字段共享一个对象 state 时推荐函数式更新 + 计算属性名 `[e.target.name]`（呼应 react-usestate 的"state 是快照"）。

**来源**：React 官方文档 — Queuing state updates、Functional updates

### 5. 为什么受控写法里 `onChange` 的参数是事件对象而不是值本身？

**答**：React 的 `onChange` 实际监听原生 `input` 事件，回调收到的是（合成的）事件对象，值在 `e.target.value`。这与 Vue `v-model` 编译期自动取值不同——React 不替你解构，得手写 `e => setState(e.target.value)`。React 19 的 `action`/FormData 才让"取值"更声明式。

**来源**：React 官方文档 — Handling events、Event Object

---

## 三、校验与提交（C 类）

### 6. 表单提交时为什么必须 `e.preventDefault()`？不加会怎样？

**答**：`<form>` 有浏览器默认行为——提交会向 action 发请求并**刷新/跳转整页**，SPA 里这会导致状态全丢、页面白闪。`onSubmit` 里 `e.preventDefault()` 阻止默认提交，改由 JS 处理（fetch/校验）。React 的 on 事件对象是真实 DOM 事件，`preventDefault`/`stopPropagation` 都可用。

**来源**：MDN — form submit event / preventDefault、React 官方文档 — Handling Events

### 7. 表单校验有哪些时机？如何做"提交前统一校验"？

**答**：三类时机可组合：onChange（实时，体验好但吵）、onBlur（失焦，较平衡）、onSubmit（提交时兜底）。常见做法：用一个 `errors` state，submit 时跑一遍所有字段的校验函数收集错误，有错则阻止提交并展示；通过再发请求。字段多时交给校验库（Yup/Zod schema + React Hook Form）避免手写。

**来源**：React 官方文档 — Conditional rendering、React Hook Form / Zod 文档

### 8. 异步提交（fetch）时要注意哪些坑？

**答**：① 用 `async` 函数并在 try/catch 里处理错误，别让 Promise 吞异常；② 维护 `isPending/loading` 状态防重复提交；③ 处理**竞态**——若提交过程中组件卸载或用户改了值，setState 会报错/错乱，用 AbortController + ignore 标志（呼应 react-effect-patterns）；④ 成功后再更新 UI 或跳转。

**来源**：React 官方文档 — Managing async、MDN — AbortController

---

## 四、与 Vue v-model / React 19 对照（D 类）

### 9. React 受控组件和 Vue 的 v-model 有什么异同？

**答**：目标一致——让输入框与组件状态双向同步、值即真相。差异在实现层次：Vue `v-model="text"` 是**编译期语法糖**，自动展开成 `:value` + `@input`（或自定义组件的 modelValue/update:modelValue），开发者只写一半；React 无编译期糖，必须**手写 `value` + `onChange`** 两半，且要自己从 `e.target.value` 取值。Vue 靠响应式系统改 ref 即更新，React 靠 setState 触发重渲染（呼应 vue-reactivity、react-usestate）。

**来源**：Vue 官方文档 — v-model、React 官方文档 — Controlled Components

### 10. React 19 的 `<form action={fn}>`、FormData、useActionState 解决了什么？

**答**：让表单回归"渐进增强"——给 form 传 `action` 异步函数，提交时框架自动传入 `FormData`（`form.get(name)` 直接取值，无需把每个字段都受控），无 JS 时仍能原生提交；`useActionState` 返回 `[state, formAction, isPending]` 标准化"提交中/错误/结果"。它把大量受控样板交给框架托管，思想上接近"非受控 + 由框架读 FormData"。

**来源**：React 官方文档 — useActionState、form action、Server Actions

### 11. `useTransition`/`isPending` 在表单里有什么用？

**答**：把提交这类"可能耗时、想让输入保持响应"的更新标记为非紧急过渡：`startTransition(async () => await submit())`，用 `isPending` 禁用按钮/转圈，用户在等待时仍可继续操作页面（呼应 react-advanced-hooks 第四节）。`useActionState` 内置的 `isPending` 就是为此设计。

**来源**：React 官方文档 — useTransition、useActionState

### 12. 面试问"你为什么用/不用 React Hook Form"，如何答出深度？

**答**：从受控的成本切入——大表单每个字段受控意味着每次按键整树重渲染 + 大量 state/校验样板。RHF 用**非受控 + ref 订阅**只在校验/提交时读值，按需渲染、性能好，并提供字段级错误、schema 校验集成。代价是要理解其注册（`register`/Controller）模型、受控第三方组件需 `Controller` 包裹。小表单或强实时联动，纯受控反而更直观。答出"按字段数量与联动需求选受控/非受控/库"体现工程判断。

**来源**：React Hook Form 文档 — Why Hook Form、getStarted、React 官方文档 — Controlled vs Uncontrolled
