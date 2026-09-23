# 组件：props、emits 与 slot

> 目标：组件是 Vue 的基本复用单元。本课以 `<script setup>` 组合式 API 为主线，掌握 **组件注册**（全局/局部、SFC 自动注册）、**props 单向数据流与校验/类型化声明**、**emits 声明与自定义事件（含 `defineModel`）**、**slot（默认/具名/作用域插槽）**、**组件上的 `v-model` 多值绑定**，以及**透传 attribute（fallthrough attrs）与 `inheritAttrs`**。（呼应 vue-reactivity、node-modules 复用思想、vue-sfc 宏在 L7 深挖）

---

## 一、组件注册

```js
// 全局（app.use / app.component）——到处可用，但无法 tree-shake
app.component('MyButton', { /* ... */ });

// 局部（推荐）：<script setup> 里 import 即可当标签用
import MyButton from './MyButton.vue';
```
`<script setup>` 中**被 import 的组件、以及在模板里用到的顶层绑定**自动注册，无需 `components: {}`。组件名：SFC 文件名（`MyButton.vue` → `<MyButton/>`），模板里用 **PascalCase** 与 kebab-case（`<my-button>`）都能匹配。

---

## 二、props：父 → 子，单向数据流

```vue
<!-- Child.vue -->
<script setup>
// 类型化声明（推荐，编译期生成运行时校验）
const props = defineProps({
  title: { type: String, required: true },
  count: { type: Number, default: 0 },
  tags:  { type: Array, default: () => [] },   // 引用类型用工厂函数
});
</script>
```

- **单向数据流**：子组件**不能改** props（改了会告警、破坏可预测性）。要基于 props 派生就用 `computed`，要"本地可编辑副本"就 `ref(props.x)` 拷一份（呼应 vue-reactivity 第四节、state-patterns 的 props-down）；
- `default` 对引用类型必须是**工厂函数**；`validator` 做自定义校验；
- 纯类型声明 `defineProps<{ title: string; count?: number }>()` + `withDefaults` 是 TS 写法（详见 vue-sfc-compiler-macros、02-ts）。

> prop 名 camelCase，模板里写 kebab-case：`<Child :post-title="t"/>` → `props.postTitle`。

---

## 三、emits：子 → 父，事件上抛

```vue
<!-- Child.vue -->
<script setup>
const emit = defineEmits(['add', 'update']);
function onClick() { emit('add', 1); }        // 携带载荷
</script>

<!-- Parent.vue -->
<Child @add="onAdd" />
```
- 显式 `defineEmits` 声明后，这些事件**不会**再作为原生事件透传到根元素（避免 `@click` 之类的 fallthrough 歧义）；
- 事件名同样有 kebab/camel 对应；载荷即 `emit(name, payload)` 的参数。

**双向的错觉**：Vue 里没有真正的"双向 props"。所谓双向，是"props 向下 + emit 向上"的组合，`v-model` 只是把它写成糖（见第五节）。

---

## 四、slot：父给子"塞内容"

```vue
<!-- Card.vue -->
<template>
  <div class="card">
    <header><slot name="title">默认标题</slot></header>
    <main><slot>这里是内容的兜底</slot></main>
  </div>
</template>

<!-- 使用 -->
<Card>
  <template #title><h2>文章</h2></template>   <!-- 具名插槽（# = v-slot:） -->
  <p>正文……</p>                                <!-- 默认插槽 -->
</Card>
```

- **默认插槽**：标签的直接子内容；**具名插槽**：`<slot name="x">` + `#x`；
- 子组件可用 `useSlots()` 在 JS 里判断某插槽是否被传（`slots.title` 是否存在）；
- slot 内容**作用域属于父组件**（在父作用域求值），与子组件的 props 是两条通道。

### 作用域插槽（子把数据回传给插槽）

```vue
<!-- List.vue -->
<slot :item="item" :index="i">{{ item.name }}</slot>

<!-- 使用：v-slot 接收子传出的 props -->
<List>
  <template #default="{ item, index }">
    <li>{{ index }}: {{ item.name }}</li>
  </template>
</List>
```
作用域插槽是"子组件掌控布局数据、父组件掌控渲染样式"的关键，很多组件库（表格列、下拉选项）都靠它（呼应 vue-composables 的复用思想）。

---

## 五、组件上的 v-model（含多值与修饰符）

```vue
<!-- 自定义组件 v-model 绑定 modelValue -->
<MyInput v-model="text" />
<!-- 等价于 -->
<MyInput :model-value="text" @update:model-value="text = $event" />
```

Vue 3 默认 `v-model` = `modelValue` prop + `update:modelValue` 事件。子组件用 **`defineModel`**（3.4+）最省心：

```vue
<!-- MyInput.vue -->
<script setup>
const model = defineModel();          // 一个可读写 ref
</script>
<template><input v-model="model" /></template>
```

- **多值**：`v-model:title`、`v-model:count` → `defineModel('title')`；
- **修饰符**：`v-model.trim="x"` → 子里 `const [m, modifiers] = defineModel(); if (modifiers.lazy) …`；
- 老写法（无 defineModel 时）：`props: ['modelValue']` + `emit('update:modelValue', v)`。

---

## 六、透传 Attribute（fallthrough）

组件根元素会自动接收父传的非 prop attribute（`class`、`style`、`data-*`、`@click`…）：

```vue
<BaseButton class="primary" @click="x" />   <!-- 落到按钮根元素 -->
```
- **多个根元素**时无自动透传，必须手动 `<div v-bind="$attrs">` 指定落到哪；
- `inheritAttrs: false`（`defineOptions({ inheritAttrs: false })`）关闭默认透传，把 `$attrs` 绑到内部某个元素；
- `class`/`style` 与根元素自身值**合并**，其余 attribute 覆盖式透传（呼应 vue-class-style-transition 第四节）。

---

## 七、自检清单

- [ ] `<script setup>` 里组件怎么注册？prop 的引用类型默认值要注意什么？
- [ ] 为什么子组件不能直接改 props？想改该怎么办？
- [ ] `defineEmits` 显式声明有什么好处？
- [ ] 默认/具名/作用域插槽分别在什么场景？slot 内容在谁的作用域求值？
- [ ] 组件 v-model 的默认 prop/事件名是什么？`defineModel` 怎么用？多值/修饰符呢？
- [ ] 多根组件为什么 `$attrs` 要手动绑？`inheritAttrs:false` 干什么？

---

## 🚀 部署预告

- 组件的动态挂载/卸载（`v-if`、动态组件、路由切换）会触发生命周期钩子——下一关 **vue-lifecycle** 讲"何时初始化第三方实例、何时清理"；
- 需要"直接命令式调用子组件方法"（如 `formRef.validate()`）时靠模板引用 + `defineExpose`，见 **vue-refs-expose**；
- props/emits 的层层传递在小树里没问题，但"跨多层"会催生 **vue-provide-inject（L4）**、"跨兄弟/全局"会催生 **vue-pinia（L6）**；`v-model`/作用域插槽是 **vue-composables** 与组件库的基石。

下一关进入 **vue-lifecycle**：从 setup 到 mounted/unmounted 的完整时序，以及 `<KeepAlive>` 的 activated/deactivated。
