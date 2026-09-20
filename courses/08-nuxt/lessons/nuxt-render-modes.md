# 渲染模式与 route rules：一个项目四种姿势

Next 用 build 日志的 ○●ƒ 告诉你每个路由的渲染形态（呼应 next-render-modes 第 5 节），Nuxt 把选择权明牌交给你：`ssr` 开关管全局，**routeRules 按路由声明式配策略**——Nuxt 版"混合渲染"的核心文件就在 nuxt.config 那十几行里。

## 1. 全局旋钮与逐路由旋钮

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  ssr: true,                    // 全局默认服务端渲染；false=整站 SPA 化（no SSR 版 CSR）
  nitro: {
    prerender: { routes: ['/'] },          // SSG：构建期定格的路径清单
    // 或 crawlLinks: true 让爬虫从首页摸全站
  },
  routeRules: {
    '/':                { prerender: true },                 // ≈ Next SSG ○
    '/blog/**':         { swr: 3600 },                       // ≈ ISR ●（stale-while-revalidate）
    '/docs/**':         { isr: 600 },                        // 带平台缓存层的 isr 提示
    '/app/**':          { ssr: false },                      // 登录后后台：只发壳，纯客户端渲染
    '/old/**':          { redirect: '/' },                   // URL 治理（301 语义见 nuxt-dynamic D1）
    '/api/**':          { cors: true },                      // 杂项旋钮
  },
});
```

四种渲染姿势：

| 姿势 | 手段 | 服务端产物 | 适用 |
|------|------|-----------|------|
| SSR（默认） | 不配即是 | 每请求现渲染 HTML | 个性化/实时页 |
| SSG | prerender | 构建期 HTML 文件 | 营销页、文档 |
| SWR/ISR | swr/isr 秒数 | 缓存 HTML+后台再生成 | 内容站列表/详情 |
| SPA 化 | ssr:false（全局或 per-route） | 只发空壳+JS | 重交互后台 |

对照记忆：Next 的"默认静态、动态 API 触发"是**拉**（页面自己声明动态）；Nuxt 的 routeRules 是**推**（配置中心按路径模式指派策略）。前者贴着代码、后者一张表——大团队治理常偏爱后者（架构讨论素材，nuxt-architect 回收）。

## 2. 读懂 routeRules 的两个作用域

routeRules 的匹配走 Nitro 层，所以它能做渲染之外的事：`headers`（给路由批量挂响应头——CDN 缓存控制正解位）、`proxy`（把 /api/legacy/** 代理给老服务，迁移神器）、`redirect`/`rewrite`、`experimental: { websocket: true }` 等。**它在中间件之后、页面渲染之前生效**，优先级链路在 nuxt-lifecycle 里画全。

一个高频陷阱：`ssr: false` 的路由仍会被 Nitro 执行一次"外壳渲染"（app.vue 到 Suspense 为止），并非"完全静态"；SEO 检查时别看到 HTML 里一点骨架就以为配置无效（呼应 nuxt-hydration）。

## 3. 动态页的预渲染：generateStaticParams 的 Nuxt 答案

Next 在页面里写生成函数（呼应 next-dynamic 第 1 节），Nuxt 在配置里给清单：

```ts
nitro: {
  prerender: {
    routes: async () => {
      const { data } = await $fetch.raw('/api/posts');   // 构建期调自家 API
      return data.map(p => `/blog/${p.slug}`);
    },
    crawlLinks: true,          // 从入口沿 <a> 爬全站
  },
},
```

思路差异：Nuxt 把"预渲染哪些"集中成部署关注点（CI 可注入不同清单），页面代码保持无关。构建期取数注意 API 可达性——本地 build 要连得通 DB/上游（或用已 mock 的 server/api，nuxt-server-routes 见其便利）。

## 4. 缓存语义与"响应与请求者无关"红线

Next 的三层缓存金字塔（呼应 next-fetch-cache 第 3 节）在 Nuxt 缩成两层：**route rules 的 HTML 缓存**（Nitro/CDN 层）+ **数据层缓存**（defineCachedEventHandler，下一关 server 专题里讲）。同一条安全红线平移过来：**对 A 用户生成的 HTML 被缓存后 B 用户拿到，就是串号事故**。判据同样直白：用了 `useRequestHeaders`/cookie 的页面配 prerender/swr = 埋雷；`/app/**` 这类登录区正确姿势永远是 ssr:false 或 plain SSR，绝不进 HTML 缓存（把 nuxt-fetch-cache 的安全线在这里立起来）。

## 5. 部署形态联动：preset 决定旋钮含金量

routeRules 是"声明"，兑现靠平台适配——Nitro 的 preset 把 isr/swr 翻译成各平台原生缓存原语（Vercel CDN 规则、Netlify blober、Cloudflare KV；node-server preset 则用内存/文件系统缓存兜底）。这是 Next 没有的体验：Next 的 ISR 语义在自托管要自己接 cacheHandler（呼应 next-deploy 第 1 节），Nuxt 靠 Nitro 一层抽象抹平大半。代价：平台高级旋钮偶有新 bug 慢半拍，看 preset 文档要认准版本。

## 6. 自检清单

- [ ] 四种姿势的配置写法与适用场景一一对应；
- [ ] routeRules 能干的"渲染外的事"说出三件（headers/proxy/redirect）；
- [ ] 预渲染清单两种给法（routes 列表 / crawlLinks）；
- [ ] "带用户态的页不进 HTML 缓存"红线刻进脑子；
- [ ] 知道 isr/swr 的实际兑现依赖 preset 适配。

## 7. 小结

routeRules 是 Nuxt 的"渲染策略宪法"：一张表里说清每块 URL 怎么渲染、怎么缓存、怎么跳转。它比 Next 的段级 config 更集中，比手写 Nitro 中间件更声明式——用好它，混合渲染从玄学变成表格审查。下一关把一次请求从头到尾的钩子时机串成时间线。

🚀 部署预告：下一关 nuxt-lifecycle 画出"Nitro 中间件 → routeRules → 路由中间件 → 页面 setup → 水合"的全链路时间线——学完你能口述一次 SSR 请求的完整一生。
