# L7 阶段作业：进阶专题（API / i18n / 导航状态）

> 覆盖：kit-api-design / kit-i18n-routes / kit-navigation-state

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**
```js
// src/routes/api/user/+server.js
import { json } from '@sveltejs/kit';
export async function POST({ request }) {
  const body = await request.json();
  return { ok: true, id: body.id };   // 想把结果直接 return
}
```
客户端拿到 500。指出返回契约错误，给最小修法（并说明 `json()` 帮你补了哪两个头）。

**Bug 2**
```js
// src/routes/api/admin/stats/+server.js
export async function GET({ url }) {
  const uid = url.searchParams.get('uid');
  if (uid !== '1') throw error(403, 'no');   // 用 query 里的 uid 判权
  return json(await stats());
}
```
任何人手敲 `?uid=1` 就越权。指出为什么不能用 `url`/query 判身份，给出正确的鉴权取数来源。

**Bug 3**
```js
// 只在开发验证了跨域：本地前端 fetch 本站 /api 一切正常
export async function OPTIONS() { return new Response(null, { status: 204 }); }
```
上线后跨域请求全被 CORS 拦。指出 dev 与 prod 的差异来源，给出生产真正要补的东西。

**Bug 4**
```js
// 部署在 AWS Lambda 上的 SSE 端点
export function GET() {
  const stream = new ReadableStream({ start(c){ /* 每隔 1s enqueue 一帧 */ } });
  return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
}
```
本地能逐条推、上 Lambda 后消息"攒一批一起到"。指出平台层面的限制与两条出路。

**Bug 5**
```js
export async function GET({ params }) {
  try {
    const row = await db.get(params.id);
    if (!row) throw error(404, 'Not Found');
    return json(row);
  } catch (e) {
    return json({ message: e.message }, { status: 400 });   // "统一兜底"
  }
}
```
本预期的 404 被自己的 catch 改成了 400、还吞掉了 SvelteKit 的错误处理。指出"别 catch 住 thrown error"的规矩与修法（`isHttpError` 判出后重抛）。

**Bug 6**
```js
// src/routes/api/feed/+server.js
export const prerender = true;
export async function GET({ url }) {
  return json(await feedFor(url.searchParams.get('user')));   // 预渲染端点读 query
}
```
构建期直接报错。指出 `prerender=true` 的端点为什么禁读 `searchParams`，给两种不同方向的修法。

**Bug 7**
```
src/routes/
└ [lang]/              # 想要 / 与 /en/ 都能开
  ├ about/+page.svelte
  └ +layout.server.js
```
结果访问 `/about`（无语言前缀）404。指出该把动态段改成什么写法，附带说明它为什么能让"缺省 lang"命中同页。

**Bug 8**
```js
// src/params/lang.js —— 想限制只认 en/zh
const valid = ['en','zh'];
/** @type {import('@sveltejs/kit').ParamMatcher} */
export function matchLang(p) { return valid.includes(p); }   // 路由里写 [[lang=lang]]
```
matcher 完全不生效，非法前缀仍进得来。指出命名/导出约定错误（matcher 模块必须导出名为 `match` 的函数）。

**Bug 9**
```svelte
<script>
  import { page } from '$app/state';
  $: postId = page.params.id;      // 迁移后仍用旧语法
</script>
<p>{postId}</p>
```
从 `/post/1` 导航到 `/post/2`，标题不更新、且不报错。指出 `$app/state` 的响应式规矩与正确写法。

**Bug 10**
```js
import { willUnload } from '$app/state';   // 想做离开确认
willUnload();
```
运行报 `willUnload is not a function`。指出 `willUnload` 的真实归属（`$app/state` 只导出三件），并给出"离开前弹原生确认"的正确 API 组合。

## 二、手写题（5 题）

**手写 1** 写 `/api/health` 端点：`GET` 返回 `json({ ok: true, ts: Date.now() })` 且带 `cache-control: no-store`；导出 `OPTIONS` 正确处理跨域预检（补 `Access-Control-Allow-Origin`/`-Methods`/`-Headers`）。注释说明"为什么 dev 不写也能过、生产必须写"。

**手写 2** 写一个 SSE 端点 `/api/events`：用 `ReadableStream` 逐帧推 `data: {...}\n\n`，`content-type: text/event-stream`；在 `cancel` 回调里清理定时器；并列出部署到缓冲型平台会退化这一点。

**手写 3** 双语骨架：① `src/params/lang.js` 限定 `['en','zh']`；② 路由目录使 `/`（默认英文、无前缀）与 `/zh/...` 命中同一组件；③ `[[lang=lang]]/+layout.server.js` 的 `load` 从 `params.lang` 判定语言并 `return { lang }`。三处一起给。

**手写 4** 在 `src/hooks.js` 写 `reroute({ url })`：首段不是合法语言码时，读 cookie（无则 `defaultLocale`）返回补前缀后的新路径；用一段注释对比"若改用 `handle`+`redirect(307)` 会带来什么不同（地址栏 / SEO / 往返）"。

**手写 5** 在根 `+layout.svelte` 里组合两件事：① `beforeNavigate` 拦脏表单，`type==='leave'` 走原生卸载确认、否则 `confirm` 后 `cancel()`；② `$effect` 监听 `updated.current`，为真时显示"有新版，点击刷新"按钮（点击才 `location.reload()`）。写清两钩子都必须在组件初始化期调用这一点。

## 三、场景题（1 题）

为"中英双语 + 对外 REST API + 后台实时通知（SSE）+ 版本热更提示"的运营后台，逐条给落点：
① 哪些数据入口用 form action、哪些必须用 `+server.js` 端点，各给判据；
② `/api/orders` 列表端点的缓存策略（`cache-control` 怎么给、要不要 `etag`、命中 304 怎么写），并说明 Kit 会不会替你缓存；
③ 双语 URL 设计：默认英文无前缀 + 中文带 `/zh`，你会选 `reroute` 静默重写还是 `handle`+`redirect`？给出与 hreflang/sitemap 联动的一处风险与规避；
④ SSE 通知端点鉴权走什么（EventSource 带不了自定义头），与页面级 `locals` 如何一致；
⑤ 版本热更：`version.pollInterval` 检测到新 `version` 后，为什么不自动 reload、该在 `updated.current` 变 true 时如何做不打断用户的提示；
⑥ 迁移到新导航 API 后，哪些从 `page` 派生的量必须写成 `$derived`？给一个"改成 `$app/state` 后因残留 `$:` 而僵住"的具体症状；
⑦ 若后台还要被移动端公网调用，端点层比"只给自家页面 load 用"多要做哪两件事（CORS、鉴权来源），为什么内部 `event.fetch` 时不用担心 HTTP 往返。

## 四、简答题（3 题）

**简答 1** 用判据说清"何时 form action、何时 `+server.js` 端点"，并列出端点真正的三类用武之地；补一句：为什么"表单提交用端点"会丢掉 action 的那一整套协议。

**简答 2** 讲 `$app/stores`→`$app/state` 的迁移动机（响应式粒度 + deprecated 现状 + 2.12/Svelte 5 前提），并写出"$: 写法会僵住"的正反例各一行。

**简答 3** 描述端点里 `throw error(400,...)` 与一个未预期异常的三种呈现差异：是否经 `handleError`、`+error.svelte` 是否渲染、按 `Accept` 头分叉给什么；再一句话说清"端点缓存为什么全要手写"。

## 五、挑战题 🏆

**"reroute 静默重写引发的 i18n 三连崩"**：某双语站用 `reroute` 把无前缀请求按 cookie 静默重写到 `/zh/...`，地址栏保持 `/about` 不变。上线后发现三处连锁故障：①页面里 `page.url.pathname` 生成的导航链接**都不带前缀**，用户点进内页后切语言"失效"；②爬虫只抓到无前缀 URL，`/zh/*` 几乎没被收录、`sitemap` 里却有 `/zh` 条目；③`hreflang` 声明的 `/zh/about` 与规范化的无前缀 `/about` 互相打架，Google 报"重复/矛盾标注"。请推演：
(a) 画出"地址栏不变 → `page.url` 不变 → 相对链接生成漏前缀 → 爬虫只走一条 → 另一语言版本脱钩"的完整失效链；
(b) 给出**两套**修复方案——方案甲：全站改 `handle`+`redirect(307)` 让 URL 真带前缀（说明它如何一举解开①②③、代价是什么）；方案乙：保留 `reroute` 但改用 `routeId + params` 手工拼绝对链接、并让 hreflang/canonical 全部指向带前缀的规范地址（说明要额外守住哪几条）；
(c) 从"同内容多 URL 是否会产生 SEO 重复内容惩罚、canonical 能否兜住"的角度，判定方案甲/乙各自更适合什么团队（重 SEO 官网 vs 应用型后台），并各指出它做不到的一点（对比作答）。

---

**本阶段关键词**：方法导出即路由、RequestHandler 须返回 Response、GET 自带 HEAD、fallback 兜底冷门动词、json/text/error 构造器、别 catch thrown error、按 Accept 头分叉且不渲 +error.svelte、端点无自动缓存、cache-control/etag/304、CORS dev 注入 prod 不注入、layout 不碰端点跨请求进 handle、勿用 event.url 判权、ReadableStream 流式与 SSE、Lambda 缓冲退化、内部 event.fetch 直调、[[lang]] 可选段、可选段不跟 rest、src/params 导出 match、matcher 双端都跑、reroute 静默重写 vs handle+redirect、load 注 lang + setContext 分发 $t、hreflang/canonical/x-default、$app/state 三件(page/navigating/updated)、stores 已 deprecated、page 只能用 runes、navigating 空值 null、willUnload 是导航属性、beforeNavigate cancel 触发原生卸载确认、onNavigate 时机、updated.check 不自动刷新、preloadCode 不跑 load vs preloadData

**判分口径**：Bug 每题 3 分、手写每题 7 分、场景 20 分、简答每题 5 分、挑战加分 10 分（总分 100+10）。≥72 为合格；挑战题答出 (a)(b) 即得 5 分基础分，(c) +5。

交卷后自评三道小测各对 ≥5 题视为过关。

🚀 **下一站 L8**：kit-typescript——generated types 开关与产物、`$page.params` 按路由收窄、load 返回值到数据的类型流转、ActionData/Actions 类型协议。
