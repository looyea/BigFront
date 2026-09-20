# vue-watch 面试题精选

> 共 12 题，覆盖 概念与选型 / 侦听源 / 选项 / 清理与竞态 / watchEffect 五类。

---

## 一、概念与选型

### 1. `computed`、`watch`、`watchEffect` 分别在什么场景用？

- **computed**：由其它状态**派生出一个值**，要缓存、惰性；
- **watch**：明确知道侦听哪个源，且变化时要跑**副作用**，需要新/旧值或懒执行；
- **watchEffect**：想"只要用到的依赖变了就重跑这段副作用"，不想手动声明源。
口诀：**派生值→computed；定向侦听+副作用+要旧值→watch；自动依赖+副作用→watchEffect**（呼应 vue-watch 第一、五节）。

**来源**：Vue.js — "Computed vs Watchers"、"watchers"

### 2. 为什么说"能用 computed 就别用 watch 手动同步状态"是反模式？

用 watch 把 `a` 变化时 `b = f(a)` 手动赋值，会引入**两份需要保持一致的状态**、易漏初始值/漏触发、难追踪。computed 让派生值**始终由依赖推导、自动缓存**，无同步 bug（呼应 vue-reactivity interview 第 10 题、vue-state-patterns）。

**来源**：社区 — "You might not need a watcher / derived state"、Vue Style Guide

---

## 二、侦听源

### 3. `watch` 可以侦听哪些"源"？

① 单个 ref；② ref 数组（多源）；③ getter 函数 `() => state.x`；④ reactive 对象（自动 deep，但新旧值同引用）；⑤ 组件 props 对象。要拿到有意义的新旧值，多推荐用 getter 形式（呼应 vue-watch 第二节）。

**来源**：Vue.js — "watch Sources"

### 4. 侦听一个 reactive 对象，为什么回调里新值和旧值相等？怎么办？

因为 reactive 是**同一个 Proxy 引用**被就地修改，Vue 无法给出"上一帧的快照"，故 `newVal === oldVal`。要按具体字段比较，改成 `watch(() => state.count, (n, o) => ...)`，或需要"变了哪些"时配合记录/深拷贝（呼应 vue-watch 第二节）。

**来源**：Vue.js — "Caveats when using reactive objects as watch sources"

---

## 三、选项

### 5. 解释 `immediate`、`deep`、`flush` 三个选项。

- **`immediate`**：创建侦听时用当前值**立即执行一次**回调（初始化取数常用）；
- **`deep`**：递归遍历侦听对象，深层属性变化也触发（侦听 getter 返回的嵌套对象时需要）；
- **`flush`**：控制回调相对组件更新的时机——`pre`（默认，DOM 更新前）、`post`（DOM 更新后，可安全访问渲染结果）、`sync`（同步，慎用）（呼应 vue-watch 第三节）。

**来源**：Vue.js — "watch options: deep / immediate / flush"

### 6. 什么时候必须 `deep: true`？它有什么代价？

当侦听的是 **getter 返回的嵌套对象**、或需要深层属性变化都触发时（直接侦听 reactive 整体已隐含 deep）。代价是**递归遍历整个对象树**追踪依赖，大对象开销高——尽量只侦听真正需要的具体字段，或用 `shallowRef` 手动 `triggerRef`（呼应 vue-reactivity-theory、vue-performance）。

**来源**：Vue.js — "deep option / performance"

---

## 四、清理与竞态

### 7. `watch` 回调里的 `onCleanup` 参数有什么用？给一个典型场景。

`onCleanup(fn)` 注册的 `fn` 会在**该回调下次执行之前**以及**侦听停止时**被调用，用于清理上一次副作用。最典型：**异步搜索竞态**——每次输入发请求，用 `onCleanup(() => controller.abort())` 取消上一条未完成的请求，避免旧结果覆盖新结果（呼应 vue-watch 第四节）。

**来源**：Vue.js — "Watcher Cleanup and Errors / onCleanup"、社区 — "Race conditions in search with Vue watchers"

### 8. watch/watchEffect 创建的副作用，什么时候会被自动清理？何时要手动 stop？

在**组件 setup 同步作用域**内创建的侦听器，会随组件卸载自动停止。若在**异步回调里**（组件已可能卸载）或**组件作用域之外**（如独立库函数）创建，则需自己调用 `watch` 返回的 `stop()`，或用 `effectScope`/`onScopeDispose` 管理（呼应 vue-watch 第六节、vue-composables）。

**来源**：Vue.js — "effectScope / watch scope"

### 9. 组件卸载后 watch 的异步回调里还在 setData/操作已销毁实例，如何防？

在回调里先判断组件是否仍挂载（或用 `onUnmounted` 设标志位/`getCurrentInstance`），并用 `onCleanup` 取消未完成的 fetch/定时器；把订阅统一交给侦听器生命周期自动停。核心是**副作用要与组件生命周期绑定**（呼应 vue-lifecycle、node-events off 泄漏）。

**来源**：Vue.js — "onUnmounted / cleanup"、社区最佳实践

---

## 五、watchEffect

### 10. `watchEffect` 有什么"过度依赖"的风险？

因为它"用到谁就侦听谁"，若回调里读取了很多响应式值（哪怕是**条件分支后才读到**的），会让它比预期更频繁地重跑，且难以从代码看出到底依赖了什么。需要**精确控制侦听源**或**只要某个值变化才做**时，用显式 `watch`（呼应 vue-watch 第五节）。

**来源**：Vue.js — "watchEffect caveats / lazy collection"

### 11. `watchPostEffect` / `watchSyncEffect` 是什么？

它们是 `watchEffect` 的 flush 变体：`watchPostEffect` = `flush:'post'`（DOM 更新后跑，适合读渲染结果），`watchSyncEffect` = `flush:'sync'`（依赖变化立即同步跑，性能敏感、几乎不用）。默认 `watchEffect` 在组件内是 `pre`（呼应 vue-watch 第三、五节）。

**来源**：Vue.js — "watchPostEffect / watchSyncEffect"

### 12. `flush:'post'` 的回调能读到"最新 DOM"，这背后的调度是什么？Vue 为什么批量异步更新 DOM？

组件更新被排进**微任务队列**批量 flush（合并同一 tick 内多次状态变化，只重渲染一次），`post` 回调在 flush 之后执行故能看到更新后 DOM。批处理避免了"每改一个值就同步重排重绘"的性能灾难（呼应 vue-reactivity-theory 调度、node-event-loop 微任务、nextTick）。

**来源**：Vue.js — "Update Queue / nextTick / reactivity flush"
