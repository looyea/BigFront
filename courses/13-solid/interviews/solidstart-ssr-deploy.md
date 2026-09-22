# SSR 模式与部署 · 面试题

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) SolidStart 的 SSR / CSR / SSG 三形态分别由哪个配置驱动？

`ssr: true`（默认）服务端渲染；`ssr: false` 纯客户端；`server.prerender`（routes 名单或 crawlLinks 全站爬）在**构建期**产静态 HTML、运行时零服务端处理。三者可对不同页面组合使用。
**来源**：官方 defineConfig 参数表与 route-prerendering 页转述。

### 2. (A) prerender 的 routes 与 crawlLinks 怎么用、有何区别？

`routes: ["/", "/about"]` 点名单页；`crawlLinks: true` 让构建器从入口顺 `<a>` 爬遍全站逐页产出。高级选项归 Nitro 文档。博客/文档站常用 crawlLinks 一把梭。
**来源**：官方 Route Pre-rendering 页两种配置转述。

### 3. (A) v1 的部署配置面和 v2 的部署协作机制分别是什么？

v1：defineConfig 的 `server` 段暴露 Nitro 选项，`preset` 选平台（node 默认；netlify/vercel/aws_lambda/cloudflare…）。v2：改用 **Vite Environment API** 做两端构建，直接对接 Nitro v3、Cloudflare Vite 插件、Netlify Vite 插件等 deployment plugins。
**来源**：官方 defineConfig Nitro 节与 v2 Overview 页两代口径转述。

### 4. (B) 部署到 Cloudflare Workers 后运行时报 async_hooks 相关错误，官方给的标准修复？

SolidStart 依赖 AsyncLocalStorage，Netlify/Vercel/Deno 开箱支持，Cloudflare 要两处显式开：rollupConfig.external 列 `__STATIC_CONTENT_MANIFEST` 与 `node:async_hooks`；wrangler.toml 加 `compatibility_flags = ["nodejs_compat"]`。
**来源**：官方 defineConfig 页 Cloudflare Special note 转述。

### 5. (B) 构建成功但线上 500，从"渲染形态×平台能力"角度给个排查序。

① 平台与 preset 是否匹配（探测失败时手写 server.preset）；② 页面用了 SSR 运行时能力（session/ALS）却部署成纯静态托管；③ Cloudflare 类边缘运行时没开 node 兼容；④ 预渲染页里混进了必须每请求计算的路由（不该进 prerender 名单）。
**来源**：官方部署/预渲染机制反推的社区高频排障路径转述。

### 6. (C) 哪些页面该预渲染、哪些坚决不该？给判据。

内容对所有访客相同、更新频率≈发布频率 →  prerender（营销页、文档）；含个性化/实时数据、按用户渲染 → SSR/CSR。判据一句话：**HTML 能否在构建期就被完全确定**。
**来源**：SSG 适用叙述（文档/博客/营销）与动态页对比转述。

### 7. (C) v2 说 router-agnostic，对部署/渲染有什么含义？

渲染与部署是框架层能力，与路由库解耦：可官方 Solid Router v1 或 TanStack Solid Router v1。换 router 不动 prerender/服务端函数/序列化配置——迁移评估面收窄到路由 API 本身。
**来源**：v2 Overview router-agnostic 声明的应用视角转述。

### 8. (D) 一个"官网+博客+登录后台"的站点，渲染形态怎么切？

官网与博客 prerender（crawlLinks 顺内链爬取，MDX 内容可配 SolidBase）；后台带会话数据保 SSR（或 `ssr: false` 走 CSR，看 SEO 诉求）；服务端函数需要的运行时在平台侧确认支持 ALS。一个应用内按路由分档，正是 SolidStart 允许的组合。
**来源**：官方 prerender 定位与 ssr 开关组合的场景题转述。

### 9. (A) 为什么 server function 的载荷序列化会扯上 CSP？js 模式做了什么？

js 模式用 Seroval 序列化、客户端**靠 eval 反序列化**，严格 CSP（无 unsafe-eval）直接封死；json 模式用 JSON.parse 避开 eval，代价是载荷略大。v1 默认 js、v2 默认 json 的换代就是这场取舍的落锤。
**来源**：官方 Serialization Modes/Defaults 一节转述。

### 10. (B) `server: {}` 什么都不传跑生产，起的是什么？想上 edge 函数清单里有哪些？

默认 **node** 服务器 preset。edge/provider 常见：netlify / netlify-edge、vercel / vercel-edge、aws_lambda（含 Lambda@Edge）、cloudflare / cloudflare_pages / cloudflare_module、deno_deploy、bun、deno_server。
**来源**：官方 Nitro 预设清单转述。

### 11. (D) 老板问"上 SSG 能省多少服务器成本、代价是什么"，你怎么答？

省：静态文件 CDN 直给、运行时无计算实例（官方：无服务端处理）。代价：内容更新要重新构建/触发增量重建、个性化页仍需一版动态兜底、crawlLinks 需要站内链接可达否则漏页。适合内容型路由多、交互集中在少数动态页的站点。
**来源**：官方 SSG 收益叙述延伸到成本决策的转述。

### 12. (C) 预渲染和"把页面写成纯客户端渲染"都能不要服务器，差别在哪？

预渲染交付的是**构建期 HTML**（爬虫可见、首帧即内容）；CSR 首帧是空壳、内容在 JS 跑完后出现。同为"无运行时服务端"，SEO 与首屏体验天差地别——所以官方把 prerender 归到性能与 SEO 收益一侧。
**来源**：route-prerendering 页 SEO/加载收益叙述与 CSR 对比转述。
