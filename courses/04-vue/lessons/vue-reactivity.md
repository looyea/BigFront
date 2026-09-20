# Vue L1 · Vue3 组合式 API 入门

> 🎯 目标：理解 ref/reactive 的区别，会用 computed 与 watch 驱动视图更新

## 一、组件 = 模板 + 逻辑 + 样式

单文件组件 `.vue` 把三者封装在一起，Vue 编译器负责转成 JS。

## 二、ref vs reactive

- `ref`：包裹任意值，需 `.value` 访问，模板中自动解包
- `reactive`：仅用于对象/数组，深层响应，不需 `.value`

```vue
<script setup>
import { ref, computed } from 'vue'
const count = ref(0)
const double = computed(() => count.value * 2)
function inc() { count.value++ }
</script>
<template><button @click="inc">{{ count }} / {{ double }}</button></template>
```

## 三、单向数据流

父传子用 `props`，子报父用 `emit`；不要直接改 props。跨组件共享状态用 Pinia。
---

> 🚧 这是大前端学院的**骨架关卡**。课文已给出核心概念与最小示例；
> 你可以在 `courses/04-vue/lessons/vue-reactivity.md` 里继续扩写，
> 并按同样路径新增/编辑小测(`quizzes/vue-reactivity.json`)与作业(`homework/L1.md`)，
> 平台会自动读取，改动随 Git 提交同步到你的 GitHub。
