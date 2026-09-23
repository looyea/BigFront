# 生命周期与 keep-alive

> 目标：组件从创建到销毁有一条固定时序，理解它才能回答"何时能访问 DOM、何时该初始化第三方实例、何时必须清理"。本课掌握组合式 API 的 **`onBeforeMount`/`onMounted`/`onBeforeUpdate`/`onUpdated`/`onBeforeUnmount`/`onUnmounted`**、**setup 与渲染的关系**、`onRenderTracked`/`onRenderTriggered`/`onErrorCaptured`、`<KeepAlive>` 缓存与 **`onActivated`/`onDeactivated`**，以及 SSR 下哪些钩子会跑。（呼应 vue-reactivity-theory 渲染 effect、vue-watch 清理、node-events off 泄漏）

---

## 一、组合式 API 生命周期总览

```vue
<script setup>
import {
  onBeforeMount, onMounted,
  onBeforeUpdate, onUpdated,
  onBeforeUnmount, onUnmounted,
} from 'vue';

onBeforeMount(() => {});   // DOM 还没创建
onMounted(() => {});       // ✅ 已挂载，可访问 DOM、初始化第三方库、发首屏请求
onBeforeUpdate(() => {});  // 响应式变了、DOM 未更新前
onUpdated(() => {});       // ⚠️ DOM 已更新；别在此改状态（易死循环）
onBeforeUnmount(() => {}); // 仍可访问 DOM，做收尾
onUnmounted(() => {});     // ✅ 清理定时器/事件/订阅（多数已被 Vue 自动清）
</script>
```

时序（挂载）：`setup()` → `onBeforeMount` → **首次 render** → `onMounted`。
更新：状态变 → `onBeforeUpdate` → render → `onUpdated`。
卸载：`onBeforeUnmount` → render effect **stop**（侦听器/computed 自动清）→ `onUnmounted`。

> **`setup` 里能拿到生命周期"开始前"的时机**：`setup` 本身相当于 `beforeCreate`+`created`——此时组件实例已建、响应式已就位，但 DOM 未生成，故要访问 DOM 必须放 `onMounted`（呼应 vue-component-basics）。

---

## 二、mounted：真正"接触 DOM / 起副作用"的地方

```js
onMounted(() => {
  const chart = echarts.init(canvasRef.value);   // 第三方实例：这里建
  window.addEventListener('resize', onResize);    // 手动加的全局监听：要手动移
});
onUnmounted(() => {
  chart?.dispose();
  window.removeEventListener('resize', onResize); // 防泄漏
});
```

- **只有 `onMounted` 里 DOM 才存在**，SSR 下 `mounted` **不在服务端执行**（客户端水合后才跑），故"仅浏览器 API"的初始化放这里最安全（呼应 vue-ssr-nuxt）；
- 组件内用 `watch`/`watchEffect` 创建的侦听器、`computed`，会随组件卸载**自动停止**；但 `onMounted` 之后**异步回调里**创建、或挂在 `window` 上的原生监听，Vue 管不到，必须自己清（呼应 vue-watch interview 第 8 题、node-events off 泄漏）。

---

## 三、updated 的陷阱 & 用 watch/nextTick 替代

`onUpdated` 在每次依赖变化重渲染后触发，**在其中再改响应式状态会造成更新循环**。想"状态变后基于新 DOM 做事"，优先：
- 用 `watch(src, cb, { flush: 'post' })` 精确指定源与时机（呼应 vue-watch 第三节）；
- 或在异步回调里 `await nextTick()` 后再读 DOM（呼应 vue-reactivity-theory 第五节）。

`onUpdated` 只适合"不得不同步观察渲染结果"的兜底场景。

---

## 四、侦测类与错误钩子

- `onRenderTracked(dep)` / `onRenderTriggered(event)`：调试用，打印 render effect 追踪/触发了哪个依赖（直接对应 vue-reactivity-theory 第三节的 track/trigger）；
- `onErrorCaptured(err, instance, info)`：捕获**后代组件**抛出的错误，返回 `false` 可阻止继续上抛；配合 `app.config.errorHandler` 做全局兜底（呼应 node-async-errors、vue-project-architecture）；
- `onServerPrefetch`：SSR 专用，服务端渲染前异步取数（呼应 vue-ssr-nuxt）。

---

## 五、`<KeepAlive>`：缓存组件、避免反复重建

`v-if`/动态组件/路由切换默认会**销毁**组件、切回时**重新创建**（丢掉状态、重跑 mounted 取数）。`<KeepAlive>` 把组件实例**缓存**起来，切回时复用：

```vue
<KeepAlive :include="/Article/" :max="10">
  <component :is="tab" />
</KeepAlive>
```

- 缓存的组件卸载时不销毁，改触发 **`onActivated` / `onDeactivated`**（替代 mounted/unmounted 的"每次进入/离开"逻辑，如切回页面刷新数据、离开时暂停轮询）；
- `include`/`exclude`（按组件 `name` 匹配，`<script setup>` 需 `defineOptions({ name })` 或用文件名）、`:max`（LRU 上限，超了淘汰最久未用）、`:key` 精细控制缓存粒度；
- **首次**挂载：`setup → mounted → activated` 依次；切回：只 `activated`；切走：`deactivated`。

---

## 六、KeepAlive 与副作用/内存

缓存意味着组件**一直活着**：其定时器、订阅、watch 若写在 `onUnmounted` 清理，`KeepAlive` 下 `onUnmounted` 不会在切走时触发——要放到 **`onDeactivated`** 里暂停、`onActivated` 里恢复（呼应 vue-watch 第六节、node-child-process 句柄清理）。无节制缓存会涨内存，用 `:max` 兜底（呼应 vue-performance）。

---

## 七、自检清单

- [ ] 哪几个钩子里 DOM 才存在？SSR 下哪些不跑？
- [ ] `setup` 对应选项式的哪个阶段？为什么访问 DOM 要等 mounted？
- [ ] 为什么不建议在 `onUpdated` 里改状态？"渲染后做事"更好用什么？
- [ ] 组件卸载时哪些副作用自动清、哪些必须手动清？
- [ ] `<KeepAlive>` 改变哪两个钩子的触发？include/max 各干什么？

---

## 🚀 部署预告

- `onMounted` 里存第三方实例、`onUnmounted`/`onDeactivated` 里清理，是 **vue-composables（L4）** 封装可复用副作用的标准结构，也是 `onScopeDispose`/`effectScope` 的用武之地；
- 路由页面用 `<RouterView>` + `<KeepAlive>` 做"标签页缓存"是 **vue-router（L5）** 常见需求；轮询/计时器泄漏排查呼应 **node-events / node-deploy-perf**；
- 需要"命令式拿到子组件/DOM 再操作"配合本课时序，正是下一关 **vue-refs-expose** 的主题。

下一关进入 **vue-refs-expose**：模板 ref、`useTemplateRef`、组件默认封闭与 `defineExpose`，以及"何时该用 ref、何时该数据驱动"。
