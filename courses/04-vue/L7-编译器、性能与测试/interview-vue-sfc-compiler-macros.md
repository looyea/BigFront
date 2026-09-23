# vue-sfc-compiler-macros 面试题精选

> 共 12 题，覆盖 A 编译器宏本质 / B props 与类型 / C 事件与 v-model / D style 与 scoped 类。

## 一、编译器宏本质（A 类）

### 1. `<script setup>` 和普通 `setup()` 有什么区别？编译后发生了什么？
`<script setup>` 是编译期语法糖：`@vue/compiler-sfc` 把它编译成一个默认导出的组件选项对象，`setup()` 函数体就是你的顶层代码，`defineXxx` 宏被翻译成 `props`/`emits`/`expose` 等选项，`<template>` 编译成 render 函数。运行时二者完全等价，区别只在书写体验与编译期可做的优化（自动注册导入的组件、静态提升等）。
**来源**：Vue.js 官方文档 — Single-File Components、`<script setup>` 入门

### 2. 为什么编译器宏必须写在 `<script setup>` 顶层，不能放进 if 或回调里？
因为宏不是运行时函数，而是编译阶段做**静态分析**识别的记号——编译器扫到顶层的 `defineProps(...)` 才能把它转成组件的 `props` 选项。放进条件/循环/箭头函数里，静态分析无法确定其结构与位置，编译就会报错。理解这一点也解释了为什么 `import` 进来的组件会自动注册（编译期收集）。
**来源**：Vue.js 官方文档 — 编译器宏、Response to ts-decorators 类比

### 3. `defineOptions` 是用来解决什么问题的？给个典型场景。
`<script setup>` 里没有显式的 `export default {}`，需要给组件补 `name`、`inheritAttrs` 或自定义选项时就用 `defineOptions({ name: 'X', inheritAttrs: false })`。典型场景：`<KeepAlive include="X">` 靠组件 `name` 匹配缓存；关闭 attrs 自动透传以便手动把 `$attrs` 绑到内部元素。
**来源**：Vue.js 官方文档 — defineOptions、KeepAlive include

## 二、props 与类型（B 类）

### 4. 类型声明式 props 和运行时声明式 props 有何不同？能混用吗？
类型声明式写 `defineProps<Props>()`，用 TS 接口/类型字面量描述，编译期翻成运行时校验并带来模板类型检查；运行时声明式写 `defineProps({ msg: String })`。二者**不能在同一次调用里混用**，但都可用 `withDefaults`/默认值。选哪种看是否需要纯 TS 类型体验。
**来源**：Vue.js 官方文档 — 带类型的 Props 声明、SFC 中的类型声明式 props

### 5. `withDefaults` 的作用是什么？数组/对象类型的默认值为什么必须写成函数？
`withDefaults(defineProps<Props>(), { count: 0 })` 给可选 props 提供默认值。数组/对象等引用类型必须写成工厂 `tags: () => []`，否则所有组件实例会**共享同一个引用**，一个实例改了会影响其它实例——这与 `data()` 必须返回新对象是同一个道理（呼应 vue-component-basics）。
**来源**：Vue.js 官方文档 — 使用 withDefaults 的默认值、Props 默认值需工厂

### 6. `<script setup>` 里 props 能做响应式解构吗？
3.5+ 起，`const { msg } = defineProps()` 的解构会由编译器自动保持响应式（内部用 `toRef` 重连）。此前版本解构会丢失响应性，需要 `toRef(props, 'msg')` 或 `watch` 处理，也可用编译标志 `propsDestructure` 提前启用（呼应 vue-reactivity 的 toRef/toRefs）。
**来源**：Vue.js 官方文档 — 响应式 props 解构（3.5）

## 三、事件与 v-model（C 类）

### 7. `defineEmits` 的类型化签名怎么写？校验有什么意义？
可写运行时数组 `defineEmits(['change'])`，或类型化 `defineEmits<{ change: [id: number]; submit: [] }>()`。类型化后 `emit('change', 'x')` 会在编译期报错，参数数量与类型都受约束；同时声明的事件不会被当作原生属性透传到根元素（呼应 vue-component-basics fallthrough）。
**来源**：Vue.js 官方文档 — 带类型的 Exposed/Emits 声明

### 8. `defineModel` 相比手写 `modelValue` + `update:modelValue` 好在哪？支持多值和修饰符吗？
`const m = defineModel()` 把"prop + 更新事件"合并成一个可读写 ref，消除样板。多值用 `defineModel('title')`、`defineModel('content')`；修饰符通过数组解构 `const [model, modifiers] = defineModel()` 读取。3.4 起稳定（呼应 vue-component-basics 第五节 v-model 本质）。
**来源**：Vue.js 官方文档 — defineModel、组件上的 v-model

### 9. `defineExpose` 为什么必要？`<script setup>` 组件默认对父是什么状态？
`<script setup>` 编译出的组件**默认是封闭的**——父组件通过模板 ref 拿不到内部绑定。要让父能调用子方法（如 `focus()`），子必须 `defineExpose({ focus })` 显式开放。这是"默认封闭 + 白名单暴露"的封装设计（呼应 vue-refs-expose）。
**来源**：Vue.js 官方文档 — defineExpose、`<script setup>` 是闭封的

## 四、style 与 scoped（D 类）

### 10. `<style scoped>` 是怎么做到"只作用于本组件"的？多子组件时命中规则是什么？
编译期给该组件每个元素加唯一属性 `data-v-xxxx`，并把选择器改写成 `.title[data-v-xxxx]`。默认它**只命中本组件模板里的元素以及子组件的根元素**，不会命中子组件内部更深的节点。要穿透就用 `:deep()`（呼应 vue-sfc-compiler-macros 第五节）。
**来源**：Vue.js 官方文档 — Scoped CSS 如何工作

### 11. `:deep()`、`:global()`、`::v-deep` 三者有什么区别？
`:deep(.x)` 把选择器"下沉"到子组件内部（穿透第三方库类名常用）；`:global(.x)` 包裹的选择器不加 scope 属性，写成全局规则；`::v-deep` 是 `:deep` 的旧别名（SFC 里新写法推荐 `:deep()`）。多 `<style>` 块、`<style module>`（CSS Modules）也可共存。
**来源**：Vue.js 官方文档 — 深度选择器、全局样式

### 12. `<style>` 里的 `v-bind(color)` 底层是什么？它和直接内联 style 有何取舍？
底层是 `useCssVars` 把组件状态设成 CSS 自定义属性 `--hash-color`，样式里引用它。好处是响应式变量能进伪类/媒体查询等无法用内联 style 表达的地方；代价是要经 CSS 变量层，纯元素样式用 `:style` 直接绑定更直观（呼应 vue-class-style-transition 第二节绑定 CSS 变量）。
**来源**：Vue.js 官方文档 — 在 CSS 中使用的组件变量、useCssVars
