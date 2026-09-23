# 导航守卫、元信息与懒加载

> 目标：路由切换前后常要"做判断/做拦截"——鉴权、埋点、离开确认、滚动复位。本课掌握**三种作用域的导航守卫**（全局 `beforeEach`、路由独享 `beforeEnter`、组件内 `beforeRouteEnter/Update/Leave`）与**完整执行顺序**、**`to`/`from`/`next` 与返回值两种控制方式**、用 **`meta` + 全局守卫**实现鉴权重定向、**滚动行为 `scrollBehavior`**、以及**路由懒加载与打包分包**（呼应 10-vite）。

---

## 一、守卫的三种作用域

```js
// 1) 全局守卫（作用于每次导航）
router.beforeEach((to, from) => { /* ... */ });      // 进入前
router.afterEach((to, from) => { /* 埋点、关进度条 */ }); // 已确认、渲染后

// 2) 路由独享守卫（写在某条路由记录上）
{ path: '/admin', component: Admin, beforeEnter: (to, from) => { /* ... */ } }

// 3) 组件内守卫（写在被路由的组件里）
// <script setup> 用带守卫的组合式 API：
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
onBeforeRouteLeave((to, from) => { if (!saved) return confirm('放弃编辑?'); });
```
- **全局 beforeEach** 最常用：统一鉴权、白名单、进度条；
- **beforeEnter** 只针对某路由；
- **组件内** `onBeforeRouteLeave`（离开当前页确认）、`onBeforeRouteUpdate`（同组件换 params，见上一关第六节）。

---

## 二、控制导航：next 与 返回值（二选一）

守卫可用**第三个参数 `next`**，或**直接返回**来影响导航，**别混用**：

```js
// 返回值风格（推荐，Vue Router 4）
router.beforeEach((to) => {
  if (to.meta.requiresAuth && !isLogin()) return { name: 'login' }; // 重定向
  if (to.path === '/old') return '/new';    // 返回路径/路由对象=重定向
  // 返回 false = 取消本次导航；返回 undefined/true = 放行
});

// next 风格
router.beforeEach((to, from, next) => {
  if (ok) next();                 // 放行
  else next({ name: 'login' });   // 重定向
  // next(false) 取消；next(err) 中断并抛错
});
```
异步：守卫可 `async`，`await` 校验结果再决定返回（如校验 token）。**每个 beforeEach 必须最终产生一个决定**（放行/取消/重定向），否则导航会挂起（呼应 node-async-errors）。

---

## 三、执行顺序（必背）

一次导航（进入新路由）完整顺序：

1. 触发 `beforeRouteLeave`（**被离开组件**）
2. 全局 `beforeEach`
3. 复用组件的 `beforeRouteUpdate`
4. 路由记录 `beforeEnter`（进入的路由，含其**父到子**依次）
5. **异步组件路由懒加载**（解析 chunk，见第五节）
6. 组件内 `beforeRouteEnter`（新组件；此时组件**尚未创建**，拿不到 `this`）
7. 全局 `beforeResolve`
8. `beforeRouteEnter` 的 `next(vm => …)` 回调（组件已创建）
9. 导航确认 → 全局 `afterEach` → DOM 更新

> 记住"**离开 → 全局 → 更新 → 进入前(路由) → 解析 → 进入(组件) → resolve → after**"。`beforeRouteEnter` 里访问实例要用 `next(vm=>…)`（呼应 vue-lifecycle）。

---

## 四、用 meta + 全局守卫做鉴权（最主流范式）

```js
const routes = [
  { path: '/login', name: 'login', component: Login },
  { path: '/profile', component: Profile, meta: { requiresAuth: true } },
  { path: '/admin', component: Admin, meta: { requiresAuth: true, roles: ['admin'] } },
];

router.beforeEach((to) => {
  const authed = useAuthStore().isLoggedIn;    // 见 vue-pinia
  if (to.meta.requiresAuth && !authed) {
    return { name: 'login', query: { redirect: to.fullPath } }; // 记住原目标
  }
  if (to.meta.roles && !hasRole(to.meta.roles)) return { name: '403' };
});
```
登录后再 `router.replace(route.query.redirect)` 回原页。`meta` 会沿 `route.matched` 合并（父 meta 被子继承，呼应 nested-dynamic interview 第 11 题）。

> **前端守卫只是 UX 层**，不是安全边界——真正的鉴权必须在**后端**每个接口校验（呼应 09-express 鉴权/session、exp-auth）。别以为挡了路由就安全了。

---

## 五、滚动行为 & 路由懒加载分包

```js
createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition;         // 后退回到原位
    if (to.hash) return { el: to.hash, behavior: 'smooth' }; // 锚点
    return { top: 0 };                                // 默认定到顶部
  },
});
```

**路由懒加载 = 天然分包**：
```js
{ path: '/dash', component: () => import('@/views/Dash.vue') }   // 进入才下 chunk
```
- 每个 `() => import()` 是 Vite/Rollup 的**代码分割点**，产出一个独立 chunk；
- 首屏只加载首页 chunk，其余按需（呼应 vue-async-suspense、10-vite 分包、vue-performance）；
- 想更细的分包策略（手动 chunks、公共依赖提取）在 **10-vite build** / **vue-performance（L7）** 展开。

---

## 六、自检清单

- [ ] 守卫的三种作用域分别是？`beforeEach` 和 `afterEach` 用途差异？
- [ ] `next` 风格和返回风格怎么控制"放行/取消/重定向"？为何别混用？
- [ ] 完整执行顺序能否默写？`beforeRouteEnter` 里为何拿不到实例、怎么拿？
- [ ] 用 meta + beforeEach 怎么写鉴权 + redirect 回原页？
- [ ] 为什么说前端路由守卫不是安全边界？`scrollBehavior` 三种返回？

---

## 🚀 部署预告

- 守卫里读登录态通常来自全局 store——把鉴权状态放 **vue-pinia（L6）** 的 `useAuthStore`，避免到处 import；
- `beforeEach` 的异步校验、被中断导航的 `catch`，与 **node-async-errors**、本包 vue-watch 竞态清理同理；
- 路由懒加载分出的 chunk 如何命名、preload、合并，属 **10-vite / vue-performance（L7）**；SPA 直链刷新回退在 **vue-deploy（L8）**。

L5 完成，进入 **L6 状态管理**：先用 Pinia 把"跨组件共享的业务状态"从组件里拎出来，统一管理 state/getters/actions。
