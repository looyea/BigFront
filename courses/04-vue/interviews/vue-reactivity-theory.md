# vue-reactivity-theory 面试题精选

> 共 12 题，覆盖 原理选型 / 依赖收集 / effect 与 computed / 调度与 nextTick / 逃生舱 五类。

---

## 一、原理与选型

### 1. Vue 3 的响应式相比 Vue 2 有哪些本质改进？为什么放弃 defineProperty？

defineProperty 逐属性劫持 getter/setter，**侦测不到新增/删除属性、数组索引与 length 变化**，且初始化要**递归遍历**整个对象。Proxy 代理**整个对象**、拦截操作本身，新增/删除/数组都能感知，并支持**懒代理**（用到嵌套对象才递归）。代价是 Proxy 无法 polyfill，故 Vue 3 放弃 IE（呼应 vue-reactivity-theory 第一节、ES 包 Proxy）。

**来源**：Vue.js — "Reactivity in Depth / Why Proxies"、Vue 2 文档 — "Change Detection Caveats"

### 2. `Proxy` 和 `Reflect` 常成对出现，为什么？

在拦截器里用 `Reflect.get/set` 能保证默认行为正确，尤其能正确处理 **receiver（this 指向）**——当被代理对象的原型链上有 getter 时，用 `target[key]` 直接取会丢失正确的 `this`，`Reflect.get(t, k, receiver)` 才符合规范（呼应 ES 包 Proxy/Reflect 关）。

**来源**：MDN — "Proxy / Reflect"、"Proxy 陷阱与 Reflect 默认行为"

---

## 二、依赖收集

### 3. 讲讲 Vue 3 的依赖收集数据结构，track 和 trigger 分别做什么？

三层：`targetMap: WeakMap<raw, Map<key, Set<effect>>>`。`get` 时 `track(target,key)` 把当前 `activeEffect` 加入对应 Set（并记入 effect.deps 以便清理）；`set` 时 `trigger(target,key)` 取出 Set，调度其中每个 effect 重跑。这就是"读时收集、写时触发"（呼应 vue-reactivity-theory 第二、三节）。

**来源**：Vue.js — "Reactivity in Depth"、社区源码解读 — "Vue 3 响应式原理 / depsMap"

### 4. 为什么用 WeakMap 作最外层？和内存泄漏有什么关系？

WeakMap 的 key 是弱引用，原始响应式对象被 GC 时其依赖记录自动消失；若用 Map 则会永久持有已销毁对象，造成泄漏（呼应 vue-reactivity-theory 第三节、ES 包 WeakMap）。

**来源**：MDN — "WeakMap"、Vue 源码 — "targetMap 使用 WeakMap"

### 5. `activeEffect` 为什么需要一个栈（effectStack）？

因为 effect 会**嵌套**：外层是组件渲染 effect，内部访问 computed 会触发 computed 自己的 runner effect。若只用一个变量，内层跑完会把 `activeEffect` 覆盖成 undefined，外层后续依赖就收集不到。栈保证内层结束后恢复外层（呼应 vue-reactivity-theory 第二节）。

**来源**：Vue 源码解读 — "effectStack / 嵌套 effect"

---

## 三、effect 与 computed

### 6. computed 为什么"惰性 + 缓存"？和 watch 有何底层区别？

computed 把 getter 包成 `lazy` effect：依赖变化时 scheduler 只把 `dirty` 置真并通知下游，**不立即计算**；只有访问 `.value` 且 dirty 时才真正跑 getter，否则返回缓存。watch 则是"依赖变就执行副作用回调"。所以派生值用 computed、副作用用 watch（呼应 vue-reactivity-theory 第四节、vue-watch interview 第 2 题）。

**来源**：Vue.js — "Computed vs Watchers / 惰性求值"

### 7. 重新执行 effect 前为什么要先 cleanup 旧依赖？举一个分支的例子。

条件表达式 `flag ? a.x : b.x` 切换分支后，未走到的分支属性不该再被侦听。若不清理，失效依赖会残留，导致无关属性变化也触发重跑。Vue 每次 run 前把 effect 从旧 dep 移除、执行时重新收集（呼应 vue-reactivity-theory 第三节）。

**来源**：Vue 源码 — "cleanupEffect / 动态依赖"

---

## 四、调度与 nextTick

### 8. 连续 `count.value++` 十次为什么只渲染一次？

trigger 不直接同步重渲染，而是把组件的更新 effect **推入去重队列**（同一 effect 只入队一次），再调度一个**微任务**一次性 flush。同步代码跑完、微任务执行时才真正 diff/patch，所以十次只渲染一次（呼应 vue-reactivity-theory 第五节、node-event-loop 微任务）。

**来源**：Vue.js — "Update Queue / nextTick"、"Rendering Mechanics"

### 9. `await nextTick()` 到底等了什么？什么时候需要它？

它返回一个在当前 flush 完成后 resolve 的 Promise，用来"等 DOM 更新完再操作 DOM"。改了响应式数据后立刻 `document.querySelector` 拿到的是旧 DOM，需 `await nextTick()`。多数场景应优先数据驱动 + `flush:'post'`，而非手动 nextTick（呼应 vue-watch 第三节）。

**来源**：Vue.js — "nextTick"、社区 — "When to use nextTick"

---

## 五、逃生舱

### 10. `shallowRef` 相比 `ref` 有何不同？为什么大列表/第三方实例推荐它？

`ref` 对对象值会内部 `reactive` 深层代理；`shallowRef` 只在 `.value` **整体替换**时触发，深层属性变化不侦听，省去递归代理开销。存 ECharts/地图实例、海量表格数据时用，需要手动通知用 `triggerRef()`（呼应 vue-reactivity-theory 第六节、vue-performance）。

**来源**：Vue.js — "shallowRef / triggerRef"

### 11. 从 reactive 解构会丢响应，`toRef`/`toRefs` 怎么救？

解构 `const { x } = state` 拿到的是普通值、脱离代理。`toRef(state,'x')` 生成一个与该属性**双向共享**的 ref；`toRefs` 对每个属性都做，解构后仍是活的 ref。组合式函数返回多个状态常用 `toRefs`（呼应 vue-reactivity-theory 第六节、vue-composables）。

**来源**：Vue.js — "toRef / toRefs"、"reactive caveats 解构"

### 12. `markRaw`、`customRef` 分别解决什么问题？

`markRaw(obj)` 给对象打标记，**永不**被转成代理（如把组件定义、不可变实例放进响应式树，避免无谓代理）。`customRef` 让你自定义 `track`/`trigger` 时机，实现"防抖 ref""写入即 trim"等定制行为（呼应 vue-reactivity-theory 第六节）。

**来源**：Vue.js — "markRaw / customRef"
