# hooks.server.ts：handle 中间件管道

> 目标：建立"每条请求进来先过 handle、出去再被 handle 包一层"的洋葱心智——掌握 handle({event, resolve}) 的执行模型与 resolve 的三个渲染选项、locals 作为跨层数据总线、handleFetch 改写服务端出网、reroute 的 URL 重写、以及 server/client 两端 handleError 的分工（呼应 express-middleware 的洋葱、next-middleware 的收口定位）

## 一、三个 hooks 文件与"启动即执行"

Hooks 是**应用级**、你在特定事件上让 Kit 回调的函数。三个文件全部可选：

- `src/hooks.server.js` —— 服务端 hooks（handle/handleFetch/handleError/init…），只在 Node/构建期跑；
- `src/hooks.client.js` —— 客户端 hooks（handleError/onError…），只在浏览器跑；
- `src/hooks.js` —— 两端都跑的 hooks（reroute/transport）。

一个常被忽略的性质：**这些模块的顶层代码在应用启动时执行**（适合初始化 DB 客户端）。想"每请求前置"用 handle，想"一次性异步初始化"用 `init`（ServerInit，2.10+；若环境支持顶层 await，init 与写在模块顶层几乎等价——但 Safari 不支持顶层 await，init 是安全港；浏览器端 init 里的异步会**推迟水合**，别塞重活）。

## 二、handle：进来的那道门，出去的那层皮

```ts
// src/hooks.server.js
/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  // —— resolve 之前：请求前织入（鉴权、日志计时、塞 locals）——
  const start = Date.now();
  event.locals.user = await getUser(event.cookies.get('sessionid'));

  const response = await resolve(event);   // ← 交给 SvelteKit 渲染路由

  // —— resolve 之后：响应后织入（加头、改写）——
  response.headers.set('x-response-time', `${Date.now() - start}ms`);
  return response;
}
```

关键认知逐条钉死：
- **每条请求都跑**——无论 app 运行中还是**预渲染期**（build 时爬虫渲染每个路由也会调 handle 及其全部依赖如 load）；要排除构建期执行某段代码，先查 `$app/environment` 的 `building`。
- **静态资源请求不经 SvelteKit**——已预渲染成文件的页面走纯静态托管，handle 不触发。
- `resolve(event)` **永不抛错**，总返回带正确状态码的 `Promise<Response>`；但 **resolve 之外**的 handle 代码抛错是**致命的**——Kit 按 Accept 头回 JSON 错误或 fallback 页（L4 的 Responses 节在此闭环）。
- 未实现 handle 时默认 `({ event, resolve }) => resolve(event)`。
- **可返回自定义 Response 直接旁路**：`if (event.url.pathname.startsWith('/custom')) return new Response('custom response')`——这就是"用 handle 完全接管某路径"的机制（对标 next-middleware 的 rewrite/next()）。
- ⚠️ 改响应头并非总安全：`Response.redirect()` 等产物的 headers 是**不可变的**，直接 `.set` 抛 TypeError——需 `response = response.clone()` 后再改。

**洋葱的多层**：一个 handle 只能套一层，要多个中间件按序织入，用 `sequence` 辅助函数组合：`export const handle = sequence(sentry.init(), sessionAuth, addTiming, i18n)`——前一个的 `resolve(event, ...)` 调用后一个，天然形成"外层先处理后收尾"的洋葱序（呼应 Express 的 use 链，但显式由你排列）。

## 三、resolve 的三个渲染选项

`resolve(event, opts)` 的 opts 直接干预 HTML 生成：
- `transformPageChunk({ html, done })` —— 对 HTML 分块做自定义替换（`done:true` 是末块）。分块不保证是良构 HTML（可能只有开标签），但总在 `%sveltekit.head%`、layout/page 边界这类**合理位置**切。用途：注入主题 class、改写 head。
- `filterSerializedResponseHeaders(name, value)` —— 决定 load 里 `event.fetch` 拿到的响应**哪些头**被内联进 SSR 数据（默认**一个都不给**，所以 L3 讲过要 `name.startsWith('x-')` 之类显式放行）。
- `preload({ type, path })` —— 决定哪些 js/css/font/asset 加进 `<head>` 预加载（默认预载 js+css，asset 不预载）；**dev 模式不调用**（依赖构建期分析）。

## 四、locals：跨 handle→load→端点的数据总线

`event.locals` 是在 handle 里塞、供 `+server.js` 端点与 **server load** 读取的请求级容器（类型靠 `App.Locals` 声明）。它是 L3/L4 反复出现的那根线：handle 每条请求跑、早于 action 与 load，因此**鉴权的正确落点就是这里**（load 有缓存粘性、handle 没有）。但记住 L4 的教训——**action 改了 cookie，handle 不会为后续 load 重跑**，locals 得在 action 里手动同步。

## 五、handleFetch：改写出网那一跳

`handleFetch({ event, request, fetch })` 拦截**服务端执行时**（SSR/预渲染）由 `event.fetch` 发出的请求——在 endpoint/load/action/handle/handleError/reroute 里的 event.fetch 都归它管。经典用法：公网域名 `https://api.yourapp.com` 在 SSR 时改直连 `http://localhost:9999`，绕开中间的代理/负载均衡。这是 L3"event.fetch 五特性"里 handleFetch 逃生舱的完整落地：cookie 精控、内网直达、注入鉴权头都在此改写。

## 六、handleError：两端各一份，只接意外

L4 已定性，这里补工程面：
- 服务端 `HandleServerError`（入参含 RequestEvent）、客户端 `HandleClientError`（入参 event 是 **NavigationEvent**）——两份分开写，签名不同；
- 只对 **unexpected 错误**触发（`error()` 抛的 expected 不进来）；代码里抛的错 status 恒为 500、message 恒为 `"Internal Error"`（`error.message` 可能含敏感信息、`message` 才是可安全外显的）；
- **红线**：handleError 自己绝不能再抛；
- 返回值成为 `page.error`，要加字段先扩 `App.Error`（必含 message）。dev 下 Svelte 语法错的 error 带 `frame` 定位。

## 七、reroute 与 transport：两端 hooks 的双子

- `reroute({ url, fetch })`（hooks.js，2.3+）跑在 handle **之前**，返回改写后的 pathname 决定选哪条路由与 params——`/de/ueber-uns → /de/about` 类 i18n 别名，且 params 从**返回值**正确推导。三纪律：①**不改地址栏也不改 event.url**（纯内部映射）；②视为**纯、幂等**函数，客户端据同一 URL 只调一次并缓存；③2.18+ 可 async（用传入的 fetch，但此刻路由未知，handleFetch 里拿不到 params/id）。别拿它做重定向（那用 redirect），它只"换脑子选路由"。
- `transport`（hooks.js，2.11+）给 devalue 装自定义编解码器：`{ MyType: { encode, decode } }`，让 load/action 返回**自定义类实例**跨服务端/客户端边界存活——L3 说的"devalue 不支持自定义类型"的正解通道（Svelte 组件构造器就靠它或放 universal）。

## N、自检清单

1. handle 何时被调用（运行期/预渲染期）？哪种请求根本不经过它？resolve 之外抛错会怎样？
2. sequence 解决的什么问题？画出一个"日志→鉴权→计时"三层洋葱的进出顺序。
3. 为什么鉴权放 handle 而非 layout load？用 L4 的"handle 不重跑但 load 有缓存粘性"两面说清。
4. handleFetch 与 event.fetch 是什么关系？给出"SSR 内网直连"的最小改写。
5. reroute 和 redirect 的分工？为什么 reroute 必须纯且幂等？

🚀 下一关：kit-auth-session——把 handle + locals + cookies 三块拼成一套可上线的会话鉴权：httpOnly 纪律、登录态共享模式、逐路由 vs 中间件拦截的取舍。
