# L2 阶段作业：路由进阶

> 覆盖：kit-dynamic-routes / kit-route-matchers / kit-navigation-preload

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**
```
src/routes/docs/[...path]/[[version]]/+page.svelte
```
需求是"版本号可选、其后任意深度"。访问 /docs/guide 时 [[version]] 永远为空。为什么？

**Bug 2**
```ts
// src/params/numeric.ts
export const match = (param: string): boolean => {
  return /^[0-9]+$/.test(param);
};
```
目录用了 `[id=number]`，路由从不匹配。两处错在哪？

**Bug 3**
```svelte
<a href="/about" data-sveltekit-preload-code="tap" data-sveltekit-preload-data="hover">About</a>
```
同事说"tap 档代码预取没生效，属性坏了"。用官方规则解释这不是 bug。

**Bug 4**
同层存在 `src/blog/[slug]` 与 `src/blog/[category]` 两个路由，你期望 /blog/tech 进 category、其余进 slug，实际全部进了 category。排序规则哪一条在起作用？给出两个修复方向。

**Bug 5**
```
src/routes/(marketing)/pricing/+page.svelte
```
上线后 /marketing/pricing 404、/pricing 正常——有同事坚称"(marketing) 会在 URL 里出现"。谁对？

**Bug 6**
```ts
// src/params/tenant.ts
import { env } from '$env/dynamic/private';
export const match = (param: string) => param === env.TENANT;
```
评审一票否决。给出否决理由（提示：执行时机与数据来源）。

**Bug 7**
```svelte
<a data-sveltekit-noscroll href="/faq#q3">跳到问题 3</a>
```
期望"别滚回顶部"，实测点了之后页面纹丝不动连锚点都不去。noscroll 的实际语义是什么？此场景正确做法？

**Bug 8**
搜索结果用 `{#if}` 动态渲染，链接带 `data-sveltekit-preload-code="viewport"`，DevTools 里从没看到提前拉 chunk。解释官方设限的原因，并给出替代方案的关键 API 名。

**Bug 9**
`src/routes/users/[id]/+page@.svelte` 的意图是"跳过 users 层布局、保留根布局"，但同事把它重命名成了 `+page@users.svelte`，说"效果一样"。一样吗？

**Bug 10**
给 `/orders/[id]` 加了 `id=uuid` matcher 后，投放中的短链 `/orders/latest` 全线 404。解释失配后的完整路由裁决链，给出两种修复。

## 二、手写题（5 题）

**手写 1** 写出 `src/params/slug.ts`：小写字母数字连字符、必须以字母开头、总长 ≤64，使用 satisfies ParamMatcher 姿势；并写配套的 `slug.test.ts` 至少 4 个断言（含一个边界：恰好 64 字符）。

**手写 2** 用路由结构表达：`/shop`（列表）、`/shop/any-page-number`（`[[page=positiveInteger]]` 可选段）、`/shop/category/...任意深度`（rest + matcher 拒绝 `..` 段）——画出 src/routes 下的目录树（含 matcher 文件位置）。

**手写 3** 写 `src/routes/docs/[...path]/+page.ts` 的 load：rest 为空时 redirect(307, '/docs/home')；含非法段（用你手写 1 的校验逻辑）时 throw error(404)；合法时返回 { segments }。throw 的两个 API 从哪导入写清楚。

**手写 4** 在一个父容器上配置："本区域内所有链接默认 hover 预取数据"；其中一个高防误触的按钮区豁免为只 tap 预取数据但仍 hover 预取代码——只用 data-sveltekit-* 属性写出这两层。

**手写 5** 用 `$app/navigation` 实现：搜索下拉渲染后（Svelte 5 用 $effect 或 afterNavigate 思路均可），对前 5 条结果调用 preloadCode；点击某条时不 await、直接 goto。5-10 行内完成。

## 三、场景题（1 题）

多语言文档站需求：`/en/...`、`/ja/...` 两套内容共用一套页面组件；`/` 要按浏览器语言 302 到对应前缀；非法前缀 `/fr/...` 要进一个带布局的"语言不支持"页而不是裸 404；所有 `/zh/old/*` 历史链接整段重定向到 `/en/`。给出完整方案：(group) 要不要用、[[lang]] 还是 [lang]、matcher 挂哪、302 与历史重定向各放哪个文件、"语言不支持"页靠什么机制保住布局。画出目录树。

## 四、简答题（3 题）

**简答 1** 背写官方路由排序四规则，并用 foo-abc / foo-[c] / [[a=x]] / [b] / [...catchall] 五路由例子说明 /foo-def 的最终归属与理由。

**简答 2** data-sveltekit-preload-data 与 preload-code 的档位集合为何不同（两档 vs 四档）？"只有更激进才有效"规则的底层原因是什么？saveData 用户面前两者行为如何？

**简答 3** "matcher 管格式、load 管存在"——用 /blog/[slug] 与 /orders/[id] 两个例子把这句话展开成 80 字以内的分工说明书，并说明 matcher 失配与 load throw error(404) 在 handleError 统计上的可见性差异。

## 五、挑战题 🏆

为文档站实现**布局级越级演练**：`(app)` 组提供全站侧边栏布局，`/canvas/*` 子树要求完全无壳（连根布局的 header 都不要，但保留根布局里 `{@render children()}` 位置外的样式容器），`/app/settings/preview` 单页要求只吃 (app) 层布局不吃 settings 子层布局。用 +layout@、+page@、组外放置三种手段的组合达成，写清每个文件为什么选这个后缀；再反向论证：如果全站只有 canvas 一个例外，用 (group) 重构和单文件 @ 重置哪个更可取（引用官方"when to use layout groups"的立场）。

---

**本阶段关键词**：rest 空匹配、optional 禁区、排序四规则、字母序 tie-break、(group) 透明性、+page@ 重置、ParamMatcher、satisfies、双端执行、排序兜底链、preload-data 两档、preload-code 四档、更激进才有效、saveData、"false" 豁免、rel=external、preloadCode 通配、beforeNavigate cancel

**判分口径**：Bug 每题 3 分、手写每题 7 分、场景 20 分、简答每题 5 分、挑战加分 10 分（总分 100+10）。≥72 为合格；挑战题写出任意两种 @ 后缀组合即给 4 分，含官方立场引用再 +6。

交卷后自评三道小测各对 ≥5 题视为过关。

🚀 **下一站 L3**：kit-load-universal——load 函数全解：event 全家桶、依赖追踪、fetch 透传与两级 load 共存契约。
