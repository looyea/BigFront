# vue-performance 面试题精选

> 共 12 题，覆盖 A 编译期优化 / B 响应式开销 / C 列表与 DOM / D 分包与构建类。

## 一、编译期优化（A 类）

### 1. Vue 3 相比 Vue 2 在渲染性能上的核心改进是什么？
三点：① **静态提升**——不变节点只创建一次；② **patchFlag 差分标记**——更新时只处理被标记的动态 props，而非全量 diff；③ **block 树**——动态节点串成快线跳过静态内容。根源是 Vue 3 编译器能对模板做**编译期静态分析**（呼应 vue-sfc-compiler-macros）。
**来源**：Vue.js 官方文档 — 渲染优化、深入响应式系统

### 2. 什么是 patchFlag？举几个常见标记。
patchFlag 是编译器打在动态 VNode 上的位标记，patch 时据此只比对相关部分。常见：`TEXT(1)` 仅文本变、`CLASS(2)`、`STYLE(16)`、`PROPS(4)` 个别 props 变、`FULL_PROPS(8)` 有动态 key 需全量、`NEED_PATCH(32)` 涉及 ref/指令、`STABLE_FRAGMENT(64)`。
**来源**：Vue.js 源码注释 — PatchFlags、渲染优化文档

### 3. `v-once` 和 `v-memo` 有什么区别？各自适用场景？
`v-once` 渲染一次后**永久跳过**，适合纯静态块（页头、说明文字）。`v-memo` 带依赖数组，依赖不变本轮复用上次 VNode、变了才重渲染，适合**大列表里多数项不变**的场景，且需配 `:key`。前者是"一次定格"，后者是"computed 式子树缓存"。
**来源**：Vue.js 官方文档 — v-memo、v-once

## 二、响应式开销（B 类）

### 4. 为什么大数组/大对象不建议用深层 reactive？该怎么做？
Vue 3 虽是懒代理（访问到才递归代理），但对上万条嵌套数据，一旦遍历渲染仍会逐层代理、逐 key track，内存与依赖收集成本高。应用 `shallowRef`/`shallowReactive` 只追踪顶层替换，配合不可变整体赋值；确需原地改就 `triggerRef`（呼应 vue-reactivity-theory）。
**来源**：Vue.js 官方文档 — shallowRef 与大型数据列表

### 5. `markRaw`、`Object.freeze`、`toRaw` 在性能上各自意义？
`markRaw` 把对象标记为永不代理（适合第三方实例、ECharts、DOM）；`Object.freeze`/常量数据可跳过响应化；`toRaw` 拿到代理背后的原始对象，用于**只读遍历**或传给非 Vue 代码时避免触发代理逻辑。共同点是"减少不必要的响应式包裹"（呼应 vue-reactivity-theory）。
**来源**：Vue.js 官方 API — markRaw、toRaw、shallowReactive

### 6. `computed` 为什么能提升性能？它和 methods 里算同一份数据的区别？
`computed` 基于响应式依赖**缓存**，依赖不变直接返回上轮结果，且惰性求值（没人用就不算）；methods 每次 render 都重算。把派生值交给 computed 既省算力又保证 single source of truth（呼应 vue-reactivity-theory 的 computed dirty 缓存、vue-state-patterns 第四节）。
**来源**：Vue.js 官方文档 — 计算属性缓存 vs 方法

## 三、列表与 DOM（C 类）

### 7. 万级列表卡顿时，为什么"虚拟滚动"往往比"关掉响应式"更有效？
因为卡顿主因常是**几万个真实 DOM 节点**的创建/布局/回流，而非响应式开销。虚拟滚动只渲染视口 + 缓冲的几十条，用占位撑出总高，DOM 数量骤降。二者可叠加：虚拟窗口数据用 shallowRef 更佳。
**来源**：Vue.js 官方文档 — 大型列表与虚拟滚动、vue-virtual-scroller 文档

### 8. 为什么 `v-for` 的 key 不建议用 index？什么情况下用 index 也无妨？
index 不唯一稳定：插入/删除/逆序时同一 index 指向不同数据，diff 会错误复用节点导致状态错位、多余重渲染甚至 XSS（复用了带旧 DOM 的节点）。仅当列表**纯静态、永不重排、仅作展示**时用 index 才无副作用，一般仍建议唯一 id（呼应 vue-conditional-list）。
**来源**：Vue.js 官方文档 — 列表渲染 key、与 v-for 的 best practice

### 9. `v-if` 和 `v-show` 在性能上如何取舍？
`v-if` 是真正条件渲染，切换会**销毁/重建**组件（有初始化开销），但初始为假时什么都不渲染；`v-show` 始终渲染、只切 CSS `display`，切换开销小但初始就在 DOM。频繁切换用 v-show，较少切换/初始可能不显示用 v-if（呼应 vue-conditional-list）。
**来源**：Vue.js 官方文档 — v-show vs v-if

## 四、分包与构建（D 类）

### 10. 组件级代码分割是怎么发生的？哪些写法会成为分包点？
`import()`（动态 import）是打包器的分割点：路由懒加载 `component: () => import(...)`、`defineAsyncComponent(() => import(...))` 都会让 Rollup/Vite 把目标拆成独立 chunk，按需加载。顶部静态 `import` 都进主 chunk（呼应 vue-async-suspense、vue-router-guard-lazy、10-vite build）。
**来源**：Vite 文档 — 动态 import 与代码分割、Vue Router 懒加载路由

### 11. 如何做"路由组件预加载"？为什么能提升体验？
在链接 hover 或浏览器空闲时提前执行该路由的 `import()`，chunk 被缓存，真正导航时命中缓存秒开。Vue Router 的 `<RouterLink>` 或自定义 `prefetch` 钩子可实现。代价是多耗一点带宽，需按需权衡（呼应 vue-performance 第六节）。
**来源**：web.dev — Predictive prefetching、Vue Router 导航守卫

### 12. 上线前你用什么定位"到底是哪个组件/依赖拖慢了首屏"？
`vite build` 后用 rollup-plugin-visualizer 出 treemap 找体积大户；开发环境 `app.config.performance=true` + Vue Devtools Perf 面板看组件渲染耗时；浏览器 Performance/Network 面板看长任务与瀑布。测量优先，避免凭感觉优化（呼应 10-vite build、node-deploy-perf）。
**来源**：Vue.js 官方文档 — 组件渲染性能追踪、Vite 生产构建优化
