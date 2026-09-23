# vue-forms-validation 面试题精选

> 共 12 题，覆盖 v-model 原理 / 组件双向契约 / 原生校验 / schema 校验体系 / 提交工程 五类。

---

## 一、v-model 原理

### 1. v-model 是"双向绑定"吗？它底层到底做了什么？

不是黑魔法，是**语法糖**：元素上是 `:value` + `@input` 赋值（checkbox 换 `checked`、select 特化）；组件上是 `modelValue` prop + `update:modelValue` 事件。本质仍是"单向数据流 + 显式事件"，Vue 只是把最高频的这一对收进了指令（呼应 vue-forms-validation 第一节）。

**来源**：Vue.js — "Form Input Bindings / v-model"

### 2. v-model 的三个修饰符各解决什么问题？

`.trim` 首尾去空格（用户名/邮箱）；`.lazy` 从 input 事件换成 change 事件——长文本域省掉逐键重渲染；`.number` 能转 Number 就转、转不动保留原字符串（不像 `parseFloat` 那样失败变 NaN）。注意 `.number` 与 `<input type="number">` 是两条路（呼应 vue-forms-validation 第一节、01-es 类型转换）。

**来源**：Vue.js — "v-model Modifiers"

---

## 二、组件双向契约

### 3. 让第三方组件支持 v-model，你要实现什么？最少代码写出来。

`defineProps({ modelValue: String })` + `defineEmits(['update:modelValue'])`，模板里 `:value="modelValue"` 且 input 时 `emit('update:modelValue', 新值)`。Vue 3.4+ 也可用 `defineModel()` 宏一行搞定（编译产物就是这一对）。答出"prop 进、事件出、内部不直接改 props"三纪律更佳（呼应 vue-forms-validation 第二节、vue-sfc-compiler-macros 的 defineModel）。

**来源**：Vue.js — "v-model on Components / defineModel"

### 4. 一个组件上要同时绑两个值（价格+折扣）怎么办？

参数化多 v-model：`<Price v-model:amount="a" v-model:discount="d" />`，子组件对应 `amount/update:amount`、`discount/update:discount` 两对契约。默认无参的仍是 `modelValue`。这是 Svelte `bind:` 多绑、React 受控多 props 的 Vue 式折中（呼应 vue-forms-validation 第一节、svelte-forms 同题）。

**来源**：Vue.js — "Multiple v-model"

### 5. 子组件内部想做"金额格式化"（显示 12.00、出去 12），怎么不来回抖动？

单向出去前格式化，回流要**幂等**：emit 的是规范值（数字 12），显示值由 `modelValue` 派生 computed 格式化；若 emit 了格式化串"12.00"再回填又格式化，就会抖动。原则：v-model 通道里只走"事实值"，展示格式留在组件渲染层（呼应 vue-forms-validation 第二节契约 3）。

**来源**：Vue 生态组件库（Element Plus / Vuetify）— "受控值与显示值分离"

---

## 三、原生校验层

### 6. form 上的 novalidate 是不是"放弃原生校验"？

恰恰不是。加 novalidate 只是关掉**浏览器默认的弹出气泡**，`required/type/pattern/min/max` 属性全部保留其"合法性声明"价值：可经 `checkValidity()/validationMessage` 编程读取、`:invalid` 伪类纯 CSS 上色、屏幕阅读器依旧播报字段期望。正解是"声明保留、呈现接管"（呼应 vue-forms-validation 第三节）。

**来源**：MDN — "Form validation / novalidate"

### 7. 原生约束校验和 JS 校验怎么选层？

两层叠加而非二选一：原生层零成本、最强无障碍、防 JS 未加载的裸奔窗口；JS 层管跨字段联动、异步查重、i18n 文案、可控样式。React/Svelte 社区同结论（svelte-forms、react-forms 两课一致），这条是跨框架通识（呼应 vue-forms-validation 第三节）。

**来源**：Web.dev — "Form validation UX and a11y"

---

## 四、schema 校验体系（vee-validate + zod）

### 8. 什么规模的表单值得引入 vee-validate + zod？手写 errors 对象不行吗？

经验线：≤3 字段无联动，手写可控；出现**跨字段校验（两次密码）、异步查重、多步表单、动态字段**任一特征，手写 `errors[key]` 就开始腐烂。zod 的价值是把规则收敛成"单一事实源"，还能与后端共享同一 schema（09-express 端复用）（呼应 vue-forms-validation 第四节）。

**来源**：vee-validate — "Overview / why schema validation"

### 9. zod schema 里怎么实现"用户名查重"这种异步校验？错误体验怎么不闪？

`.superRefine(async (val, ctx) => …)` 里 await 接口，失败 `ctx.addIssue`。体验上配 vee-validate 的 `validateOnMount:false` + `meta.touched` gating——用户没碰过的字段不报错；查重进行中可显示 pending 态（useForm 的 `validating` meta）。竞态处理（旧请求覆盖新结果）与 vue-watch 的 onCleanup 同题（呼应 vue-forms-validation 第四节）。

**来源**：zod — "Async Refinements"；vee-validate — "meta.touched"

### 10. toTypedSchema 桥进来后，TS 层面赚到的是什么？

表单 values 的类型从 zod schema **自动推导**：`z.infer<typeof signupSchema>` 即 handleSubmit 回调的参数类型，字段改名编译期就炸，不再手写接口类型两份对不上。这是"校验即类型"（schema-first）路线，与 02-ts ts-frameworks、tRPC 同一思想（呼应 vue-forms-validation 第四节）。

**来源**：@vee-validate/zod — "Typed schemas"

---

## 五、提交工程

### 11. 用户连点两次提交，注册了两批账号。全链路怎么堵？

前端第一道：`isSubmitting` 期间禁用按钮 + handleSubmit 自身排队锁；传输第二道：防重放 token/requestId；后端终极道：**幂等**（唯一约束或 requestId 去重表，09-express 展开）。只答"disable 按钮"不及格——双开标签、重试请求都绕得过（呼应 vue-forms-validation 第五节）。

**来源**：OWASP + Stripe API — "Idempotency"

### 12. 后端 422 返回字段错误，前端怎么和 schema 错误共用一套 UI？

约定错误通道协议：响应 `{ fields: { email: '已注册' } }` 逐条 `setFieldError(key, msg)` 写进 vee-validate 的 errors——字段的 `<span role="alert">` 不区分错误来源。配套纪律：提交成功 `resetForm()` 一把清（值+错误+meta），手拼初始对象漏字段是常见 bug 源（呼应 vue-forms-validation 第五节）。

**来源**：vee-validate — "setFieldError / Server-side errors"
