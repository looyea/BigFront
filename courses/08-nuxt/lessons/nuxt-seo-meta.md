# SEO 与 Meta：SSR 真正的胜负点

## 1. 先纠正一个流行误解

很多人说"上 SSR 就是为了 SEO"。这话只对了一半：**SSR 提供的是"爬虫能拿到 HTML"的可能性，能不能变成收录与排名，取决于你有没有把三件事做对——正确的文档结构、每页独立的元信息、可被抓取的链接与资源。** 一个 ssr:true 但每页 title 都相同、正文靠客户端 `onMounted` 补拉的项目，SEO 表现和 SPA 没有本质区别。

各类爬虫的 JS 执行能力（决定为什么必须服务端出内容）：

| 抓取方 | 执行 JS | 影响 |
|---|---|---|
| Googlebot | 会（双波渲染，慢且耗配额） | SSR 出内容才稳 |
| 百度 | 基本不执行 | 必须 SSR/预渲染 |
| **微信/飞书/Slack/Twitter 分享爬虫** | **完全不执行** | OG 标签必须服务端输出，否则分享卡片空白 |
| Bing | 部分 | 同上 |

第三行是业务上最痛的：分享链接没图没描述，靠客户端 `useHead` 永远修不好（呼应 nuxt-hydration 的"两侧执行"模型——爬虫只吃第一侧）。

## 2. useHead / useSeoMeta：两套 API 各管一半

```ts
// app.vue（全站级）
useHead({
  titleTemplate: '%s | NoteDeck-N',     // 模板函数更灵活：(title) => title ? `${title} · 笔记` : '笔记 · NoteDeck-N'
  link: [{ rel: 'icon', href: '/favicon.svg' }],
  meta: [{ name: 'theme-color', content: '#00dc82' }],
});
```

```vue
<!-- pages/articles/[slug].vue（页面级） -->
<script setup>
const { data: a } = await useFetch(`/api/articles/${route.params.slug}`, { key: `art-${route.params.slug}` });

useSeoMeta({
  title: () => a.value?.title,                 // 传函数 = 响应式，数据回来自动更新
  description: () => a.value?.summary,
  ogTitle: () => a.value?.title,
  ogDescription: () => a.value?.summary,
  ogType: 'article',
  ogImage: () => `${base}/api/og?slug=${a.value?.slug}`,   // 绝对 URL！
  twitterCard: 'summary_large_image',
});
</script>
```

分工：**`useSeoMeta` 管"已知的 SEO 语义"（40+ 预设字段，写键名不用记 `property=` 拼写，还有 TS 提示）；`useHead` 管"其它一切标签"**（script/JSON-LD/link canonical/htmlAttrs/bodyAttrs）。两者都来自 @unhead，服务端渲染时直接写进 HTML `<head>`，客户端导航时 diff 替换（不会残留上一页的 meta，这点比手写 vue-meta 可靠）。

时机注意：`useHead` 必须在 setup 同步阶段调用（不能在 `onMounted` 或 await 之后，否则脱离组件实例，呼应 vue-lifecycle）。

## 3. 五个必做项，逐项给代码

**① canonical —— 没有它就有重复内容。** 每个页面输出规范绝对地址：

```ts
const base = useRuntimeConfig().public.siteUrl;   // 运行期注入，测试环境另配（呼应 nuxt-runtime-config）
useHead({ link: [{ rel: 'canonical', href: () => base + route.path }] });
```

**② 站点级 URL：`site.url`（Nuxt 3.10+ 的 `nuxt.config.site`）。** sitemap/OG/规范化都读它，且支持 `NUXT_PUBLIC_SITE_URL` 环境变量覆盖——一个 env 变量比满世界 `process.env.BASE_URL` 干净得多。

**③ robots 双层。** `meta robots` 管索引，`/robots.txt` 管抓取：

```ts
useSeoMeta({ robots: 'noindex, nofollow' });   // 私有页/搜索结果页/带参数列表页
```

推荐 `@nuxtjs/robots` 模块：自动区分 dev（全站 Disallow）与 prod，并处理 groups、sitemap 声明。原则与 nuxt-middleware-auth 第 6 节同源：**未登录也不能被收录的页面，既要不索引，也要服务端别返回 200 HTML**（呼应"302 优于渲染后再跳"）。

**④ sitemap。** `@nuxtjs/sitemap` 自动收集路由并输出 `/sitemap.xml`；带数据的站点用自定义端点：

```ts
// server/sitemap.xml.ts （Nitro 路由，呼应 nuxt-server-routes）
export default defineEventHandler(async (event) => {
  const urls = await db.publishedUrls();
  setHeader(event, 'Content-Type', 'application/xml');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${
    urls.map(u => `<url><loc>${base}${u}</loc></url>`).join('')
  }</urlset>`;
});
```

sitemap 里只放 canonical 且可索引的 URL（不要把分页参数、内部预览链接塞进去）。

**⑤ 结构化数据 JSON-LD。** Google 唯一推荐的格式（微数据/microformats 已是历史）：

```ts
useHead({
  script: [{ type: 'application/ld+json', innerHTML: JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Article',
    headline: a.value?.title, datePublished: a.value?.publishedAt,
    author: { '@type': 'Person', name: a.value?.author },
    image: `${base}/api/og?slug=${a.value?.slug}`,
  }) }],
});
```

注意 `innerHTML` 里不能出现未转义的 `</script>`；序列化用户输入要过一遍 `escapeHtml`（这是 XSS 注入 JSON-LD 的真实路径）。

## 4. OG 图：动态生成才是正解

静态一张 logo 当全站分享图，等于放弃了点击率。两条实现路线：

```
路线 A：Nuxt 模块 @nuxt/og-image（openGraphImage 端点，基于 satori + headless 渲染）
路线 B：自建 Nitro 路由 /api/og?slug=xxx → 用 satori 把 JSX 转 SVG → @resvg 转 PNG
```

要点：OG 抓图有尺寸与超时限制（建议 ≤5MB、生成 <1s，超时就退到静态兜底图）；微信抓取对 SVG 支持差，**输出 PNG**；URL 要带内容版本哈希否则社交平台的图缓存永远更新不了（呼应 next-fonts-images 的 OG 图讨论）。

## 5. 渲染模式与 SEO 的搭配（把 L3 的账结清）

| 页面类型 | 建议 routeRules | SEO 结论 |
|---|---|---|
| 首页/落地页/文档 | `prerender: true` | 最佳：静态 HTML + 全球 CDN |
| 文章详情（量大） | `isr: 3600` + `swr` | 好：首次动态、之后命中缓存 |
| 搜索结果页 | `ssr: true`，**noindex** | 别把无限参数页交给爬虫 |
| 用户中心/后台 | `ssr: true` + 302 前置 + noindex | 根本不该被索引 |
| 纯交互工具页 | 可 `ssr: false` | 只需 title/desc 服务端有即可 |

`ssr: false` 时 `useHead` 的产物不在服务端 HTML 里（只有 app.vue 层的默认值）——这是"SPA 模式对 SEO 的代价"的准确表述，不是"完全没救"（Google 仍能渲染，百度/微信不行）。

## 6. 高频坑

1. **title 闪烁**：数据未到时 `title: () => a.value?.title` 返回 undefined → 落到 titleTemplate 的空值。给兜底：`() => a.value?.title ?? '加载中'`，或用 `status: pending` 时不输出（呼应 nuxt-usefetch 的 status）。
2. **meta 重复**：在 `app.vue` 和页面同时写 description，unhead 按 key 合并；若用 `useHead` 手写成 `meta: [{name:'description'}]` 与 `useSeoMeta({description})` 混用可能出现两份——统一用 useSeoMeta。
3. **OG 用相对路径**：分享爬虫不看你的域名上下文，必须绝对 URL。
4. **canonical 指向带参 URL**：`?utm_` 参数页把 canonical 写回干净路径，否则权重被稀释。
5. **hydration 报错来自 head**：把 `<ClientOnly>` 用在 head 内容上没有意义，head 由 unhead 单独管理，不要放组件树里。
6. **预渲染时数据接口 500** → `prerender` 阶段没有登录态与 DB 连接（nuxt-render-modes 的构建期陷阱）。
7. **忘了 `x-default` 与多语言 hreflang**：i18n 场景交给 `@nuxtjs/i18n` 生成，别手搓。

## 7. 自检清单

- [ ] 每页 title/description 唯一且服务端可见（view-source 验证，不是 F12）
- [ ] canonical 输出绝对 URL，且 `site.url` 按环境注入
- [ ] 不该收录的页面同时做了 noindex 与服务端非 200
- [ ] robots.txt 与 sitemap 可访问，sitemap 只含可索引 canonical
- [ ] OG 图为绝对 URL、PNG、有兜底、URL 带版本
- [ ] 文章/商品/面包屑/FAQ 的 JSON-LD 已加，用富媒体测试工具校验
- [ ] 分享链接在微信/飞书实测出图出描述
- [ ] 结构化数据里的用户输入已转义

## 8. 🚀 部署预告

元信息管"被看见"，样式管"好看且快"。下一关 **nuxt-styling**：`css` 数组与全局样式的加载顺序、Tailwind/UnoCSS 的接入姿势、`.client.css` / `.server.css` 后缀同构技巧，以及 CSS 如何避免成为水合闪烁与体积失控的来源。
