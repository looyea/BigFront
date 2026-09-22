# error() / redirect() / json() 与 +error.svelte：投掷工具与边界落点

> 目标：把 L3 就见过的三件 `@sveltejs/kit` 投掷工具收拢成完整认知——expected/unexpected 两套错误世界的分界、+error.svelte 边界的"向上就近"落点规则、端点与 handle 抛错的 fallback 页链路，并对照 svelte:boundary 与 Next.js error.tsx 划清"HTTP 错误呈现"和"运行时崩溃兜底"的边界（呼应 svelte-error-boundary、next-error-handling）

## 一、三件工具一句话契约

都从 `@sveltejs/kit` 导入，前两件是**抛**（调用即中断，返回类型 `never`），第三件是**造响应**：

```ts
import { error, redirect, json } from '@sveltejs/kit';

error(404, { message: 'Not found', code: 'NOT_FOUND' });   // 状态码必须 400-599；第二参对象进 page.error；传字符串则自动包成 { message }
redirect(303, '/login');                                    // 状态码限 3xx 家族；303=POST 后转 GET、307 保方法临时、308 保方法永久
json({ ok: true }, { status: 201 });                        // 端点里造 Response（非抛掷）；load 的世界不用它，json() 是 +server.js 三件套之一
```

两件抛掷工具的通用红线（JSDoc 原文点名）：**别把 thrown 的东西 catch 掉**——`Make sure you're not catching the thrown redirect/error, which would prevent SvelteKit from handling it`。try/catch 包住 load 全体是新手最常见的"吞重定向"事故：redirect 也是一种抛，被你的 `catch (e)` 拦住后跳转静默失效。要过滤着接：`if (isRedirect(e)) throw e;`（`@sveltejs/kit` 提供 isRedirect/isHttpError 判据）。

## 二、两套错误世界：expected 与 unexpected

SvelteKit 用**是否由你亲手 `error()` 抛出**给错误划分身份：

| | expected（用 error() 抛） | unexpected（其他任何异常） |
|---|---|---|
| 语义 | 业务可预见：404 文章不存在、403 没权限 | 程序 bug、依赖炸了：DB 断连、TypeError |
| 状态码 | 你指定（400-599） | 默认 500 |
| 用户看到 | 你给的 `{ message, ... }` 原样进 page.error | **通用壳** `{ "message": "Internal Error" }`——原始 message 与堆栈因含敏感信息**不出服务端日志** |
| handleError | **不经过**（JSDoc 明说 without invoking handleError） | **必经**：日志/上报/改写返回值的收口点 |

这表格背后是一条安全设计：意外错误不被信任，默认对用户 masking；预期错误是你签过字的，直接放行到边界。**默认行为**：意外错误打进控制台/服务端日志，`handleError({ error, event })` 里可以上报 Sentry 并 `return { message, code }` 定制用户可见形状（TS 下返回值必须符合 App.Error）。
给错误对象加私货的类型通道：约定在 `src/app.d.ts` 声明 `namespace App { interface Error { code?: string; id?: string } }`——`message: string` 永远内置，接口只能加字段。

## 三、+error.svelte 的落点几何学：三条定位规则

load 抛错后"就近渲染 +error.svelte"，但**就近的方向有讲究**，三条规则背下来：

1. **常规**：错误发生在哪个路由，就渲染**该路由往上最近**的 +error.svelte；模板里读 `$app/state` 的 `page.error`（2.12+；老项目/ Svelte 4 用 `$app/stores` 解 `$page`），`page.status` 给状态码。`<h1>{page.error.message}</h1>` 是最小可用边界。
2. **layout 层的反直觉**：错误发生在 `+layout(.server).js` 的 load 时，最近的边界是**该布局之上**的 +error.svelte，**不是它同目录旁边那个**——布局旁边的 +error 只接子路由的错，自己不接自己的。
3. **根布局例外 → fallback 页**：根 `+layout.js/+layout.server.js` 抛错时，本该兜底的根 +error.svelte 在根布局内部（自举死锁），于是 Kit 改用 **fallback 错误页**：默认极简页，或自定义 `src/error.html`——注意这是**另一个世界的文件**：不是 Svelte 组件，只有 `%sveltekit.status%` / `%sveltekit.error.message%` 两个占位符会被替换。

**端点与 handle 的世界没有 +error.svelte**（L3 讲过、这里补全）：+server.js handler 或 handle hook 抛错时，按请求 `Accept` 头二选一——要 HTML 给 fallback 错误页、要 JSON 给错误对象的 JSON 序列化。`+layout.svelte` 对端点无效、`+error.svelte` 对端点无效，端点只吃 Request 吐 Response。

## 四、action 抛错 vs load 抛错：呈现路径的差异

L4 前两关合流点。action 里三件工具全可用，但语义各有分工：
- **校验不过**：别抛错——`fail(400, {...})` 是"带数据的软失败"，走 form prop 回显，页面不崩、load 照常重跑、`page.status` 变 400；
- **权限/不存在**：`error(403)` 硬抛——渲染最近 +error.svelte（enhance 的第 5 件默认事就是接这个）；
- **成功转场**：`redirect(303)`——跳过一切回显直接换页。
与 load 抛错唯一的体感差异：load 的错发生在"取数"阶段，action 的错发生在"提交"阶段，但**边界落点几何完全相同**。一个高频事故：无 JS 环境 action 抛 unexpected error，响应是整页 fallback——用户表单内容全丢；有 JS + enhance 时错误被边界接住、表单还在。所以"提交期错误优先用 fail 软着陆"不只是体验问题，还是渐进增强的鲁棒性问题。

## 五、渲染期错误：2.54 的实验开关与前史

第三类错误——不在 load/action、而在**组件渲染**（`<script>` 或模板执行）炸出来的：
- **默认（SSR 期渲染炸）**：整页 500，走 fallback；
- **SSR 之后客户端渲染炸**：这是 11-svelte 学的 `~error/:global:error` 与 svelte:boundary 的领地——Svelte 组件级错误边界 `~error` 只能接**事件与 effect** 的错，接不住渲染错；渲染错要靠 `<svelte:boundary>` 的 `failed` snippet（见 svelte-error-boundary 关）。
- **SvelteKit 2.54 + Svelte 5.53 起**：`kit.experimental.handleRenderingErrors = true` 后，Kit 自动在每个有 +error.svelte 的层级用 `<svelte:boundary>` 包路由组件——**服务端渲染错也进边界**，呈现得像 load 抛错一样落在最近 +error.svelte；错误先过 handleError 再进边界。注意细节：此时 page 对象（含 page.error）**不更新**，错误以 **prop** 直接传给 +error.svelte（`let { error } = $props()`），因为渲染已经开始、多个边界可能并行接不同的错。实验特性不受 semver 保护，生产依赖前看发布说明。

对照记：Next.js 用 `error.tsx`（客户端运行时错误边界，error 是**真 Error 实例**须自己提取 message）；Nuxt 用 `createError({ statusCode, fatal })` + `~~/error.vue` 单页收口。Kit 的三段式（+error.svelte 分层 / error.html 兜底 / svelte:boundary 组件级）粒度最细也最"各管一段"。

## 六、redirect 的代际与参数口味

- **1.x 前史**：`error()`/`redirect()` 当年**必须自己 throw**（`throw error(404, ...)`）；2.x 起函数内部已抛，多写 throw 只是画蛇添足但无害——读老教程别被绕晕。
- 状态码白名单：redirect 限 300-308；303 是"POST→GET"专用语义（PRG 模式），307/308 保方法；301/302 永久/临时不带保方法承诺（302 历史实现可能把 POST 变 GET）。
- redirect 的 location 若是**用户可控值**（`url.searchParams.get('redirectTo')`），就是开放式重定向钓鱼面——白名单校验放 L5 安全清单，本关先立问题意识（官方 JSDoc 也警告 url/params 属"可被操纵的请求数据，勿单独作权限判据"）。

## N、自检清单

1. expected 与 unexpected 错误的四行对比表（身份/状态码/用户可见形状/是否过 handleError）不看书写全。
2. layout 的 load 抛错，边界在哪个 +error.svelte？根 layout 抛错呢？——两条规则连"为什么根布局自举死锁"一起讲。
3. 为什么 try/catch 全包裹 load 会静默吃掉 redirect？用 isRedirect 写正确姿势。
4. action 校验失败为什么该 fail() 而不是 error()？无 JS 时两种做法的用户代价差在哪？
5. `experimental.handleRenderingErrors` 开了之后 +error.svelte 拿错误的方式有何不同？为什么 page.error 不更新？

🚀 **下一站 L5**：kit-hooks-handle——hooks.server.ts 的 handle 洋葱管道：每条请求在 action 与 load 之前跑的那一层，正是本关多次预告的鉴权收口位。
