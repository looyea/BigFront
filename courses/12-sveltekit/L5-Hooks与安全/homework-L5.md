# L5 阶段作业：Hooks 与安全

> 覆盖：kit-hooks-handle / kit-auth-session / kit-security-headers

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**
```ts
// src/hooks.server.js
export async function auth({ event, resolve }) {
  event.locals.user = await getUser(event.cookies);
  return resolve(event);
}
export async function logging({ event, resolve }) {
  console.log(event.url.pathname);
  return resolve(event);
}
```
"两个 export 就能拼成中间件链"。这套写法实际只有哪个生效？用什么 API 组合成"auth 先跑、logging 后跑"的洋葱序，写正确形态。

**Bug 2**
```ts
export const handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  response.headers.set('x-visit', '1');
  return response;
};
```
某些走 `+server.js` 里 `return redirect(303, '/x')` 的路径偶发 `TypeError`。指出不可变来源与一行修法。

**Bug 3**
```ts
// src/hooks.server.js
import db from '$lib/server/db';
await db.connect();          // 顶层 await
export const handle = async ({ event, resolve }) => resolve(event);
```
同事的 Safari/部分 edge 环境启动即白屏。改用哪个 hook 承载一次性异步初始化更稳？为什么浏览器端同样写法要格外克制？

**Bug 4**
```ts
// 鉴权写在 src/routes/(app)/+layout.server.js
export const load = async ({ locals }) => {
  if (!locals.user) redirect(307, '/login');
  return { user: { id: locals.user.id, name: locals.user.name, role: locals.user.role } };
};
```
从 `/app/orders` 切到 `/app/settings`，session 恰好中途过期却没被拦。用 layout 缓存粘性解释成因，并给出正确落点（两处改动）。

**Bug 5**
```ts
login: async ({ cookies, url }) => {
  // 校验通过
  cookies.set('sessionid', token, { path: '/' });
  redirect(303, url.searchParams.get('next'));
}
```
安全评审打回两个高危：①`url.searchParams` 作跳转目标；②登录后 handle 建的 `event.locals.user` 在本次响应里仍是 null 导致顶栏空白。分别给修法。

**Bug 6**
```ts
// src/hooks.server.js
export const handle = async ({ event, resolve }) => {
  const r = await fetch('https://api.internal/user'); // 用全局 fetch
  event.locals.user = await r.json();
  return resolve(event);
};
```
本地能跑、SSR 生产把内网请求打到了公网域名且带不上 cookie。改用哪个函数、配合哪个 hook 做"内网直连 + 注入鉴权头"？

**Bug 7**
```ts
// svelte.config.js
kit: { csp: { mode: 'nonce', directives: { 'script-src': ["'self'"] } } }
```
整站开了 `prerender = true` 的营销页在浏览器报"nonce 无效"并白屏。CSP 的哪条约束被踩？mode 改成什么能自动规避？

**Bug 8**
```ts
export const handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith('/admin') && !event.locals.user?.admin) {
    return new Response(null, { status: 401 });
  }
  return resolve(event);
};
```
用 `event.locals` 却从没在任何前置 hook 里填过它。指出执行顺序错误，给出把 user 挂上 locals 应在何处、以及为何 401 前应先做身份识别。

**Bug 9**
```ts
// src/routes/+error.svelte 承接根 layout load 抛的 unexpected 错误
```
```ts
// src/hooks.client.js
export function handleError({ error }) { throw new Error('二次包装'); }
```
客户端错误监控里"handleError 偶发不触发反而崩"。踩了哪条官方红线？handleError 的正确返回契约是什么？

**Bug 10**
```ts
kit: { csrf: { checkOrigin: false } }  // 为接第三方支付表单回调
```
"临时关一下结果忘了"。用新 API 写成最小信任面，并说明为何"全局关"比"精确白名单"危险、以及此检查只在什么环境生效。

## 二、手写题（5 题）

**手写 1** 用 `sequence` 组装三层 handle：`sentryInit → auth → timing`，auth 里 `event.locals.user = await getUserFromSession(event.cookies)`，timing 在 resolve 后给 response 加 `Server-Timing`（对不可变头先 clone）。三个 Handle 各自的 import 类型写全（Handle/ServerInit）。

**手写 2** 全站登录墙 + 公开白名单：handle 里放行 `/`、`/login`、`/api/auth/*`、`/_assets`；其余未登录时按 `Accept` 头分叉——页面导航 `redirect(307, '/login?next=' + 编码后的当前路径)`，fetch 请求 `new Response(JSON.stringify({message:'Unauthorized'}), {status:401})`。

**手写 3** safeRedirect 加固版：入参可能是 `null`、`/ok`、`//evil.tld`、`https://evil.tld`；要求仅放行"同源相对路径、以单个 `/` 开头、不含 `//`、长度 ≤ 2048"，否则回退 `/`。给出函数与 4 条断言用例。

**手写 4** 干净登出 action：`cookies.delete('sessionid', { path: '/' })` → 服务端销毁会话 → `event.locals.user = null` 三件套，并注释每步各自防住什么现象（"删不掉/下次仍登录/本次顶栏仍显示"）。

**手写 5** 一份 `App.Error` + 双端 handleError：在 `src/app.d.ts` 扩 `interface Error { message: string; errorId: string }`；`hooks.server.js` 用 RequestEvent、`hooks.client.js` 用 NavigationEvent，各生成 `errorId = crypto.randomUUID()`、送 Sentry、返回 `{ message: 'Whoops!', errorId }`，且都保证自身不抛。

## 三、场景题（1 题）

内部工具站安全加固清单，逐条给落点（文件 + 关键代码形状）：
① 会话令牌用 httpOnly cookie 存，前端组件要显示"当前用户名"但绝不接触原始令牌——说数据从哪来到哪去；
② 接一个可信支付网关会用 **表单 POST** 回调本站 `/billing/callback`，生产却 403——精确到配置项地解决，不许全局关 CSRF；
③ 管理员后台"整棵子树需 admin"——为什么不能只写在 `/admin/+layout.server.js`，给出可靠的双层方案；
④ 某页面用 `{@html}` 渲染管理员手写的公告富文本——给出你放行的前提（内容来源 + 净化）；
⑤ 上线 CSP：先只观察不拦截，稳定一周后再启用——写出两阶段配置差异与必须配的收报字段；
⑥ 登录后跳回原页：`?next=` 从哪来、经哪道校验、用哪个状态码，串成闭环；
⑦ 一个 fetch 型 `/api` 请求与一次页面导航同时未登录，为何二者响应形态应不同。

## 四、简答题（3 题）

**简答 1** 默写 handle 的执行时机（运行期/预渲染期）、哪种请求根本不进 handle、`resolve` 之外抛错的后果；再补一句 locals 为何是"鉴权正确落点"。

**简答 2** CSP 的 mode 三档各适用什么页？为什么预渲染页禁用 nonce？静态页走 `<meta>` 下发 CSP 时哪三个指令会失效、后果分别是什么。

**简答 3** 用一句话分别界定 `reroute`、`redirect`、handle 里 `new Response()` 三者的职责，并说明 reroute 为何必须是纯幂等函数（对客户端行为的影响）。

## 五、挑战题 🏆

**中间件鉴权时序连环案**：某站把鉴权写成 `handle = sequence(auth, guard)`，`auth` 填 `locals.user`，`guard` 对 `/admin` 前缀未登录者 `redirect`。同时 `/admin/+layout.server.js` 也写了一份重复的 redirect 守卫，且某 action 登录成功后未手动同步 locals。请推演并回答：①登录页 action 成功后，紧随重渲染时 `guard` 会不会重跑、`locals.user` 此刻是什么值、顶栏与页面数据各自读到什么（用 L4/L5 的"action 后 load 重跑、handle 不重跑"两条时序事实论证）；②layout 守卫与 guard 中间件的分工，为什么"只留一个"更安全、留哪个、理由；③给出这条链上你只做一处改动就能修掉"登录后本次仍显示未登录"的最小补丁；④对比 Next.js middleware + `matcher` 的鉴权模型，说出 Kit 的 `locals` 总线与 Next 每请求独立跑 middleware 的一个关键差异（对比作答）。

---

**本阶段关键词**：handle 每请求必跑、预渲染期也跑、静态资源不进 handle、resolve 永不抛错、resolve 外抛错致命、不可变头要 clone、sequence 洋葱、locals 请求级、init 一次性异步、顶层 await 环境限制、handleFetch 内网直连、reroute 纯幂等不改地址栏、transport encode/decode、双端 handleError、NavigationEvent vs Request-Event、expected 不进 handleError、cookies httpOnly/secure 默认、sameSite lax、path 强制、set 后即 get、layout 缓存漏判、逐页守卫下沉 page.server、乐观鉴权禁区、getRequestEvent AsyncLocalStorage 红线、登出三件套、CSP mode auto、nonce/hash、meta 忽略 frame-ancestors、reportOnly 灰度、transition unsafe-inline、csrf checkOrigin deprecated、trustedOrigins、仅生产生效、开放重定向 safeRedirect

**判分口径**：Bug 每题 3 分、手写每题 7 分、场景 20 分、简答每题 5 分、挑战加分 10 分（总分 100+10）。≥72 为合格；挑战题答出 ①③ 即得 4 分基础分，②④ 各 +3。

交卷后自评三道小测各对 ≥5 题视为过关。

🚀 **下一站 L6**：kit-adapters——一份代码的 N 种落地形态：adapter-static/node/平台产物差异、fallback 纯 CSR 模式与 prerender 选型联动。
