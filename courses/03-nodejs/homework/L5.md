# L5 课后作业：网络与 HTTP 底层

> 覆盖 **node-net-dns / node-http / node-https-tls** 三关。先读代码/找 bug，再动手写，最后场景与简答。环境：Node 20+。

---

## 一、读代码，找 bug / 预测（10 小题）

**1.** 这个"聊天协议"处理函数有什么 TCP 层的问题？
```js
socket.on("data", (chunk) => {
  broadcast(JSON.parse(chunk.toString()));   // 假设每次 data 正好是一条完整 JSON
});
```

**2.** 输出/结果可能是什么？为什么？
```js
socket.write("hello");
socket.write("world");
// 对端一次 'data' 可能收到什么？
```

**3.** `dns.lookup('x.com', cb)` 和 `dns.resolve4('x.com', cb)` 谁可能读到 `/etc/hosts`？谁走 libuv 线程池？

**4.** 这个 http handler 会怎样？
```js
http.createServer((req, res) => {
  if (req.url === "/") res.write("hi");   // 其余分支什么都不做
});
```
> 请求 `/nope` 会发生什么？

**5.** 找出两个 bug：
```js
http.createServer(async (req, res) => {
  const body = JSON.parse(await collect(req));   // 没有大小上限、req 出错也没处理
  res.end(body);
});
```

**6.** 这段设置响应头的问题？
```js
res.end("done");
res.setHeader("X-Foo", "bar");   // ← ？
```

**7.** 为什么这行可能打印出被"截断"的中文？
```js
const buf = await someChunkStream; console.log(buf.toString("utf8"));  // 若 buf 末尾是半个汉字
```
> 改用哪个工具能安全流式解码？（呼应 node-buffer）

**8.** `https.get(url, { rejectUnauthorized:false }, ...)` 有什么安全隐患？

**9.** 这段 keep-alive 配置为什么会导致偶发 502？
```
Nginx upstream keepalive 空闲超时 = 60s
Node server.keepAliveTimeout = 90s
```

**10.** TLS 握手后，真正用来加密网页内容的是"服务器证书里的公钥"吗？如果不是，是什么？

---

## 二、手写编程题（5 题）

**11.** 写一个**行协议 TCP 回声服务**：用 `\n` 分帧，正确处理"一条消息被拆成多个 data 块 / 多个消息粘在一个块"，对每完整行回 `ECHO:<line>\n`（用接收缓冲累积，切不出完整行就留着）。

**12.** 用裸 `http` 写一个迷你 REST：`GET /`→文本；`GET /json`→`{now}`；`POST /echo`→回显 JSON body（自己收集流 + 限 1MB + 挂 error）；其余 404。全部用统一 `send(res, status, objOrText)` 助手。

**13.** 用 `for await (const chunk of req)` 重写第 12 题的 body 收集，并保留"超限 413 + 出错 400"的错误语义（呼应 node-stream-pipeline、node-async-errors）。

**14.** 生成自签证书（给出 `openssl` 命令），用 `https.createServer` 起一个服务；再分别用 `curl -k` 和不带 `-k` 访问，观察证书校验报错，然后用 `ca` 指向自签证书的方式**正确**地让它通过校验（不许关 `rejectUnauthorized`）。

**15.** 用 `dgram` 写一对 UDP ping/pong：客户端 `send` 一个数据报，服务端 `message` 回调里 `send` 回 `pong`。打印往返，并说明"如果丢包会发生什么、TCP 会怎样"。

---

## 三、场景题（1 题）

**16.** 你的 Express 应用部署在 ALB（负载均衡）后面，用户反馈"偶尔 502"，且 `req.ip` 全是 ALB 的内网 IP、`req.secure` 恒为 false（明明用 https 访问）。请回答：
- (a) `req.ip` 不对是因为没配什么？（提示 `trust proxy`、`X-Forwarded-For`）怎么修？
- (b) `req.secure` 恒 false 是因为 TLS 在**哪里终结**、Node 收到的是什么协议？怎么让 Express 正确判断？（呼应 node-https-tls 第八节、node-http interview 第 11 题）
- (c) 偶尔 502 最可能是哪两个超时没对齐？给出调整原则。（呼应 node-net-dns 第 11 题、node-http interview 第 9 题）

---

## 四、简答题（3 题）

**17.** 画出 HTTPS 的分层（IP/TCP/TLS/HTTP），并解释"证书证明的是公钥归属，加密数据的是对称会话密钥"。（呼应 node-https-tls 第一、三、四节）

**18.** `http.createServer` 的回调里，`res.end()` 为什么必须被调用？`express.json()` 在裸 http 层等价于你手动做了哪些事？（呼应 node-http 第一、三节）

**19.** `dns.lookup` 与 `dns.resolve` 的区别？为什么"大量并发 `dns.lookup` 会打满线程池而网络 I/O 不会"？（呼应 node-net-dns 第五、六节）

---

## 五、挑战题 🏆

**20.** 🏆 不用任何框架，只用 `http`/`fs`/`stream`，实现一个**带断点续传**的静态文件下载服务：
- 解析 `Range: bytes=start-end` 请求头，返回 `206 Partial Content` + `Content-Range`（无 Range 则 `200` + `Content-Length`）；
- 用 `fs.createReadStream(path,{start,end})` → `pipeline` 到 `res`（恒定内存，呼应 node-stream-pipeline）；
- 路径来自 URL，**必须防路径遍历**（把 `decodeURIComponent` 后的路径 resolve 到根目录并校验 `startsWith`，呼应 node-path-url 第 11 题）；
- 客户端中途断开：监听 `res.on('close')` 判断 `writableEnded`，及时 `destroy` 读流、停止读盘（呼应 node-http interview 第 12 题）；
- 文件不存在 404、非法 Range 返回 `416`。
用浏览器"下载管理器暂停/恢复"或 `curl -C -` 验证续传生效。
