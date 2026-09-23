# exp-response 面试题精选

> 共 12 题，覆盖 **res 方法族 / 流式响应 / SSE / 缓存控制 / 安全 / 生命周期** 六类。

---

## 一、res 方法族

### 1. res.send() 和 res.json() 在 Express 5 有什么区别？

`res.json(obj)` → 设置 Content-Type: application/json + JSON.stringify → 调 res.send(string)。`res.send(body)` 可发 String/Buffer/Array/Object（自动 JSON）。Express 5 移除了 `res.send(status)` 的数字签名（不再 `res.send(200)` → 必须 `res.status(200).send()`）。`res.sendStatus(code)` 发纯文本状态描述。

**来源**：Express 5 Migration Guide — "res.send"; Express API — "res.json()" / "res.sendStatus()"

### 2. res.sendFile() 的安全注意事项有哪些？

① 必须配 `root` 选项限定可访问目录（防 `../../etc/passwd` 路径穿越）；② 用 `path.basename()` 清洗用户输入的文件名；③ 设 `maxAge` 让浏览器缓存减少 IO；④ `dotfiles: 'deny'` 禁止访问隐藏文件；⑤ 错误回调里区分 ENOENT/EACCES 给不同状态码。

**来源**：Express API — "res.sendFile()"; OWASP — "Path Traversal"; CWE-22

### 3. res.download() 和 res.sendFile() 的区别是什么？

`res.download(path, filename)` = `res.sendFile()` + `Content-Disposition: attachment; filename="xxx"` → 浏览器弹出保存对话框。可传第二个参数自定义文件名（不传则用原文件名）。大文件下载需配合 `res.setHeader('Content-Length')` 让浏览器显示进度。

**来源**：Express API — "res.download()"; MDN — "Content-Disposition"

### 4. res.redirect() 的 301/302/307/308 怎么选？

301 = 永久（SEO 传递权重 / 被缓存）；302 = 临时（默认 / 不缓存）；307 = 临时且**保持方法**（POST → POST）；308 = 永久且保持方法。Express 默认 302。如果重定向要保留 HTTP method 和 body → 307/308。

**来源**：MDN — "HTTP redirect status"; Express API — "res.redirect()"; RFC 9110 §15.4

---

## 二、流式响应

### 5. 用 pipe() 做大文件下载时，为什么不能直接 res.send(buffer)？

`fs.readFileSync(5GB)` → OOM 崩溃。pipe 流式：`fs.createReadStream(path).pipe(res)` → 每次只占 64KB 内存 → 适合任意大小。且 pipe 自动处理背压（highWaterMark）。需监听 error 事件处理文件不存在。

**来源**：Node.js — "Streams and pipe()"; NearForm — "Node.js Best Practices — Streaming"

### 6. 流式响应中途出错（比如 DB 连接断开）怎么处理？

已发送的响应头无法撤回（不能 writeHead(500)）。解决：① 在 pipe 前检查资源有效性；② 监听 stream 'error' → `res.destroy(err)` 断开连接（客户端感知不完整）；③ 如果是 JSON API → 先完整构建再发；④ 用 chunked transfer 发 trailer header 标记错误。

**来源**：Node.js streams — "error event handling"; StackOverflow — "handle pipe error express"

---

## 三、SSE

### 7. SSE 和 WebSocket 在 Express 里如何选择？

SSE：单向推送（Server→Client）、纯 HTTP、自动重连（Retry-After）、跨域用 CORS、走 HTTP/2 多路复用无额外连接。WebSocket：双向、独立协议（ws://）、需 ws/socket.io 库、适合实时协作/游戏。80% 的通知场景用 SSE 更简单。

**来源**：MDN — "Server-sent events" vs "WebSocket"; HTML5Rocks — "DEMO: Server-Sent Events"; socket.io docs — "When to use"

### 8. SSE 连接为什么需要定期发送心跳？Nginx 对 SSE 有什么影响？

中间代理/CDN 有 `proxy_read_timeout`（默认 60s）→ 如果服务端无数据发送 → 代理断开连接。心跳：每 15-30s 发 `: ping\n\n`（注释帧客户端忽略）。Nginx 需 `proxy_buffering off;` + `X-Accel-Buffering: no` 头 → 否则响应被缓冲 → 客户端收不到实时推送。

**来源**：MDN — "EventSource"; Nginx docs — "proxy_buffering"; W3C — "Server-Sent Events spec §9.5 Comment"

---

## 四、缓存控制

### 9. Cache-Control 的 public/private/max-age/no-cache/no-store 分别什么含义？

- `public`：任何人（含 CDN）可缓存
- `private`：仅浏览器可缓存，CDN 不存
- `max-age=3600`：1 小时内直接用缓存不发请求
- `no-cache`：每次都向服务器验证（走 304），非"不缓存"
- `no-store`：完全不缓存（密码/API Token 响应）

优先级：`no-store > no-cache > max-age`。

**来源**：MDN — "Cache-Control"; RFC 9111 §5.2; web.dev — "Cache"

### 10. res.vary('Accept-Language') 为什么对国际化 API 重要？

不设置 → CDN 缓存第一个请求的响应（比如中文）→ 英文用户拿到中文内容。设 Vary → CDN 按 Accept-Language 分别存储变体。但 Vary 字段过多会导致缓存命中率暴跌（笛卡尔积）。

**来源**：MDN — "Vary header"; Express API — "res.vary()"; RFC 9110 §12.5.5

---

## 五、安全相关

### 11. res.setHeader('Set-Cookie', ...) 在 Express 里推荐怎么写？

用 `res.cookie(name, value, options)` → 自动序列化 + 编码。关键选项：`httpOnly: true`（防 XSS 窃取）、`secure: true`（仅 HTTPS）、`sameSite: 'strict'|'lax'|'none'`（'none' 必须配 secure）。`res.clearCookie(name)` 设过期时间过去即删除。

**来源**：Express API — "res.cookie()" / "res.clearCookie()"; OWASP — "Session Management Cheat Sheet"; MDN — "SameSite cookies"

### 12. 为什么 res.locals 比 res.set('X-Custom', value) 更适合模板传值？

res.locals 是请求级隔离的 JS 对象 → 模板里直接用 `<%= user.name %>` → 不暴露到 HTTP 响应头。res.set 写的是 HTTP 头 → 客户端可见（泄露内部信息如 user role/permissions）+ 有大小限制（8KB header）。res.locals 仅服务端模板消费。

**来源**：Express API — "res.locals"; Pug/EJS docs — "locals"; OWASP — "Response headers should not contain sensitive data"
