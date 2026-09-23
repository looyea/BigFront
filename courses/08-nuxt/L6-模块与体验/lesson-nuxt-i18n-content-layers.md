# 实战三件套：i18n、Content 与 Layers

> 目标：把 nuxt-modules 关只点了名的三大生态支柱真正落地——@nuxtjs/i18n（框架级多语言，对照 next-i18n 的手工组合）、@nuxt/content（文件即 CMS）、Layers（项目继承体系）。三者共同的关键词是"**约定收编**"：Next 生态要自己接线的东西，Nuxt 模块直接变成配置项（呼应 nuxt-seo-meta、vue-use-i18n、next-i18n）。

---

## 一、@nuxtjs/i18n：五分钟的 Next 一小时

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n'],
  i18n: {
    locales: [
      { code: 'zh', language: 'zh-CN', file: 'zh.json', name: '简体中文' },
      { code: 'en', language: 'en-US', file: 'en.json', name: 'English' },
    ],
    defaultLocale: 'zh',
    strategy: 'prefix_and_default',     // 五种形态见下
    baseUrl: 'https://demo.dev',         // hreflang 绝对地址的来源
  },
})
```

`i18n/locales/zh.json` 放字典，页面里 `const { t } = useI18n()`（vue-i18n 的组合式 API 原班人马，vue-use-i18n 所学直接复用）。**strategy 五档**是面试点：`no_prefix` / `prefix` / `prefix_except_default`（/about 与 /en/about）/ `prefix_and_default` / `no_prefix`+domains 子域模式（每语言一个域名）。模块自动办妥的事清单：**语言前缀路由重定向（Accept-Language 协商）、hreflang 标签注入、`vue-i18n` 依赖装配、路由本地化（每语言一条 route 记录）**——next-i18n 里 middleware+alternates 手工拼的全套，这里一个 modules 数组项。

切换器两件套：`switchLocalePath('en')`（当前页换语言段，等价 next-intl 的 locale 导航）、`localePath('about', 'en')`。复数/日期数字仍走 vue-i18n 的 CLDR 管线（`n()`/`d()`，01-es Intl 底层）——框架模块不同，**整句翻译、错键不错文四条纪律三家通用**。

## 二、@nuxt/content v3：文件即数据库

```ts
// content.config.ts —— 集合 = schema + 来源目录
import { defineContentConfig, defineCollection, z } from '@nuxt/content'
export default defineContentConfig({
  collections: {
    docs: defineCollection({
      type: 'page',                       // page（有 slug 可路由）或 data（纯数据）
      source: 'docs/**',                  // content/ 下 glob
      schema: z.object({ title: z.string(), tag: z.enum(['guide', 'api']) }),
    }),
  },
})
```

```vue
<script setup>
const { data: posts } = await queryCollection('docs')
  .where('tag', '=', 'guide').order('date', 'desc').limit(5).all()
</script>
<template>
  <ContentRenderer v-for="p of posts" :key="p.id" :value="p" />   <!-- Markdown → Prose 组件渲染 -->
</template>
```

分工记牢：**`queryCollection` 管列表（server route 里也能用），页面头部 `useRouteContent()` 管当前篇**（含前后导航 `navigateContentCollection`）。`npx content-ui` 拉起本地 **Content Studio** 看数据、改 markdown 即时预览。v2→v3 的口径更新：`queryCollection`（单数链式）替代旧 `$collections` 复数参数——网上老教程是坑源。对照 Next 生态的 contentlayer/MDX：能力同位，但 Content 是**运行时查询**（dev 内存 SQLite、build 后文件库），改 markdown 不用重启构建（呼应 next-fullstack-project 里 contentlayer 的位置）。

## 三、Layers：Nuxt 的"项目继承"

```
design-system/          # 一个层：组件+composables+nuxt.config 增补
  nuxt.config.ts        # css、alias、hooks…（会被合并进主项目）
  components/Button.vue
  composables/useTheme.ts
apps/web/
  nuxt.config.ts        # extends: ['@acme/design-system', 'ui']  ← 数组序=优先级链
  pages/index.vue       # 自动层感知：Button 无需注册直接用
```

方向别答反：**主项目 extends 层（层是被继承的底座）**，链上后者优先覆盖前者（可覆盖组件/页面/composable——覆写即定制）。与模块的分界一句话：**模块=逻辑钩子（npm 库带 setup 钩子改构建），层=完整目录（文件即约定，页面组件都能带）**；层内部可以用模块。经典用法：公司主题包、多租户白标（同一 core 层 + 每租户一薄层换 logo/配色/页面）、monorepo 里"示例站即产品"（docs 层嵌框架本体）。与 Next 对照：无 RSC 边界约束的 Nuxt 用"目录继承"表达复用，Next 侧靠 monorepo + 包导出——机制不同，都治"多站共享一份骨架"。

## 四、三件套的合体剧本

文档站最典型：Layers 出品牌底座（导航/页脚/设计 token）→ i18n 模块管中英双语路由与 hreflang → Content 集合管 markdown 文档（每语言一个 source glob 或 data.path 分目录）。三者全部**声明进 nuxt.config 即生效**——这就是"Nuxt 把默认答案写进框架"哲学的具体形态（next-i18n iv10 的总结在此闭环）。

## 自检清单

- [ ] strategy 五档各产生什么 URL 形态，默认推荐哪档。
- [ ] @nuxtjs/i18n 自动办妥的事，能对着 next-i18n 手工清单逐条打勾。
- [ ] page 与 data 集合的区别；queryCollection 链式 API 会写。
- [ ] extends 的方向与数组优先级说得清，和"模块"的分界一句话。
- [ ] 文档站三件套剧本能画架构图。

---

## 🚀 部署预告

- i18n 的 hreflang 由模块注入，但 **canonical/OG 本地化**仍要手查——回扣 **nuxt-seo-meta** 与 **next-i18n** 第四节的三重坑；
- Content 生产部署两种姿势：dev/test 内存 SQLite、build 时预查询落文件库——SSG 下与 **nuxt-render-modes** 的 prerender 串联；
- Layers 的租户白标在 CI 里=同一 core 多次 build，产物与 **nuxt-deploy** 的 preset 矩阵正好组合；
- 下一关进入 **L7 nuxt-perf**：route rules 缓存、payload 瘦身与 bundle 分析——三件套装完该量体重了。
