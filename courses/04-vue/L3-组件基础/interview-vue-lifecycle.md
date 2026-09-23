# vue-lifecycle 面试题精选

> 共 12 题，覆盖 时序 / DOM 与副作用 / 更新与调试钩子 / KeepAlive 四类。

---

## 一、时序

### 1. 画出 Vue 3 组件的生命周期时序，标出 setup 的位置。

`setup()`（≈ beforeCreate+created，此时响应式就位、无 DOM）→ `onBeforeMount` → **首次 render（建立 DOM）** → `onMounted`。之后：状态变 → `onBeforeUpdate` → render → `onUpdated`；卸载 → `onBeforeUnmount` → render effect stop → `onUnmounted`（呼应 vue-lifecycle 第一节）。

**来源**：Vue.js — "Composition API Lifecycle Hooks / 生命周期图"

### 2. 为什么"操作 DOM / 初始化第三方库 / 首屏取数"要放 onMounted 而不是 setup？

`setup` 阶段 DOM 还不存在（还没 render）。`onMounted` 是 DOM 就绪的第一个时机，`ref` 绑定的元素也在此后可用；把浏览器 API、图表/编辑器实例化、依赖 DOM 的测量都放这里最安全（呼应 vue-lifecycle 第二节、vue-refs-expose）。

**来源**：Vue.js — "onMounted / 何时访问 DOM"

---

## 二、DOM 与副作用

### 3. SSR（或 Nuxt）下哪些生命周期会在服务端跑、哪些只在客户端？

服务端跑：`setup`、`onServerPrefetch`、computed/render；**不跑** `onMounted`/`onUpdated`/`onBeforeUnmount` 等 DOM 相关钩子（浏览器没有 DOM）。客户端水合后才触发 `mounted`。故"仅浏览器 API"的副作用要么放 `onMounted`、要么加 `import.meta.client`/`onMounted` 守卫（呼应 vue-lifecycle 第二节、vue-ssr-nuxt）。

**来源**：Vue.js — "SSR Lifecycle / Client-Only Code"

### 4. 组件卸载时，Vue 会自动帮你清理哪些副作用？哪些必须自己清？

自动：render effect、组件作用域内创建的 `watch`/`watchEffect`/`computed`/`effectScope` 会随卸载停止。手动：`onMounted` 之后异步回调里创建的侦听、`window`/`document` 原生事件、`setInterval`、WebSocket、第三方实例——这些 Vue 看不见，要在 `onUnmounted` 清（呼应 vue-lifecycle 第二、六节、vue-watch interview 第 8 题、node-events off）。

**来源**：Vue.js — "Component scope / effectScope"、社区 — "Vue memory leaks / event listeners"

---

## 三、更新与调试钩子

### 5. 为什么"数据变了之后想读更新后的 DOM"不该放 onUpdated？推荐什么？

`onUpdated` 在**任何**依赖变化后都触发、且在其内部改状态会导致更新循环。更精准的做法：`watch(src, cb, { flush:'post' })` 只在关心的源变化、且 DOM 更新后执行；或 `await nextTick()` 后读 DOM。把 `onUpdated` 当最后手段（呼应 vue-lifecycle 第三节、vue-watch 第三节）。

**来源**：Vue.js — "onUpdated caveat / flush post / nextTick"

### 6. `onRenderTracked` / `onRenderTriggered` 有什么用？

调试钩子：分别在 render effect **追踪到新依赖**、**因某依赖变化被触发重渲染**时回调，能打印出"这个组件到底依赖了什么、这次是被谁触发的"。用于排查"意外重渲染"，直连依赖收集机制（呼应 vue-lifecycle 第四节、vue-reactivity-theory 第三节、vue-performance）。

**来源**：Vue.js — "onRenderTracked / onRenderTriggered"

### 7. `onErrorCaptured` 能捕获所有错误吗？它的作用域是什么？

只捕获**当前组件及其后代组件**抛出的错误（渲染/钩子/watch 中），返回 `false` 阻止继续向上传；**不捕获**事件处理器、异步回调（如 setTimeout/promise）里的错误——那些要靠 try/catch 或全局 `app.config.errorHandler`。类似错误的"捕获冒泡"（呼应 vue-lifecycle 第四节、node-async-errors）。

**来源**：Vue.js — "errorCaptured / Error Handling"

---

## 四、KeepAlive

### 8. `<KeepAlive>` 解决什么问题？工作原理是什么？

缓存动态组件/路由切换时的组件**实例**（含状态、DOM），避免每次切回都销毁重建、重跑取数。原理是维护一个按组件 key/name 索引的缓存池，切走时把组件**从视图移除但保留实例**、发 `deactivated`；切回时重新插入、发 `activated`（呼应 vue-lifecycle 第五节、vue-conditional-list 的 v-if 对比）。

**来源**：Vue.js — "KeepAlive"、"Built-in Components / activated-deactivated"

### 9. 被 KeepAlive 缓存的组件，钩子触发和普通组件有何不同？

首次进入：`setup → mounted → activated`；切走：只 `deactivated`（**不** unmounted）；再切回：只 `activated`（**不**再 mounted）。所以"每次进入刷新/每次离开暂停"的逻辑要写在 activated/deactivated，而不是 mounted/unmounted（呼应 vue-lifecycle 第五、六节）。

**来源**：Vue.js — "KeepAlive Lifecycle Hooks Impact"

### 10. `include` / `exclude` / `max` 怎么用？`<script setup>` 里 include 按什么匹配？

`include`/`exclude` 按组件 **name** 匹配决定缓存谁；`max` 给缓存数量上限，超出按 **LRU** 淘汰最久未激活的。`<script setup>` 默认无 name，`include` 会用**文件名**匹配，或显式 `defineOptions({ name: 'Article' })`（呼应 vue-lifecycle 第五节、vue-sfc 宏）。

**来源**：Vue.js — "KeepAlive include/exclude/max"、"defineOptions"

### 11. KeepAlive 用得不当会有什么坑？

内存增长（缓存实例一直活着）、旧数据不刷新（切回不触发 mounted 取数）、写在 unmounted 的清理不执行（轮询/监听停不掉，要在 deactivated）。对策：`:max` 限制、activated 里按需刷新、把清理搬到 deactivated（呼应 vue-lifecycle 第六节、vue-performance）。

**来源**：Vue.js — "KeepAlive caveats"、社区 — "KeepAlive 内存/刷新问题"

### 12. 路由页面缓存一般怎么和 KeepAlive、RouterView 结合？

```vue
<RouterView v-slot="{ Component }">
  <KeepAlive :include="cachedTabs">
    <component :is="Component" :key="route.fullPath" />
  </KeepAlive>
</RouterView>
```
用 `v-slot` 拿到当前路由组件，`KeepAlive` 包动态组件，`include` 绑定"需要缓存的标签页 name 列表"，`:key` 精细控制同一路由不同参数是否分别缓存（呼应 vue-lifecycle 第五节、vue-router L5）。

**来源**：Vue Router — "View Data Transition / RouterView slot"
