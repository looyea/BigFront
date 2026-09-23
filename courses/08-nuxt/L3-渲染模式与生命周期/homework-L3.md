# L3 作业：渲染模式、生命周期与水合

> 覆盖关卡：nuxt-render-modes / nuxt-lifecycle / nuxt-hydration。五段式 20 题。

## 第一段：读代码找 Bug（10 题）

**题 1**
```ts
// nuxt.config.ts
routeRules: {
  '/user/**': { swr: 60 },   // /user/profile 里 await auth() 读 cookie
}
```
上线两天后用户截图反馈"看到了别人的昵称"。定位问题层级并给出两种修复。

**题 2**
```vue
<script setup>
const isDesktop = typeof window !== 'undefined' && window.innerWidth > 1024;
</script>
<template><aside v-if="isDesktop">侧栏</aside></template>
```
水合 warn + 侧栏闪。指出"双端判定"的错处，用 import.meta 与 onMounted 各改一版。

**题 3**
```vue
<ClientOnly>
  <HeroBanner />   <!-- 页面 LCP 主图在 HeroBanner 内 -->
</ClientOnly>
```
上线后 LCP 从 1.9s 恶化到 3.6s。为什么？给保留 SSR 又修好 mismatch 的替代方案。

**题 4**
```ts
// app/middleware/track.ts
export default defineNuxtRouteMiddleware(() => {
  if (import.meta.server) sendPageView();   // 服务端打点
});
```
页面 PV 统计出现"一次访问两次上报"。水合语义下这行代码错在哪？

**题 5**
```vue
<!-- app/pages/index.vue -->
<script setup>
const { data } = await useFetch('/api/big-list');   // 返回 1.8MB JSON
</script>
```
TTFB 高达 2.4s、HTML 源码里一坨数字。两个独立优化点是什么？

**题 6**
```ts
export default defineNuxtPlugin(async (nuxtApp) => {
  const cfg = await fetchRemoteConfig();   // 无 timeout
  nuxtApp.provide('cfg', cfg);
});
```
上游配置服务抖动时全站白屏 8 秒后报错。插件时机与容错各埋了什么雷？

**题 7**
```ts
// server/middleware/ua.ts
export default defineEventHandler((e) => { e.context.isMobile = /Mobi/.test(getHeader(e,'user-agent')||''); });
```
有人把此文件挪进了 app/middleware/ 同名继续用。双端执行差异会让什么坏掉？

**题 8**
```vue
<template>
  <time>{{ new Date().toLocaleTimeString() }}</time>
</template>
```
checkHydration 报告 diff 只有一个时间数字。这是 bug 吗？两种处置哲学。

**题 9**
```ts
nitro: { prerender: { crawlLinks: true } },
// 页面模板里有 <a :href="`/cart?add=${item.id}`"> 这类可爬到的写操作链接
```
预渲染爬完后，爬虫清单把带参数链接全爬了。两个危害与 crawlLinks 的 ignore 方案。

**题 10**
```ts
const route = useRoute();
watch(route, () => refresh());   // 期望参数变化自动重取
```
刷新逻辑时灵时不灵。响应式对象的 watch 错在哪，正确写法？

## 第二段：手写编程（5 题）

**题 11** 为内容站写完整 routeRules：首页 swr60、/article/**（ISR 3600 + immutable 资源头）、/search（永不缓存 + SSR）、/admin/**（ssr:false）、/old/**（301 到新站）、/api/legacy/**（代理旧服务）。逐键注释理由。

**题 12** 实现一个 `<BrowserGreeting />`：SSR 输出占位"Hello"，水合后按 navigator.language 显示对应问候语，全程零 mismatch。再写出其 .client.vue 版本并比较适用场景。

**题 13** 写一个"钩子耗时探针"插件：对 page:start/page:finish/app:suspense:resolve 打点，超过阈值 console.warn 并上报 /api/metrics（含导航 to/from）。

**题 14** 用 getCachedData 实现"列表数据 30 秒内复用 payload、超时重取"，并解释水合首帧为什么不会触发重取。

**题 15** 写一条 CI 检查脚本思路：扫描 app/pages 与 app/components，报告"模板表达式里出现 Date.now()/Math.random()/window." 的文件行清单（供 review 拦截）。

## 第三段：场景题（1 题）

**题 16** 出海电商：主框架 SSR 正常，但中东某市场页面花屏——定位发现是 RTL 翻译扩展在改写 DOM 且站上接了翻译。给出：① 分级影响评估表；② 短期止血（组件/水合层面）；③ 长期方案（产品+工程）；④ 如何把这类"环境不可控"纳入验收清单。

## 第四段：简答（3 题）

**题 17** 一次 SSR 请求能"短路出栈"的三个环节是什么？各自典型用途举一例。

**题 18** payload 三暗面（体积/过期/双源）各自的一句话对策。

**题 19** "水合窗口期点不动"是 bug 吗？给出产品与技术两层缓解各一条。

## 第五段：挑战题 🏆（1 题）

**题 20** 🏆 给 L2 挑战题的多后台系统设计渲染策略终稿：三档 routeRules（含 headers/缓存/isr 取舍）、鉴权 middleware 与 HTML 缓存的互斥证明（为何 /console/** 绝不能 swr）、payload 预算（每页 ≤80KB 的落地手段清单）、并写 5 条《水合纪律》进团队 Lint/评审规范。与 Next 方案对比列一张差异表——这张表将直接成为 nuxt-architect 的素材。
