# vue-composables 面试题精选

> 共 12 题，覆盖 概念与约定 / 返回值与响应式 / 组合与参数 / 作用域清理 / 与 mixin/库 五类。

---

## 一、概念与约定

### 1. 什么是组合式函数？它和"普通工具函数""组件"的区别？

以 `use` 开头、内部使用**响应式 API/生命周期**的函数，用来复用"有状态的逻辑"。比普通工具函数多了响应式与副作用；比组件少了模板、专管逻辑。它是 Vue 3 Composition API 复用的基本单元（呼应 vue-composables 第一节）。

**来源**：Vue.js — "Composables / Why Composables"

### 2. 为什么组合式函数必须在 setup（或另一个 composable / effectScope）里同步调用？

因为内部的 `onMounted`/`watch`/`computed` 等需要**当前组件实例或作用域**来登记生命周期与自动清理。异步回调里调用，实例上下文已丢，钩子绑不上、清理失效（呼应 vue-composables 第一节、vue-provide-inject interview 第 12 题、vue-lifecycle）。

**来源**：Vue.js — "Composables setup context"

---

## 二、返回值与响应式

### 3. 组合式函数应该返回 ref 还是 reactive？解构的坑怎么避？

优先返回**一组 ref**（解构安全、语义清楚）。若返回 reactive 对象，`const {a}=useX()` 会丢响应；需要打包对象时用 `toRefs(state)` 返回，使每个字段仍是 ref（呼应 vue-composables 第二节、vue-reactivity-theory 第六节）。

**来源**：Vue.js — "Returning refs vs reactive"

### 4. 一个组合式函数可以被多个组件同时调用吗？状态会共享吗？

每次调用都创建**一套新的局部状态**（各自的 ref），互不干扰——这正是复用逻辑而非共享状态。若要跨组件共享同一状态，得把 ref 提到模块作用域（单例）或用 store/inject（呼应 vue-composables、vue-pinia）。

**来源**：Vue.js — "Shared vs local state in composables"

---

## 三、组合与参数

### 5. "组合式函数可以套组合式函数"体现在哪？给个例子。

`useUser(id)` 内部调用通用的 `useFetch(url)`，再包一层业务语义；`useFetch` 内部又用了 `watch`/`computed`。层层组合形成清晰的数据/逻辑分层，这也是它胜过 mixin 的地方（呼应 vue-composables 第三节）。

**来源**：Vue.js — "Composing Composables"

### 6. 想让参数既支持 `ref` 又支持普通值，怎么处理？

用 `toValue(src)`/`unref(src)` 归一读取；若要在响应式追踪里跟随 ref 变化，把参数放进 `computed`/`watch` 源。这样 `useX(1)` 与 `useX(someRef)` 都能用（呼应 vue-composables 第三节）。

**来源**：Vue.js — "Accepting ref and plain values / toValue"

---

## 四、作用域与清理

### 7. `onScopeDispose` 和组件里的 `onUnmounted` 有何不同？

`onUnmounted` 只在有组件实例时有效；`onScopeDispose` 在**任意活跃 effectScope**（包括组件作用域、`effectScope()` 手动创建、Pinia 等）结束时触发，让组合式函数"无论在哪被调用"都能登记清理（呼应 vue-composables 第四节、vue-watch 第六节）。

**来源**：Vue.js — "effectScope / onScopeDispose"

### 8. 用 `effectScope` 能避免什么真实问题？（比如 SSR/单例）

组件外的常驻组合式逻辑（全局定时器、订阅）若不收在作用域里，会随模块生命周期长存 → **内存泄漏、SSR 跨请求串状态**。`scope.run(...)` 收集、`scope.stop()` 一次性释放，SSR 里"每请求一个 scope"尤其关键（呼应 vue-composables 第四节、vue-ssr-nuxt、node-deploy-perf）。

**来源**：Vue.js — "effectScope usage / SSR per-request scope"

---

## 五、与 mixin、通用库

### 9. 组合式函数相比 mixins 到底好在哪？逐条说。

① **来源显式**：`const {x}=useX()` 一眼看到出处，mixin 的 `this.x` 不知来自谁；② **无命名冲突**：各返回各的，不像 mixin 合并进同一实例相互覆盖；③ **可传参、可组合**；④ **易单测**：就是普通函数；⑤ **TS 推断好**（呼应 vue-composables 第五节）。

**来源**：Vue.js — "Why not Mixins"、"Composition API FAQ"

### 10. 一个组合式函数什么时候该做成"单例（共享状态）"？怎么做？

当多个组件要共享**同一份**状态（如全局 toast、主题、当前用户）时。做法：把状态 ref 提到**模块作用域**，函数只读写它 → 所有调用者共享（"Vue 3 单例 composable"）。注意 SSR 下模块级状态是**跨请求共享**的，需慎用（呼应 vue-composables 第四节、vue-pinia、vue-ssr-nuxt）。

**来源**：Vue.js — "Singleton in a Composable"、社区 — "global state without a store"

### 11. 为什么说"能用 composable 表达的逻辑就别塞进 store"？

store 适合**跨页面/跨兄弟的全局业务状态**。局部的、只服务一个组件/子树的逻辑（鼠标追踪、表单校验、防抖取数）用 composable 更内聚、可测试、无全局污染。二者互补，别把所有东西都往 Pinia 里灌（呼应 vue-composables、vue-pinia、vue-state-patterns）。

**来源**：Pinia 文档 — "When to use a store"、社区 — "composables vs store"

### 12. 像 VueUse 这类库的组合式函数有哪些值得学习的设计？

参数支持 ref/值（`toValue`）、返回命名 ref、自动随作用域清理、SSR/环境安全、按文件拆分可 tree-shake、选项对象可扩展。团队沉淀自己的 `composables/` 时应遵循同样契约（呼应 vue-composables 第六节、vue-project-architecture、10-vite tree-shaking）。

**来源**：VueUse 文档 — "Functions best practices / SSR"
