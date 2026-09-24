# 面试题：Pinia 是什么（pinia-overview）

### 1. (概念类) Pinia 解决了 Vuex 的哪些问题？为什么官方推荐迁移？
**来源**：https://pinia.vuejs.org/introduction.html#motivation

Pinia 核心解决了 Vuex 三大痛点：① mutations 层冗余——同步改 state 被强制通过 commit 字符串调用，增加了无意义的间接层；② 模块割裂——namespaced 让 import 和跨模块引用变成字符串拼接地狱；③ TypeScript 支持极差——需要手写大量 as/infer 才能获得有限类型。Pinia 用 Setup Store（直接 ref/computed/function）消除了所有样板，类型自动推断，体积仅 1.2KB。Vue 官方文档已将 Pinia 列为唯一推荐方案。

### 2. (原理类) Pinia 的 Setup Store 和 Vue 组件的 <script setup> 有什么关系？
**来源**：https://pinia.vuejs.org/core-concepts/#setup-stores

Setup Store 就是一个 setup 函数——返回的 ref 即 state、computed 即 getter、普通函数即 action。与组件的 `<script setup>` 完全同构，可复用 Composition API 的一切：watch、inject、自定义 composable。区别在于 Pinia store 是模块级单例（全局共享），组件 setup 每次创建新实例。

### 3. (对比类) Pinia 和 Zustand 的设计哲学有何异同？
**来源**：https://github.com/pmndrs/zustand/discussions/1144

相同：都追求"最少的仪式感"、优秀的 TS 推断、通过插件/中间件扩展。不同：Zustand 是 React 外部 store，基于不可变快照+useSyncExternalStore；Pinia 活在 Vue 响应式系统内部，直接操作 ref——无需桥接层。Zustand 的 store 创建后是一个 hook；Pinia 的 store 创建后是一个函数（useXxxStore()）返回 reactive 对象。

### 4. (实战类) Pinia 在 Nuxt 3 项目中怎么配置？SSR 水合怎么处理？
**来源**：https://pinia.vuejs.org/ssr/nuxt.html

`npx nuxi module add pinia` 安装官方模块。模块自动处理：① createPinia 注册到 Vue app；② 服务端 store 的 state 序列化为 JSON 注入 HTML；③ 客户端水合时恢复。开发者无需手动 hydrate。注意点：store 里的 localStorage/sessionStorage 操作必须用 `import.meta.client`（或 `process.client`）守卫，否则 SSR 报错。

### 5. (概念类) Pinia 的 storeToRefs 是做什么的？为什么不能直接解构？
**来源**：https://pinia.vuejs.org/core-concepts/state.html#destructuring-from-a-store

`storeToRefs(store)` 把 store 里的 state 和 getter 转成 refs 数组，解构后保持响应式绑定。直接 `const { count } = store` 会解引用丢响应性——因为 Pinia 内部用 reactive 包了 store 对象，解构等同于拷贝值。action 不需要 storeToRefs（函数引用稳定，直接解构安全）。

### 6. (原理类) Pinia 的响应式基础是什么？它与 Vue 的 reactive 是什么关系？
**来源**：https://pinia.vuejs.org/core-concepts/#setup-stores

Pinia 直接复用 Vue 3 的响应式系统（@vue/reactivity）。Setup Store 返回的 ref/computed 在 Pinia 内部被 reactive 包装成 store 对象。因此 Pinia 本身没有独立的响应式引擎——它就是 Vue 响应式的"有名字的全局实例"。这比 Vuex（基于 Vue.observable 包装普通对象）更彻底。

### 7. (对比类) Pinia 中为什么没有 mutations？直接改 state 不会丢失追踪吗？
**来源**：https://pinia.vuejs.org/introduction.html#mutations

Vue 3 的 Proxy 响应式系统在 ref.value = x 或 reactive 对象属性赋值时自动触发更新，不需要"显式 commit 通知"。Vuex 的 mutation 是 Vue 2 时代 Observable 的遗留设计。Pinia 直接赋值或 $patch 批量改，DevTools 通过 store.$subscribe 统一记录变更快照。

### 8. (实战类) 新项目选 Pinia 还是直接用 provide/inject + ref？
**来源**：https://github.com/vuejs/rfcs/discussions/542

判据三问：① 需要跨页面持久共享？→ Pinia；② 需要 DevTools 时间旅行调试？→ Pinia；③ 需要插件（persist/日志/撤销）？→ Pinia。三问都是"否"→ composable（ref + provide/inject）足够。不要为了"用 Pinia 而用 Pinia"——过度集中反而让组件难以独立测试。

### 9. (生态类) Pinia 与 @pinia/colada 的关系？
**来源**：https://pinia.vuejs.org/cookbook/future-plan.html

@pinia/colada（原 vue-modal）定位是 Pinia 生态的"服务端状态缓存层"（类似 TanStack Query），处理异步数据的 cache/invalidate/retry。Pinia 管客户端状态（UI 偏好、表单草稿等），colada 管服务端状态。posva 明确建议：数据拉取类需求优先用 colada/TanStack Query 而非塞进 store。

### 10. (实战类) Pinia 如何做 HMR 热更新不丢状态？
**来源**：https://pinia.vuejs.org/cookbook/hot-module-replacement.html

每个 store 文件末尾加 `if (import.meta.hot) { import.meta.hot.accept(acceptHMRUpdate(useMyStore, import.meta.hot)) }`。acceptHMRUpdate 会 patch store 实例的 state/getter/action 引用而不销毁——组件持有的是同一个 reactive 对象，值不丢。

### 11. (选型类) Pinia 适合 React 项目吗？如果团队从 Vue 迁移到 React 呢？
**来源**：https://stackoverflow.com/questions/76091795/can-i-use-pinia-with-react

Pinia 仅支持 Vue——依赖 Vue 的响应式系统和 app.use 机制。迁移到 React 时的对等替代品是 Zustand（同为 posva 推荐的最小化 store）。Pinia 的 Setup Store 思路在 React 中可参考 Jotai（原子化）或 Zustand（selector 订阅）。

### 12. (调试类) 如何调试 Pinia store 的意外状态变更？
**来源**：https://pinia.vuejs.org/core-concepts/state.html#strict-mode

① 开 Vue DevTools Pinia 面板——每次 patch/action 都有时间线；② `$subscribe` 钩子打印变更路径；③ 开发模式开启 `strict: true`（createPinia({ strict: true })）阻止 DevTools 外直接赋值。三层组合定位"谁改了这个值"。

### 13. (性能类) Pinia 大量 state 时性能如何？有粒度订阅吗？
**来源**：https://github.com/vuejs/pinia/discussions/1148

Pinia 依赖 Vue 的 Proxy 响应式——组件 render 函数里读到哪个 ref，那个 ref 变了才触发该组件更新（天然细粒度）。不需要手动 selector（Vue 编译器已做收集）。但如果 store 有上千字段、一个 computed 依赖全部字段，仍要注意 computed 的 re-computation 频率。

### 14. (迁移类) Vuex 4 项目如何迁移到 Pinia？能共存吗？
**来源**：https://vitejs.dev/guide/features.html

Pinia 官方提供 codemod 工具（`npx @posva/vuex-to-pinia`）自动转 module→store。两种写法共存可行（app.use(createPinia()) + app.use(store)），但建议分阶段全量迁移。迁移检查：① mutations 删除→直接赋值；② namespaced getters→computed；③ dispatch→直接调用 action。

### 15. (综合类) Pinia 未来会支持 Vue 2 或 React 吗？
**来源**：https://pinia.vuejs.org/getting-started.html#installation

官方明确不支持 Vue 2（Composition API polyfill 不完整且维护成本太高）。跨框架（如 React）同样不在路线图——Pinia 深度绑定 @vue/reactivity。posva 在 RFC 讨论中表示，如果 signals 提案 Stage 3 稳定，底层可能切到标准原语，但不会做跨框架 runtime。
