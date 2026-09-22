# Form Actions：`<form>` 的原生进化与渐进增强

> 目标：掌握 +page.server.js 里 actions 的完整契约——default/具名的调用语法、FormData 进与 fail() 出的数据整形、提交后 load 重跑的时序、use:enhance 接管后的六件默认事——理解"无 JS 表单先能用、有 JS 再变爽"的渐进增强哲学（呼应 svelte-form-validation 的 submit 拦截史、next-server-actions 的同源设计）

## 一、设计哲学：表单不走 fetch 也能用

SvelteKit 的 Form Actions 把"提交数据给服务端"降级回 HTML 原语：`+page.server.js` 导出 `actions`，页面里放一个 `<form method="POST">`——**一个字的 JS 都不用写**，浏览器原生 POST 就会命中服务端的 action。JS 加载失败、禁用、或用户网速极差，表单照样提交照样回显错误。有 JS 时再用 `use:enhance` 渐进增强出无刷新体验。这与 Next.js Server Actions（`action` 属性收进 RSC 调用协议、本质是 RPC）方向相反：Kit 保留了 HTTP 表单语义，官方文档原话是"client-side JavaScript is optional"。

> 版本预告：官方文档已注明 experimental 的 form remote function 覆盖 actions 的全部用例并附加类型安全与 single-flight，未来会成为推荐方案；但 actions 已 feature-complete、持续可用，新开发聚焦 remote functions（API 可能变动）。本关考纲只到 actions 为止。

## 二、default 与具名 action：一套互斥规则

```ts
// src/routes/login/+page.server.js
import * as db from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions = {
  login: async ({ cookies, request, url }) => {
    const data = await request.formData();
    const email = data.get('email');
    const user = await db.getUser(email);
    if (!user) return fail(400, { email, missing: true });
    cookies.set('sessionid', await db.createSession(user), { path: '/' });
    if (url.searchParams.has('redirectTo')) {
      redirect(303, url.searchParams.get('redirectTo'));
    }
    return { success: true };
  },
  register: async (event) => { /* TODO */ }
} satisfies Actions;
```

调用语法四条：
- **具名 action** 用查询参数寻址：`<form method="POST" action="?/register">`；从别的页面投（如根布局里的登录挂件）写全路径 `action="/login?/register"`。
- **按钮级改道**：`<button formaction="?/register">`——同一个 form 的数据可以投去不同 action（登录页上"登录/注册"双按钮的官方姿势）。
- **default 与具名互斥**：官方明说不能并存。原因是 POST 具名 action 后若不重定向，`?/register` 会留在 URL 里，下次对同页 default 的 POST 会被这个残留查询参数劫持进 register——语义含混，干脆禁止。
- **只能 POST**：actions 一律 POST，因为 GET 不该有副作用；`method="GET"` 的表单会被 Kit 当作 `<a>` 同款走客户端路由（只改 URL 触发 load、不碰 action）。

## 三、数据进出：FormData 进、fail() 出、form prop 回显

入参是完整 RequestEvent（cookies/locals/request/url 全在，L3 的 server 侧特权这里全适用）。返回值的呈现协议：

- **成功返回**：普通对象 → 页面 `form` prop（也进 `$app/state` 的 `page.form`，全局可见直到下次更新）。模板里 `form?.success` 显示欢迎语——注意官方注释：这条消息是**短暂的**，刷新页面就没了（它只因本次提交而存在）。
- **校验失败**：`fail(400, { ... })` 返回**带 4xx 状态码的数据**（状态码须在 400-599，校验错惯用 400 或 422；`page.status` 可读到）。第二个参数里把**用户已填的值回传**实现回显——官方示例特意只回 email 不回 password："as a precaution"。
- **结构自由**：返回值只需 JSON 可序列化（devalue 口径），形状随你。一页多个 form 时，建议带 `id` 之类的键区分这份 form 数据属于谁。
- **重定向与抛错**与 load 完全同规则：`redirect(303, ...)`（303 专用于"POST 之后转 GET"）、`error(status, ...)` 直接抛。

## 四、提交之后发生了什么：时序必须背下来

官方"Loading data"节的时序链：

1. action 跑完 → **页面重渲染**（除非 redirect 或意外错误中断），action 返回值进 `form` prop；
2. **页面的 load 函数会重跑**——所以 action 里改了数据库，load 自然拉到新数据，不用手动刷新；
3. **handle hook 只在提交这次跑、不为随后的 load 重跑**——这条是 locals 陷阱：如果你的 handle 从 cookie 读出 `event.locals.user`，而 action 里登出删了 cookie，**必须同步手动把 `event.locals.user = null`**，否则本次响应链路里 load 读到的 locals 还是旧登录态。官方 logout 示例专门演示了 `cookies.delete(...)` 紧跟 `event.locals.user = null` 两件套。

## 五、use:enhance：六件默认事

```svelte
<script>
  import { enhance } from '$app/forms';
  let { form } = $props();
</script>

<form method="POST" use:enhance>...</form>
```

限制先行：`use:enhance` **只认 method="POST" 且目标是 +page.server.js 的 actions**——挂在 GET 表单或指向 +server.js 端点上会直接报错（官方原话）。无参调用时它模拟浏览器原生行为、但去掉整页刷新，做六件事：

1. **更新 form prop / page.form / page.status**——但仅当 action 就在当前页（`<form action="/somewhere/else">` 跨页投不更新，因为原生行为本来就是跳走了；想两种情况都更新，回调里用 `applyAction`）；
2. **重置 `<form>` 元素**（输入框清空回初始态）；
3. 成功响应时 **invalidateAll()**——所有 load 重跑；
4. redirect 响应时 **goto()**；
5. 出错时渲染**最近的 +error 边界**；
6. **焦点重置**回正确的元素。

自定义：`use:enhance={({ formElement, formData, action, cancel, submitter }) => {...}}`——前置函数在提交瞬间跑（可 `cancel()` 否决、可亮 spinner），**返回的回调一旦提供就覆盖上面的默认六件套**；想找回默认行为，在回调里调 `update()`（接受 invalidateAll/reset 参数）或对 result 调 `applyAction(result)`。

`applyAction(result)` 按 `result.type` 分发：`success/failure` → 写 page.status + form/page.form（**不分页**，这正是它与 update 的差异）；`redirect` → `goto(location, { invalidateAll: true })`；`error` → 渲染最近边界。全部动作都含焦点重置。

## 六、不用 enhance 的第三条路 + 反序列化纪律

想要完全掌控，可以裸写事件监听：`onsubmit` 里 preventDefault → `fetch(event.currentTarget.action, { method: 'POST', body: new FormData(...) })` → 响应**必须用 `$app/forms` 的 `deserialize(text)` 解析，JSON.parse 不够格**——actions 和 load 一样支持返回 Date/BigInt，deserialize 认识 devalue 协议。成功要自己 `invalidateAll()`。另一个冷知识：同目录既有 +server.js 又有 +page.server.js 时，fetch 默认被路由去**端点**；要投 action 得手动加请求头 `x-sveltekit-action: 'true'`。

## 七、类型面与代际注记

- `form` prop 的类型：SvelteKit 2.16+ 用 `PageProps` 一次性标 `let { data, form }: PageProps = $props()`；老代码分别标 `PageData` + `ActionData`，Svelte 4 时代是 `export let data; export let form;`。
- actions 整体 `satisfies Actions`（来自 `./$types`），每个 action 的返回类型会被推导合并进 `ActionData` 联合——`form?.missing` 有没有类型提示，全看你 action 里 return 得规不规范。

## N、自检清单

1. 为什么 default action 不能和具名 action 并存？用"?/register 残留 URL"解释给同事听。
2. action 改了数据库，页面数据为什么自动是新的？——说出"action 后 load 重跑"时序，以及 handle 为何**不会**重跑。
3. use:enhance 的六件默认事各是什么？跨页提交时哪一件会"失灵"、用什么补？
4. 写了返回回调的 use:enhance 发现 invalidateAll 不发生了——为什么？两种找回方式？
5. 自己 fetch 提交 action，为什么不能 JSON.parse 响应？同名 +server.js 存在时还要加什么头？

🚀 下一关：kit-form-validation——把"校验"从手写 if 升级成体系：服务端为底客户端为表、zod 双端复用与 sveltekit-superforms 生态位。
