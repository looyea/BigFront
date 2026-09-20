# 鉴权中间件：路由中间件、服务端拦截与三层纵深

## 1. 先破除一个误解：Nuxt 的 middleware 有两种，不是一种

| | route middleware（路由中间件） | server middleware（Nitro） |
|---|---|---|
| 目录 | `middleware/*.ts` | `server/middleware/*.ts` |
| 关注点 | **能不能去这个页面**（导航拦截/跳转） | **能不能吃这个请求**（所有 HTTP 请求切面） |
| 运行时机 | SSR 首屏一次 + 客户端每次导航 | 每个进入 Nitro 的请求（含静态、API） |
| 能拿到 | `useRoute()`、nuxtApp、可 `navigateTo` | `event`（cookie、header、body） |
| 不能做 | 阻止 API 被直接调用 | 控制前端路由跳转 |
| 对应 Next | `middleware.ts`（但 Next 的跑在 Edge，每次请求） | Express 的 `app.use` |

**最贵的认知误区**在这里：route middleware 在**首屏 SSR 时确实会跑**，但用户之后在浏览器地址栏直接输入 URL、或者从外部链接跳转进来时，它同样会在服务端跑一次——看起来"够用"。可是它管不住三件事：

1. 页面里 `useFetch('/api/admin/users')` 这个接口本身照样能被任何人直接请求；
2. 客户端篡改 `__NUXT__.state` 里的 `isAdmin` 就能骗过纯前端判断（呼应 nuxt-state 面试第 11 题）；
3. 生成 HTML 时才 throw 401，用户仍能看到部分渲染产物。

结论：**route middleware 是体验层，鉴权的事实层必须在 server 侧。**

## 2. route middleware 的写法与执行时机

```ts
// middleware/auth.ts（文件名 = 中间件名，自动导入，呼应 nuxt-auto-imports）
export default defineNuxtRouteMiddleware((to, from) => {
  const { logged } = useAuthSession();       // 内部 useCookie/useFetch
  if (!logged.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
  }
});
```

```vue
<!-- pages/dashboard.vue -->
<script setup>
definePageMeta({ middleware: 'auth' });      // 编译宏，呼应 nuxt-dynamic
</script>
```

时机链路（把 nuxt-lifecycle 的图接上）：

```
resolve route → 全局 middleware（按文件名排序） → per-route middleware
→ 页面 setup（顶层 await useFetch 在这里） → 渲染
```

要点：

- **`return` 一个 Promise/navigateTo 就是重定向**；想留在原地用 `abortNavigation()`（404 场景常用）；
- 全局中间件：文件名以 `.global.` 结尾（`middleware/auth.global.ts`）或导出数组名 `global: true`，每跳都跑——**代价是每次导航都执行，别在里面发请求**；
- 多个中间件按数组顺序串行，任一返回跳转即中断后面的；
- 中间件里可以用 `useRuntimeConfig()`（public 栏）与 `useCookie()`——后者正是"服务端首屏能读到身份"的关键。

## 3. 服务端的事实层：server middleware + handler 二次校验

```ts
// server/middleware/session.ts —— 只解析身份，不做拦截（呼应 nuxt-server-routes 第 5 节）
export default defineEventHandler(async (event) => {
  const sid = getCookie(event, 'sid');
  event.context.user = sid ? await readSession(sid) : null;   // 查不到就是 null
});
```

```ts
// server/utils/guards.ts
export function requireUser(event: H3Event) {
  const u = event.context.user;
  if (!u) throw createError({ statusCode: 401, message: '未登录' });
  return u;
}
export function requireRole(event: H3Event, role: string) {
  const u = requireUser(event);
  if (!u.roles?.includes(role)) throw createError({ statusCode: 403, message: '无权访问' });
  return u;
}
```

```ts
// server/api/admin/users.get.ts
export default defineEventHandler((event) => {
  requireRole(event, 'admin');      // ← 真正的门禁在这里
  return db.users.list();
});
```

分工写清楚：**server middleware 负责"你是谁"（解析并挂到 event.context），handler 负责"你能不能干这件事"（抛 401/403）**。反过来用 middleware 做拦截会撞上"放行路径清单永远列不全"的老坑（登录、健康检查、静态资源、内部 API 短路都会被误杀）。

## 4. 三层纵深模型（本关的骨架）

```
第 1 层  前端 route middleware / UI 隐藏    → 体验：不该看的看不到，不该去的被引导
第 2 层  服务端 middleware + handler 校验    → 安全：任何请求都要重新证明身份与权限
第 3 层  数据层 scoped query / RLS           → 底线：SQL 带 user_id，越权也拿不到别人的行
```

三层的判据是一句可执行的话：**假设第 2 层不存在，第 3 层会不会泄露数据？如果会，说明第 3 层写弱了。** 这与 09-express 的 exp-auth、07-nextjs 的 next-middleware-auth 完全同构，只是各家框架落点不同。

对照 Next.js：

| 维度 | Nuxt | Next App Router |
|---|---|---|
| 导航守卫 | route middleware（客户端也会跑） | 无客户端概念，只有 `middleware.ts`（Edge，每请求） |
| 服务端事实层 | handler 里 requireUser | `layout/page` 里读 cookie 判断 + Route Handler 校验 |
| 细粒度保护 | 逐 handler | 逐 route segment / Server Action 内 |
| 优势 | 前端体验连贯 | 无"客户端绕过"概念 |

## 5. 首屏身份的正确取法：一次请求，两侧可用

```ts
// composables/useAuthSession.ts
export const useAuthSession = () => {
  const user = useState<User | null>('auth-user', () => null);
  async function refresh() {
    const { data } = await useFetch<User | null>('/api/me', { key: 'me', credentials: 'include' });
    user.value = data.value;
  }
  return { user, logged: computed(() => !!user.value), refresh };
};
```

在页面 setup 顶层 `await refresh()`：SSR 阶段服务端带 cookie 调内部 `/api/me`（进程内短路，几乎零开销），结果进 payload，客户端水合后直接复用，middleware 与组件读到的都是同一份、两侧一致——**避免"服务端判定未登录、客户端判定已登录"的抖动**（呼应 nuxt-hydration）。

## 6. 高频坑清单

1. **在 route middleware 里 `await` 一个外部 HTTP**：每次导航都串行等一次网络，白屏明显。全站数据交给 SSR payload 或 `useState` 缓存。
2. **只在前端判断角色隐藏按钮，接口不校验**：等于把 URL 当权限。第 2 层必须有。
3. **登录后不刷新就 401**：服务端写 cookie 对本次请求无效（nuxt-cookie-session 第 2 节），必须跳转触发新一轮请求。
4. **`redirect` 参数未校验**：`?redirect=//evil.com` 直接 `navigateTo` 就是开放重定向漏洞。只允许站内相对路径，白名单校验。
5. **`.global.` 中间件里 throw 401**：会让静态资源路由也进不去。全局中间件只做跳转，不做异常。
6. **忘记 server 侧也要有 error 页面口径**：API 抛 `createError({statusCode:401})` 与页面抛错渲染 error.vue 是两条路（nuxt-error-debug 展开）。
7. **SSG/prerender 页面里做鉴权**：构建期没有请求者身份，`prerender:true` 的页面鉴权必然失效（呼应 nuxt-render-modes 的 HTML 缓存安全线）。

## 7. 自检清单

- [ ] 每个敏感 API handler 都有 requireUser/requireRole 吗（不是只靠 middleware）？
- [ ] server middleware 是否只做解析、不做拦截？
- [ ] route middleware 里有没有发外部请求？
- [ ] 重定向目标 `redirect` 是否校验为站内路径？
- [ ] 全局中间件是否用了 `.global.` 且只做跳转？
- [ ] 身份是否只在 payload 出现公开字段（角色列表可给，权限判定不给）？
- [ ] 数据层查询是否带 owner 维度（第三层兜底）？
- [ ] prerender/swr 的页面里有没有依赖登录态的内容？

## 8. 🚀 部署预告

到这里"数据—状态—身份—门禁"四条线闭环，接下来进入体验与工程化：下一关 **nuxt-modules**——Nuxt 的模块系统如何用一个 `nuxt.config.ts` 的数组把 SEO、图片、Tailwind、i18n 全接进来，以及 `addImports`/`addComponentsDir` 这些钩子背后与自动导入（nuxt-auto-imports）的同源机制。
