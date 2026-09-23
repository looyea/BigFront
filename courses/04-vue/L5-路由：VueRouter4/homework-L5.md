# L5 课后作业：路由 Vue Router 4

> 覆盖 **vue-router-basics / vue-router-nested-dynamic / vue-router-guard-lazy** 三关。先读代码找 bug，再动手写，最后场景与简答。环境：Vue 3 + Vue Router 4。

---

## 一、读代码，找 bug / 预测（10 小题）

**1.** 用 `createWebHistory`，本地正常、上线后刷新 `/detail/9` 却 404，为什么？给 Nginx 与 Express 两种修法。（呼应 vue-router-basics 第二节）

**2.** 这段跳转为什么会整页刷新、丢失 SPA 状态？
```vue
<a href="/user/5">用户</a>
```
> 改成什么？（呼应 vue-router-basics 第三节）

**3.** 有人在 `<script setup>` 顶层写：
```js
onMounted(() => { router.push('/x'); });
const route = useRoute();   // 放到 onMounted 之后
```
> `useRoute/useRouter` 应该在哪调用？（呼应 vue-router-basics 第四节、vue-composables 第一节）

**4.** 子路由写成 `{ path: '/posts', component: P }` 挂在 `/user/:id` 下，结果 URL 不是预期的 `/user/1/posts`。哪里错了？（呼应 vue-router-nested-dynamic 第一节）

**5.** 组件里到处 `this.$route.params.id`，导致这个组件离了路由没法测。用哪个路由配置改善？怎么写？（呼应 vue-router-nested-dynamic 第二节）

**6.** 从 `/user/1` 点到 `/user/2`，页面数据没变（还是 1 的内容）。给三种修法。（呼应 vue-router-nested-dynamic 第六节）

**7.** 把 catch-all 404 路由放在了 routes 数组**最前面**，会发生什么？（呼应 vue-router-nested-dynamic 第三节）

**8.** 分页 `?page=2`，代码写 `Number(route.query.page)` 忘了转，直接 `page + 1`，结果出现 `21`。为什么？（呼应 vue-router-nested-dynamic 第五节）

**9.** 这段守卫有什么问题（放行/取消语义）？
```js
router.beforeEach((to, from, next) => {
  if (to.meta.auth && !logged) return next({ name: 'login' });
  // 忘记 else next()
});
```
>（呼应 vue-router-guard-lazy 第二节）

**10.** 在 `beforeRouteEnter` 里写 `this.userInfo = ...` 报错。为什么？怎么改？（呼应 vue-router-guard-lazy 第三节）

---

## 二、手写编程题（5 题）

**11.** 配置一个 `/user/:id` 路由树：默认子路由 `Profile`、子路由 `posts`（列表）、`posts/:pid`（详情），各层用 `<RouterView>` 出口，并给 `posts/:pid` 开 `props:true`。（呼应 vue-router-nested-dynamic 第一、二节）

**12.** 写一个鉴权 `beforeEach`：读取 `useAuth` store 的登录态，未登录访问 `meta.requiresAuth` 页跳 `/login` 并带 `redirect` query；登录后 `replace` 回原目标。（呼应 vue-router-guard-lazy 第四节、vue-pinia 预告）

**13.** 用 `onBeforeRouteLeave` 实现"表单有未保存修改时，离开弹确认"；再用 `scrollBehavior` 实现"前进滚到顶、后退回原位、有 hash 滚到锚点"。（呼应 vue-router-guard-lazy 第一、五节）

**14.** 把 `/dashboard` 及其重图表子组件都改成路由懒加载 `() => import(...)`，并用 `<component :is>` + `Suspense`/`defineAsyncComponent` 展示加载骨架。（呼应 vue-router-guard-lazy 第五节、vue-async-suspense）

**15.** 写一个 `route.query` 安全读取的组合式函数 `useQueryParam(name, { cast, def })`：把字符串 query 转成 number/boolean 并给默认值，参数变化自动响应（内部用 `computed(() => route.query[name])`）。（呼应 vue-router-nested-dynamic 第五节、vue-composables）

---

## 三、场景题（1 题）

**16.** 你在做一个"电商后台"，有登录、商品列表（筛选+分页）、商品详情、编辑表单、404。请给出路由与守卫设计：
- (a) 列表筛选/页码用 params 还是 query？商品身份（id）呢？为什么（呼应 vue-router-nested-dynamic 第五节）；
- (b) 详情→编辑是同组件复用还是分开？切不同商品 id 数据不刷新怎么防（呼应 vue-router-nested-dynamic 第六节）；
- (c) "必须登录 + 必须 admin 角色"分别怎么落到 meta 与守卫？为什么后端还要再校验（呼应 vue-router-guard-lazy 第四、七题）；
- (d) 编辑页未保存离开如何拦截？（呼应 vue-router-guard-lazy 第一节）；
- (e) 哪些页面适合懒加载、哪些不适合？发布后旧 chunk 404 怎么缓解（呼应 vue-router-guard-lazy interview 第 12 题、vue-async-suspense）。

---

## 四、简答题（3 题）

**17.** `createWebHistory` 与 `createWebHashHistory` 的原理与部署差异？为什么前者要服务器回退？（呼应 vue-router-basics 第二节）

**18.** 默写并解释导航守卫的完整执行顺序；`beforeRouteEnter` 与 `beforeRouteLeave` 在"能否拿到实例"上有何不同？（呼应 vue-router-guard-lazy 第三节）

**19.** `props` 路由配置解决了什么问题？路由懒加载为什么能提速首屏、它的分包原理是什么？（呼应 vue-router-nested-dynamic 第二节、vue-router-guard-lazy 第五节）

---

## 五、挑战题 🏆

**20.** 🏆 实现一个"面包屑 + 权限"系统：
- 每条路由挂 `meta: { title, roles, breadcrumb }`，写一个 `useBreadcrumb()` 组合式函数，从 `route.matched` 自顶向下收集 meta 生成面包屑（父被子继承/覆盖，呼应 vue-router-nested-dynamic interview 第 11 题）；
- 写一个全局 `beforeEach` 做 `roles` 校验（支持父级角色下沉），不通过跳 `/403`，并用 `redirect` query 登录后回原页（呼应 vue-router-guard-lazy 第四节）；
- 用 `<RouterView v-slot="{ Component }">` + `<KeepAlive :include>` + `<Transition mode="out-in">` 做"标签页缓存 + 页面切换动画"（呼应 vue-lifecycle 第五节、vue-class-style-transition 第六节）；
- 全部路由组件懒加载，并在 `onError` 里对 chunk 加载失败做一次带 reload 的重试（呼应 vue-router-guard-lazy interview 第 12 题、vue-async-suspense 第一节）；
- 强调并落一句注释：这些前端守卫只是 UX，真实鉴权在后端（呼应 exp-auth）。
