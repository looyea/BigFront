# 表单绑定与校验生态

> 目标：把 Vue 表单从零散写法升级成体系——v-model 全家族（修饰符/参数化/组件多绑）、自定义输入组件的双向契约、原生约束校验的正确用法、以及业界标准 vee-validate + zod 的 schema 校验层。表单是面试必答、线上事故高发区（呼应 vue-component-basics 的 v-model 组件、02-ts 的 zod、react-forms/svelte-forms 同题异构）。

---

## 一、v-model 全家族：不止 `bind:input`

```vue
<!-- 目的：v-model 的三个修饰符与组件多绑 -->
<input v-model.trim="form.name" />          <!-- trim：输入写回前自动去首尾空格 -->
<input v-model.lazy="form.bio" />           <!-- lazy：change（失焦）后才同步，长文本省重渲染 -->
<input v-model.number="form.age" />         <!-- number：能转 Number 就转（避免 "18" 字符串） -->
<input v-model="price" v-model:discount="disc" />   <!-- 组件多 v-model：参数化 -->
<!-- ❌ 忘加 .number 时 form.age 是字符串："18"+1 会变 "181" 而非 19 -->
```

- 三个修饰符就是三个高频需求：`trim`（用户名去空格）、`lazy`（长文本失焦才进 state，省重渲染）、`number`。
- **v-model 的原理必须能默写**：`v-model="x"` 在元素上 = `:value="x"` + `@input="x = $event.target.value"`（checkbox/radio/select 换 `checked`）。理解展开式，才懂得为什么 `<MyInput v-model="x">` 要求子组件配合。
- 组件上的 v-model 默认落在 `modelValue` prop + `update:modelValue` 事件——这是 **vue-component-basics**（下一关）要展开的契约，本课先用起来。

## 二、自定义输入组件：把契约写规范

```vue
<!-- DateInput.vue -->
<!-- 目的：手写 modelValue prop + update:modelValue 事件，实现自定义双向组件 -->
<script setup>
const props = defineProps({ modelValue: String })
const emit = defineEmits(['update:modelValue'])
</script>
<template><input type="date" :value="props.modelValue"
  @input="emit('update:modelValue', $event.target.value)" /></template>
<!-- ✅ 应用：父组件 <DateInput v-model="form.day"/> 即可双向；prop/事件名必须成对，否则 v-model 接不上 -->
```

纪律四条：

1. **prop 名与事件名成对**（`modelValue`/`update:modelValue`），改名必须 `v-model:xxx` 参数化对应；
2. 组件内部**别直接改 props**（单向数据流，devtools 会警告），改完即 emit；
3. 需要"格式化后再出去"（如金额），emit 前处理，回流进 `modelValue` 的值要幂等，否则来回抖动；
4. `useId` 时代的多实例无障碍：label 的 `for` 用 `useId()`（Vue 3.5+）或注入 id，杜绝写死 `id="name"`（呼应 svelte-forms 的 aria 纪律）。

## 三、原生约束校验：被低估的第一层

```vue
<form @submit.prevent="onSubmit" novalidate>
  <!-- 目的：novalidate 关掉浏览器弹框，但保留 required/type 属性当合法性声明，提示自绘 -->
  <input v-model="form.email" type="email" required maxlength="50" />
  <output v-if="emailErr">{{ emailErr }}</output>
</form>
<!-- ❌ 不写 novalidate 又想自绘：浏览器默认弹框会和自定义提示叠加出现 -->
```

- `required/type=email/pattern/min/max/step` 是**免费且最强**的一层（自动 focus 第一个非法字段、屏幕阅读器直接播报）；
- 但浏览器报错样式不可控、i18n 困难——所以主流做法：`novalidate` 关掉浏览器弹出，**保留属性当声明**，用 `checkValidity()/validationMessage` 或 `:invalid` CSS 伪类自绘提示；
- 结论：**原生属性管"合法性声明"，JS 层管"提示体验"**，两层都要（呼应 svelte-forms 双层校验结论——三家框架这条完全同构）。

## 四、vee-validate + zod：schema 驱动的工业方案

小表单手写没意见；8 字段、联动校验、异步查重、多步表单，手写 `errors` 对象就开始腐烂。业界标准组合：

```js
// schema.ts —— 校验逻辑第一次有了"单一事实源"，还能和后端共享（zod 呼应 09-express）
// 目的：用 zod 声明式定义注册表单的校验规则，前后端共享
import { z } from 'zod'
export const signupSchema = z.object({
  name: z.string().min(2).max(20),                // 长度 2~20
  email: z.string().email(),                      // 非法邮箱报错
  age: z.coerce.number().min(18),                 // coerce 把字符串输入转成数字再比较
  pwd: z.string().min(8).regex(/[A-Z]/, '需含大写'),
  confirm: z.string(),
}).refine(v => v.pwd === v.confirm, { path: ['confirm'], message: '两次密码不一致' })  // 跨字段校验
// ✅ 应用：signupSchema.parse(data) 合法返回数据；❌ 不合法抛 ZodError（.issues 逐项报错）
```

```vue
<script setup>
// 目的：vee-validate 接管表单状态，useField 直接拿到双向值 + 错误消息
import { useForm, useField } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
const { handleSubmit, errors } = useForm({
  validationSchema: toTypedSchema(signupSchema),   // zod schema 直接推给类型
  initialValues: { name: '', email: '', age: 0, pwd: '', confirm: '' },
})
const { value: email, errorMessage } = useField('email')   // 双向值 + 该字段错误
const onSubmit = handleSubmit((values) => api.signup(values))   // 只有校验通过才进回调
</script>
<template>
  <form @submit="onSubmit" novalidate>
    <input v-model="email" type="email" :aria-invalid="!!errorMessage" />
    <span v-if="errorMessage" role="alert">{{ errorMessage }}</span>
    <button type="submit">注册</button>
  </form>
</template>
```

要点：`toTypedSchema` 让 **zod 类型直接推给模板**（TS 红利，呼应 02-ts 的 ts-frameworks）；`useField` 可解构出 `meta.touched/valid`，"离开过才报错"的体验三行实现；异步校验（用户名查重）写进 zod 的 `.refine` + `superRefine`（内部可 await）。

## 五、提交态与工程细节

- **提交锁**：`isSubmitting`（useForm 提供）+ 按钮 `:disabled="isSubmitting"`，双保险再配后端幂等（防连点重复注册——和 Express 端 requestId 去重是一对，预告 09-express）；
- 成功后重置：`resetForm()` 一把清值清错误，别手写 `form = { ...初始 }` 漏字段；
- 错误归位：后端 422 返回 `{ fields: { email: '已注册' } }` → `setFieldError('email', …)`，schema 层与传输层的错共用同一 UI 通道；
- 多步表单：每一步一个局部 schema，最后合并全量校验——**渐进式校验**比"最后一步才爆 20 条错误"体验好（评审常考）。

## 六、自检清单

- [ ] 能默写 v-model 在元素与组件上的两种展开式。
- [ ] 自定义双向组件的四条契约说得全。
- [ ] 知道 `novalidate` 不是丢弃原生校验，而是"声明保留、呈现接管"。
- [ ] vee-validate+zod 能搭出带 touched 策略与异步查重的注册表单。
- [ ] 讲清提交锁、resetForm、后端 422 回填三条工程线。

---

## 🚀 部署预告

- 组件多 `v-model:discount` 的参数化契约，与 **vue-component-basics** 的 emits 命名规范同源；`useId` 无障碍绑定回扣 **vue-refs-expose** 的"数据驱动优先"；
- zod schema 前后端共享是 **09-express** 校验课的引子；异步 `superRefine` 查重与 **vue-watch** 的 onCleanup 竞态处理是同一问题的两副药；
- 表单错误提示的 `role=alert`、aria-invalid 在 **vue-testing**（L7）用 @testing-library 可断言化；
- i18n 表单报错文案 → 本包新关 **vue-use-i18n**（L4 尾）的翻译键方案。

下一关进入 **L3 vue-component-basics**：把视野从"一个输入框"拉到"组件系统"——props 单向数据流、emits 事件契约与 slot 分发。
