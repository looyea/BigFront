# 面试题 · Nitro 服务端与部署

1. **Nitro 是什么？和 Nuxt 什么关系？**
   Nitro 是 Nuxt 3 的**服务端引擎**（unjs 出品），基于 h3 + unstorage + rollup。能独立使用（Nitro 单独项目）；Nuxt 用它处理 server/api、中间件、SSR 输出、部署。

2. **server/api 的路由规则？**
   `server/api/users.get.ts` → `GET /api/users`；`.post`、`.all`；`[id]` 动态段。文件里 `export default defineEventHandler(async e => {})`。

3. **event.context 与 useState 的区别？**
   - event.context：仅**服务端**每次请求作用域；
   - useState：跨组件的**请求级**状态，可服务端→客户端安全水合（SSR-safe）。

4. **Nuxt 如何做 SSR 与预渲染？两者产物？**
   - SSR：`nuxt build` + `node .output/server/index.mjs`，动态渲染。
   - 预渲染（SSG）：`nuxt generate`，产出 dist 静态文件，可托管对象存储 + CDN。
   - 混合：routeRules 里 per-path 指定 ssr/prerender/swr/isr。

5. **`swr` 与 `isr` 在 Nuxt 里对应什么？**
   - `swr: true` 或 `{ swr: 60 }`：后台过期 + 立即返回缓存，适合对时效要求不苛刻的动态内容。
   - `isr: 60`（在支持 ISR 的平台如 Vercel/Netlify）：按秒数缓存 + CDN 边缘重生成。

6. **Nuxt 部署到不同平台你会注意什么？**
   - Vercel/Netlify：`nuxt build` + preset 自动匹配。
   - Node 单机：`node .output/server/index.mjs`。
   - 静态：`nuxi generate` + 任意 CDN。
   - Cloudflare：preset 'cloudflare-pages'，注意 Node API 兼容层。
   Docker：官方 `node:20-alpine` + `.output`。

7. **Nuxt 如何做 i18n、SEO、OG 图片？**
   `@nuxtjs/i18n`；`useSeoMeta`/`useHead`；`nuxt-og-image` 模块动态生成 OG。

8. **从 Nuxt 2 迁移到 Nuxt 3 你会讲哪些坑？**
   Vue2→3、Options→Composition、Vuex→Pinia、`asyncData` → `useAsyncData/useFetch`、CommonJS→ESM、nuxt.config 变化、组件 name 命名规则变化。
