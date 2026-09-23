# svelte-forms 面试题精选

> 共 15 题，覆盖 A 绑定基础 / B 组件与双向 / C 提交与校验 / D 对照与生态。

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

---

## 补充（新专题 13-15）

### 13.  bind:value 在不同元素上的形态差异，以及 type=number、checkbox、select 各自的坑？

形态：文本类 input/textarea→字符串双向；type=number→绑定为 number（空输入是 NaN 要处理，对应既有 type=number 题）；checkbox→bind:checked（布尔）或 bind:group（多选数组，quiz 已考）；radio→bind:group（单值）；select→bind:value（单选值/多选配 multiple+数组）。坑：① number 空值语义（NaN vs 空串）——校验与提交要显式归一；② 中文输入法 composing 期间 bind:value 会边打边同步（要"输入完才同步"需自定义或惰性，对照 Vue 的 v-model.lazy/trim/number，既有对照题）；③ select 动态 options 时序（值先于 option 到位会丢失匹配）；④ bind:value 表达式左值必须是可写引用（bind:value={obj[key]} 合法性，对应既有"绑定表达式"题）。加分句：把 bind 想成"在 DOM 值与 state 间装一条类型化的双向管道"——每类控件的"DOM 值形状"不同（字符串/数字/布尔/数组/FileList），bind 的职责正是在两端做该形状的正确转换，坑都出在形状边界（空值、输入法、动态选项）——建立"形状意识"就都能预判。

**来源**：Svelte bind:value 文档；number/checkbox/select 绑定语义；既有 number bind 题深化

### 14.  受控 vs 非受控表单在 Svelte 里怎么写？为什么 Svelte 不需要 React 那套重表单库？

非受控（Svelte 默认且推荐）：DOM 自己持有值，提交时 new FormData(form) 一次性读，组件里不维护每字段 state——零样板、性能天然好（不因每键入重渲染）。受控（需要时才用）：bind:value 到 $state，用于"实时校验/联动/条件禁用/即时预览"。为什么不需要 RHF：React 之所以要 RHF/React HookForm 是为了解决"受控表单每键重渲染整棵组件树 + 手动管 touched/errors/dirty"的性能与样板问题（React 无内置双向绑定、无编译期优化）。Svelte 的 bind:value 是编译器优化的细粒度双向绑定（只更新用到的地方，不重渲染整表），加上 FormData 非受控逃生舱 + 表单原生事件，把 RHF 解决的两件事（性能、字段状态管理）用语言/框架能力直接兜住了。代价：极复杂表单（大量跨字段异步校验、wizard）仍需自己组织——但没有"必须装库"的压力。加分句：这个题的真正洞察是"库的繁荣度反映框架的缺口"——React 表单库生态之所以庞大恰因 React 缺原生双向绑定与细粒度更新；Svelte/Vue 有 bind 与 v-model 所以库需求小（既有"为什么 Svelte 没有 RHF"题的答案就是这句）（呼应 Vue v-model 对照题）。

**来源**：Svelte forms 指南；React HookForm/VeeValidate 存在理由对照；既有"受控与非受控"题

### 15.  表单校验的分层策略？纯客户端、渐进增强、以及 SvelteKit form action 的组合。

分层：① 即时反馈（客户端 bind + $derived 校验，边填边提示，体验层）；② 提交前拦截（onsubmit 统一校验、focus 第一错误）；③ 服务端权威校验（永远不可信客户端——SvelteKit form action 里再校验一遍并返回字段错误）；④ HTML 原生约束（required/type/pattern/minlength）作为"零 JS 兜底"（渐进增强基线）。体验取向（对应既有"体验更好校验策略"题）：blur/提交后才报错（别边敲第一个字符就红）、错误可聚焦可达（aria-invalid + 关联）、保留用户已输入。SvelteKit form action 的角色：把 mutation 与校验放服务端（actions.default 里 superValidate 校验、失败返回 data/errors），客户端用 enhance 渐进增强（有 JS 走 fetch 乐观、无 JS 走原生 POST 仍被服务端校验兜住，对应既有 form action 题与 overview 渐进增强题）。加分句：校验的正确架构是"客户端管体验、服务端管真相、HTML 管底线"三层各不越位——只在客户端校验=安全漏洞、只在服务端校验=体验差；能讲出"用 SvelteKit 的 form action + enhance 天然把这三层缝好（渐进增强的服务端校验）"，说明你懂这套表单的完整生命周期而非只会 bind:value。

**来源**：SvelteKit form actions 与校验；渐进增强表单；既有"体验更好的校验策略""form action 是什么"题整合
