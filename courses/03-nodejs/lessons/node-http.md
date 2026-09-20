# 裸 http 模块：服务器与请求响应

> 目标：不用任何框架，用内置 `http` 亲手写一个服务器——这是理解 **09-express 之下到底发生了什么**的唯一正道。你会看到：`req`（`IncomingMessage`）和 `res`（`ServerResponse`）本质是 socket 上的**读流/写流**（呼应 node-streams、node-net-dns）；路由、解析 body、设状态码/头、发 JSON，Express 帮你做的那些"魔法"，全都能用裸 `http` 还原。学完你会对 Express 的每一个 API 都"知其所以然"。

---

## 一、最小服务器：一个回调说明一切

```js
import http from "node:http";

const server = http.createServer((req, res) => {   // 每个请求触发一次
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Hello World");                            // end = 发完并（可能）关闭
});
server.listen(3000, () => console.log("http://localhost:3000"));
```

- `createServer(fn)` 的 `fn` 就是**请求监听器**——Express 的 `app` 最终也就是被这样喂给 `http.createServer`（呼应 Express：`app` 是 `(req,res)=>{}`）。
- `req`：进来的**读流**（`IncomingMessage`），承载请求行、头、体；
- `res`：出去的**写流**（`ServerResponse`，是个 Writable），你用 `write`/`end` 往里写。

**`res.end()` 必须调用**，否则请求永远挂着（呼应 node-async-errors 第五节：Express async 路由没响应也是这个机制）。`writeHead(status, headers)` vs 分开的 `res.statusCode=` + `res.setHeader()`：两者等价，`writeHead` 一次性提交。

---

## 二、读请求：方法、路径、头

```js
http.createServer((req, res) => {
  req.method;                 // 'GET' | 'POST' ...
  req.url;                    // '/users/42?x=1' —— 只是相对路径+query（呼应 node-path-url 第 7 题）
  req.headers["user-agent"];  // 全小写键
  req.headers.host;
  // 解析出 pathname 与 query：
  const u = new URL(req.url, `http://${req.headers.host}`);
  u.pathname;                 // '/users/42'
  u.searchParams.get("x");    // '1'
});
```

`req.url` 不含协议/主机（是相对形式），要 `new URL` 得补 base（呼应 node-path-url 第三节）。`req.headers` 是一个普通对象、键全小写、重复头会成数组（`set-cookie` 例外，用 `getHeader`/`rawHeaders` 看原始）。

---

## 三、解析请求体：一条需要背压/大小防护的流

body 不自动给你——`req` 是 Readable，得**收集所有块**。而且必须防"超大 body"（内存攻击，呼应 node-streams interview 第 12 题）：

```js
function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error("payload too large"), { statusCode: 413 }));
        req.destroy();                 // 超限直接断
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);           // ★ 别忘了（呼应 node-events 第三节）
  });
}

// POST /users，application/json
const raw = await readBody(req);
const body = JSON.parse(raw);          // express 的 express.json() 做的就是这些 + 校验类型
```

`express.json()`、`body-parser` 本质就是"收集流 → 按 Content-Type 选解析器 → 挂到 `req.body`"。理解这一点，你就懂为何**忘了解析 body 时 `req.body` 是 undefined**（呼应 Express L5 校验）。

---

## 四、手写路由：一个 if/switch 就够起步

```js
http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "GET" && pathname === "/")       return send(res, 200, "home");
  if (req.method === "GET" && pathname === "/api")    return send(res, 200, JSON.stringify({ ok: true }), "application/json");
  if (req.method === "POST" && pathname === "/echo")  return send(res, 200, await readBody(req));
  send(res, 404, "Not Found");
}).listen(3000);

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}
```

Express 的 `app.get('/x', h)`、路由参数、中间件链，都是在**这套 method+path 匹配**之上加糖（呼应 Express L1/L5）。动态段 `/users/:id` 用正则或 `pathname.split('/')` 手解即可体会其原理。

---

## 五、响应：状态码、头、流式发送

```js
res.statusCode = 201;                          // 或 writeHead
res.setHeader("Location", "/users/42");        // 201 后配 2xx/3xx 语义
res.setHeader("Set-Cookie", ["a=1", "b=2"]);   // 多值用数组（呼应 Express L5 认证）
res.writeHead(200, { "Content-Type": "text/event-stream" });   // SSE
res.write("data: 1\n\n"); res.write("data: 2\n\n"); res.end();

// 大文件流式下载：把 Readable 直接 pipe 到 res（背压自动处理，呼应 node-stream-pipeline）
import fs from "node:fs";
const rs = fs.createReadStream("video.mp4");
res.setHeader("Content-Length", fs.statSync("video.mp4").size);
await import("node:stream/promises").then(({ pipeline }) => pipeline(rs, res));
```

`Content-Type`、`Content-Length`、`Location`、`Set-Cookie` 这些是**响应头的地基**（呼应 Express L4 静态、L5 认证）。用 `pipeline(rs, res)` 而非手撸 `on('data')`——错误与资源自动收口（呼应 node-stream-pipeline）。

---

## 六、发起请求：`http.request` 与内置 fetch

裸客户端：

```js
import http from "node:http";
const req = http.request(
  { host: "localhost", port: 3000, path: "/api", method: "GET", headers: { accept: "application/json" } },
  (res) => {
    let data = "";
    res.setEncoding("utf8");
    res.on("data", (c) => (data += c));
    res.on("end", () => console.log(res.statusCode, data));
  }
);
req.on("error", console.error);   // 连接失败也走 error（呼应 node-events）
req.end();
```

现代首选 **全局 `fetch`**（Node 18+，WHATWG 标准）：`const r = await fetch(url); const j = await r.json();`。`fetch` 的响应体是 Web `ReadableStream`，可用 `Readable.fromWeb` 转成 Node 流再 `pipeline`（呼应 node-stream-pipeline 第六节）。超时用 `AbortController`（呼应 node-net-dns 第 11 题、node-stream-pipeline 第 10 题）。

---

## 七、几个"面试爱问"的语义细节

1. **keep-alive**：HTTP/1.1 默认持久连接，一个 TCP 上跑多个请求（呼应 node-net-dns 第 5 题）；`server.keepAliveTimeout` 控空闲关闭（第 11 题）。
2. **chunked**：不知道总长时用 `Transfer-Encoding: chunked`，边生成边发，不设 `Content-Length`（流式响应的底层）。
3. **`res.write` 之后必须 `res.end`**：否则连接不结束、客户端一直等（"请求挂起"）。
4. **未捕获的 handler 异常**：裸 `http` 里抛错**不会自动变 500**，会让该请求出错/进程受影响（呼应 node-async-errors 第五节）——这就是 Express 要加错误中间件、要 `asyncHandler` 的根因。
5. **`req`/`res` 生命周期**：`'close'`（连接关闭，Node 老版本里"未完成也 close"）语义在 18+ 有调整，判断"客户端断开"用 `res.on('close')` + `res.writableEnded` 是否为 false。

---

## 八、自检清单

- [ ] `req`、`res` 分别是什么流？为什么 `res.end()` 非调不可？
- [ ] 为什么 `req.url` 要配 base 才能 `new URL`？
- [ ] 收集 body 为什么要加大小上限、为什么要监听 `req` 的 `error`？
- [ ] Express 的 `express.json()` 在裸 http 层做了什么？
- [ ] 流式下载大文件应该怎么把 fs 流接到 res？为什么用 pipeline？
- [ ] 裸 handler 抛错会怎样？这和 Express 错误处理有何关系？

---

## 🚀 部署预告

- 本关的 `http.createServer((req,res)=>…)` 正是 **09-express** 全部魔法的落点：`app`、中间件、`res.json`、错误中间件都是对 `req/res` 的封装（呼应）；
- 明文 HTTP 之上加 TLS = **node-https-tls**（`https.createServer` 用同一套 `req/res`）；
- `keepAliveTimeout`/`headersTimeout`/慢连接防护、`X-Forwarded-For` 与反向代理，在 **node-deploy-perf** 与 **Express L6/L8** 收口（呼应 node-net-dns 第 11 题）；
- 大文件 `pipeline(rs,res)` 把 L4 全链路用上（呼应 node-stream-pipeline）。

下一关进入 **node-https-tls**：给 TCP 套上加密层，把 `http` 升级成 `https`。
