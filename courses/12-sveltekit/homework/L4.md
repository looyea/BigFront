# L4 阶段作业：表单与错误处理

> 覆盖：kit-form-actions / kit-form-validation / kit-error-boundaries

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**
```svelte
<form action="?/register" method="POST">
```
```ts
// +page.server.js
export const actions = {
  default: async ({ request }) => { /* 建号 */ },
  register: async ({ request }) => { /* 另一套建号 */ }
};
```
评审说这套写法"语义双保险"。用官方互斥规则与 ?/register 残留链说明为什么这是一票否决。

**Bug 2**
```svelte
<form action="?/login">
  <input name="email">
  <button>登录</button>
</form>
```
开发者称"点了没反应，action 从没执行"。缺了哪个属性？SvelteKit 对这种表单的实际待遇是什么（说出视同物与去向）？

**Bug 3**
```ts
login: async ({ request }) => {
  const data = await request.formData();
  if (!data.get('email')) {
    throw error(400, '邮箱必填');
  }
  return { success: true };
}
```
"校验失败"与"错误页"被混为一谈。改用官方软着陆写法（含值回显，回显范围按『as a precaution』口径划线），并说明改后 page.status 与页面存活状态各是什么。

**Bug 4**
登录挂件放在根布局，`<form method="POST" action="/login" use:enhance>`；/login 页的 action 返回 `{ success: true }` 后，**挂件组件**里读 `form?.success` 永远 undefined。为什么？两种补救方向。

**Bug 5**
同目录有 +page.server.js（actions）与 +server.js（POST）。组件里裸写：
```ts
await fetch('/news', { method: 'POST', body: formData });
```
数据库没动静，但端点的日志打出来了。加什么救？这现象暴露了同一路径上的什么路由优先级？

**Bug 6**
```ts
const raw = Object.fromEntries(await request.formData());
schema = z.object({ age: z.number().min(18), tos: z.boolean() })
const r = schema.safeParse(raw); // 用户填了 age=25、勾了 tos，仍全挂
```
两个字段各挂在哪条 FormData 特性上？分别给出 schema 修法。

**Bug 7**
```ts
export const load = async (event) => {
  try {
    if (!event.locals.user) redirect(303, '/login');
    return await api.fetchSecret(event);
  } catch (e) {
    return { error: String(e) };
  }
};
```
"登录墙形同虚设，未登录能看到数据"。指出结构性原因，并给出官方 JSDoc 点名的红线与正确 catch 姿势。

**Bug 8**
```ts
logout: async ({ cookies }) => {
  cookies.delete('sessionid', { path: '/' });
}
```
handle 里有 `event.locals.user = await getUser(cookies.get('sessionid'))`。登出后本次渲染顶栏仍显示用户名。补哪一行？为什么 invalidateAll 救不了它？

**Bug 9**
```svelte
use:enhance={() => {
  pending = true;
  return async () => { pending = false; };
}}
```
提交成功后 spinner 灭了，但页面数据没刷新、表单也没清空。缺了什么调用？该调用接受哪两个可选参数？

**Bug 10**
```ts
// src/routes/blog/+layout.server.js
throw error(404, '目录不存在');
// src/routes/blog/+error.svelte  ← 作者期望它来接
```
实际接错的是 src/routes/+error.svelte。这是 bug 吗？给出规则原文，并说明什么条件下才会轮到 blog/+error.svelte。

## 二、手写题（5 题）

**手写 1** 完整登录 action：`request.formData()` → `Object.fromEntries` → zod safeParse → 失败 `fail(400, { input, errors })`（password 不回显）→ 成功 cookies.set 会话 + `redirect(303, url.searchParams.get('redirectTo') ?? '/')`。satisfies Actions 收口，import 清单写全。

**手写 2** 草稿箱一页双动作：『保存草稿』与『保存并发布』共用同一组输入。用具名 action + 按钮级属性达成（不许写一行 JS），两个 action 的返回值分别 `{ saved: true }` 与 `{ saved: true, published: true }`，模板按 form 键分支提示。

**手写 3** pending 两拍子完整版：use:enhance 前置函数置 pending 并允许 cancel（有字段超长时否决提交就地报错），回调灭灯后**必须保留六件套默认行为**——用正确的那个 API 找回。12 行以内。

**手写 4** 在 +page.server.js 的 load 里实现"isHttpError 过滤器"：catch 后 expected 错误原样重抛、unexpected 记日志后转 `error(502, { message: '上游挂了', code: 'UPSTREAM' })`。配套在 app.d.ts 里扩 App.Error 让 code 过类型。

**手写 5** 最小正确 +error.svelte：从 $app/state 读 page，渲染 `page.status` 与 `page.error.message`（只取白名单字段）；再写一个兼容 experimental.handleRenderingErrors 的变体（error 走 prop）。两版并排，注释标出错误对象的两个来源。

## 三、场景题（1 题）

工单系统「新建/删除」全链路设计，7 条需求逐条给落点（文件+关键代码形状）：
① 无 JS 也能提交建单，服务端 zod 校验失败时**标题与描述回填、优先级恢复默认**；
② 附件上传（图片 ≤2MB），文件校验失败时**不回显文件**只回显其余字段并提示重新选择；
③ 删除按钮带确认，成功页要见新列表且不整页刷新（局部失效一个自定义依赖）；
④ 只有 admin 能删——普通用户点删除时**不留错误页**，软失败提示"无权限"；
⑤ 建单成功后别的标签页也应尽快看到新单（说出你能想到的最轻机制与其局限）；
⑥ 该页 SSR 部署在会缓冲响应的平台上，删除后重渲染必须**原子地**包含新 form 数据与新列表——说明这对本关时序（action→load）意味着什么；
⑦ 全站 5xx 统一进 Sentry 且 4xx 不进，一个钩子搞定——写出判据代码。

## 四、简答题（3 题）

**简答 1** 默写 use:enhance 六件默认事，标出其中"有同页限制"的是哪件、跨页场景用什么 API 替代、替代版与它的**一处**语义差异。

**简答 2** action 提交成功后到页面更新完毕的完整时序链（handle/action/form prop/load 重跑/handle 不重跑），并解释"locals 陷阱"在这条链上的成因与官方解法。

**简答 3** 三行说清 expected/unexpected 的：身份判据、用户可见形状、是否过 handleError；再补一条 src/error.html 的两个占位符（%sveltekit.status% / %sveltekit.error.message%）与触发场景清单。

## 五、挑战题 🏆

**开放重定向 + 残留参数连环案**：审查以下真实风格代码并写出完整攻击叙事与加固版：
```ts
// /login 的 action 成功后
redirect(303, url.searchParams.get('redirectTo') ?? '/');
// 全站守卫写法：+page.server.js 里 if (!locals.user) redirect(307, `/login?redirectTo=${url.pathname}`);
```
①构造一条让"登录后跳走"的恶意 URL，说明用户为什么可能不疑；②给出白名单校验函数（同源相对路径、禁协议相对 `//`、限长度）；③307 守卫 + 具名 action 的组合下，登录失败重试时 URL 长什么样、default/具名互斥规则在这里如何显形；④如果改用 Next.js Server Actions 的 redirect 语义，这条链上哪些环节的表达方式会变（对比作答）。

---

**本阶段关键词**：actions 只吃 POST、?/具名寻址、formaction 改道、default/具名互斥、fail 400-599、password 不回显、action 后 load 重跑、handle 不重跑、locals 两件套、enhance 六件套、同页限制、update/applyAction、deserialize、x-sveltekit-action、GET form 视同 <a>、coerce/checkbox 缺席/同名多值、isRedirect 重抛、expected/unexpected、Internal Error 壳、边界向上找、根 layout 与 fallback、%sveltekit.status%、handleRenderingErrors prop

**判分口径**：Bug 每题 3 分、手写每题 7 分、场景 20 分、简答每题 5 分、挑战加分 10 分（总分 100+10）。≥72 为合格；挑战题答出 ①② 即得 4 分基础分，③④ 各 +3。

交卷后自评三道小测各对 ≥5 题视为过关。

🚀 **下一站 L5**：kit-hooks-handle——hooks.server.ts 的 handle 洋葱管道：本关多次预告的"每条请求必跑、action 与 load 之前"的那一层，正式开箱。
