# vue-pinia-basics 面试题精选

> 共 12 题，覆盖 概念与选型 / store 定义 / 响应性与 storeToRefs / actions 与异步 / 模块化 五类。

---

## 一、概念与选型

### 1. 为什么需要 Pinia？它解决了纯 props/inject 的什么痛点？

跨兄弟、跨页面共享的**同一份业务状态**（当前用户、购物车、主题）用 props 逐层传、inject 手动挂树都很累且易失控。Pinia 提供**全局可访问的响应式单例 store**，集中 state/getters/actions，配 devtools、类型推导、SSR 水合（呼应 vue-pinia-basics 第一、六节、vue-provide-inject 第五节）。

**来源**：Pinia — "What is Pinia / Why"

### 2. Pinia 相比 Vuex 4 有哪些改进？

① **去掉 mutations**（action 直接改 state）；② 完整 **TS 类型推导**（无需手写包裹类型）；③ **多 store 组合**、无嵌套 module 的样板；④ **setup 语法**（组合式）；⑤ 更小的体积与更简 API；⑥ 支持 devtools/插件。Vuex 已非 Vue3 官方推荐（呼应 vue-pinia-basics 第四节）。

**来源**：Pinia — "Comparison to Vuex / Why Pinia"

---

## 二、store 定义

### 3. 选项式 store 与 setup 式 store 有什么区别？复杂场景选哪个？

选项式给 `state/getters/actions` 三个选项；setup 式像写一个组合式函数，用 `ref/computed/function` 并 return。setup 式更灵活（可自由组合、用 watch、私有变量天然不暴露），推荐复杂逻辑用；两者可混用风格但同一个 store 选一种（呼应 vue-pinia-basics 第一节、vue-composables）。

**来源**：Vue.js Store / Pinia — "Core Concepts / Setup Stores"

### 4. store 的 `id`（第一个参数）有什么用？不写会怎样？

id 是 store 唯一标识，用于 **devtools 展示、SSR 状态水合、HMR、以及跨 store 引用**。setup 式也必须提供。冲突/缺失会导致 devtools 分不清、SSR 无法正确 hydrate（呼应 vue-pinia-basics 第五节、vue-pinia-advanced SSR）。

**来源**：Pinia — "The Store id"

---

## 三、响应性与 storeToRefs

### 5. 为什么 `const { count } = store` 会丢响应，而 `const { inc } = store` 却没事？

store 实例是 **reactive 对象**，解构 state/getter 得到的是脱离代理的普通值（同 reactive 解构丢响应，呼应 vue-reactivity-theory 第六节）。而 **action 是绑定了 store 的函数**，解构后 `this` 仍指向 store，调用不受影响。要保持 state 响应需 `storeToRefs(store)`（呼应 vue-pinia-basics 第二节）。

**来源**：Pinia — "Destructuring / storeToRefs"、"Actions 解构安全"

### 6. `storeToRefs` 会带上 actions 吗？怎么处理 action？

不会。`storeToRefs` 只把 **state + getters** 转成 refs，不含 actions（避免把函数也 ref 化）。action 直接从 store 解构即可：`const { count } = storeToRefs(store); const { inc } = store;`（呼应 vue-pinia-basics 第二节）。

**来源**：Pinia — "storeToRefs"

---

## 四、actions 与异步

### 7. Pinia 里异步请求（取数）写在哪？怎么管理 loading/error？

写在 **action** 里，一个 async action 里 `try/catch/finally` 直接改 `this.loading/this.error/this.data`。组件只调 action、读 store 里的状态，不必关心同步异步（呼应 vue-pinia-basics 第四节）。竞态可结合请求 id 或 `AbortController`（呼应 vue-watch 第四节）。

**来源**：Pinia — "Actions / 异步、Making Hot HTTP Requests"

### 8. 没有 mutation，直接 `store.count++` 或在 action 里改，会有什么问题？

技术上组件里直接 `store.count++` 是允许的、也响应。但把**变更散落在各组件**会丢失"改了什么、在哪改、能否加日志/校验"的集中管控。推荐把变更收进 **action**（可测、可追踪），保持"逻辑集中、状态可预测"（呼应 vue-pinia-basics 第四节、vue-state-patterns）。

**来源**：Pinia — "Mutating state / Why Actions"

---

## 五、模块化与边界

### 9. 一个 store 要写多大？如何拆分？

按**领域/功能**拆：`useUserStore`、`useCartStore`、`useUIStore`。别造"一个装下全 App 状态的巨型 store"（难维护、HMR/devtools 粒度差）。store 之间通过"在 action 里 use 另一个 store"组合（呼应 vue-pinia-basics 第五节、vue-project-architecture）。

**来源**：Pinia — "Store Typing / Composition 组合"

### 10. 什么状态不该放进 store？

只服务单个组件的**局部 UI 状态**（输入框草稿、展开/收起、动画标志）该留在组件/composable；派生值该用 getter/computed 而非再存一份（避免同步 bug）。store 装的是"跨组件共享 + 需要集中变更管控"的业务状态（呼应 vue-pinia-basics 第六节、vue-state-patterns）。

**来源**：Pinia — "When to use a store"、社区 — "local state vs store"

### 11. Pinia 和"模块作用域单例 ref（全局 composable）"都能共享状态，差别在哪？

模块级单例 ref 能共享，但缺 **devtools 时间旅行、SSR 水合、$reset/插件生态**，也容易不小心全局污染。Pinia 把这些做成框架级能力（每请求可重置、可持久化、可插插件）。小脚本用单例 composable 没问题，正式 App 用 Pinia 更可控（呼应 vue-composables interview 第 10 题、vue-pinia-basics 第六节）。

**来源**：Pinia — "SSR / devtools"、社区 — "composables vs Pinia"

### 12. 在组件外（如 axios 拦截器、router 守卫）能用 store 吗？

能，但要**先 `app.use(createPinia())` 之后再调用** `useXxx()`——否则会报"no active pinia"。常见于 axios 拦截器里取 token、`beforeEach` 里判登录态。在 setup/组件生命周期内调用则无需担心时机（呼应 vue-router-guard-lazy 第四节、vue-pinia-basics 第一节）。

**来源**：Pinia — "使用 store 的时机 / no active pinia"
