# 面试题：Computed Getters（pinia-getters）

### 1. (概念类) Pinia 的 getter 是怎么实现的？和 Vuex getter 有什么本质区别？
**来源**：https://pinia.vuejs.org/core-concepts/getters.html

Pinia Setup Store 里 getter 就是 `computed()`——底层复用 @vue/reactivity。与 Vuex getter 的区别：① Vuex getter 是函数签名 `(state, getters, rootState) => value`，Pinia 是闭包直接捕获 ref；② Vuex 跨模块 getter 需要 rootState 路径，Pinia 不能在 getter 里跨 store（只能在 action）；③ 类型推断：Pinia 自动、Vuex 需要手写 ReturnType。

### 2. (实战类) 如何实现一个"按类型筛选商品"的带参 getter？
**来源**：https://pinia.vuejs.org/core-concepts/getters.html#getters-with-parameters

```ts
const getByType = computed(() => (type: string) =>
  items.value.filter(i => i.type === type)
);
```
外层 computed 在 items 变时更新函数引用，内层函数按参数执行。注意缓存粒度粗——type 参数无独立缓存，items 不变时多次调用同一 type 不重新 filter（因为 filter 每次新建数组）。如需按 key 缓存要用 action + ref<Map>。

### 3. (性能类) getter 链过深怎么优化？
**来源**：https://vuejs.org/guide/essentials/computed.html#caching-computed-vs-methods

方案：① 合并中间步骤为一个 computed（减少链路）；② 把重计算移到 action（数据变更时算一次存 ref，getter 只做简单读取）；③ 用 `markRaw` 标记大对象不参与追踪；④ 组件里用 `v-memo` 隔离子树更新。

### 4. (坑类) 为什么不能在 Pinia getter 里调用另一个 store？
**来源**：https://pinia.vuejs.org/core-concepts/getters.html#why-not

computed 是惰性的——只有被访问时才执行。如果访问时机在 `app.use(createPinia())` 之前（如 SSR 预渲染顺序问题），`useOtherStore()` 会抛 "getActivePinia()" 错误。action 不存在此问题（一定在 store 创建后才会被调用）。

### 5. (TS类) Pinia getter 的返回类型怎么被组件推断到？
**来源**：https://pinia.vuejs.org/core-concepts/getters.html#typescript

Setup Store return 了 computed 变量 → useXxxStore() 返回类型包含该字段 → 组件里 `store.total` 类型是 `number`（Pinia 内部对 ComputedRef 做了 UnwrapRef）。storeToRefs 解构后类型是 `ComputedRef<number>`。

### 6. (对比类) Pinia getter 和 MobX computed 有什么异同？
**来源**：https://mobx.js.org/computeds.html

相同：惰性 + 缓存 + 依赖自动追踪。不同：MobX 有 `computed({equals})` 自定义相等判断和 `computedFn`（带参数缓存）；Pinia 的带参 getter 无按 key 缓存。MobX 有 computed 自动传播（reaction 只触发一次）；Pinia 走 Vue scheduler。

### 7. (设计类) 什么时候 getter、什么时候 action 里算？
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html

getter：纯派生（无副作用、输入是 state、输出可缓存）。action 里算：① 需要 async（HTTP）；② 需要跨 store；③ 计算代价极高且消费频率低（延迟到"需要时再算"）；④ 需要写入中间结果供多处复用。

### 8. (原理类) computed 的 dirty 标记与重新计算在 Pinia 里怎么运作？
**来源**：https://vuejs.org/guide/extras/reactivity-in-depth.html#how-computed-works

依赖的 ref 变更 → 通知 computed → computed 标记 dirty → 下一次访问时重新执行 getter 函数 → 如果新值 !== 旧值 → 继续通知下游（组件 render effect）。这就是"惰性"——不访问不计算。

### 9. (调试类) DevTools 里 getter 显示什么？能编辑吗？
**来源**：https://pinia.vuejs.org/introduction.html#devtools

Vue DevTools Pinia 面板里 getter 实时显示当前值（computed 结果）。不可编辑（只读）。编辑 state 后 getter 值自动刷新。如果 getter 是带参数函数，DevTools 显示函数体字符串而非结果。

### 10. (SSR类) getter 在 SSR 阶段会执行吗？
**来源**：https://pinia.vuejs.org/ssr/nuxt.html

取决于是否在 SSR render 期间被访问。如果模板里 `{{ store.total }}`，SSR render 触发 computed 执行 → 结果被缓存 → 序列化进 HTML state。客户端水合恢复 state 后 getter 自动重算（因为 computed 不被序列化——只序列化它依赖的 state）。

### 11. (迁移类) Vuex 的 `getters: { double: (s) => s.count * 2 }` 怎么迁到 Pinia？
**来源**：https://pinia.vuejs.org/core-concepts/getters.html

```ts
// Setup Store
const count = ref(0);
const double = computed(() => count.value * 2);
return { double };
```

把 `state.count` 换成 `count.value`、`getters.xxx` 换成直接变量引用、删掉 `(state)` 参数。

### 12. (性能类) getter 返回的数组/filter 结果每次引用不同怎么解决？
**来源**：https://github.com/vuejs/pinia/discussions/1838

computed(() => items.filter(...)) 内部 filter 产生新数组——每次 computed 重算都新引用 → 下游组件重渲。如果这造成问题：在 action 里手动算+比较→只有真正变了才赋值给一个 ref。或用 Vue 的 `shallowRef` + 手动 trigger。

### 13. (综合类) Pinia 的 computed 和 TC39 Signals 提案的 computed() 有什么关系？
**来源**：https://github.com/tc39/proposal-signals#computed

语义完全对齐：都是惰性+缓存+依赖追踪。Vue 3 的 computed 是 signals 提案的"先行实现之一"。如果提案 Stage 3 通过，未来 Vue 可能底层切到标准原语。当前写法（computed(() => ...)）不变。

### 14. (对比类) Pinia getter 和 SolidJS 的 createMemo 有什么异同？
**来源**：https://www.solidjs.com/docs/latest/api#creatememo

相同：惰性+缓存+自动追踪依赖。不同：Solid createMemo 是 **pull-based**（访问才追踪、精确到信号级别）；Vue computed 是 **push-based 通知 + pull-based 求值** 混合。Solid 天然细粒度（memo 不触发组件 render，只有绑定 memo.value 的 DOM 节点更新）；Pinia 触发整个组件 render。

### 15. (实战类) 如何实现"缓存 getter 结果 + 手动失效"模式？
**来源**：https://pinia.vuejs.com/cookbook/composing-stores.html

```ts
const _cache = ref<Map<string, Item[]>>(new Map());
const _version = ref(0); // 手动失效计数器

const getCached = computed(() => {
  void _version.value; // 依赖 version（即使不用它的值）
  return (key: string) => _cache.value.get(key) ?? expensiveCompute(key);
});

function invalidate() { _cache.value.clear(); _version.value++; }
```
