# vue-router-guard-lazy 面试题精选

> 共 12 题，覆盖 守卫作用域 / 导航控制 / 执行顺序 / 鉴权 meta / 滚动与懒加载 五类。

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
