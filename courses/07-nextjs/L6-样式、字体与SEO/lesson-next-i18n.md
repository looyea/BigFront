# 国际化：多语言路由与 next-intl

> 目标：给 Next.js App Router 应用加上完整的多语言能力——`[locale]` 路由段、middleware 语言协商、next-intl 的服务端/客户端翻译双层、hreflang 与多语言 sitemap（回收 next-metadata 埋下的伏笔），并讲清 App Router 时代"内置 i18n 已死"的历史包袱（呼应 vue-use-i18n 的 vue-i18n 同题、08-nuxt 的 @nuxtjs/i18n 预告）。

---

## 一、先纠正一个过期认知

Pages Router 时代 `next.config.js` 里有内置 `i18n: { locales, defaultLocale }` 配置。**App Router 不支持它**——官方明确"用 middleware 自己搭"，内置方案不会迁移也不会补全。所以面试聊"Next 怎么做 i18n"，第一句就该报路线：

1. **next-intl**（社区事实标准，App Router/RSC 深度适配）；
2. 自制：`[locale]` 段 + context + JSON 字典（学习原理值得走一遍）；
3. Linguijs / react-i18next + 手写接线（存量方案搬运）。

本课以 next-intl 为主线，思路上三个方案共享。

## 二、URL 结构：[locale] 路由段

```
app/
  [locale]/
    layout.tsx        # 挂 NextIntlClientProvider + html lang={locale}
    page.tsx          # /zh、/en、/ja 都是它
    about/page.tsx
messages/
  zh.json  en.json    # { "home": { "title": "…" } }
i18n/request.ts       # getRequestConfig：按 locale 动态 import 对应字典
```

```ts
// 目的：[locale] 段根布局—每种语言全预渲染，服务端拿字典喂给 Provider
// app/[locale]/layout.tsx
export function generateStaticParams() {          // ✅ SSG：每种语言全预渲染
  return ['zh', 'en'].map(locale => ({ locale }))
}
export default async function Root({ children, params: { locale } }) {
  const messages = await getMessages()            // ✅ 服务端拿字典（不下发全量 JSON 给浏览器）
  return (
    <html lang={locale}>                          {/* ✅ lang 随 locale 变，SEO/无障碍受益 */}
      <body><NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider></body>
    </html>
  )
}
```

```ts
// 目的：无语言前缀的 URL 按偏好重定向（语言协商放 middleware，第一道闸口）
const preferred = negotiate([...locales], req.headers.get('accept-language'))   // ✅ 读 Accept-Language 协商
return NextResponse.redirect(new URL(`/${preferred}${path}`, req.url))  // ✅ /about → /en/about
// ❌ matcher 忘排除 _next/static/图标等静态路径 → 每个静态请求都跑协商+重定向逻辑（白白耗 Edge 预算）
```

matcher 记得排除 `_next/static`、图标等静态路径（next-middleware-auth 学过的老纪律）。

## 三、翻译双层：服务端 getTranslations、客户端 useTranslations

```tsx
// 目的：翻译双层——能服务端翻的绝不下沉客户端（字典不进 bundle）
// 服务端组件（RSC 默认）—— 翻译不进 bundle，零 JS 成本
import { getTranslations } from 'next-intl/server'
export default async function Home() {
  const t = await getTranslations('home')   // ✅ 服务端翻好→直接输出 HTML
  return <h1>{t('title')}</h1>
}

// 客户端组件 —— hooks 版，吃 Provider 里的 messages
'use client'
import { useTranslations } from 'next-intl'
const t = useTranslations('cart')   // ✅ 仅交互文案（按钮 toast/动态校验）才走这条
// ❌ 把所有静态文案都塞进客户端组件用 useTranslations → 字典 JSON 全量下发，浏览器白背体积
```

分层纪律（RSC 边界在 next-server-client 讲过，这里复用）：**能服务端翻的绝不下沉客户端**——服务端翻译结果就是渲染好的 HTML，浏览器不背字典 JSON；只有交互文案（按钮 toast、动态校验提示）才经 Provider 下发。`t('items', { count })` 复数与 vue-i18n 的管道语法同底层——都是 CLDR plural categories（01-es Intl.PluralRules 的又一副面孔）。

## 四、SEO 收尾：hreflang 与多语言 sitemap

next-metadata 预告过的 `alternates.languages` 现在补全：

```tsx
// 目的：hreflang 互引 + 自引用，每种语言页都被 Google 归为同一内容的不同语言
export async function generateMetadata({ params: { locale } }) {
  const t = await getTranslations({ locale, namespace: 'meta' })
  return {
    title: t('title'),
    alternates: { canonical: `/${locale}`, languages: { 'hreflang': 'x-default', zh: '/zh', en: '/en' } },   // ✅ 含自我引用
  }
}
// ❌ 缺自引用（只列别的语言不写自己）→ Google 会忽略整组 hreflang
```

- 每种语言页面**互设 hreflang 且自我引用**（缺自引用 Google 会忽略）；
- sitemap.ts 把同一页的所有语言 URL 全列出；
- 语言前缀进 URL（而非 cookie 记忆）正是 SEO 的前提——爬虫只认 URL 不认你的会话（呼应 next-metadata"爬虫可见性"一节）。

## 五、切换器与三框架对照

```tsx
// 目的：语言切换器—next-intl 劫持 useRouter/usePathname，保留当前页只换语言段
'use client'
import { useLocale, usePathname, useRouter } from 'next-intl'
function Switcher() {
  const locales = ['zh', 'en'], locale = useLocale()
  const router = useRouter(), pathname = usePathname()   // ✅ pathname 不含语言段，正合适
  return <select value={locale} onChange={e => router.replace(e.target.value, { locale: e.target.value })}>   // ✅ 切语言不丢位置
    {locales.map(l => <option key={l}>{l}</option>)}
  </select>
}
// ❌ 误用原生 next/navigation 的 usePathname（它含语言段）→ 拼接时语言段重复，跳转出错
```

注意 next-intl 劫持了 `useRouter/usePathname`（保留当前页只换语言段）——这就是"切语言不丢位置"一行搞定的原因。横向对照收束三包：vue-i18n（路由自己接）、**next-intl**（本关）、@nuxtjs/i18n（框架级模块，08-nuxt 专关）——机制各表一枝，**CLDR/复数/整句翻译/错键不错文**四条纪律三家通用。

## 自检清单

- [ ] 说得出 App Router 不用内置 i18n 配置的原因与三条替代路线。
- [ ] [locale] 段 + generateStaticParams + middleware 协商三件套各管什么。
- [ ] getTranslations 与 useTranslations 的分层纪律讲得清。
- [ ] hreflang 互引 + 自引用、sitemap 多语言 URL 两条 SEO 线齐。
- [ ] 切换器为什么"不丢当前页"——usePathname 语言段语义。

---

## 🚀 部署预告

- 本关回收 **next-metadata** 的 hreflang 伏笔，L6 至此真正完整：样式、字体、图片、收录、多语言五件套；
- 字典按 locale 动态 import 的瘦身思路，与 **next-perf** 的 bundle 分析同一战场（messages JSON 也是体积）；
- cookie 记忆偏好 vs URL 前缀的取舍，自托管多实例下无差别——URL 方案对 CDN 缓存也更友好（**next-deploy** 见）；
- 下一关进入 **L7 next-perf**：把 L6 五件的零散收益汇成 Core Web Vitals 作战图。
