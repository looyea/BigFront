# vue-async-suspense 面试题精选

> 共 15 题，覆盖 异步组件 / 配置项 / Suspense / 与分包和路由 四类。

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

---

## 补充（新专题 13-15）

### 13. Suspense 被官方称为实验性却已被 Nuxt/Vue Router 深度使用——「内部功能稳定」和「公共 API 稳定」的差距到底指什么？生产该押哪边？

实 验 性 的 具 体 指 向：未 定 型 的 **公 共 契约**——事件（resolve/pending 的 触发 细 节）、多 层 嵌套 的 竞 态（同 一 帧 内 兄 弟 陆 续 resolve 的 切换 策 略）、与 keep-alive/transition 组合 的 行 为 矩阵、错 误 冒 泡 的 归 属（子 异 步 setup 抛 错 该 谁 接——onErrorCaptured 与 #fallback 的 交 界 区）。运行 时 本身 的 挂 起/恢复 内核（异步 setup 组件 的 suspense 状态 机）早 已 被 生态 锤 稳。**决 策 框架**：库/框 架 作 者 直 接 用（Nuxt 这 样 的 生 态 主 权 者 可 能 锁 版 本）；业 务 应 用 优先 押 在 **由 它 们 封装 后 的 API**（路由 级 懒 加载、useAsyncData/defineAsyncComponent 的 加载 态 选项）上，让 中 间 层 吸 收 breaking change；UI 局 部 的 #fallback 交 互（列 表 占 位）可 以 用、关 键 流 程（支 付 页 挂 载）不 押。答 案 的 答 案：把「实 验 性」翻译 成 「谁 来 承 担 API 漂移 的 成本」，而 不 是 「是 否 会 崩」。

**来源**：Vue 官方对 Suspense experimental 状态说明（RFC/文档）；Nuxt 团队关于 Suspense 稳定性诉求的 issue 讨论。

### 14. 路由组件的异步加载和 Suspense 组合时的「双重懒加载」陷阱：chunk 就绪 ≠ 数据就绪，加载态应该由谁呈现？分层方案给出。

三 段 时序：chunk 下载（defineAsyncComponent/路由 懒 加载）→ 组件 setup → 数据 请求（onMounted/watchEffect 发 起 或 顶层 await）——每 段 空 窗 都 会 被 「单 层 loading」的 期待 背 叛（骨架 屏 闪 两 次/黑 屏）。分 层 正 解：① chunk 层 用 骨架 兜 住（Suspense #fallback 或 路由 守卫 预 加 载），要 求 **秒 开 不 闪**（delay 200ms 才 显 loading，本关 delay 题 的 组 合）；② 数据 层 loading 归 组件 内（业 务 形 状 决 定 是 骨 架 还 是 spinner，绝 不 让 Suspense 替 业 务 发 言）；③ 最 优 化 是 **合并 等待**：路由 守 卫/数 据 层 预 取（Vue Router 的 数据 加载 API 3.6+/useAsyncData 在 导 航 阶段 就 发 请 求），组 件 挂 载 时 数据 已 在——「chunk 与 数据 并行」把 两 段 空 窗 压 成 一 段（本包 路由 关 懒 加载 题 的 时间 轴 版）。反 模式：Suspense 嵌 Suspense 套 娃 等 待 语义 互 踩、fallback 里 再 发 请 求。

**来源**：Vue Router 数据加载（lazy component + 导航守卫预取）文档；Nuxt route middleware/useAsyncData 预取模式。

### 15. 给「网络抖动导致异步组件加载失败」做一套生产级自愈：重试、降级、上报各怎么落？

重试：loader 工厂 里 自 包 retry（指 数 退避+上限 2-3 次，只 重 **网络 异常**不 重 404——chunk 404 多 半 是 版 本 漂移 不 该 无 限 重 试）；更 关 键 的 环 节：发布 后 旧 HTML 状 态 的 用 户 点 到 新 路由 → 旧 chunk 哈希 已 不 存 在（vite/webpack 「Loading chunk failed」头 号 线上 事故），**唯 一 有 效 处 置 是 强 刷**（catch 到 加载 失败 后 `location.reload()` 一 次 性 标记 防 循 环 刷 新）。降级：errorComponent 给 「点 击 重 试」的 友 好 页 而 不 是 白 屏；关 键 功 能（下 单 流 程）改 前 置 加 载（守 卫 里 await 完 再 放 行，失 败 决 定 是 否 阻 断 导航）。上 报：捕 获 `Failed to fetch dynamically imported module` 特 征 串 单 独 维度（区 分 chunk 失败 vs 业 务 异 常），带 版 本 哈希 上 报——「发 布 潮 尖 爆 的 加载 失败」= 版 本 漂移 指纹，配 CDN 长 期 保留 旧 chunk（保 留 策 略 写 进 部署 规范，本包 部署 关 的 异步 组件 往 回 拉 手 段）。

**来源**：Vite/webpack chunk 加载失败与部署漂移社区方案（preload 报错重试/reload 兜底）；web-vitals 之外的前端错误上报维度实践。
