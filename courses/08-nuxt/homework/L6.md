# L6 作业：模块、SEO 与样式

> 覆盖关卡：nuxt-modules / nuxt-seo-meta / nuxt-styling。五段式 20 题。

## 第一段：读代码找 Bug（10 题）

**题 1**
```ts
// modules/analytics/index.ts
import TrackerBanner from './runtime/components/TrackerBanner.vue';
export default defineNuxtModule({
  setup() {
    addComponent({ name: 'TrackerBanner', global: true });  // ← 直接把组件 import 进来
  },
});
```
构建报 "Cannot find module 'vue'"。指出构建期/运行期代码混淆之处，给出正确的注册写法（两处改动）。

**题 2**
```ts
export default defineNuxtModule({
  meta: { name: 'my-mod' },
  defaults: { enable: true },
  setup(options) {
    if (!options.enable) return;
  },
});
```
用户在 nuxt.config 里写 `myMod: { enable: false }` 却仍然生效。指出缺了哪个字段（并说明它同时影响冲突提示与类型 augmentation）。

**题 3**
```ts
// 某模块 setup 内
nuxt.hook('nitro:config', (cfg) => {
  cfg.handlers.push({ route: '/api/health', handler: '~/server/health.ts' });
});
```
本地 dev 正常，生产 404。说明 handler 路径应如何解析（两个常见错法）。

**题 4**
```vue
<script setup>
const { data } = await useFetch('/api/seo');
onMounted(() => useSeoMeta({ title: data.value.title }));
</script>
```
分享卡片的 title 一直是默认值。给出两个错误点（时机 + 响应式写法），并改正。

**题 5**
```ts
useHead({ link: [{ rel: 'canonical', href: '/docs/intro' }] });
```
站点在 www / 裸域 / 预发三个域名同时被收录，权重分散。指出 canonical 的写法问题并给出按环境正确的实现（含环境变量名）。

**题 6**
```
User-Agent: *
Disallow: /
```
```ts
useSeoMeta({ robots: 'noindex' });
```
上线半年后后台路径仍出现在搜索结果（仅标题）。解释 robots.txt 与 noindex 的相互关系，给出正确组合。

**题 7**
```vue
<style>
/* pages/admin/index.vue 内，无 scoped */
body { background: #f5f5f5; }
.btn { color: red; }
</style>
```
访问过后台后，官网首页按钮变红。说明成因与两种修复。

**题 8**
```html
<div class="{{ type === 'ok' ? 'text-green' : 'text-red' }}-500">
```
某些状态下文字颜色丢失。指出原子化 CSS 的扫描机制导致的后果，改写成安全形态。

**题 9**
```ts
css: ['@ui-lib/theme.css', '~/assets/css/reset.css'];
```
reset 把 UI 库的按钮样式全冲掉了。给出最小改动修复方案，并说明 Nuxt 的注入顺序规则。

**题 10**
```ts
export default { features: { inlineStyles: true } };
```
预渲染站点首屏 HTML 从 30KB 涨到 180KB，且 CDN 命中率暴跌。解释内联样式的代价，给出两种缓解策略（不能简单关掉了事，需说明关掉的副作用）。

## 第二段：手写编程（5 题）

**题 11**
写本地模块 `modules/brand/`：接收 `{ logos: Record<string,string> }` 配置，注入自动导入的 `useBrand()`（运行期从 `runtimeConfig.public.brand` 读当前租户）与 `<BrandLogo>` 组件。给出目录结构、`index.ts` 与 runtime 文件的关键代码，并标注哪些是构建期、哪些是运行期。

**题 12**
为一个内容站补齐 SEO 基座：`app.vue` 的 titleTemplate 与 favicon、`pages/articles/[slug].vue` 的 useSeoMeta（全部字段用响应式函数 + 兜底）、JSON-LD（含用户投稿的转义处理）、canonical 来自 `runtimeConfig.public.siteUrl`。写出四处代码。

**题 13**
用 Nitro 实现 `/api/og?slug=xxx`：satori 生成 SVG、resvg 转 PNG，设置 `Content-Type`、`Cache-Control: public, max-age=86400, immutable`（URL 带内容哈希），并给超时/失败时 302 到 `/og-fallback.png`。说明为什么 OG 图要绝对 URL + PNG。

**题 14**
实现无闪烁暗色模式：`useCookie('theme')`、SSR 在 `<html>` 写 `data-theme`（通过 `useHead({ htmlAttrs })`）、`app.head.script` 内联同步脚本兜住客户端首帧、Tailwind `darkMode: 'class'`（或 v4 的 `@custom-variant`）。写出四段并说明顺序。

**题 15**
把富文本编辑器的重样式与组件从首屏剥离：给出 `components/RichEditor.client.vue` + 外层 `.client.css` + 异步导入的组合，并说明为什么 `<ClientOnly>` 包 `<style>` 是没用的。

## 第三段：场景设计（1 题）

**题 16**
跨境电商站（Nuxt 全栈，中英德三语言，50 万 SKU）要求：SEO 优先、OG 分享有图、后台不被收录、首屏 CSS 不能成为瓶颈。请给出：
- 页面分类表（首页/类目/详情/搜索/账户/后台）× 渲染模式（prerender/isr/ssr:false）× 索引策略（index/noindex/canonical/hreflang）；
- sitemap 方案（分片、按语言、更新频率、生成端点与缓存）；
- 样式分层方案（tokens / 原子层 / 组件库）与 `inlineStyles` 决策及依据指标；
- 需要自研哪些 Nuxt 模块（列出 configKey 与注入内容），哪些用现成模块（列出名字）；
- 上线后用什么数据证明"SEO 没退化"（至少 4 个指标）。

## 第四段：简答（3 题）

**题 17**
Vite 插件 / Nuxt 模块 / Nuxt Layer 分别适合解决什么问题？各举一例，并说明"改编译方式"和"改框架约定"的分界。

**题 18**
`useHead` 与 `useSeoMeta` 的差异、各自的典型字段、以及"为什么必须在 setup 同步阶段调用"。

**题 19**
内联样式（inlineStyles）与外部 CSS chunk 的性能/缓存/CSP 三方权衡，给出你在"内容站"与"后台系统"两种项目里的默认选择与理由。

## 第五段：挑战题（1 题）

**题 20** 🏆
写一个可发布的团队基础模块 `@acme/nuxt-platform`，一次性提供：
- `addImportsDir` 暴露 `useTracker/usePerfMark/useFlag`（三者的运行期实现放 `runtime/`）；
- `addServerHandler` 提供 `/api/collect`（批量埋点，带体积上限与来源 Origin 校验）与 `/api/flags`（swr 缓存，复用 L4 的缓存端点）；
- `addPlugin({ mode: 'server' })` 在 SSR 时注入 `x-request-id` 与埋点上下文，`mode: 'client'` 插件做性能上报（`onAfterRender` 时机，呼应 nuxt-lifecycle）；
- 自动 SEO 基座：通过 `pages:extend` + `addTemplate` 为每个路由生成默认 ogImage 与 canonical（可用 `site.url`）；
- 主题 CSS 注入与 `.client` 拆分能力（暴露 `styles` 选项）；
- 类型：`declare module 'nuxt/schema'` 让 `platform: {...}` 配置有提示；
- 最后回答三问：①模块被 20 个项目引用后，你要如何避免"一次改动引发全站构建期炸"（版本与兼容策略）；②如何在 CI 里回归"埋点没被 SSR 重复发送"；③如果构建机拿不到生产密钥，你的模块设计要遵守什么纪律？
