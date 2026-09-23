# svelte-forms 面试题精选

> 共 12 题，覆盖 A 绑定基础 / B 组件与双向 / C 提交与校验 / D 对照与生态。

## 一、绑定基础（A 类）

### 1. bind:value 能用在哪些元素上？各有什么形态？
`<input>`（text/password/email/search 等）、`<textarea>`、`<select>`（单选绑标量、`multiple` 绑数组）、`<input type="range">`。复选/单选家族不用 value：单框布尔 `bind:checked`、多框/多选组 `bind:group`（配 value）、文件 `bind:files`（呼应 svelte-forms 第一、二节）。
**来源**：Svelte 官方文档 — DOM bind 列表

### 2. type="number" 的 bind:value 有什么经典坑？
输入框清空时 DOM value 是空串，数字转换得 `NaN` 进 state——下游 `NaN > 0` 之类的校验全崩。兜底：用 `bind:value={{ get, set }}` 在 set 里把 NaN 归 0/null，或提交前统一清洗（呼应 svelte-forms 第一节）。
**来源**：Svelte 官方文档 — number input 说明；社区高频坑

### 3. Vue 的 v-model.lazy/.number/.trim 在 Svelte 里怎么等价？
Svelte 没有 model 修饰符体系：`.number`→`type="number"` 天然转换；`.lazy`→不绑定、`onblur` 手动同步（或 get/set 绑定自控）；`.trim`→在 `$derived`/提交时 `.trim()`。哲学差异：Vue 给指令加后缀，Svelte 用普通 JS 解决（呼应 svelte-forms 第一节）。
**来源**：Svelte/Vue 官方文档对照

## 二、组件与双向（B 类）

### 4. 自定义表单组件如何支持父级 bind:value？
prop 声明为 `value = $bindable(初值)`，内部 `<input bind:value>`；父 `<Comp bind:value={x}/>` 即闭环。`$bindable` 默认是单向的——父不 `bind:` 时子写 value 不会外泄（呼应 svelte-props 第四节、svelte-forms 第三节）。
**来源**：Svelte 官方文档 — $bindable

### 5. bind: 绑定和"props + 回调"手写双向，工程上怎么选？
`bind:` 胜在样板少、适合"值语义"（输入框、开关、分页页码）；手写 `value + onchange` 胜在**拦截点显式**（可在回调里改名、清洗、审计），跨多层或需要 transform 时用回调。混用很常见：组件对外 bindable、内部逻辑走显式函数（呼应 react-state-patterns 受控话题）。
**来源**：Svelte 官方文档 + 组件库 API 设计惯例

### 6. 绑定表达式能写 `bind:value={obj[key]}` 吗？
能——bind 的目标只要是 lvalue（可写位置）就行：`$state` 变量、对象属性、数组下标都可以；但不能绑 `$derived`（只读）或普通函数返回值，编译器会拒绝（呼应 svelte-reactive-runes）。
**来源**：Svelte 官方文档 — bind 的左值要求

## 三、提交与校验（C 类）

### 7. 受控与非受控表单在 Svelte 里各怎么写？何时用哪个？
受控：每字段 `$state`+`bind:value`，适合联动/实时校验；非受控：不绑定，`onsubmit` 里 `new FormData(e.currentTarget)` 一把抓，适合字段多无联动的长表单（零逐字段状态、少一层重渲染面）。生产常混用：联动字段绑定、静态字段交给 FormData（呼应 svelte-forms 第四节）。
**来源**：MDN — FormData；React 受控/非受控概念平移

### 8. 阻止表单默认提交有哪两种写法？
`onsubmit={(e) => { e.preventDefault(); ... }}`，或修饰符写法 `on:submit|preventDefault={fn}`（on: 形态支持修饰符，小写 prop 形态不支持）（呼应 svelte-events 第三节、svelte-forms 第四节）。
**来源**：Svelte 官方文档 — event modifiers

### 9. 表单校验的分层策略？
① 原生约束（required/minlength/pattern/type）白嫖无障碍与移动端键盘类型；② 自定义 `errors = $state({})` 在 blur/input 跑规则，`$derived` 汇总提交可用性；③ 服务端最终校验（永远要有）。UX 红线：别等提交才首次报错；错误文案 `aria-describedby` 绑定、提交后焦点跳首个错误（呼应 svelte-forms 第五节）。
**来源**：W3C/WAI — 表单校验可访问性指南

## 四、对照与生态（D 类）

### 10. SvelteKit 的 form action 是什么？和今天讲的客户端提交什么关系？
`<form action="?/login" method="post">` 直接把表单 POST 给同页 server 端点（`export const actions = { login: async ({ request }) => {...} }`），渐进增强无 JS 也可用；客户端再配 `use:enhance` 拦截成 AJAX+乐观更新。它是"非受控提交"的服务端版——本课客户端路线在无 SvelteKit 时就是全部（呼应 svelte-global-state 第四节、12-sveltekit 预告）。
**来源**：SvelteKit 官方文档 — form actions

### 11. 为什么 Svelte 没有 RHF/VeeValidate 那么重的表单库需求？
因为 bind 语言级够便宜：几行 `$state`+`bind:` 覆盖 80% 场景；大表单可用 FormData 零状态。库的剩余价值在**schema 校验集成（Zod）、字段数组动态增删、跨字段异步竞态**这些工程件——需要时再上（sveltekit-superforms 等）（呼应 vue 表单 v-model、react-forms）。
**来源**：Svelte 生态现状 — super-forms 等定位

### 12. 从 React 受控组件迁移过来，心智要改哪几点？
① 不再"每次按键全组件重渲染"——bind 是信号级，只有读该字段的表达式更新；② `onChange` 事件对象样板可整段删掉；③ 非受控不需要 useRef 收集，FormData 原生可用；④ 双向不再是"约定"而是 `$bindable` 的**显式声明**（呼应 svelte-overview 第二节、svelte-props）。
**来源**：Svelte 5 官方博客 — forms 与 runes
