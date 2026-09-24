# 面试题：选型与生态（pinia-ecosystem）

### 1. (选型类) 什么情况不需要 Pinia？
**来源**：https://pinia.vuejs.org/introduction.html#when-should-i-use-pinia
局部状态（组件 ref）、URL 可表达的状态（query）、纯服务端缓存（TanStack/colada）、简单的父子通信（props/emit）。

### 2. (对比类) Pinia 和 Composable 的边界？
**来源**：https://vuejs.org/guide/reusability/composables.html
Composable 每次调用独立实例；Pinia 全局单例。“需要共享”→Pinia；“可复用逻辑”→composable。

### 3. (生态类) Pinia 生态的核心社区包？
**来源**：https://github.com/vuejs/pinia#used-in-the-wild
persistedstate、@pinia/colada、@pinia/testing、pinia-plugin-hmr、pinia-undo。

### 4. (对比类) Pinia Colada 与 TanStack Query 的定位差异？
**来源**：https://pinia-colada.posva.dev/guide/introduction.html
Colada 是 Vue-native（使用 ref/computed）、与 Pinia 同作者、API 设计类似但体积更小。TanStack 跨框架、生态更大。

### 5. (设计类) “一切状态进 store”为什么是反模式？
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html
Store 膨胀→DevTools 不可读、测试困难、组件耦合 store、无法独立复用。应局部优先、全局克制。

### 6. (综合类) 给一个“中型 Vue 项目”的状态管理分层方案。
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html
① 组件局部: ref/computed ② 跨组件共享: Pinia store ③ 服务端缓存: colada/TanStack ④ URL 可分享态: router query ⑤ 持久化: persist 插件。

### 7. (趋势类) Pinia 未来会支持 Signals 提案吗？
**来源**：https://github.com/tc39/proposal-signals
Vue 的 ref/computed 已对齐 signals 语义。Pinia 底层可能切换到标准原语，但对外 API 不变。

### 8. (选型类) Nuxt 项目里 useAsyncData 能取代 Pinia 吗？
**来源**：https://nuxt.com/docs/getting-started/data-fetching
useAsyncData 管页面级数据；Pinia 管全局共享状态。不能完全取代——跨页面的 auth/cart/ui 状态仍需 store。

### 9. (实战类) 从 Vuex 迁移到 Pinia 的最大收获是什么？
**来源**：https://pinia.vuejs.org/introduction.html
TypeScript 体验质的飞跃、代码量减少约 40%、DevTools 体验、体积压缩 9KB。

### 10. (综合类) 一个 Vue 开发者的状态管理技术栈路线？
**来源**：https://vuejs.org/guide/scaling-up/state-management.html
useState → provide/inject → Pinia → Pinia + Colada → 了解 Signals 演进。

### 11. (选型类) SSR + 纯静态内容站为什么可能不需要 Pinia？
**来源**：https://pinia.vuejs.org/introduction.html#when-should-i-use-pinia

首屏数据由服务端直接注入 HTML、客户端交互极少。用局部 ref / composable 即可，引入全局 store 反而增加水合与序列化的复杂度。

### 12. (对比类) Pinia 和 VueUse 的 createGlobalState 都能跨组件共享，边界在哪？
**来源**：https://vueuse.org/shared/createGlobalState/

createGlobalState 适合轻量跨组件单例，但没有 DevTools、插件、SSR 水合与测试隔离。需要结构化管理、时间旅行、持久化时才值得上 Pinia。

### 13. (生态类) persist 持久化生态里首选哪个方案，要注意什么？
**来源**：https://github.com/prazdevs/pinia-plugin-persistedstate

首选 pinia-plugin-persistedstate。注意：SSR 下只客户端读写、敏感 token 勿明文进 localStorage、用版本字段做 schema 迁移、指定部分字段 persist 而非整 store。

### 14. (趋势类) Vue Vapor 模式与编译器优化会冲击 Pinia 吗？
**来源**：https://vuejs.org/guide/extras/web-vitals.html

不会替代。Vapor 去掉虚拟 DOM、响应式更细粒度，而 Pinia 本就构建在 ref/computed 之上，天然兼容——长期是受益方而非被颠覆方。

### 15. (综合类) 如何向团队论证新项目默认用 Pinia，而不是一个全局 reactive 对象？
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html

裸 reactive 单例缺约束、无 DevTools、测试难隔离、SSR 要手动水合。Pinia 提供结构、插件、类型与可测性，且几乎零额外成本——规范收益远大于学习成本。
