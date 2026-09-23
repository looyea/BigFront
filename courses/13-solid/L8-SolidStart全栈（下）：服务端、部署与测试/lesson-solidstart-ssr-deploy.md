# SSR 模式与部署：ssr 开关、预渲染与 Nitro 预设

> 目标：能按产品需求在 SSR / CSR / SSG 之间做选型并落到配置——`ssr` 布尔、prerender 路由表与 crawlLinks、Nitro 部署预设与 Cloudflare 的异步局部存储坑——并把站点交到正确的托管形态上。呼应课业「了解 SSR/SSG 与部署形态」。

## 一、三种渲染形态一张表

| 形态 | 配置 | HTML 何时产生 | 适用 |
| --- | --- | --- | --- |
| SSR（默认） | `ssr: true` | 每个请求在服务器渲染 | 内容个性化/时效强 |
| CSR | `ssr: false` | 浏览器首帧后 | 强交互后台、SEO 无所谓 |
| SSG/预渲染 | `server.prerender` | **构建期**生成静态 HTML | 文档/博客/营销页 |

官方对预渲染的定位原话：构建过程产出静态 HTML 页、**静态文件运行时无服务端处理**——更快加载与更好 SEO。

## 二、预渲染：点名路由 or 全站爬取

```ts
// 指定路由
export default defineConfig({
  server: { prerender: { routes: ["/", "/about"] } },
});
// 全部路由：顺着链接爬
export default defineConfig({
  server: { prerender: { crawlLinks: true } },
});
```
`routes` 列名单、`crawlLinks: true` 让构建器从入口页**顺着 `<a>` 爬遍全站**；更高级选项看 Nitro 文档。注意 crawlLinks 的可达性前提：不在任何链接上的路由（如只能通过命令式跳转抵达的页面）不会被爬到，需要这类页时用 routes 名单兼容。文档/博客类还可用 SolidBase——官方点名它对快速预渲染的 Markdown/MDX 页有内建支持。

## 三、部署 = 选 Nitro 预设

v1 的 `defineConfig`（app.config.ts）把 **Nitro** 的构建/部署预设暴露在 `server.preset`；不传参默认 **node**。官方常备清单：
- **自建服务器**：`node`（默认）、`deno_server`、`bun`；
- **托管 provider**：`netlify` / `netlify-edge`、`vercel` / `vercel-edge`、`aws_lambda`（Lambda@Edge）、`cloudflare` / `cloudflare_pages` / `cloudflare_module`、`deno_deploy`。

```ts
export default defineConfig({ server: { preset: "netlify_edge" } });
```
多数 provider 环境能**自动探测**预设，探不到才需要手写。选预设前留意运行时能力差异：官方特别指出 SolidStart 依赖异步局部存储（ALS）做请求上下文追踪，Netlify/Vercel/Deno 开箱支持，而 Cloudflare 需要额外开启——这是第五节坑的伏笔。

## 四、v2 的变化：部署交给 Vite 插件生态

v2 概览页口径：SolidStart v2 构建在 **Solid v1 + Vite v8+** 之上，用 **Vite Environment API** 做客户端/服务端两套构建，因此直接和 **Nitro v3、Cloudflare Vite 插件、Netlify Vite 插件**这类 deployment plugins 协作。心智不变：**"产出什么运行时"是一等配置项**，只是挂载方式从 app.config 的 Nitro 预设变成 Vite 插件体系。v2 配置在 vite.config.ts 的 solidStart()（L7 讲过）。

## 五、Cloudflare 专属坑：异步局部存储

SolidStart 依赖 **AsyncLocalStorage**（请求上下文追踪的地基）。Netlify、Vercel、Deno 开箱支持；**Cloudflare 要手动开两处**：
```ts
export default defineConfig({
  server: {
    preset: "cloudflare_module",
    rollupConfig: { external: ["__STATIC_CONTENT_MANIFEST", "node:async_hooks"] },
  },
});
```
```toml
compatibility_flags = [ "nodejs_compat" ]
```
漏配的典型症状是运行时报错而非构建失败——上 Workers 先把这两段抄齐。

## 六、路由无关性（v2）

v2 明确 **router-agnostic**：可配官方 Solid Router v1，也可换 TanStack Solid Router v1。"框架层"（预渲染、服务端函数、序列化）与"路由层"解耦——评估新 router 时不必整体搬家。

另一句官方定调值得记住：对 v1 存量用户，v2 "主要是一次工具链与稳定性升级"（Vite Environment API、部署插件生态、序列化默认 json）——业务代码里 L1–L7 的响应式/路由/数据写法基本不变，迁移风险集中在**配置面与部署面**，这也是本关知识的主战场。

## 七、选型三问

1. **内容给爬虫看吗？** 营销/文档 → prerender（crawlLinks）；
2. **首屏要带用户数据吗？** 要 → 保 SSR；纯工具型后台可 `ssr: false` 走 CSR；
3. **托管在哪？** 自建 node/容器；edge 需求选 netlify_edge/vercel-edge/cloudflare_module——Cloudflare 记得第五节的 ALS 双配。

## 八、自检清单

- [ ] 能写出 prerender 的 routes 与 crawlLinks 两种配置并说清产物差异
- [ ] 能背出至少 6 个 Nitro 预设名及其对应平台
- [ ] 知道 v1（app.config + Nitro 预设）与 v2（Vite Environment API + deployment plugins）的两代部署形态
- [ ] 能默写 Cloudflare 的 rollupConfig.external 与 wrangler 的 nodejs_compat 两处配置
- [ ] 会用"三问"给一个新页面定渲染与部署形态

🚀 **下一站**：测试（solid-testing）——@solidjs/testing-library 的 Solid 特化 API 与 Vitest 集成。
