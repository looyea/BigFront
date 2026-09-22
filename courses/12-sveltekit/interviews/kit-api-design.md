# kit-api-design 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) +server.js 的路由模型是什么？处理器签名与返回契约？
**来源**：Kit 端点基础开场题的转述。

导出名字等于 HTTP 动词的函数即该路由对该动词的处理器：GET/POST/PUT/PATCH/DELETE/OPTIONS/HEAD，外加兜底的 fallback。签名固定 `(event: RequestEvent) => MaybePromise<Response>`（类型 RequestHandler 从 ./$types 取），**必须返回 Response 或抛错**，不能返回裸对象。URL 不带动词、动词靠导出名分派，是标准 REST 表意。

### 2. (A) 只导出 GET 时 HEAD 请求怎么走？没导出的动词返回什么、如何兜底？
**来源**：端点方法处理细节题的转述。

只要导出了 GET，HEAD 请求会自动返回该 GET 响应体的 content-length，不必单独写 HEAD。没专门导出、也没 fallback 的动词返回 405。导出 fallback 可接住任何未专门处理的方法，包括 MOVE 这种无专属导出的冷门动词，用它统一兜底省样板。

### 3. (A) json()/text()/error() 三个辅助器分别解决什么？
**来源**：@sveltejs/kit 工具函数题的转述。

json(data, init?) 生成 JSON Response，自动补 Content-Type: application/json 与 Content-Length，init 带 status/自定义头。text(body, init?) 按原样生成、自动补 Content-Length。error(status, body?) 抛带状态码的预期错误，status 限 400–599。用它们是便利而非强制，直接 new Response 也完全可以。

### 4. (B) 端点里抛出的错误，和页面路由的错误呈现有何不同？
**来源**：错误处理边界高频题的转述。

端点没有 UI 边界：throw error(...) 或未预期错误时，响应按请求 Accept 头给 JSON 错误表示或 src/error.html 兜底页，**+error.svelte 不会被渲染**。error() 抛的预期错误原样出去、不经 handleError；未预期错误才走 handleError 收口。要统一错误体形状，未预期部分在 handleError 归一，预期部分自己在端点里 json({code,message},{status}) 控制。

### 5. (B) 用 event.url 判断"用户能否访问这条数据"为什么不安全？
**来源**：端点安全红线题的转述。

官方文档明确警告：url 是请求的一部分、可被客户端篡改，"永远不要用它来决定用户是否有权访问某些数据"。鉴权应基于 cookie 解出的会话、挂在 event.locals（L5），而非 URL 或 query 参数里的身份标识。

### 6. (B) 写了 OPTIONS 处理器，本地跨域好好的、上线就挂，为什么？
**来源**：CORS dev/生产差异排坑题的转述。

dev 下 Vite 会自动注入 Access-Control-Allow-Origin 和 Access-Control-Allow-Methods，生产不会带这两个头。要真正跨域，必须在 OPTIONS 处理器或 handle 里自己加这些响应头，否则线上必挂。

### 7. (C) 什么时候用 form action、什么时候用 +server.js 端点提交数据？
**来源**：action vs endpoint 选型对比题的转述。

官方建议：从浏览器表单提交数据，一般 action 更好——它天然带回显校验、use:enhance、错误边界、成功重渲染并重跑 load 那一整套协议。端点留给真正的对外 API：第三方/移动端调用、webhook、文件下载、SSE，或需要完全控制 Response 的场合。

### 8. (C) 端点如何做流式返回？什么平台会失效？
**来源**：streaming 端点题的转述。

Response 第一个参数可传 ReadableStream，用于流式吐大数据或做 server-sent events。红线：部署到会缓冲响应的平台（如 AWS Lambda）无法真流式，它会把整个 body 攒齐再发——与页面 streaming 对平台的要求同源。

### 9. (A) SvelteKit 对端点响应做自动缓存吗？缓存头该怎么加？
**来源**：API 缓存策略题的转述。

不做任何自动缓存，Cache-Control/ETag 全要在返回时自己写：json(data, { headers: { 'cache-control': 'public, max-age=60, s-maxage=600, stale-while-revalidate', etag: ... } })。ETag 命中 If-None-Match 就 return new Response(null,{status:304})。与 load 协同时用 event.setHeaders 把缓存头并入页面响应。

### 10. (B) 同一页 SSR 时 load 调自家端点，会有额外 HTTP 开销吗？
**来源**：内部 fetch 优化题的转述。

不会走网络。load 里用 event.fetch 请求站内 +server.js 路由时，运行在服务端会直接调用处理函数、绕过 HTTP 往返；且 SSR 期间其响应会被捕获内联进 HTML，水合时从 HTML 读取，避免二次请求。所以"内部 API + load 消费"没有想象中的双重开销。

### 11. (D) 设计一个既要给自家页面 load 用、又要给移动端调的 /api/articles 端点，你怎么安排？
**来源**：API 分层设计题的转述。

GET /api/articles 支持分页/过滤用 url.searchParams，返回 json 并设合理 cache-control（列表短 max-age + s-maxage、CDN 挡量）与 etag。自家页面 load 用 event.fetch 走内部直调；移动端走公网，需真实 HTTP，故要在 OPTIONS/handle 里补 CORS、用 cookie 或 token 经 locals 鉴权（不信 url/query 里的身份）。列表与详情分路由（/api/articles/[id]），错误统一 {code,message} 形状。

### 12. (D) 要在端点里实现 SSE 实时推送，写清要点与坑。
**来源**：实时接口设计题的转述。

用 ReadableStream 作 Response body，content-type: text/event-stream，start 里把消息 enqueue（每帧 `data: ...\n\n`），保持连接不 close 直到客户端断开；在 pull 里对接事件源、用 controller 错误时 close。坑：① 缓冲型平台（Lambda）不真流式；② Nginx 等反代要关响应缓冲、超时调大；③ 客户端断连要感知并释放资源；④ 鉴权走不了 EventSource 的自定义头，通常用 cookie/locals 或首帧握手。

🚀 **下一组**：kit-i18n-routes 面试题——可选段、matcher、协商路线与 SEO 闭环的高频考法。
