# +server.ts 的 API 工程：REST、流与缓存

> 目标：把 `+server.js` 从"能返回东西"升级到"能对外交付一份体面的 API"——方法导出即路由、RequestEvent→Response 的契约、`json`/`text`/`error` 三个便利构造器、GET 自带 HEAD 与 `fallback` 兜底、ReadableStream 流式与 SSE、缓存头要自己写、以及"端点不受 layout 影响、跨请求逻辑归 handle"的边界纪律（呼应 express-rest-api 的方法组织、next-route-handlers 的 app router 端点）

## 一、方法导出即路由：一个文件就是一组动词

`src/routes` 下除了 `+page`/`+layout`，还能放 `+server.js`（也叫 endpoint / API route）。它的模型极简：**导出名字等于 HTTP 动词的函数，就是该路由对该动词的处理器**。

```js
// src/routes/api/add/+server.js
import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
  const { a, b } = await request.json();
  return json(a + b);
}
```

- 动词全集：`GET / POST / PUT / PATCH / DELETE / OPTIONS / HEAD`，再加一个特殊的 `fallback`。
- 每个处理器签名固定为 `(event: RequestEvent) => MaybePromise<Response>`，类型 `RequestHandler` 从 `./$types` 拿（generated types 会按路由收窄 `params`）。
- **必须返回 `Response`**（或 throw）。没有"隐式 204"，什么都不 return 会报错。
- 路由组织就是文件路径：`src/routes/api/users/[id]/+server.js` 对应 `/api/users/:id`，`params.id` 从 `event.params` 取。动词靠导出名分派，URL 不带动词——一套标准 REST 表意。

## 二、三个构造器：json / text / error（以及为什么优先 action）

手动 `new Response(JSON.stringify(x), { headers: {...} })` 没错但啰嗦，`@sveltejs/kit` 给了三个快捷构造：

- `json(data, init?)`：生成 JSON `Response`，**自动补 `Content-Type: application/json` 与 `Content-Length`**，`init` 里可加 `status` 和自定义头。
- `text(body, init?)`：按原样生成，自动补 `Content-Length`。
- `error(status, body?)`：抛一个带状态码的预期错误，`status` 限 **400–599**。

一个常被追问的点：**表单提交别用 POST endpoint**。官方明说"一般地，form actions 是从浏览器往服务端提交数据的更好方式"——因为 action 天然享有校验回显、`use:enhance`、错误边界、重渲染重跑 load 那一整套协议。端点留给**真正的对外 API**：给第三方/移动端/HMTL 之外的 fetch 调用方，或做 webhook、文件下载、SSE。

## 三、GET 自带 HEAD、fallback 兜底其余动词

两条省心的自动规则：

1. **只要导出了 `GET`，`HEAD` 请求会自动返回该 GET 响应的 `Content-Length`**（不必单独写 HEAD）。
2. **导出 `fallback`** 可接住任何"没专门导出对应函数"的方法——包括 `MOVE` 这种没有专属导出的冷门动词：

```js
import { json, text } from '@sveltejs/kit';
export async function POST({ request }) {
  const { a, b } = await request.json();
  return json(a + b);
}
// 接住 PUT / PATCH / DELETE / MOVE ...
export async function fallback({ request }) {
  return text(`I caught your ${request.method} request!`);
}
```

没有 `fallback` 也没有对应动词导出时，该动词返回 405。用 `fallback` 统一兜底能避免"每个动词都导出但只是回 Not Allowed"的样板。

## 四、流式返回：ReadableStream 与 SSE

`Response` 第一个参数可以是 **`ReadableStream`**，于是能流式吐大数据、做 server-sent events：

```js
export function GET() {
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of await slowSource()) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
```

红线：**部署到会缓冲响应的平台（如 AWS Lambda）就没法真流式**——它会把整个 body 攒齐再发。这与 L3 讲页面流式（streaming）时"平台得支持 streaming 才有效"是同一条约束。SSE 的 `content-type: text/event-stream` + 保持连接也走这条路。

## 五、错误响应一致性与"按 Accept 头分叉"

端点里 `throw error(...)` 或抛出任何未预期错误时，Kit 的处理与页面路由**不同**：

- 响应会是一个 **JSON 形式的错误对象**，或（当客户端表明要 HTML 时）**fallback 错误页**，取决于请求的 **`Accept` 头**。
- **`+error.svelte` 组件此时不会被渲染**——端点没有 UI 边界，错误只以数据/兜底页形态出去。
- `error()` 抛的是"预期错误"，原样进响应、**不经过 `handleError`**；未预期错误才走 `handleError` 收口。要做统一的 `{ code, message }` 错误体，在 `handleError` 里归一未预期那部分，预期那部分自己在端点里 `json({ ... }, { status })` 控制形状。

一致性建议：一个 API 里所有错误体形状固定（比如 `{ error: { code, message } }`），别一半 `text` 一半裸字符串。

## 六、缓存：Kit 不替你加，头全得自己写

关键心智：**SvelteKit 对 `+server.js` 的响应不做任何自动缓存**。要给 CDN/浏览器设缓存策略，你在返回时手动写头：

```js
export async function GET({ url }) {
  const data = await getSomething(url.searchParams.get('id'));
  return json(data, {
    headers: {
      'cache-control': 'public, max-age=60, s-maxage=600, stale-while-revalidate',
      etag: `"${hash(data)}"`,
    },
  });
}
```

- `Cache-Control`：`public/private`、`max-age`（浏览器）、`s-maxage`（CDN）、`stale-while-revalidate` 是这套 API 的常用四件套。
- `ETag` / `If-None-Match`：命中就 `return new Response(null, { status: 304 })`，省带宽。
- 与 load 协同时，端点之外还有 `event.setHeaders`——在 server load 里设缓存头，它们会被并入页面响应，而不是覆盖（详见 L8 类型与 L3 数据协议）。
- 别忘了：**预渲染（`prerender = true`）的 GET 端点**在构建期就把响应烧成文件（见 L6），此时 `cache-control` 由你的托管层决定。

## 七、边界纪律：layout 不碰端点、跨请求逻辑进 handle

三条容易踩空的红线：

1. **`+layout.*` 文件对 `+server.js` 毫无影响**。想"每个请求都跑一段逻辑"（鉴权、限流、日志），那是 `handle` hook 的活（L5），别指望 layout。
2. **`OPTIONS` 的 CORS 头**：dev 下 Vite 会自动注入 `Access-Control-Allow-Origin`/`-Methods`，**生产不会**——要跨域必须自己导出 `OPTIONS` 或在 `handle` 里加，否则线上必挂。
3. **别拿 `event.url` 判断权限**。官方文档明确警告：`url` 是请求的一部分、可被篡改，"永远不要用它来决定用户是否有权访问某些数据"——鉴权要看 cookie/locals（L5），不信客户端传来的 URL/参数。

内部调用红利：同一次 SSR 里 load 用 `event.fetch` 调自家端点，**走的是函数直调、不经过 HTTP 网络往返**（L3 讲过），所以"内部 API + load 消费"没有想象中的双重开销。

## 八、自检清单

1. 说出 `+server.js` 支持哪些导出名，以及"只导出 GET 时 HEAD 请求得到什么"。
2. 解释为什么"从浏览器提交表单"优先用 form action 而非 POST endpoint，端点真正的用武之地是哪三类。
3. 写出带 `cache-control` + `etag` 的 `json()` 返回，并说明 304 分支怎么写。
4. 说明端点里 `throw error(400, ...)` 与未预期错误在"是否经 `handleError`""是否渲 `+error.svelte`"上的差异。
5. 复述三条边界纪律：layout 对端点的影响、OPTIONS 的 CORS dev/生产差异、为何不能用 `event.url` 判权。

🚀 **下一关**：kit-i18n-routes——用 `[[lang]]` 可选段承载语言、matcher 限定语言码、reroute/handle 做协商、hreflang 闭合 SEO。
