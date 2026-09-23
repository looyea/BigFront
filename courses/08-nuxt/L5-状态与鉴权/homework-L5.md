# L5 作业：状态、会话与鉴权

> 覆盖关卡：nuxt-state / nuxt-cookie-session / nuxt-middleware-auth。五段式 20 题。

## 第一段：读代码找 Bug（10 题）

**题 1**
```ts
// stores/user.ts
const store = useUserStore();
export function setNick(n: string) { store.nick = n; }
```
压测时出现"A 用户看到 B 用户昵称"。指出这行为什么会串（与"每请求新建 app"并不矛盾的原因），给出改法。

**题 2**
```vue
<script setup>
const cart = useCartStore();
onMounted(() => cart.load());   // load 内部 await useFetch('/api/cart')
</script>
<template><span>{{ cart.count }}</span></template>
```
首屏 HTML 里 count 永远是 0，且 SEO 抓不到。改法要说明"为什么不能在 onMounted"。

**题 3**
```ts
export const useFilters = () => useState('filters', () => ({
  tags: new Set(['vue']),
  since: new Date('2026-01-01'),
  fn: (x) => x,
}));
```
客户端拿到的值一片空白。逐个字段说明在 payload 序列化时的下场，并改写为可往返的形态。

**题 4**
```ts
const token = useCookie('token', { default: '' });
```
安全审计把这一行判为高危。给出两个理由（一个关于默认值写法、一个关于该 token 被谁读得到），并改成正确方案。

**题 5**
```ts
// server/api/login.post.ts
setCookie(event, 'sid', sid, { httpOnly: true, path: '/api' });
```
```ts
// server/middleware/auth.ts（getCookie(event,'sid') 后无则 throw 401）
```
登录成功但之后所有页面都是未登录。定位 path 造成的作用域问题，并说明"删除时也要一致"的连带影响。

**题 6**
```ts
// middleware/auth.global.ts
export default defineNuxtRouteMiddleware(async () => {
  const { data } = await useFetch('/api/me');
  if (!data.value) throw createError({ statusCode: 401 });
});
```
列出这段全局中间件的三个问题（性能、误伤范围、错误呈现方式），并改写。

**题 7**
```vue
<script setup>
definePageMeta({ middleware: [(to) => { if (!isAuth()) return navigateTo(to.query.redirect) }] });
</script>
```
被安全扫描标"开放重定向"。说明攻击载荷长什么样，给出校验函数。

**题 8**
```ts
const sid = useCookie('sid', { readonly: true });
console.log(sid.value); // undefined
```
服务端明明下发了 sid，客户端却读不到，且刷新页面后服务端仍能识别。解释这是哪一属性导致的"正常现象"。

**题 9**
```ts
// 某接口用 JWT，登出仅前端清 localStorage
```
运维反馈"被踢的员工十分钟后还能查订单"。从令牌模型层面解释原因，给出两种治理方案与代价。

**题 10**
```vue
<template><AdminPanel v-if="me.roles.includes('admin')" /></template>
```
```ts
// server/api/orders.get.ts：直接返回全表
```
说明这两段代码合起来构成的漏洞类别，写出应有的三层修复。

## 第二段：手写编程（5 题）

**题 11**
实现 `composables/useAuthSession.ts`：内部用 `useFetch('/api/me', { key: 'me' })` + `useState` 缓存，导出 `user / logged / refresh / logout`。要求：SSR 首屏可用、客户端不重复请求、logout 后清 payload 缓存（提示 `clearNuxtData`）。

**题 12**
写 `server/middleware/session.ts` + `server/utils/guards.ts`（`requireUser` / `requireRole`），并给出一个使用它们的 `server/api/admin/stats.get.ts`。要求 server middleware 只解析不拦截，并解释为什么。

**题 13**
实现"无闪烁深色主题"：`useCookie('theme')` + `nuxt.config.ts` 的 `app.head.script` 内联脚本在挂载前给 `<html>` 打属性，SSR 侧同样读取。写出三处代码并说明如何避免 hydration mismatch。

**题 14**
为购物车 store 写服务端水合版本：Setup Store + `hydrateFromServer()`（用 `useFetch` 的 `pick` 只取必要字段），页面在 setup 顶层 await。要求说明 state 里不放函数/class，以及这样对 payload 体积的好处。

**题 15**
实现 401 静默续期：封装 `apiFetch(url, opts)`，遇 401 时调用 `/api/auth/refresh` 换票并重试一次；并发 401 只允许一次刷新（用共享 Promise 去重）。给出关键代码与失败兜底。

## 第三段：场景设计（1 题）

**题 16**
企业内部 OA（Nuxt 全栈）需求：SSR 首屏就要按部门显示不同菜单；会话 30 分钟空闲过期；管理员可强制下线某人；禁止搜索引擎收录；审计要求记录谁在何时访问了哪条数据。请给出：
- 会话方案（session vs JWT、cookie 属性完整清单、存储选型与过期回收）；
- 鉴权三层各自落点（route middleware / server middleware+handler / 数据层），并指出哪些页面必须 ssr:true 不能缓存；
- 强制下线的实现路径与生效时延；
- 过期与"填表中途掉线"的交互设计；
- 审计日志写在哪一层、为什么不能写在中间件的 fire-and-forget 里。

## 第四段：简答（3 题）

**题 17**
按"刷新后是否还在 / 是否 SSR 可读 / 是否可被 JS 读取"三个维度，比较 useState、Pinia、useCookie、localStorage 四种载体，并各给一个适用例子。

**题 18**
说明一次"未登录用户直接访问 /dashboard"的完整链路：route middleware（SSR 分支）→ 是否返回 302 → 登录页 → 登录接口写 cookie → 跳转回原页 → 服务端解析 cookie → payload 下发身份。标出每个环节的进程位置（Nitro / Vue 服务端 / 浏览器）。

**题 19**
为什么"cookie 里只放不透明 id，用户信息放服务端或 payload"是更优设计？请从体积、暴露面、变更生效时延三点作答。

## 第五段：挑战题（1 题）

**题 20** 🏆
设计并实现一个多租户权限中枢：
- `server/utils/perm.ts` 提供 `can(event, 'invoice:write')`，权限集合按租户 + 角色缓存在 `useStorage()`（swr，带版本号失效）；
- route middleware 只做"看不见"（菜单/按钮/路由），server handler 用 `can` 做"拿不到"，数据层查询强制带 `tenantId`；
- 提供一个 `/api/permissions/mine` 批量下发当前用户可见权限码（进 payload，控制体积，只下发布尔集合不下发规则）；
- 支持"权限变更后 5 秒内全网生效"，写出失效链路（版本戳 / 广播 / 缓存 key 设计）；
- 最后回答：如果 storage 集群抖动导致权限缓存全失效，你的系统是fail-open 还是 fail-close？给出你的选择、代价与降级预案（这是真正的工程决策点）。
