# L8 阶段作业：类型、测试与排障

> 覆盖：kit-typescript / kit-testing / kit-debug-playbook

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**
```jsonc
// tsconfig.json
{ "compilerOptions": { "strict": true } }   // 没 extends 生成物
// src/routes/blog/[slug]/+page.server.js
/** @type {import('./$types').PageServerLoad} */   // 这里 $types 一片红
```
`./$types` 解析不到。指出缺了哪一行配置、它提供了哪个让 `$types` 可被相对 import 的选项。

**Bug 2**
```ts
import { PageData } from './$types';        // 值导入一个类型
let { data }: { data: PageData } = $props();
```
`vite build` 报 `PageData is not exported` / 运行期 import 失败。结合生成 tsconfig 里的 `verbatimModuleSyntax` 指出正确写法。

**Bug 3**
```ts
// 路由：src/routes/[[lang]]/about/+page.server.js
export function load({ params }) {
  return { upper: params.lang.toUpperCase() };   // 访问 /about 时崩
}
```
生成的 `RouteParams` 里 `lang` 到底是什么类型？指出崩因与修法。

**Bug 4**
```ts
// 路由：src/routes/item/[id=numeric]/+page.server.js
export const prerender = true;
export function load({ params }) {
  return { next: params.id + 1 };   // 想要 5+1=6
}
```
访问 `/item/5` 得到 `next === "51"`。指出对 matcher 的误解与正确写法。

**Bug 5**
```ts
// src/app.d.ts
declare global {
  namespace App {
    interface Locals { user: { id: string } | null }
  }
}
// 末尾的 export {} 被"清理无用代码"删掉了
import type { Session } from '$lib/server/session';   // 现在这行报错
```
为什么删掉 `export {}` 后 `app.d.ts` 里就不许写 `import` 了？给修法（含该放哪）。

**Bug 6**
```ts
// Counter.svelte.test —— 组件测试
import { render } from '@testing-library/svelte';
test('标题渲染', () => {
  render(Counter);                          // 运行报 document is not defined
});
```
指出组件测试的环境配置缺失（两件事），说明各自作用。

**Bug 7**
```ts
// multiplier.test.ts （注意文件名没有 .svelte）
import { expect, test } from 'vitest';
import { multiplier } from './multiplier.svelte.js';
test('自增', () => {
  let n = $state(0);   // 编译失败
  ...
});
```
测试文件里 `n = $state(0)` 编译不过。指出与文件名相关的规则与最小修法。

**Bug 8**
```ts
// 想在单测里覆盖不同数据库连接串
process.env.DATABASE_URL = 'postgres://test';
import { DATABASE_URL } from '$env/static/private';   // 仍是构建时那个值
```
为什么改了 `process.env` 但 `DATABASE_URL` 没变？给出两种让该值"可测"的改造方向。

**Bug 9**
```ts
// src/routes/user/[id]/+page.server.js
export async function load({ params, fetch, depends }) {
  depends('data:user');
  const u = await (await fetch(`/api/user/${params.id}`)).json();
  await invalidate('data:user');   // "刷新一下保证最新"
  return { u };
}
```
页面越点越卡、`/api/user/:id` 请求风暴。指出 `invalidate` 的误用与正确触发时机。

**Bug 10**
```svelte
<!-- +page.svelte -->
<script>
  import { page } from '$app/state';
  let now = new Date().toLocaleTimeString();   // 想在页眉显示当前时间
</script>
<span>{now}</span>
```
生产 build+preview 下控制台报 `Hydration failed`。指出根因（SSR vs 首帧）与修法方向（两种）。

## 二、手写题（5 题）

**手写 1** 给 `src/routes/blog/[slug]/+page.server.js` 写端到端类型：`import type { PageServerLoad } from './$types'`，`load` 用 `params.slug`（带类型）查库返回 `{ post }`；再在 `+page.svelte` 用 `PageProps`（2.16+）拿到带类型的 `data.post`。两处一起给。

**手写 2** 在 `src/app.d.ts` 声明 `App.Locals = { user: { id: string; name: string } | null }` 与 `App.Error = { message: string; code?: string }`；写一段 `hooks.server.js` 的 `handle`：从 cookie 解析 user 赋给 `event.locals.user`（此时应带类型、需判 null）。

**手写 3** 用 Vitest 给一个 action 写单测：桩 `request.formData()` 返回缺 email 的表单，调用 `actions.default(event)`，断言返回 `fail` 的形状（`status===400` 且 `data.fieldErrors.email` 存在）。说明为何"直接 import action 传桩 event"就够、不需要起浏览器。

**手写 4** 写 `playwright.config.js`（`webServer.command: 'npm run build && npm run preview'`、`port: 4173`、`testDir`）+ 一条登录黄金路径 spec：`page.goto('/login')` → 填错密码 → 断言停在登录页且出现错误文案；再填对 → 断言跳到 `/dashboard`。注释为何用 preview 而非 dev。

**手写 5** 写一个"负责又不吞控制流"的服务端 `handleError`：用 `isRedirect(error)`/`isHttpError(error)` 判出后**原样重抛**；真·未预期异常则 `console.error(event.url, error)` 并 `return { message: 'Internal Error' }`（形状匹配 App.Error）。

## 三、场景题（1 题）

一个中大型 SvelteKit 后台在 CI 里同时冒出三类怪事，逐条给排查与预防：
① **类型全红**：新同事 clone 后 IDE 里所有 `./$types` 报错——先怀疑什么、跑什么命令恢复、CI 里该保证哪步先生成 types；
② **偶发水合失败**：某页用了 `new Date()` + `Math.random()` 生成的邀请码，build+preview 的 e2e 时不时报 `Hydration failed`——定位两端不一致来源并给两种修法；
③ **某详情页无限请求**：一个 load 边 `fetch('/api/x')` 边 `invalidate('data:x')`——画出自依赖环并改对；
④ 这三类里哪些能在**单测/组件测**阶段拦下、哪些**只有 e2e**能发现？据此给一份"下大上小"的测试分层清单；
⑤ 团队想把 `$env/static/private` 的密钥彻底挡在客户端外——现有哪两道 Kit 内置防呆（构建期报错的机制）？分别针对什么误用；
⑥ 若某 universal `+page.js` 里 `import { db } from '$lib/server/db'`，`vite build` 会怎样？给正确换通道方案；
⑦ 给出一条能防"水合回归"复发的 CI 组合策略（build+preview e2e 跑几条黄金路径 + 关键页 SSR HTML 快照比对）。

## 四、简答题（3 题）

**简答 1** 各用一句话区分 `PageData`、`ActionData`、`PageProps`，并说明 `PageProps` 比 `PageData` 多带什么、从哪个版本起可用。

**简答 2** 说清三处抛错各自落点与是否经 `handleError`：`handle` 里 `resolve` 之外抛错、load/action 抛未预期错、`error()` 抛预期错。

**简答 3** 画 `$env` 的 2×2（static/dynamic × private/public）：哪些构建期被静态替换、哪些禁止进客户端代码、哪些值测试里好喂假值，各给一句理由。

## 五、挑战题 🏆

**"CI 里的薛定谔失败"**：某 `+page.server.js` 的 load 里有 `const now = Date.now()` 并 `return { now }`；`+page.svelte` 首帧直接渲染 `{now}`；同路由另一个 universal load 里既 `fetch('/api/user/'+id)`、又 `invalidate('user:'+id)`。诡异现象：本地 `vite dev` 一切正常，CI 的 build+preview e2e 却**偶发** `Hydration failed`，且**偶发** `/api/user/:id` 请求风暴。请推演：
(a) `now = Date.now()` 如何造成水合失配（SSR 算一次、水合再算一次）？给两种修法（服务端定值下发 vs 首帧占位 effect 后填）；
(b) 定位那个请求风暴的自依赖环（谁 fetch 谁 invalidate、key 撞在哪），改成正确的触发时机；
(c) 为什么 **dev 不暴露、build+preview 才暴露**（模块图/水合/时序差异），这对你选 e2e 环境有何指导；
(d) 设计一套防回归组合：一条 Playwright e2e（跑 build+preview、断言无 hydration 报错）+ 一条单测（把 load 抽成可测函数、桩 event 断言 `now` 由入参决定而非 `Date.now()`），说清各自挡住哪类退化。

---

**本阶段关键词**：generated types、RouteParams 按目录生成、./$types、rootDirs、tsconfig extends .svelte-kit/tsconfig.json、verbatimModuleSyntax/isolatedModules/noEmit、PageData/LayoutData/ActionData、PageProps/LayoutProps(2.16+)、App 命名空间(Locals/Error/PageData/PageState/Platform)、export {}、rest=string/optional=string|undefined、matcher 不改类型、Vitest、jsdom+resolve.conditions browser、.svelte 才能用 runes、vi.mock $app/*、纯函数红利、$env/dynamic 比 static 易测、Playwright webServer build&&preview:4173、hydration mismatch 五根因、别 catch 吞 redirect/error、load 死循环 invalidate 自依赖、$lib/server 客户端禁引、$env/private 客户端禁引、load 返回值序列化进 HTML

**判分口径**：Bug 每题 3 分、手写每题 7 分、场景 20 分、简答每题 5 分、挑战加分 10 分（总分 100+10）。≥72 为合格；挑战题答出 (a)(b) 即得 4 分基础分，(c)(d) 各 +3。

交卷后自评三道小测各对 ≥5 题视为过关。

🚀 **下一站 L9**：kit-internals——解剖整车：构建期 nodes/matchers manifest、resolve 的匹配-加载-渲染流水线、SSR 时 render() 的调用位点、客户端导航为何是"load + 局部重渲"。
