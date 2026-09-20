# 异步组件与 Suspense

> 目标：不是所有组件都需要在首屏就加载。`defineAsyncComponent` 让组件**按需/延迟加载**（配合打包器的代码分割，把大组件拆成独立 chunk）；`<Suspense>` 为"异步依赖未就绪时展示加载态"提供统一声明。本课掌握 **`defineAsyncComponent` 的 loader / loadingComponent / errorComponent / delay / timeout / suspense**、**与动态 `import()` 和 Vite 分包的关系**、**`<Suspense>` 的 default/fallback 两态与 pending 机制（实验性）**，及其与路由懒加载的衔接。（呼应 10-vite 分包、vue-router-guard-lazy、vue-lifecycle）

---

## 一、defineAsyncComponent：按需加载一个组件

```vue
<script setup>
import { defineAsyncComponent } from 'vue';
// 最简：返回 import() Promise 的工厂
const HeavyChart = defineAsyncComponent(() => import('./HeavyChart.vue'));
</script>
<template>
  <HeavyChart v-if="show" />   <!-- 只有渲染到时才去下载对应 chunk -->
</template>
```

- **工厂函数**返回 `Promise<组件>`；Vite/Rollup 会把 `import('./HeavyChart.vue')` **拆成独立 chunk**，用到才请求（呼应 10-vite 分包、vue-performance）；
- 首屏 bundle 因此更小、下载更快；组件在**首次渲染时**才解析、解析完成后挂载（会触发自己的 `onMounted`）。

### 完整配置项

```js
const AsyncComp = defineAsyncComponent({
  loader: () => import('./X.vue'),
  loadingComponent: Spinner,      // 加载中显示的组件
  errorComponent: ErrorMsg,       // 加载/渲染失败显示
  delay: 200,                     // 超过 200ms 才显示 loading（防闪一下）
  timeout: 10000,                 // 超时视为失败（可选）
  suspensible: false,             // 是否交给 <Suspense> 控制（见第三节）
  onError(error, retry, fail, attempts) { /* 重试策略 */ }
});
```
`delay` 很关键：网络快时组件瞬间就绪，若不设 delay，loading 会**闪一下**反而更丑。`onError` 里 `retry()` 可实现"仅线上环境重试 N 次"（呼应 node-deploy-perf 重试、exp 请求重试）。

---

## 二、和动态组件、v-if 配合的常见形态

```vue
<script setup>
import { computed, defineAsyncComponent, ref } from 'vue';
const tab = ref('chart');
const tabs = {
  chart: defineAsyncComponent(() => import('./ChartTab.vue')),
  table: defineAsyncComponent(() => import('./TableTab.vue')),
};
const Current = computed(() => tabs[tab.value]);
</script>
<template>
  <component :is="Current" />     <!-- 切 tab 才加载对应块（呼应 vue-component-basics 动态组件） -->
</template>
```
"低频面板/弹窗/富编辑器"这类**不该进首屏**的 UI，都用异步组件按需拉。与 `<KeepAlive>` 组合可"加载一次后缓存"（呼应 vue-lifecycle 第五节）。

---

## 三、`<Suspense>`：统一处理异步依赖的加载态（实验性）

一个组件（或其子树）里有**顶层 await 的异步 setup**、或异步组件尚未就绪时，`<Suspense>` 先渲染 `fallback`，全部就绪后切到 `default`：

```vue
<Suspense>
  <template #default>
    <AsyncDashboard />           <!-- 内含异步依赖 -->
  </template>
  <template #fallback>
    <SkeletonDashboard />        <!-- 加载中骨架 -->
  </template>
</Suspense>
```

```vue
<!-- AsyncDashboard.vue：setup 里顶层 await（需 <script setup> + 编译器支持 / 或 async setup） -->
<script setup>
const data = await fetchData();   // 挂起直到 resolve，期间由父 Suspense 显示 fallback
</script>
```

- **两态**：`pending`（有子依赖未就绪，显示 fallback）→ `resolve`（就绪，切 default）；失败 emit `fallback`/无 error 插槽（需 errorComponent 兜底）；
- **实验性**：API 可能变、SSR 支持有限，谨慎在生产核心路径依赖（呼应 vue-ssr-nuxt）；
- 一个 Suspense 会"聚合"整棵子树的异步依赖；嵌套时用 `suspensible: false` 让异步组件自带 loading/error 而不上报到祖先 Suspense。

---

## 四、与路由懒加载（真正的大收益）

组件级异步常用于页面级拆分，但**路由懒加载**是更常见的落地方式：

```js
const routes = [
  { path: '/dash', component: () => import('@/views/Dashboard.vue') } // 进该路由才下载
];
```
`component: () => import(...)` 底层用的就是异步组件机制，配合打包器把每个路由拆成一个 chunk（呼应 vue-router-guard-lazy L5、10-vite 分包）。首页只下首页 chunk，其余按需——这是 SPA 首屏提速的主力手段。

---

## 五、注意事项与坑

- **首屏关键组件别异步**：把一定马上出现的内容设成异步，反而多一次网络往返、延迟出现；异步用于"可能不渲染/低频"的块；
- 异步组件解析是**一次性**的，成功后缓存；失败可通过 `onError` 重试；
- 顶层 `await` 使组件成为**异步组件**，被它引用的父需能挂起（在 `<Suspense>` 边界内），否则要 `defineAsyncComponent` 包一层；
- 关注**加载骨架/占位高度**，避免内容就绪时布局跳动（CLS，呼应 vue-performance 首屏、vue-deploy）。

---

## 六、自检清单

- [ ] `defineAsyncComponent` 的工厂返回什么？和 `import()` 有什么关系？
- [ ] `delay`、`loadingComponent`、`errorComponent`、`onError` 各解决什么？
- [ ] `<Suspense>` 的两态是什么？为什么说它"实验性"？
- [ ] 路由懒加载用的是本讲的哪个机制？为何它是首屏提速主力？
- [ ] 哪些组件不该设成异步？

---

## 🚀 部署预告

- 异步组件的"拆 chunk、按需加载"直接建立在 **10-vite 代码分割**之上；页面级的按需靠 **vue-router（L5）** 的懒加载路由落地；
- `<Suspense>` 与异步 setup 的"挂起/恢复"，在 SSR 语境下限制更多，见 **vue-ssr-nuxt（L8）**；加载骨架/防 CLS 属 **vue-performance（L7）**；
- L4 到此结束，进入 **L5 路由**：先把 Vue Router 4 的 createRouter/RouterLink/RouterView/useRoute 讲清楚。

下一关进入 **vue-router-basics**：SPA 为什么需要前端路由、history 模式与后端回退的关系、`RouterLink`/`RouterView` 与 `useRoute`/`useRouter`。
