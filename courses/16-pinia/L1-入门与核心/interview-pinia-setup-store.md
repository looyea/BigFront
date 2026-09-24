# 面试题：Setup Store 写法（pinia-setup-store）

### 1. (概念类) 什么是 Pinia 的 Setup Store？它与 Options Store 的区别？
**来源**：https://pinia.vuejs.org/core-concepts/#setup-stores

Setup Store 用 `defineStore(id, () => { ... return { ... } })` 定义，setup 函数里用 ref/computed/function 分别表达 state/getter/action。Options Store 用对象配置 `defineStore(id, { state, getters, actions })`。区别：Setup 天然支持 TS 推断、可组合任意 composable、可设私有状态（不 return）；Options 自带 `$reset()`、对 Vuex 老用户上手友好。

### 2. (实战类) 为什么 Setup Store 需要 return？不 return 会怎样？
**来源**：https://pinia.vuejs.org/core-concepts/#setup-stores

Pinia 把 return 的对象当作 store 的公共 API——外部通过 `useXxxStore()` 只能访问 return 里的属性。未 return 的 ref/computed/function 是私有的，组件/其他 store 无法触达。这是 Setup Store 的封装机制（类似模块的 export 白名单）。

### 3. (原理类) storeToRefs 做了什么？为什么不直接 toRefs？
**来源**：https://pinia.vuejs.org/core-concepts/destructuring.html

`storeToRefs` 内部遍历 store 的 state 和 getter 属性，对每个做 `toRef(store, key)` 返回 Ref——保持与原始 store 的响应式链接。但它会**跳过 action**（函数类型），因为函数引用稳定无需转 ref。如果直接 `toRefs(store)`，action 也会被包成 Ref<Function>——调用时需要 `.value()`，使用体验退化。

### 4. (对比类) Setup Store 中的 computed getter 和组件里的 computed 有区别吗？
**来源**：https://pinia.vuejs.org/core-concepts/getters.html

行为完全一致（惰性+缓存）——因为底层都是同一个 `@vue/reactivity` 的 computed 实现。区别仅在于**共享范围**：组件 computed 是实例级（每个组件一份），store computed 是模块单例级（全局一份，所有订阅者共用缓存）。

### 5. (实战类) Setup Store 里怎么实现 $reset()？
**来源**：https://github.com/vuejs/pinia/discussions/1119

把初始值工厂抽函数：`const initState = () => ({ count: ref(0), name: ref('') })`，在 return 前定义 `function reset() { const s = initState(); count.value = s.count.value; name.value = s.name.value }` 然后 return { ..., reset }。Options Store 自带 $reset（内部记录 state() 初始快照）。

### 6. (TS类) Setup Store 里 ref<'a'|'b'>('a') 的类型能被外部推断到吗？
**来源**：https://pinia.vuejs.org/core-concepts/#typescript

可以。`return { role }` 后，`useXxxStore().role` 类型就是 `'a' | 'b'`——因为 ref 的泛型参数通过 ComputedRef/Ref<T> 透传。赋值时 TS 会检查 `store.role = 'c'` 报错。

### 7. (坑类) Setup Store 里 watch 的清理时机？
**来源**：https://pinia.vuejs.org/core-concepts/#setup-stores

Setup Store 的 setup 函数在 `useXxxStore()` 首次调用时执行一次，返回的 store 是**永驻的**（不会 unmount）。因此 watch 不会像组件里那样自动 stop——除非 store 关联了 scope。推荐：在 action 里用 `watchSource.pipe(...)` 或手动 `watchStop()` 控制生命周期；或者用 effectScope 在登出时 `scope.stop()`。

### 8. (设计类) 一个 store 应该多大？什么时候拆？
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html

原则：一个 store 对应一个**业务域**（auth/cart/user）而非一个页面。判据：如果两个字段永远一起变 → 不拆；如果某字段只在特定 action 里用 → 可拆。避免"上帝 store"（50+字段）——DevTools 不可读、computed 依赖过宽导致频繁重算。

### 9. (组合类) 两个 Setup Store 互相 import 会有循环依赖吗？
**来源**：https://pinia.vuejs.org/core-concepts/#using-other-stores

不会。Pinia 的 store 在首次 `useXxxStore()` 时才创建实例——import 只拿到"创建函数"引用。在 action 里 `const other = useOtherStore()` 是延迟解析的，Vite/Rollup tree-shake 不会成环。但 **getter 里不能用其他 store**（computed 执行时机不确定），只能在 action 里跨 store。

### 10. (实战类) 如何在 Setup Store 里做 localStorage 持久化？
**来源**：https://pinia.vuejs.org/cookbook/plugins.html#persist-with-local-storage

三种方案：① VueUse 的 `useLocalStorage`（推荐）——ref 自动同步 storage；② 插件方案：`pinia-plugin-persistedstate` 一行配置自动存/取；③ 手动 `$subscribe` 监听写 storage。注意 SSR 里 storage 不存在——需 `import.meta.client` 守卫。

### 11. (规范类) Setup Store 里 state 用 ref 还是 reactive？推荐哪种？
**来源**：https://pinia.vuejs.org/core-concepts/state.html#state

官方推荐 **ref**。原因：① 保持原始类型可读（`.value` 明确）；② 可用 `storeToRefs` 保留响应式解构；③ `reactive()` 在 Setup Store 里行为与 ref 等价但整对象替换时需要特殊处理（不能重新赋值，只能 $patch）。

### 12. (SSR类) Setup Store 在 SSR 中的生命周期是什么？
**来源**：https://pinia.vuejs.org/ssr/nuxt.html

每个请求服务端会创建新的 Pinia 实例（避免跨请求数据泄漏）。store 的 setup 在首次 `useXxxStore()` 时执行——即该请求的渲染期间。请求结束后实例销毁。客户端水合时从序列化的 state 恢复，**不会重新执行 setup**——所以 setup 里的 fetch 在客户端不会触发（这是预期）。

### 13. (调试类) Setup Store 的 DevTools 面板里能看到私有状态吗？
**来源**：https://pinia.vuejs.org/cookbook/hot-module-replacement.html

不能。DevTools 展示的是 store 的 `$state`——即 return 出去的那些 ref。私有 ref 不在 $state 里，也不参与 `$patch`/`$subscribe`——等同于完全隔离。这是"不 return 即私有"的附带好处。

### 14. (迁移类) Options Store 迁移到 Setup Store 的步骤？
**来源**：https://pinia.vuejs.org/core-concepts/#setup-stores

① state() 返回的每个字段 → 独立 `ref(val)`；② getters → `computed(() => ...)`；③ actions（含 async）→ 普通 `function`，`this.xxx` → `xxx.value`；④ `this.$patch` → 直接赋值；⑤ 最后 `return { ...all }`；⑥ 验证 DevTools 面板正常。

### 15. (综合类) Setup Store 能接受外部参数实例化吗（类似工厂）？
**来源**：https://github.com/vuejs/pinia/discussions/1143

不能。defineStore 创建的 useXxxStore() 不接受参数。如果需要"传参创建独立实例"，用 `createStore` 工厂模式——手动 `ref()` 包一组变量，用 `provide/inject` 注入组件子树，实现作用域隔离的局部 store。
