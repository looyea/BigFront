# vue-async-suspense 面试题精选

> 共 12 题，覆盖 异步组件 / 配置项 / Suspense / 与分包和路由 四类。

---

## 一、异步组件

### 1. 什么是异步组件？它解决什么问题？

组件的定义不在首包内、而是在需要渲染时才通过返回 Promise 的工厂**动态加载**。解决：首屏 bundle 过大、低频组件（弹窗/编辑器/图表）被无谓下载。配合打包器代码分割，实现"用到才拉"（呼应 vue-async-suspense 第一节）。

**来源**：Vue.js — "Async Components / defineAsyncComponent"

### 2. `defineAsyncComponent(() => import('./X.vue'))` 里 import() 和分包是什么关系？

动态 `import()` 是**代码分割点**：Vite/Rollup 把 `X.vue` 及只被它引用的依赖拆成独立 chunk，运行时 `import()` 触发按需请求。异步组件正是消费这个 Promise（呼应 vue-async-suspense 第一、四节、10-vite 分包）。

**来源**：Vue.js — "Async Components + code splitting"、Rollup/Vite — "Dynamic import chunks"

---

## 二、配置项

### 3. loadingComponent / errorComponent / delay / timeout 分别做什么？

- `loadingComponent`：加载期间显示的组件；
- `errorComponent`：加载或渲染失败时显示；
- `delay`：加载超过该毫秒数才显示 loading（默认 200，防快网闪一下）；
- `timeout`：超过则判定失败、显示 errorComponent（呼应 vue-async-suspense 第一节）。

**来源**：Vue.js — "defineAsyncComponent options"

### 4. 组件加载失败（网络抖动）怎么自动重试？

用 `onError(err, retry, fail, attempts)`，在里面按 `attempts < N` 调 `retry()`、否则 `fail()`。常用于线上偶发 chunk 加载失败（呼应 vue-async-suspense 第一、五节、node-deploy-perf 重试）。

**来源**：Vue.js — "onError / retry 策略"、社区 — "Chunk load failed retry"

---

## 三、Suspense

### 5. `<Suspense>` 解决什么问题？两态如何流转？

为"子树里存在未就绪的异步依赖"提供统一的**加载态**：有依赖 pending 时渲染 `#fallback`，全部 resolve 后切到 `#default`。让异步 setup / 异步组件的"等待"声明式化（呼应 vue-async-suspense 第三节）。

**来源**：Vue.js — "Suspense（experimental）"

### 6. `<script setup>` 里能写顶层 `await` 吗？写了会有什么后果？

可以（编译器把组件变成异步组件）。后果：该组件在 resolve 前不能挂载，必须处于某个 `<Suspense>` 边界内、或用 `defineAsyncComponent` 包裹它的引用方，否则父级不知道如何处理挂起（呼应 vue-async-suspense 第三、五节）。

**来源**：Vue.js — "<script setup> 顶层 await / Async setup"

### 7. 为什么说 `<Suspense>` 目前"实验性"？生产要注意什么？

官方标注 API 可能调整、SSR/嵌套/error 处理不如同步完善。生产核心路径慎依赖，复杂场景常回退到"loading 状态 + v-if 手动控制"。用它可享受声明式异步，但要清楚边界（呼应 vue-async-suspense 第三、五节、vue-ssr-nuxt）。

**来源**：Vue.js — "Suspense 稳定性说明"

---

## 四、与分包、路由、性能

### 8. 路由懒加载和组件级 defineAsyncComponent 有何关系与区别？

底层同一机制（异步组件 + import()）。区别在粒度与触发：路由懒加载由"进入某路由"触发、天然按页面拆 chunk，是首屏提速主力；`defineAsyncComponent` 更细，用于页面内某个按需子块（弹窗、标签页）。两者常一起用（呼应 vue-async-suspense 第四节、vue-router-guard-lazy）。

**来源**：Vue Router — "Lazy Routes"、Vue.js — "Async Components"

### 9. 过多细碎的异步组件有什么反效果？

每个 chunk 一次网络请求，切分时过碎会导致**请求瀑布/水合延迟**、缓存命中率下降、小文件开销。策略：按路由/大块拆分，别为几十行代码单开 chunk；关注总 chunk 数与体积平衡（呼应 vue-async-suspense 第五节、10-vite 分包、vue-performance）。

**来源**：社区 — "too many small chunks / 打包粒度"、web.dev — "HTTP caching / bundles"

### 10. 异步组件加载会造成布局跳动(CLS)，怎么缓解？

给容器预留**占位高度/骨架屏**，fallback 尺寸接近真实内容；关键路径不异步；配合 CSS `min-height`。减少内容就绪后的重排位移（呼应 vue-async-suspense 第五节、vue-performance、vue-deploy 首屏）。

**来源**：web.dev — "CLS / 为异步内容预留空间"、Vue.js — "loadingComponent"

### 11. 异步组件解析成功后会缓存吗？会重复下载吗？

`import()` 结果由模块系统缓存、异步组件解析成功后也复用，不会每次渲染重新下载。但组件实例本身按渲染逻辑创建/销毁（除非 KeepAlive）。（呼应 vue-async-suspense 第五节、vue-lifecycle 第五节）

**来源**：Vue.js — "Async Components caching"、MDN — "import() 模块缓存"

### 12. `suspensible` 选项是干什么的？

控制异步组件是否把它的加载 Promise **上报给祖先 `<Suspense>`** 管理。默认 `true`（受 Suspense 协调，Suspense 会在其就绪前显示 fallback）；设 `false` 则异步组件用**自己的** loading/errorComponent、不参与祖先 Suspense 的 pending（呼应 vue-async-suspense 第一、三节）。

**来源**：Vue.js — "defineAsyncComponent suspensible"
