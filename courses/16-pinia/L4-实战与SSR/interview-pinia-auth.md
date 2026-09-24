# 面试题：登录态 Store（pinia-auth）

### 1. (实战类) Pinia auth store 的标准结构？
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html

state: token, user, permissions；getter: isLoggedIn；action: login, logout, refresh, hasPerm。持久化 token（localStorage 或 persist 插件）。

### 2. (安全类) token 存 localStorage 有什么风险？ alternatives？
**来源**：https://stackoverflow.com/questions/19/where-can-you-store-a-jwt-token

localStorage 可被 XSS 脚本读取。HttpOnly Cookie 更安全（JS 不可读）。但 SPA 里 HttpOnly cookie 需配 CSRF 防护。折中：access_token 存内存（Pinia ref），refresh_token 存 HttpOnly cookie——刷新靠 refresh 接口换新 token。

### 3. (原理类) 为什么 axios 拦截器里不能文件顶层 useAuthStore()？
**来源**：https://pinia.vuejs.org/core-concepts/outside-components.html

顶层 import 时 app.use(createPinia()) 可能还没执行。拦截器回调函数体内的代码在**请求发出时**执行——那时 Pinia 已就绪。"延迟获取"是 Pinia 设计预期。

### 4. (设计类) 路由守卫在 Pinia 项目里放哪里？
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html#routing

router/index.ts 的 beforeEach 里 useAuthStore()——此时 app.use(pinia) 已完成（router 文件 import 在 main.ts app.use 之后执行）。

### 5. (SSR类) Nuxt SSR 中 auth token 怎么处理？
**来源**：https://pinia.vuejs.org/ssr/nuxt.html#authenticated-requests

服务端从 Cookie/event.header 取 token → 在 Nuxt plugin 里注入 store → 服务端渲染时用。客户端水合后从 localStorage/Cookie 恢复。不能 SSR 里用 localStorage（不存在）。

### 6. (坑类) 多标签页一个登出另一个怎么感知？
**来源**：https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event

storage 事件——A tab 清 localStorage → B tab window.onstorage 触发 → B tab store.logout()。或用 BroadcastChannel API。

### 7. (对比类) Pinia auth store vs Next.js next-auth session 有何异同？
**来源**：https://next-auth.js.org/getting-started/client

next-auth 服务端管 session（JWT 在 cookie）、客户端 useSession hook 取。Pinia 纯客户端 store——需要自己管 token 存储与刷新。SSR 场景下 Nuxt + Pinia 接近 next-auth 体验。

### 8. (实战类) refresh token 自动刷新的实现？
**来源**：https://stackoverflow.com/questions/72943549/pinia-axios-interceptor-refresh-token

response 拦截器 catch 401 → 用 refresh_token 调 /auth/refresh → 成功更新 token → 重发原请求。用 Promise 锁防并发刷新（多次 401 只 refresh 一次）。

### 9. (测试类) 如何测 auth store 的 login/logout？
**来源**：https://pinia.vuejs.org/cookbook/testing.html

mock api.post('/auth/login') 返回固定数据 → 调 store.login() → 断言 token/user/permissions。测 logout → 断言全 null + localStorage 已清。

### 10. (权限类) 动态权限路由（admin 看 admin 页、user 看 user 页）怎么配合 Pinia？
**来源**：https://github.com/vuejs/router/blob/main/packages/router/CHANGELOG.md

方案：路由表配 `meta.roles: ['admin']`；beforeEach 里 `store.permissions.some(p => to.meta.roles.includes(p))`。或动态 addRoute（登录后按权限 add）。

### 11. (架构类) auth 逻辑应集中在 store 还是分散到 composable？
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html

state（token/user/perms）集中 store；UI 逻辑（弹窗、表单校验）在 composable/组件。store 是数据源，composable 是行为封装。

### 12. (移动端类) Capacitor/Ionic 里 token 存哪？
**来源**：https://capacitorjs.com/docs/plugins/preferences

Native 无 localStorage——用 @capacitor/preferences（iOS UserDefaults / Android SharedPreferences）。Pinia persist 插件的 storage 接口可适配。

### 13. (OIDC类) 对接 OAuth2/OIDC 时 store 怎么设计？
**来源**：https://pinia.vuejs.org/cookbook/state.html

store 存 access_token + id_token + expires_at。callback 路由里从 URL fragment 取 code → 换 token → 写 store。getter isExpired = Date.now() > expires_at。

### 14. (性能类) auth store 频繁被组件读取会性能问题吗？
**来源**：https://vuejs.org/guide/extras/reactivity-in-depth.html#what-is-reactivity

不会。computed isLoggedIn 有缓存；token 不变时所有订阅者不重渲染。只有 logout/login 改 token 时才一次 flush。

### 15. (综合类) 设计一个完整的"登录+权限+401刷新+登出清场"的 Pinia 模块结构。
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html

```
stores/auth.ts       (token/user/perms/login/logout/hasPerm)
plugins/axios.ts     (request 注入 Bearer / response catch 401 refresh+retry)
router/guard.ts      (beforeEach 检查 isLoggedIn + roles)
plugins/persist.ts   (token 自动 localStorage / logout 清除)
App.vue onMounted    (跨 tab storage event 监听)
```
