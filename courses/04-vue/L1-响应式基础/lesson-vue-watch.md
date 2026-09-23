# 侦听器：watch 与 watchEffect

> 目标：computed 处理"派生的**值**"，`watch`/`watchEffect` 处理"变化时要做的**副作用**"——发请求、写 localStorage、同步第三方库、操作 DOM（非响应式部分）。本课掌握 **watch 的多种侦听源**（ref / getter / reactive / 数组）、`immediate`/`deep`/`flush`、**`onCleanup` 清理与竞态**、**`watchEffect` 自动收集依赖**、`watchPostEffect`/`watchSyncEffect`，以及"该用 computed 还是 watch"的判断（呼应 vue-reactivity 第四节，原理见 vue-reactivity-theory）。

---

## 一、watch 基础：源 + 回调（新值、旧值）

```vue
<script setup>
import { ref, watch } from "vue";
const q = ref("");

watch(q, (newVal, oldVal) => {
  console.log(`搜索从 "${oldVal}" 变为 "${newVal}"`);
  // 副作用：防抖后发请求...
});
</script>
```

- 回调收到 **(新值, 旧值)**（及 `onCleanup`/`onError` 参数，见第四节）；
- 默认**惰性**：只有源变化才跑（区别于 `watchEffect` 立即执行）。

---

## 二、侦听源：不止 ref

```js
// 1) 多个源：数组
watch([a, b], ([na, nb], [oa, ob]) => {...});

// 2) getter：精确侦听某表达式（返回对象需 deep）
watch(() => state.user.name, (n) => {...});

// 3) 直接侦听 reactive 对象：自动深层（隐含 deep:true）
watch(state, (n, o) => {...});          // ⚠️ n 和 o 是同一对象（Proxy），看不出"变了什么"
watch(state, {...}, { deep: true });    // 深层

// 4) reactive 的某个属性要拿新/旧值，用 getter 包一层
watch(() => state.count, (n, o) => {...});   // ✅ 才有意义的新旧值
```

要点：**侦听 reactive 整体时新旧值同引用**，要比较具体值请用 `() => state.x` 形式。

---

## 三、选项：immediate / deep / flush

```js
watch(q, cb, {
  immediate: true,    // 创建时立即用当前值跑一次（初始化常用）
  deep: true,         // 深层遍历（侦听嵌套对象）
  flush: "post",      // 默认 "post"：DOM 更新后跑回调（可安全读更新后的 DOM）
});
```

- **`flush` 时机**：`"pre"`（默认组件内是 pre，DOM 更新前）、`"post"`（DOM 更新后，适合访问渲染结果）、`"sync"`（同步立即，几乎别用，性能差）；
- 需要 DOM 更新后再动作 → `flush:'post'` 或 `watchPostEffect`（呼应 vue-lifecycle、node-event-loop 的微任务 flush 思想）。

---

## 四、onCleanup：清理副作用与竞态

侦听源频繁变化时，上一次副作用可能还没完成（典型：**搜索请求竞态**）。回调第三个参数 `onCleanup` 会在**下次回调执行前 / 停止时**调用，用于取消：

```js
watch(q, async (query, _, onCleanup) => {
  const ctrl = new AbortController();
  onCleanup(() => ctrl.abort());          // 新查询进来，取消上一条请求
  const res = await fetch(`/api/search?q=${query}`, { signal: ctrl.signal });
  // ...
});
```

- 也用于清除定时器、解绑事件、关闭订阅（呼应 node-events 的 off/泄漏、node-child-process 句柄清理）；
- 错误可用第四参 `onError`（呼应 node-async-errors）。

---

## 五、watchEffect：自动收集依赖 + 立即执行

```js
import { watchEffect } from "vue";
watchEffect((onCleanup) => {
  document.title = `消息 ${count.value}`;   // 用到谁就自动侦听谁
});
```

- **立即执行一次**并在其中**自动追踪**用到的所有响应式依赖，依赖变了再跑；
- 优点：省声明源；缺点：**看不到"到底侦听了什么"、拿不到旧值、易过度依赖导致意外重跑**——需要精细控制/旧值/懒执行时用 `watch`；
- 变体：`watchPostEffect`（flush post）、`watchSyncEffect`（flush sync）。

**选型**：明确知道要侦听什么、要旧值、要懒 → `watch`；就是想"依赖变了就重跑这段副作用" → `watchEffect`。

---

## 六、停止侦听

```js
const stop = watch(src, cb);   // watch 返回停止函数
// 组件卸载会自动停；手动停：
stop();
```

在 `onUnmounted` 之外，若在组件 setup 作用域内创建，卸载时自动清理；在作用域外（如某库）需自己 `stop()` 或配合 `effectScope`（呼应 vue-composables）。

---

## 七、自检清单

- [ ] 什么情况该用 watch 而不是 computed？
- [ ] watch 能侦听哪些"源"？侦听 reactive 整体时新旧值为何相同？
- [ ] `immediate`/`deep`/`flush` 分别控制什么？想读更新后的 DOM 用哪个 flush？
- [ ] `onCleanup` 如何解决搜索竞态？还能清理什么？
- [ ] `watchEffect` 相比 `watch` 的利弊？
- [ ] 如何手动停止一个侦听器？

---

## 🚀 部署预告

- watch 的"依赖追踪/清理"正是 **vue-reactivity-theory** 里 `effect` 的对外封装——理解了 effect 就懂了 watch/watchEffect 为何能"自动知道依赖"；
- 组合式函数（**vue-composables**）内部大量用 watch + onCleanup 管理副作用与 `effectScope`；
- 防抖搜索、请求竞态处理，与 **vue-pinia** 里 action 取数、**vue-router-guard** 里参数变化重取数直接配合；
- `flush` 的"微任务后更新 DOM"与 **node-event-loop**/`nextTick` 的批量异步刷新同理。

下一关进入 **vue-reactivity-theory**：用 Proxy + effect + 依赖收集，把 ref/reactive/computed/watch 统一到一套机制下讲透。
