# vue-router-guard-lazy 面试题精选

> 共 15 题，覆盖 守卫作用域 / 导航控制 / 执行顺序 / 鉴权 meta / 滚动与懒加载 五类。

---

## 一、守卫作用域

### 1. Vue Router 的导航守卫有哪几种作用域？

三层：**全局**（`beforeEach`/`beforeResolve`/`afterEach`）、**路由独享**（记录上的 `beforeEnter`）、**组件内**（`beforeRouteEnter`/`beforeRouteUpdate`/`beforeRouteLeave`，`<script setup>` 用 `onBeforeRouteLeave/Update`）。作用范围从大到小，鉴权常放全局、页面级确认放组件内（呼应 vue-router-guard-lazy 第一节）。

**来源**：Vue Router — "Navigation Guards"

### 2. `beforeEach` 和 `afterEach` 分别在什么时机？典型用途？

`beforeEach` 在导航**确认前**，可放行/取消/重定向——用于鉴权、进度条起始；`afterEach` 在导航**已确认、组件已渲染后**，不能影响导航——用于埋点、关闭进度条、滚动后的副作用（呼应 vue-router-guard-lazy 第一、三节）。

**来源**：Vue Router — "afterEach / 完成导航后"

---

## 二、导航控制

### 3. 守卫里怎么"取消""重定向""放行"一个导航？

用 `next(false)` 取消、`next({name})`/`return {name}` 重定向、`next()`/不返回 放行。Vue Router 4 也支持**直接返回**：`false`=取消、路由对象/字符串=重定向、无返回=放行。**next 与 return 二选一**别混用（呼应 vue-router-guard-lazy 第二节）。

**来源**：Vue Router — "Changing Redirections / 导航守卫返回值"

### 4. 守卫能写成 async 吗？被守卫中断的 push 会发生什么？

可以 `async`，`await` 校验后再决定返回/调用 next。`router.push` 返回的 Promise 在导航被取消时 **reject（NavigationFailure）**，若不 catch 会有未处理拒绝；被重定向则 resolve 到失败对象。要按业务 catch（呼应 vue-router-guard-lazy 第二、三节、node-async-errors）。

**来源**：Vue Router — "Navigation Failures / async guards"

---

## 三、执行顺序

### 5. 默写一次"进入新路由"的完整守卫执行顺序。

离开组件 `beforeRouteLeave` → 全局 `beforeEach` → 复用组件 `beforeRouteUpdate` → 路由记录 `beforeEnter`（父→子）→ **异步路由组件解析** → 组件 `beforeRouteEnter`（组件未建）→ 全局 `beforeResolve` → `beforeRouteEnter` 的 `next(vm)` 回调（组件已建）→ 确认 → `afterEach` → DOM 更新（呼应 vue-router-guard-lazy 第三节）。

**来源**：Vue Router — "Navigation Resolution Flow（完整流程图）"

### 6. 为什么 `beforeRouteEnter` 里拿不到组件实例？怎么拿到？

它在组件实例**创建之前**触发（数据要能影响是否进入）。要操作实例只能 `next(vm => { vm.xxx })`——回调在组件创建后执行（呼应 vue-router-guard-lazy 第三节、vue-lifecycle）。其它组件内守卫（update/leave）实例已存在，可直接用。

**来源**：Vue Router — "beforeRouteEnter 无 this / next(vm)"

---

## 四、鉴权与 meta

### 7. 用路由 meta 实现"需要登录的页面"的完整方案？

路由标 `meta: { requiresAuth: true }`；全局 `beforeEach` 读 `to.meta.requiresAuth` 与登录态（多来自 Pinia），未登录则 `return { name:'login', query:{ redirect: to.fullPath } }`；登录成功后 `router.replace(query.redirect)` 回原页。meta 沿 `route.matched` 合并、父可被子继承（呼应 vue-router-guard-lazy 第四节、nested-dynamic interview 第 11 题）。

**来源**：Vue Router — "Navigation Guards / meta 鉴权、redirect query"

### 8. 前端路由守卫能替代后端鉴权吗？为什么？

不能。前端守卫只是 **UX**（挡普通用户、优化体验），路由与 bundle 都在客户端、可被绕过/篡改。真正的授权必须在**后端每个接口**校验身份与权限（session/JWT）。只挡路由、数据接口裸奔 = 假安全（呼应 vue-router-guard-lazy 第四节、09-express exp-auth、exp-security）。

**来源**：OWASP — "Access Control"、社区 — "为什么前端路由守卫不是安全边界"

### 9. `to.meta.roles` 做角色控制时，父路由 meta 和子路由 meta 谁生效？

`to.meta` 是 `route.matched` 上所有记录 meta **合并**的结果（子覆盖父同名键）。所以父级 `requiresAuth` 会作用到所有子路由；细粒度 roles 在对应记录上写。想精确读某一层用 `to.matched[i].meta`（呼应 vue-router-guard-lazy 第四节）。

**来源**：Vue Router — "meta 合并 / route.matched"

---

## 五、滚动与懒加载

### 10. `scrollBehavior` 做什么？前进/后退/锚点分别怎么处理？

控制导航后页面滚动位置。返回 `{ top:0 }` 滚到顶；返回传入的 `savedPosition` 让**后退**回到离开时的位置；`{ el: to.hash }` 滚到锚点；可加 `behavior:'smooth'`。返回 Promise 可延迟滚动（呼应 vue-router-guard-lazy 第五节）。

**来源**：Vue Router — "Scroll Behavior"

### 11. 路由懒加载和打包分包是什么关系？为什么能提速首屏？

`component: () => import('./View.vue')` 是**代码分割点**，Rollup 把每个路由视图拆成独立 chunk。首屏 HTML 只加载必要 chunk，其余在导航到该路由时才请求，减小初始 JS、加快白屏时间（呼应 vue-router-guard-lazy 第五节、vue-async-suspense、10-vite 分包）。

**来源**：Vue Router — "Lazy Loading Routes"、Rollup/Vite — "code splitting"

### 12. 懒加载的 chunk 加载失败（发布后旧 chunk 404）怎么办？

发布替换后旧 hash chunk 被删，用户点懒加载路由会 import 失败。可用 `defineAsyncComponent`/`dynamic import` 的 `onError` 重试（`window.location.reload()` 拉新 index），或构建时**保留旧版本 chunk**/预加载关键路由（呼应 vue-router-guard-lazy 第五节、vue-deploy、vue-performance preload）。

**来源**：社区 — "Failed to fetch dynamically imported module / 部署后旧 chunk"

---

## 补充（新专题 13-15）

### 13. 把「首屏必须的全局数据」（用户信息/字典/配置）挂进路由体系有哪三种时机？各自的白屏与竞态账怎么算？

三 种：① 守 卫 内 await（beforeEach 首 次 导 航 拉 用 户 信 息）——语 义 最 早（组 件 挂 载 时 数据 已 在，无 二 次 loading），代价 是 **全 站 导 航 被 这 个 请求 卡**（失 败 要 有 放 行/重 定向 分 支，超 时 政 策 必须 写），慢 网络 白屏 时 间 直接 加 上 请求 RTT。② App 根 组 件 onMounted 拉 + 骨架 兜 全 局——导 航 不 阻 塞，但 组 件 树 会 先 见 「无 用 户 态」再 闪 成 有（权 限 按 钮 会 闪，需 全 局 `ready` 门 禁 指令/v-if，本包 模板 关 门禁 题 的 延 续）。③ 路 由 级 loader（数 据 加 载 API/Suspense 式，进 哪 页 拉 哪 页 数 据）——粒度 最 细、并行 最 好（chunk 与 数据 并行，异步 关 分层 方案 题 的 正 解），代价 是 学 习 成 本 与 缓存 归属 选 型（写 store 还 是 组 件 局部）。决策 树：数 据 是 否 「无 它 任何 页 都 不 该 渲 染」（用 户 态）→ ①+超 时 兜 底；只 有 局 部 区 域 要（列 表 数 据）→ ③；可 以 后 到（主 题/字 典）→ ②。任 何 一种 都 要 回 答 「刷 新 后 哪 去 了」：SSR 注 水 或 localStorage 快照（本包 SSR 关 状态 讨 论 的 客 户 端 版）。

**来源**：Vue Router 数据获取（Navigation Guards vs in-component）官方对比文档；Nuxt route middleware/useAsyncData 预取模式。

### 14. 「未登录跳 login 带回跳」的完整正确姿势：redirect 参数怎么编码、怎么防开放重定向、登录后恢复被取消的操作该怎么做？

回 跳 链：`/login?redirect=/cart/edit/9`——用 **path+params 序 列 化 的 完 整 fullPath**（query 嵌 query 要 编 码，`encodeURIComponent` 交给 router 自动 处 理 但 手 拼 字符串 的 人 会 忘）。防 开 放 重 定 向：回 跳 前 校 验 redirect 是 「本 站 绝 对 路径」——`new URL(redirect, location.origin).origin === location.origin` 且 拒 掉 `//evil.com` 形（以 斜 线 开 头 的 协 议 相对 URL 会 被 浏 览 器 解 析 成 外 站！这 是 开放 重 定 向 最 常 被 漏 的 形 态），更 稳 的 是 白 名 单（只 回 跳 到 未 经 验 证 也 安 全 的 路 径 集）。操 作 恢 复：「被 守 卫 掐 掉 的 动 作（点 了 收 藏 才 要 你 登 录）」登 录 后 原 样 重 放——要 先 问 产品 是 否 值 得（多 数 放 弃，记 一 条 「登 录 后 到 哪」即可；重 放 的 正 确 实 现 是 表 单 数据 入 sessionStorage 而 不 是 自动 重 放 请求——重 放 POST 是 一 致 性 事故）。同 一 业 务 操 作 中途 token 过 期：请求 层 无 感 刷 新（上 题）优 先，刷 新 失 败 才 走 login+redirect——两 层 分 工 讲 清 是 这 道 题 的 分 水 岭（本关 安全 镜 像 题 的 工 程 化 面）。

**来源**：OWASP 未验证 URL 转发（开放重定向）指引；登录回跳 redirect 参数处理的社区安全通告。

### 15. 守卫体系的可测试性与执行顺序：给一套「鉴权+角色+付费墙+数据预取」四层守卫的分层组织与单测策略。

分 层 组 织（顺 序 即 依 赖）：全局 `beforeEach` ① 鉴 权（是 不 是 人）→ ② 角 色/权 限（能 不 能 看）→ ③ 付 费 墙（该 不 该 付 钱，失 败 跳 收银 台 带 redirect）→ ④ 数据 预 取（最 后 才 做 重 I/O，前 三 层 拒 了 省 请求）——每 层 独 立 函 数 `useAuthGuard(router, deps)` 注 入 依 赖（store/api 可 mock），不 写 一 个 千 行 switch。meata 驱 动：`requiresAuth/roles/plans` 全 部 进 RouteMeta 类 型 声明，守 卫 只 读 meta 不 认 路 径 正 则（路 径 硬 编 码 是 守卫 腐 化 的 起 点，本关 全站 登录 题 的 架 构 回 答）。顺 序 考 点（面 试 默 写 题 的 完 整 版）：失 败 导 航 也 会 走 afterEach（failure 参 数）、全局 守 卫 先 于 路由 组件 守卫（Enter 的 next 回调 最 后）、`beforeResolve` 在 异 步 组 件 解析 完 之 后/守卫 前（懒 加载 失 败 在 这 之 后 才 可 能 发 生，本 异 步 关 自 愈 题 的 定位 点）。单 测：不 mount 组件，纯 函 数 测 守卫（喂 to/from + mock store 断 言 返 回 值）；再 用 一 条 集 成 测 跑 真 router 断 言 终 态 URL——两 层 缺 一 不 可（只 测 单元 会 漏 meta 继 承 与 顺 序 bug）。

**来源**：Vue Router 完整导航解析顺序表；守卫分层与 meta 驱动的权限路由通行实践。
