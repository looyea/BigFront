# Vue L2 · 路由与全局状态

> 🎯 目标：会用 vue-router 做页面切换、Pinia 做跨组件共享状态

## 一、Vue Router

`createRouter` + `createWebHistory`，`<router-view>` 出口、`<router-link>` 导航，`params/query` 传参，路由守卫做权限。

## 二、Pinia（Vue 官方推荐状态库）

一个 `defineStore` 就是一个可组合、类型友好的全局 store，替代老旧的 Vuex。

```js
import { defineStore } from 'pinia'
export const useCounter = defineStore('counter', {
  state: () => ({ n: 0 }),
  actions: { inc() { this.n++ } },
})
```

> 本项目前端 `web/` 就用了 vue-router；Pinia 视体量可选。
---

> 🚧 这是大前端学院的**骨架关卡**。课文已给出核心概念与最小示例；
> 你可以在 `courses/04-vue/lessons/vue-router-pinia.md` 里继续扩写，
> 并按同样路径新增/编辑小测(`quizzes/vue-router-pinia.json`)与作业(`homework/L2.md`)，
> 平台会自动读取，改动随 Git 提交同步到你的 GitHub。
