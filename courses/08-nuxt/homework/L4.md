# L4 作业：数据获取、Nitro 服务端与运行期配置

> 覆盖关卡：nuxt-usefetch / nuxt-server-routes / nuxt-runtime-config。五段式 20 题。

## 第一段：读代码找 Bug（10 题）

**题 1**
```vue
<script setup>
const { data } = await useFetch('/api/articles', { server: false });
</script>
```
SEO 检查发现文章列表页源码里 `<main>` 只剩骨架。指出参数错处，并说明 `server:false` 真正适用的三种场景。

**题 2**
```vue
<!-- pages/users/[id].vue -->
<script setup>
const route = useRoute();
const { data } = await useFetch('/api/user');
</script>
```
从 /users/1 点进 /users/2，页面数据仍是 1 号用户。给出两种修复（提示：一次请求参数、一次实例复用）。

**题 3**
```ts
// server/api/orders.get.ts
export default defineEventHandler(async (event) => {
  const { data } = await useFetch('/api/user');
  return data;
});
```
这段代码在 server route 里直接 500。解释为什么 useFetch 不能出现在 Nitro 侧，改正确。

**题 4**
```ts
// server/middleware/auth.ts
export default defineEventHandler((event) => {
  if (!getCookie(event, 'token')) {
    throw createError({ statusCode: 401 });
  }
});
```
上线后登录接口 /api/login 自身也返回 401，用户永远登不上。定位这个中间件的通病并修复。

**题 5**
```ts
// server/api/search.get.ts
export default defineCachedEventHandler(async (event) => {
  const q = getQuery(event).q;
  return db.search(q);
}, { maxAge: 60 });
```
压测发现不同关键词的搜索结果互相串。指出缺失 getKey 的后果，并写出正确的 key 生成。

**题 6**
```vue
<script setup>
const { data: user } = useFetch('/api/user');
const { data: posts } = useFetch('/api/user');
</script>
```
posts 永远是 undefined，Network 面板只有一次请求。解释 key 注册表机制，给出修复。

**题 7**
```ts
// nuxt.config.ts
runtimeConfig: {
  public: { apiBase: 'https://api.old.com' },
};
```
部署时设置了进程环境变量 `NUXT_API_BASE=https://api.new.com`，客户端拿到的仍是旧值。指出命名的错处，并说明 public 栏被覆盖的两个前提条件。

**题 8**
```ts
// server/api/pay.post.ts
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const sig = createHmac('sha256', config.paymentSecret).update(body).digest('hex');
  return { sig };
});
```
本地正常、线上签名全错。已知线上在 `.env.production` 写了 `NUXT_PAYMENT_SECRET`，但代码里没在 runtimeConfig 声明 paymentSecret。解释"白名单"设计为何让变量静默失效。

**题 9**
```ts
// composables/useArticles.ts
export const useArticles = () => useFetch('/api/articles', { lazy: true });
```
两个不同页面都调用它，切换时偶发拿不到数据。检查 lazy 与 await 的搭配，并说明默认 key 的生成规则带来的第二个坑。

**题 10**
```vue
<template>
  <div>{{ config.privateToken }}</div>
</template>
<script setup>
const config = useRuntimeConfig();
</script>
```
水合时报 mismatch，而 payload 里查不到 privateToken。解释服务端与客户端渲染结果为何不同，给出正确做法。

## 第二段：手写编程（5 题）

**题 11**
实现 `server/api/health.get.ts`：返回 `{ status, uptime, env, version }`，其中 env 来自 runtimeConfig.public.envName、version 来自构建期注入的 app.config.version。说明为什么这两个字段一个放 public、一个放 app.config。

**题 12**
写一个带 BFF 鉴权的组合式函数 `usePrivateData(url)`：
- 服务端阶段透传原始 cookie 头到内部服务；
- 客户端阶段直接请求本地代理；
- 401 时跳登录页。
要求使用 `useRequestHeaders` 与 `import.meta.server` 守卫。

**题 13**
为文章详情设计三级缓存：`/api/articles/[id]` 用 defineCachedEventHandler（maxAge 300）；列表页 `/blog` 用 routeRules 的 isr；用户中心 `/me/**` 明确禁缓存。写出配置代码并说明每层的失效手段。

**题 14**
实现 `server/plugins/init-db.ts`（Nitro 插件）：在 `setup` 阶段读取 runtimeConfig 的 dbUrl，缺失则 throw；把连接实例挂到 NitroApp 局部状态并在 API 中通过 `useNitroApp()` 取用。说明为什么不建议直接用 globalThis。

**题 15**
给 `useFetch` 一次性加上：`pick` 只保留 title/excerpt、`transform` 生成阅读时长、`default` 给空数组、`watch` 跟随分页 query、`getCachedData` 复用 60 秒内已有数据。写出完整调用。

## 第三段：场景设计（1 题）

**题 16**
电商详情页需求：首屏价格库存要 SEO 可见、价格秒级不准会引发客诉、库存允许 5 秒延迟、静态营销文案要上 CDN、用户评价分页需按登录态区分。请给出：
- routeRules 与 useFetch 的参数分配表（哪些 prerender、哪些 swr/isr、哪些 ssr:true 且不缓存）；
- server route 的分层（哪些接口公开可缓存、哪些必须穿透）；
- 三方密钥与服务地址在 runtimeConfig 的栏位安排；
- 说清"为什么价格不能用 HTML 缓存而库存可以"。

## 第四段：简答（3 题）

**题 17**
`useFetch`、`useAsyncData`、`$fetch`、浏览器原生 `fetch` 四者在 SSR 阶段的执行位置、是否进 payload、是否参与去重注册表，各自适用场景分别是什么？

**题 18**
画出一条请求经过 Nitro 的完整链路：外部 HTTP → server middleware → 路由匹配（文件名与后缀语义）→ handler → 响应。说明内部调用 `/api/xxx` 为什么能短路，以及这个短路对性能与排查的影响。

**题 19**
从 12-Factor 视角解释 Nuxt 的"默认值 → .env → 进程环境变量"三级合并；为什么 public 栏也要走运行期而不是构建期内联？对比 NEXT_PUBLIC_ 说明"一次构建多环境部署"的可行性差异。

## 第五段：挑战题（1 题）

**题 20** 🏆
构建一个"配置中心 + 特性开关"的完整闭环：
- `runtimeConfig` 声明 `flagsApiUrl`（非 public）与 `appName`（public）；
- `server/api/flags.get.ts` 用 `defineCachedEventHandler`（swr: 30 + 自定义 getKey 含租户 id）拉取远端开关，远端不可达时回退到 `unstorage` 缓存的上一份值；
- 提供 `server/api/flags.refresh.post.ts`，管理员调用时写穿 storage 并清缓存；
- 前端 `useFlags()` 在启动插件里预取一次、失败不阻塞渲染，并在客户端复用 payload 数据；
- 说清"远端配置改了但页面还是旧的"在这套链路里的全部可能环节，逐条给出定位手段。
