# vue-pinia-basics 面试题精选

> 共 15 题，覆盖 概念与选型 / store 定义 / 响应性与 storeToRefs / actions 与异步 / 模块化 五类。

---

## 一、概念与选型

### 1. 为什么需要 Pinia？它解决了纯 props/inject 的什么痛点？

跨兄弟、跨页面共享的**同一份业务状态**（当前用户、购物车、主题）用 props 逐层传、inject 手动挂树都很累且易失控。Pinia 提供**全局可访问的响应式单例 store**，集中 state/getters/actions，配 devtools、类型推导、SSR 水合（呼应 vue-pinia-basics 第一、六节、vue-provide-inject 第五节）。

**来源**：Pinia — "What is Pinia / Why"

### 2. Pinia 相比 Vuex 4 有哪些改进？

① **去掉 mutations**（action 直接改 state）；② 完整 **TS 类型推导**（无需手写包裹类型）；③ **多 store 组合**、无嵌套 module 的样板；④ **setup 语法**（组合式）；⑤ 更小的体积与更简 API；⑥ 支持 devtools/插件。Vuex 已非 Vue3 官方推荐（呼应 vue-pinia-basics 第四节）。

**来源**：Pinia — "Comparison to Vuex / Why Pinia"

---

## 二、store 定义

### 3. 选项式 store 与 setup 式 store 有什么区别？复杂场景选哪个？

选项式给 `state/getters/actions` 三个选项；setup 式像写一个组合式函数，用 `ref/computed/function` 并 return。setup 式更灵活（可自由组合、用 watch、私有变量天然不暴露），推荐复杂逻辑用；两者可混用风格但同一个 store 选一种（呼应 vue-pinia-basics 第一节、vue-composables）。

**来源**：Vue.js Store / Pinia — "Core Concepts / Setup Stores"

### 4. store 的 `id`（第一个参数）有什么用？不写会怎样？

id 是 store 唯一标识，用于 **devtools 展示、SSR 状态水合、HMR、以及跨 store 引用**。setup 式也必须提供。冲突/缺失会导致 devtools 分不清、SSR 无法正确 hydrate（呼应 vue-pinia-basics 第五节、vue-pinia-advanced SSR）。

**来源**：Pinia — "The Store id"

---

## 三、响应性与 storeToRefs

### 5. 为什么 `const { count } = store` 会丢响应，而 `const { inc } = store` 却没事？

store 实例是 **reactive 对象**，解构 state/getter 得到的是脱离代理的普通值（同 reactive 解构丢响应，呼应 vue-reactivity-theory 第六节）。而 **action 是绑定了 store 的函数**，解构后 `this` 仍指向 store，调用不受影响。要保持 state 响应需 `storeToRefs(store)`（呼应 vue-pinia-basics 第二节）。

**来源**：Pinia — "Destructuring / storeToRefs"、"Actions 解构安全"

### 6. `storeToRefs` 会带上 actions 吗？怎么处理 action？

不会。`storeToRefs` 只把 **state + getters** 转成 refs，不含 actions（避免把函数也 ref 化）。action 直接从 store 解构即可：`const { count } = storeToRefs(store); const { inc } = store;`（呼应 vue-pinia-basics 第二节）。

**来源**：Pinia — "storeToRefs"

---

## 四、actions 与异步

### 7. Pinia 里异步请求（取数）写在哪？怎么管理 loading/error？

写在 **action** 里，一个 async action 里 `try/catch/finally` 直接改 `this.loading/this.error/this.data`。组件只调 action、读 store 里的状态，不必关心同步异步（呼应 vue-pinia-basics 第四节）。竞态可结合请求 id 或 `AbortController`（呼应 vue-watch 第四节）。

**来源**：Pinia — "Actions / 异步、Making Hot HTTP Requests"

### 8. 没有 mutation，直接 `store.count++` 或在 action 里改，会有什么问题？

技术上组件里直接 `store.count++` 是允许的、也响应。但把**变更散落在各组件**会丢失"改了什么、在哪改、能否加日志/校验"的集中管控。推荐把变更收进 **action**（可测、可追踪），保持"逻辑集中、状态可预测"（呼应 vue-pinia-basics 第四节、vue-state-patterns）。

**来源**：Pinia — "Mutating state / Why Actions"

---

## 五、模块化与边界

### 9. 一个 store 要写多大？如何拆分？

按**领域/功能**拆：`useUserStore`、`useCartStore`、`useUIStore`。别造"一个装下全 App 状态的巨型 store"（难维护、HMR/devtools 粒度差）。store 之间通过"在 action 里 use 另一个 store"组合（呼应 vue-pinia-basics 第五节、vue-project-architecture）。

**来源**：Pinia — "Store Typing / Composition 组合"

### 10. 什么状态不该放进 store？

只服务单个组件的**局部 UI 状态**（输入框草稿、展开/收起、动画标志）该留在组件/composable；派生值该用 getter/computed 而非再存一份（避免同步 bug）。store 装的是"跨组件共享 + 需要集中变更管控"的业务状态（呼应 vue-pinia-basics 第六节、vue-state-patterns）。

**来源**：Pinia — "When to use a store"、社区 — "local state vs store"

### 11. Pinia 和"模块作用域单例 ref（全局 composable）"都能共享状态，差别在哪？

模块级单例 ref 能共享，但缺 **devtools 时间旅行、SSR 水合、$reset/插件生态**，也容易不小心全局污染。Pinia 把这些做成框架级能力（每请求可重置、可持久化、可插插件）。小脚本用单例 composable 没问题，正式 App 用 Pinia 更可控（呼应 vue-composables interview 第 10 题、vue-pinia-basics 第六节）。

**来源**：Pinia — "SSR / devtools"、社区 — "composables vs Pinia"

### 12. 在组件外（如 axios 拦截器、router 守卫）能用 store 吗？

能，但要**先 `app.use(createPinia())` 之后再调用** `useXxx()`——否则会报"no active pinia"。常见于 axios 拦截器里取 token、`beforeEach` 里判登录态。在 setup/组件生命周期内调用则无需担心时机（呼应 vue-router-guard-lazy 第四节、vue-pinia-basics 第一节）。

**来源**：Pinia — "使用 store 的时机 / no active pinia"

---

## 补充（新专题 13-15）

### 13. "这个状态该不该进 store" 的决策树完整版：组件局部、提升、provide、store、URL、持久化六级各怎么判？

六级 递 减 参 与 度：① 只 有 一 个 组 件 用 → ref 局 部；② 父 子 几 层 用 → 提 升 或 props/emit（本包 组件 关 拆分 题 的 状 态 侧）；③ 跨 树 段 但 同 一 实 例 树（表 单 联 动）→ provide/inject（实 例 级 隔离 优 于 全局）；④ 跨 无 关 树 段/组件 外 要 读（守 卫/拦截 器）→ store；⑤ 用 户 会 想 收 藏/分享/后 退（页 码 筛 选 标 签）→ **URL 优 先**（store 只 放 URL 的 镜像，本包 路由 query 题 的 状态 侧 答 案）；⑥ 刷 新 后 还 要 在（草 稿/首 选 主 题/登 录 态）→ store + 持 久 化 插 件 并 显 式 列 白 名（敏 感 不 落，本包 advanced 持久 化 题）。反 直觉 条 款：**store 是 最后 的 便 利 不 是 第 一 反应**——每 进 store 一 份 状态，就 给 全 应用 增加 一 层 「谁 都 能 看 到 谁 都 能 改」的 潜 在 耦 合；测 试 里 起 store 的 成 本 也 是 局 部 状态 免 付 的。

**来源**：Pinia 文档「从事件总线/store 迁移」与状态分类指引；user-facing state 模式通行总结。

### 14. Pinia 的响应式底座是什么？为什么 store.state 能直接 reactive 而 $reset 在 setup store 失效——从实现层讲透。

选 项 式 store：state 就 是 `reactive(stateFn())`，getter 是 computed，action 绑 store——**store 对 象 本身 是 reactive 代理**，所 以 解 构 丢 响应（代 理 读 取 丢 失，本关 storeToRefs 题 的 机 理 面），方法 不 依 赖 this 所 以 解 构 安 全。setup store：内 部 是 一 个 执 行 `setup()` 收 ref/computed/函 数 的 过程，Pinia 对 返 回 Map 做 `reactify`（ref 拆 到 外 层 reactive 保 持 响应 而 不 是 整 体 reactive 包 装——这 是 官 方 源码 注 释 里 的 「ref unwrap 于 顶 层」复用 了 组件 setup 同 一 套 unwrap 机 制）。$reset 失 效 的 原因 随 之 明 白：选项 式 拿 得 到 `state()` 工厂 所 以 能 `$patch(reset)` 回 工 厂 值；setup 式 的 局部 变量 Pinia 无 法 通 用 重 置（不 知 道 哪 些 是 状态 哪 些 是 派 生）——自 实 现：把初 始 值 收 进 工厂 函 数 + 自 定 义 `reset()` action，或 `Pinia 插件 注 入 $reset`（把 这 个 缺口 做 成 生态 练习 题 的 官方 姿势，本包 advanced $reset 题 的 源码 层）。

**来源**：Pinia 源码（reactive 包装与 refify 处理）；官方 $reset 移除动机 issue 与 stores composition 指南。

### 15. 在 setup 外面用 store（axios 拦截器、router 守卫、webcompoent 适配器）的正确时机与三个经典翻车。

正 确 姿势：`useAuthStore()` 在 **函数 体 内 调 用**（拦截 器 回 调 里 取，不 要 模 块 顶 部 取），前 提 是 pinia 已 `app.use`——这 一 句 就 是 全 部 风 险 所在。翻 车 一：模 块 顶 层 `const store = useAuthStore()` import 即 执 行，此 时 activePinia 未 设 → 「no active pinia」炸 或 拿 到 别 的 pinia（测 试 里 多 实 例 时 尤 毒）；翻 车 二：SSR 请 求 处 理 函 数 外 的 模 块 级 引用 跨 请 求 共 享（状 态 串 线，本包 advanced SSR 题 的 基础 版）；翻 车 三：守 卫 里 用 store 判 登 录 但 store 的 初 始 化 依赖 一 个 异 步 恢复（持久 化 插件 hydrate 中，守 卫 早 于 hydrate 跑 → 决 定 性 误 判 踢 回 登录 页，首 屏 永远 回 不 到 深 链）——治 疗：恢复 同步 化（localStorage 同 步 读）或 给 插件 一 个 ready Promise 让 守 卫 await。附 加 请 求 头 注入（token）这 类 只 读 场 景 最 安 全；改 状态 的（401 登 出）要 确 保 action 幂 等（多 请 求 同 时 401 只 登 出/跳 转 一 次，本 关 无 感 刷 新 单 飞 题 的 姊妹 案）。

**来源**：Pinia 文档「在组件外使用 store」与 TS/SSR 注意事项；社区 store 与路由守卫/拦截器时序事故案例。
