# L7 作业：性能、错误处理与测试

> 覆盖关卡：nuxt-perf / nuxt-error-debug / nuxt-testing。五段式 20 题。

## 第一段：读代码找 Bug（10 题）

**题 1**
```ts
// nuxt.config.ts
routeRules: {
  '/app/**': { swr: 60 },   // /app 页面 await useFetch('/api/me') 读 cookie
}
```
用户反馈"看到别人的待办列表"。指出这是性能问题还是安全问题，为什么，怎么改。

**题 2**
```vue
<script setup>
const [{ data: a }] = [await useFetch('/api/a')];
const [{ data: b }] = [await useFetch('/api/b')];   // 与 a 无依赖
const [{ data: c }] = [await useFetch('/api/c')];   // 与 a/b 无依赖
</script>
```
SSR TTFB 约等于三个接口耗时之和。改成并发并解释为什么 SSR 阶段串行这么贵。

**题 3**
```ts
const { data } = await useFetch('/api/list');       // list 有 2 万条
```
首屏 HTML 里 `__NUXT__` 有 3MB，LCP 很差。给出三种不同层面的收敛手段（提示：pick/transform、分页、store 下沉）。

**题 4**
```vue
<!-- 页面 LCP 元素 -->
<ClientOnly>
  <BigHeroImage src="/hero.jpg" />
</ClientOnly>
```
实测 LCP 4.2s。解释 ClientOnly 为什么拖垮 LCP，改法保留"仅客户端交互"的诉求。

**题 5**
```ts
// server/api/user.get.ts
export default defineEventHandler(async (e) => {
  try { return await db.find(e); }
  catch (err) { return createError({ statusCode: 500, message: err.stack }); }
});
```
安全扫描判定"信息泄露"。指出两处问题（一处关于返回 stack、一处关于把 500 直接抛给可索引页而不降级），修正。

**题 6**
```vue
<!-- app/error.vue -->
<template><div>{{ error.message }}<pre>{{ error.stack }}</pre></div></template>
```
生产环境用户看到了含 SQL 片段与文件路径的报错。说明为什么不能这样，给出正确的 error.vue 显示策略。

**题 7**
```ts
useFetch('/api/data', { onRequest: ({ request }) => { if (401) showError('未登录') } });
```
用户偶发被弹到错误页、丢失正在填的表单。为什么 401 不该走错误页？给出正确的统一处理路径。

**题 8**
```ts
// vitest 用例
import { mount } from '@vue/test-utils';
const w = mount(AsyncList);           // AsyncList 的 setup 里有顶层 await useFetch
expect(w.text()).toContain('条目');    // 失败：空
```
说明普通 mount 遇到异步 setup 为什么拿到空，改用什么 API。

**题 9**
```ts
await setup({ server: true });
const res = await $fetch('/api/articles/999');   // 期望测 404
```
测试直接 reject 报错、断言没写成。改用正确断言写法，并说明这里其实测到了 createError 的契约。

**题 10**
```ts
// e2e：证明 SSR 直出
await page.goto('/');
expect(await page.locator('h1').textContent()).toBe('标题');   // 永远绿
```
这条用例在 ssr:false 下也过。为什么？改成能真正区分 SSR/水合的断言。

## 第二段：手写编程（5 题）

**题 11**
给一个博客详情页设计性能方案并写出关键代码：`routeRules`（详情用 isr、列表用 swr、后台 no-store）、主图 `<NuxtImg>` preload + 其余 lazy、`useFetch` 用 `pick` 只取正文与元数据。逐项标注它优化了 LCP/INP/CLS/HTML 体积中的哪一项。

**题 12**
写一个全站错误上报插件 `plugins/error-reporting.ts`：监听 `vue:error` 与 `app:error`，把 `{ statusCode, url, requestId, userAgent }`（不含 stack 与隐私）POST 到 `/api/collect`；服务端 `server/api/collect.post.ts` 做体积上限与 Origin 校验。说明生产为何只上报脱敏字段。

**题 13**
写 `test/server/todos.spec.ts`（`@nuxt/test-utils/e2e` + `$fetch`）四条断言：创建返回 201、列表返回数组、访问不存在返回 404、未带 cookie 访问 `/api/todos/mine` 返回 401。并说明为什么这属于"集成契约测试"。

**题 14**
写一条 Playwright e2e：以"禁用 JS"上下文访问 `/blog/hello`，断言标题与正文存在于第一份 HTML（守 SSR 直出与 SEO），再断言 `/app` 未登录被重定向到 `/login?redirect=` 且 redirect 为站内路径。

**题 15**
为一个依赖外部汇率 API 的页面写可控测试：把调用收敛到 `server/api/rate.get.ts`，用 `runtimeConfig` 指向可切换的 base；测试里 stub 三种情况（成功/超时/500），断言页面分别显示汇率/兜底旧值/降级提示。给出 stub 与断言代码。

## 第三段：场景设计（1 题）

**题 16**
给一个内容站设计"性能 + 错误 + 测试"三位一体的上线方案：
- 关键页（首页/详情/落地页）的渲染与缓存策略及各自预算指标（LCP/HTML 体积/JS 体积阈值）；
- 上游 CMS 偶发故障时的降级链路（软失败返回缓存旧内容、何时才允许进 error.vue、对 SEO 的状态码考虑）；
- 三类自动化用例分工（单测/集成/e2e 各覆盖什么），特别是哪些"跨边界"断言必须有（SSR 直出、私有页 no-store、错误契约）；
- CI 门禁清单（prepare → 单测 → 集成 → Lighthouse CI → 体积预算 → e2e 冒烟），以及 flaky 治理原则；
- 如何用真实数据（CrUX/RUM + 5xx 率）持续验证，而非只看实验室分。

## 第四段：简答（3 题）

**题 17**
分别说明 `useFetch.error`、`showError`、`useError`、`error.vue`、`onErrorCaptured` 的职责层级，并给出"一个可重试的列表加载失败"与"一个不可恢复的根级崩溃"分别该用哪个。

**题 18**
Nuxt 里 payload、内联样式、懒加载路由三者都会影响首屏，各自的主要代价是什么？你在"内容站"与"重交互后台"分别怎么取舍？

**题 19**
为什么"起真实 Nitro 测 server route"不能"只靠直调 handler"完全替代？两种测法各自能发现什么类型的问题？

## 第五段：挑战题（1 题）

**题 20** 🏆
为 08-nuxt 的示例全栈应用建立"改不坏"的安全网并做一次性能攻坚：
- 分层测试全覆盖（utils 单测 / 组件 mountSuspended / server route 集成 / 关键流程 Playwright），至少各一条真实断言；
- 三条"SSR 框架专属"回归：首屏 HTML 直出、水合前后关键 class 一致、私有路由 `no-store`；
- 用 `--analyze` + Lighthouse 找出 3 个瓶颈并逐一修复（附修复前后数字：LCP/INP/CLS/HTML 体积/主包 JS）；
- 把上面的阈值写成 CI 的 resource budget 与 Lighthouse CI 卡点，超标即失败；
- 最后回答：当一条 e2e 在 CI 偶发失败而本地必过时，给出你完整的排查—定位—处置决策树（不允许 retry-to-pass）。
