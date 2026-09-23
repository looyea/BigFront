# node-http 面试题精选

> 共 15 题，覆盖 **req/res 本质 / 请求解析 / body 与背压 / 响应与状态码 / 路由与框架关系 / keep-alive 与流式 / 客户端 fetch / 安全** 八类。

---

## 一、req/res 本质

### 1. `http.Server` 是 EventEmitter 吗？`(req,res)` 回调和 `app` 是什么关系？

是。`http.createServer(listener)` 内部把 `listener` 注册为 `'request'` 事件处理器（呼应 node-events 第五节）：每解析完一个请求头，就 `emit('request', req, res)`。`req`（`IncomingMessage`）与 `res`（`ServerResponse`）都是**建立在底层 socket 上的流**——req 读、res 写。Express 的 `app` 本质就是一个 `(req, res) => {}` 函数（`express()` 返回的对象可传给 `http.createServer(app)`，它就是那个 request 监听器），中间件链在这个函数里依次调度（呼应 09-express L1、node-http 第一、四节）。

**来源**：Node.js — "http.createServer / event 'request'"; Express — "app is a request handler function"

---

## 二、请求解析

### 2. 为什么 `req.url` 不能直接 `new URL(req.url)`？怎么拿到真正 pathname 与查询参数？

因为 `req.url` 只是 HTTP 请求行里的目标，形如 `/users/42?x=1`，**没有 scheme/host**，`new URL('/users')` 会抛 `TypeError`（缺 base）。正确：`new URL(req.url, \`http://${req.headers.host}\`)`，再取 `.pathname`、`.searchParams`（呼应 node-path-url 第 7 题、node-http 第二节）。反向代理/HTTPS 场景 host 要从 `X-Forwarded-Host` 或配置拿，别盲信 `Host` 头（Host header injection 风险，呼应 Express L6）。

**来源**：Node.js — "request.url is path+query only"; WHATWG — "URL base"

### 3. `req.headers` 里键的大小写规则？为什么 `set-cookie` 要特别处理？

HTTP 头名大小写不敏感，Node 把它们**统一转成小写**存进 `req.headers` 对象，重复的普通头会合并成数组（少数如 `cookie` 用 `, ` 合并）。但**`set-cookie` 例外**：多条 Set-Cookie 必须各自独立保留、不能被合并，所以 Node 在 `req.headers['set-cookie']` 给数组、写响应时要用 `res.append`/`getHeader('Set-Cookie')` 保证多条不丢（呼应 Express L5 认证、node-http 第二节）。要看未经合并的原始头用 `req.rawHeaders`。

**来源**：Node.js — "request.headers lowercase / set-cookie"; RFC 9110 — "field names case-insensitive"

---

## 三、body 与背压

### 4. 手写 `req` body 收集，为什么既要限大小又要处理 `error`？不处理会怎样？

① **限大小**：`req` 是不可信的外部流，若不设上限，攻击者发超大 body 会被你全 `push` 进数组 → 内存耗尽（DoS，呼应 node-streams interview 第 12 题）。累计 `size>limit` 就 `reject(413)`+`req.destroy()`。② **处理 error**：客户端中断/网络错误会让 `req` `emit('error')`，未监听则**崩进程**（'error' 语义，呼应 node-events 第三节）。两者都漏 = 一个能被轻松打崩的服务。`body-parser`/`express.json({limit})` 帮你内置了这些防护（呼应 Express L3 上传、L6 安全）。

**来源**：Node.js — "read body stream + size limit"; OWASP — "unbounded payload / DoS"

### 5. `Content-Length` 和 `Transfer-Encoding: chunked` 分别怎么界定 body？你写流式响应该注意什么？

`Content-Length` 预先声明 body 精确字节数（接收方读够这么多即结束）——**必须是字节数**（用 `Buffer.byteLength` 非 `str.length`，呼应 node-buffer 第 5 题）。当边生成边发、总长未知时用 `Transfer-Encoding: chunked`：body 分成若干"长度头 + 数据"块，以 `0\r\n\r\n` 结束，无需 `Content-Length`。写流式响应（SSE、大文件）时：**别手动设 Content-Length**（交给 Node 用 chunked），并且一定要在结束时 `res.end()`，否则连接不闭合、客户端永远等（呼应 node-http 第五、七节）。

**来源**：RFC 9112 — "Content-Length / chunked"; Node.js — "response writeHead"

---

## 四、响应与状态码

### 6. `res.writeHead`、`res.statusCode`、`res.setHeader` 关系？何时 headers 就"发出、不能再改"了？

`res.statusCode = n` 与 `res.setHeader(k,v)` 都在"缓冲"待发的状态与头；`res.writeHead(status, headers)` 是**一次性显式提交**状态+头。一旦**头被发送**（`writeHead` 被调、或第一次 `res.write()`/`res.end()` 触发隐式 flush headers），再 `setHeader`/改 `statusCode` 就无效并报 `ERR_HTTP_HEADERS_SENT`。所以：**先设好所有状态码和头，再开始写 body**（呼应 Express：`res.set/ status` 要在 `res.send` 前）。3xx 配 `Location`、201 配新建资源 `Location`、4xx/5xx 选对语义是基本功。

**来源**：Node.js — "writeHead vs setHeader / ERR_HTTP_HEADERS_SENT"

### 7. 常见状态码：201、204、301 vs 302、400 vs 401 vs 403 vs 404、429、500 vs 502 vs 503 分别表达什么？

- **201 Created**：成功创建资源（配 `Location`）。**204 No Content**：成功但无响应体（如 DELETE）。
- **301 永久重定向**（应缓存/更新书签）vs **302/307 临时**（307 保持方法不变，302 历史上多被当 GET）。
- **400** 请求格式/参数错；**401 Unauthorized** 未认证（"你是谁"）；**403 Forbidden** 已认证但无权限（"你能不能"）；**404** 资源不存在；**429** 限流（配 `Retry-After`）。
- **500** 服务器内部错误；**502 Bad Gateway**（反代上游返回无效）；**503 不可用**（过载/维护，配 `Retry-After`）。
用对状态码是 REST 的核心（呼应 Express L5 REST、L6 认证/限流）。

**来源**：RFC 9110 — "HTTP status codes"; REST 惯例

---

## 五、路由与框架关系

### 8. 只用 `http` 能做出 Express 的路由吗？Express 额外给了你什么？

能——`http` 给你 method+url，`if/switch`/正则匹配即可手写路由（呼应 node-http 第四节）。Express 额外提供：① **路由表 + 参数解析**（`/users/:id` → `req.params`）、嵌套路由器、HTTP 方法简写；② **中间件洋葱模型**（`app.use`、`next()`、错误中间件 `(err,req,res,next)`）；③ **res 增强**（`res.json/send/status/redirect`）、`req.body`（配合 body-parser）、`req.query`；④ 静态服务、视图引擎集成。本质都是**在 `http` 的 req/res 上加糖与调度**——懂裸 http 才能看懂 Express 源码与报错（呼应 09-express 全篇）。

**来源**：Express — "Routing / Middleware guide"; Node.js — "http"

---

## 六、keep-alive 与流式

### 9. HTTP keep-alive 是什么？为什么 `keepAliveTimeout` 要小于负载均衡/反向代理的空闲超时？

keep-alive 让**一个 TCP 连接上顺序复用多个 HTTP 请求**，省掉反复 TCP（+TLS）握手，显著降延迟（呼应 node-net-dns 第 5、11 题）。Node `server.keepAliveTimeout` 是"空闲 keep-alive 连接多久被服务端关闭"。若它**大于**上游代理（Nginx/ALB）的空闲超时，会出现**竞态**：代理刚要在这个连接上发新请求，Node 恰好关掉，导致偶发 **502/ECONNRESET**。所以铁律：**Node 的 keepAliveTimeout 略小于代理的空闲超时**（如代理 65s、Node 设 61s/60s），并让 `headersTimeout > keepAliveTimeout`（呼应 node-net-dns 第 11 题、Express L8、node-deploy-perf）。

**来源**：Node.js — "server.keepAliveTimeout"; AWS/社区 — "keep-alive 502 race with ALB/nginx"

---

## 七、客户端 fetch

### 10. Node 的 `fetch` 和 `http.request` 怎么选？`fetch` 响应体是什么流、怎么转成 JSON 或落地文件？

`fetch`（Node 18+ 全局，基于 undici）是 **WHATWG 标准 API**，简洁、跨环境一致，日常首选；`http.request` 更底层（细粒度 socket 选项、自定义 agent/连接池、mTLS）。`fetch` 的 `res.body` 是 **Web `ReadableStream`**：`await res.json()`/`await res.text()` 一次性取（小数据），或 `Readable.fromWeb(res.body)` 转 Node 流再 `pipeline` 写盘/处理（大文件流式下载，呼应 node-stream-pipeline 第六节、node-http 第六节）。超时/取消用 `AbortController`：`fetch(url,{signal})`。

**来源**：Node.js — "fetch API / undici"; WHATWG — "Fetch / ReadableStream"

---

## 八、安全与生产

### 11. 裸 http 服务对外暴露，你会立刻加哪些安全/健壮配置？

① **超时三件套**：`requestTimeout`（收完整请求时限）、`headersTimeout`、`keepAliveTimeout`——防 slowloris（呼应 node-net-dns 第 11 题）；② **body 大小上限**（第 4 题）；③ **隐藏指纹**：不改 `Server` 头默认值会暴露，去掉/伪装；错误别回传 stack（呼应 Express L6、node-async-errors 第 10 题）；④ 校验 `Host`、`Origin`（防 Host header 攻击/CSRF，呼应 Express L6）；⑤ **信任代理时才解析 `X-Forwarded-*`** 并设 `app.set('trust proxy')`；⑥ 生产用 HTTPS（下一关）+ 反向代理终结 TLS。裸 http 适合内网/被代理，公网直裸奔基本必被扫。

**来源**：OWASP — "Transport Layer / HTTP hardening"; Node.js — "server timeouts"

### 12. 客户端在半途断开（关掉浏览器），服务端 handler 怎么感知并停止昂贵工作？

监听 `res`（或 `req`）的 **`'close'`** 事件，并用 **`res.writableEnded`** 区分"正常写完"还是"提前断开"：

```js
let aborted = false;
res.on("close", () => { if (!res.writableEnded) { aborted = true; controller.abort(); } });
```

感知到断开就 `AbortController.abort()`，用它取消进行中的下游 fetch、停止 `pipeline`（呼应 node-stream-pipeline 第 10 题）、中断 DB 查询等，避免"没人要了还在算"浪费资源。Node 16 起 `'close'` 在请求完成/失败后都会触发（语义更可靠）。老代码里区分 `aborted` 属性已不推荐，用 `writableEnded`/`req.destroyed` 判断。

**来源**：Node.js — "response 'close' / writableEnded"; 社区 — "detect client disconnect node"

---

## 补充（新专题 13-15）

### 13. 客户端中途断开，服务端 handler 里怎么感知并止损？给完整机制。

事件链：req/res 是 socket 的视图——客户端断开触发 res close 事件与 req aborted（现代：req.aborted=false 但 res.close 必到；AbortSignal 版：AbortSignal.any([signalTimeout, res close 转 signal])）。止损动作：① 停止生成（流式响应里 destroy 生产流——本关 pipeline signal 题的 HTTP 实装）；② 取消下游（把同一 signal 透传给 fetch/DB 取消长查询）；③ 落账（已扣款/半提交要幂等对账，**别假设断开=未发生**）。误区：res.writableEnded 后 close 也到（正常完成）——判「半途」要 ended 标记。实现模板：`res.on('close', () => { if (!res.writableEnded) abortCtrl.abort(new Error('client disconnected')) })`。别忘了：响应头已发后断开你其实无法补救——止损价值在 CPU/带宽/下游账单。

**来源**：Node http 文档 res close/writableEnded 语义；AbortSignal 与流联动（本包 pipeline 关 signal 题）实战模式。

### 14. 裸 http 与框架之间：Express 到底在 http 之上加了什么？哪些能力裸写也能要？

Express 加的：路由表（方法+路径+参数提取）、中间件洋葱模型（错误签名 4 参）、req/res 增强（json/send/params 等便利层）、视图与 app 级配置。裸写也能要的：body 解析+大小限制、超时（本关收 body 题）、统一错误出口（try/catch 包裹 + res 未头时兜 500）、日志中间件化（栈式 handler）。选型判据：需要「中间件顺序的心智模型」时框架价值最大；单接口 webhook/内部代理裸 http 反而少一层黑箱（本关「只用 http 能做出路由吗」题的立场：能，但要自己维护 404/方法不匹配/转义三件套）。趋势注脚：Fastify 证明「贴近原生+schema」可以更快——http 层原语（IncomingMessage 事件模型）理解越深，选框架越不慌。

**来源**：Express 源码 router/middleware 层与 Node http 文档对照；Fastify 官方「为什么不是 Express」性能设计篇。

### 15. Node http 客户端侧：fetch、http.request、undici 三者关系与选型。

关系：Node 18 的 fetch **就是 undici 的内置暴露**（globalThis.fetch→undici 的 fetch+dispatcher 体系），三方安装 undici 可用更多控制（拦截器、连接池参数）。差异：fetch 流式 body/AbortSignal/keepalive 默认好，但没有 per-request timeout（用 AbortSignal.timeout）；http.request 是 legacy：agent 选项、socketPath、method 大小写等旧语义，新代码官方口风「use fetch」；undici 直用：APIResponse、mock 拦截（测试！本关 http 集成测试的客户端替身）、Client/Pool 连接层自定义。选型：业务默认 fetch；要连接级策略（自定义 dispatcher 走代理/内网解析）或 mock 测试 → undici；遗留隧道/代理老栈才 http.request。陷阱：fetch 对**非 2xx 不 reject**（ok=false 手动判——本关状态码题在客户端侧的回声）、自动 gzip 但 body 流式解压后 Content-Length 变化。

**来源**：Node 官方 fetch 文档（undici 实现说明与「不要用 http.request 新代码」指引）；undici docs Dispatcher/mock 章节。
