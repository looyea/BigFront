# vue-performance 面试题精选

> 共 15 题，覆盖 A 编译期优化 / B 响应式开销 / C 列表与 DOM / D 分包与构建类。

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

---

## 补充（新专题 13-15）

### 13. 「响应式粒度」的性能账怎么算：shallowRef、manual triggerRef、结构拆分三种降粒度手段的成本收益各是什么？

深 响 应 的 成 本 模 型：一 次 全 深度 遍历（reactive 初 始 化）+ 每 个 属 性 一 个 代理 与 dep 容器（访 问 即 反 射，内 存 与 GC 双 税）；所 以 大 数 据（万 级 对 象 列 表）的 税 基 是 属 性 总 数。三 种 手 段：① shallowRef 整 体 换（初 始 化 税 归 零，但 任 何 更 新 要 换 引用——「定 位 一 条 记 录 改 一 个 字 段」变 成 全 列表 感 知 更 新（diff 成 本 转 移 给 渲染 层，虚拟 列表 天 然 弥 合，本关 补 救 题 的 系 统 化））；② triggerRef 手动（保 持 便 利 的 同 步 精 准 通 知，人 肉 依赖 追 踪 易 漏 报——只 给 「明 白 自 己 在 做 什 么」的 资深 位 使 用）；③ 结构 拆 分（热 字 段 单 独 ref、冷 字 段 整 包 浅 存——工程 最 优 但 要 改 数据 模型，架 构 期 决 定 而 非 救 火 期）。决 策 线：先 问 「存 不 存」（后 端 字 段 精 简）再 问 「代 不 代 理」（浅 化），最 后 才 是 「怎 么 通 知」——90% 的 慢 是 前 两 问 没 问（本关 大 数 据 题 的 完 整 决 策 树）。

**来源**：Vue 响应式成本与 shallowRef 官方指引；社区大数据列表基准测试结果。

### 14. 把「渲染性能问题的定位流程」做成 SOP：从用户报卡顿到确认修复，每一步的工具与判据。

Step1 复 现 定 量：录 Performance 火 焰 图（慢操 作 重 复 5 次 取 中 位），指 标 化（Long Task 数、INP 分 布——Lighthouse 只 管 首 屏，交 互 卡 顿 靠 合 成 事 件 追 踪，本包 部署 关 监 控 轴）；Step2 分 层 定 位：JS 时 间（render/patch 栈 帧）vs 布 局（recalculate style/layout 爆 炸）vs 合 成（帧 丢 但 JS 空 闲）——三 类 治 法 完 全 不 同（前 者 Vue 层、中 者 CSS/DOM 结构、后 者 属 性/层 约 定，本包 动画 关 合成 层 知 识 的 诊断 入 口）；Step3 最 小 复 现：把 疑 点 组 件 拉 出 沙 箱（playground 或 局 部 路 由），二分 props/数 据 规 模 锁 变 量；Step4 修 复 验 证：同 脚 本 回 放 对 比（前 后 录 屏 同 步 放，证 据 思 维），并 防 回 退（把 该 场 景 写 进 性 能 回 归 测：Playwright + traces 基 线，CI 门 禁 只 卡 明 显 恶 化）；Step5 归 档：卡顿 卡 片（什 么 结 构 什 么 规 模 多 久）入 团队 知 识 库——性能 知 识 的 半 衰 期 很 短，流 程 具 备 比 个 人 英 雄 主 义 便 宜。

**来源**：web.dev 性能诊断流程（Performance panel 工作流）；INP 指标与长任务分析文档。

### 15. 编译器已经够聪明了，为什么还需要 manual 优化（v-once/v-memo/key/组件拆分）？各给一个编译器救不了的场景。

编译器 的 能 力 边 界=静态 可 分 析 性：① 全 局 静 态（跨 组 件 不 变 但 经 props 下 钻 的 大 配 置 对 象）——patchFlag 只 管 单 模 板 内，跨 层 「这 个 prop 肯 定 没 变」要 么 稳 定 引用（模块 级 常量），要 么 子 组 件 内 computed 缓 存，v-once 包 宿 主 是 下 策（本关 hoist 能 力 题 的 边 界 面）；② 数 据 驱 动 的 静 态（行 内容 决 定 于 item 但 item 未 变——v-memo 的 恰 当 领地，编译器 无 法 推 导 「业务 上 等 价」）；③ 计 算 复 用（同 一 表达式 多 处 出现 3.5 已 能 cache，但 「这 个 派 生 该 不 该 经 常 重 算」是 业 务 判 断→computed 与 watch 的 推 拉 选 择）；④ DOM 规 模（虚拟 列表 砍 n，再 好 的 diff 也 不 能 把 10 万 降 到 10）。纪 律：manual 优化 前 先 问 「编译器 看 不 看 得 懂」（SFC 里 不 动 态 参 数/全 局 v-bind 对 象 就 能 拿 到 的 优 化，绝 不 要 用 手 工 换 来——先 改 写 法 再 加 指 令，本关 静 态 可 分析 性 题 的 操 作 准 则）。

**来源**：Vue 3.5 模板表达式缓存与编译器能力边界文档；v-memo 使用动机官方说明。
