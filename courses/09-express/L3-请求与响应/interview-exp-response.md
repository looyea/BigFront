# exp-response 面试题精选

> 共 15 题，覆盖 **res 方法族 / 流式响应 / SSE / 缓存控制 / 安全 / 生命周期** 六类。

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

---

## 补充（新专题 13-15）

### 13.  res.redirect 的 301/302/303/307/308 你在真实项目里怎么选？讲清楚方法改写这个坑。

核心分歧在"方法与 body 是否允许改写"：301/302 历史上被浏览器实现为"任何方法转 GET"（POST 跳 302 后 body 丢失是既成事实的标准漂移），303 是"显式规定转 GET"的合法化（PRG 模式：POST 创建→303 跳详情页，防刷新重复提交），307/308 是"方法严禁改写"的严格保持版（POST 到旧域名迁移必须 308，否则 body 消失）。选择矩阵：临时 URL 变更且要保方法→307；永久且要保→308；表单 POST 后的落地跳转→303；SEO 永久合并→301；历史遗留 302 别再新增。工程坑位：① 相对路径 redirect 在 base 不同的挂载点下拼错目标（Express 的 res.redirect 第二参可 relative 但依赖 X-Forwarded-*）；② 重定向 URL 来自用户参数=开放重定向漏洞，白名单校验是唯一解（登录跳回场景最高发）；③ HSTS 与 301 缓存的耦合——错误 301 会被浏览器永久缓存（302 不会），发错难回收，所以"临时迁移先 307 观察再转 301"。加分句：状态码选错是协议级 bug，修复要靠浏览器缓存过期——宁严格不历史。

**来源**：RFC 9110 重定向状态码；MDN 307/308；知乎《302 之后 POST 变 GET 引发的丢单》

### 14.  大文件下载接口用 pipe 直出，中断检测、限速、断点续传三件事怎么做？

直出形态：res 是 Writable，fs.createReadStream(path, { start, end }) 按 Range 头开窗，用 stream.pipeline（不是 src.pipe）串接以传播错误与清理句柄——漏 pipe 的错误监听是 fd 泄漏经典源。中断检测：req/res 双监听 close + req.aborted，发现客户端断开立即 pipeline.destroy() 释放读流（不释放=磁盘带宽和 fd 被"已死的下载"占满）。限速：管道上不自动降速（背压只保内存不保带宽），要手工 Transform 令牌桶或在 Nginx 层 limit_rate（能到源头就不到源头）。断点续传：解析 Range（bytes=a-b / 多段 byteranges 要 206 multipart/byteranges 编码）、响应 Content-Range + Accept-Ranges，ETag/If-Range 保证续传拼的是同一版本文件（文件更新过则整份重发）。架构边界：应用直出大文件在 Node 单线程事件循环模型下 CPU 占用小但带宽与 fd 成本高，量大就 X-Accel-Redirect（发内部重定向头让 Nginx 直发文件，应用只做鉴权）或对象存储签名 URL——"应用参与字节流"应该是例外而不是默认。收口：下载接口的考题本质是"谁拥有什么资源"：鉴权归应用、字节流归更便宜的层。

**来源**：MDN Range 请求；Node.js stream 文档（pipeline）；掘金《我们用直出把网关打挂的一个周末》

### 15.  响应里混用 res.set / res.append / res.cookie / res.locals，说说各自语义与踩坑点。

语义分层：res.set/res.header 是覆盖写；res.append 对同名头追加（数组语义，Set-Cookie 这类可重复头的正确写法，但 Express 对多数头 append 会拼逗号——只有协议上允许多值的头才该 append）；res.cookie 是 Set-Cookie 的结构化生成器（序列化 expires/maxAge/httpOnly/sameSite/partitioned，手拼字符串必漏编码）；res.locals 不上线，是本次响应链上的模板/中间件共享容器（每请求新对象，挂中间件产出的上下文）。高频坑：① 手动 res.setHeader("Set-Cookie", 多 cookie 字符串) 只发一条（要数组，append 或显式传数组）→ 部分浏览器拿不到关键 cookie 登录循环；② 同名头 append 到 Cache-Control（"no-store" + 中间件又加 "public"）→ CDN 行为诡异，控制类单值头永远覆盖、由唯一 owner 写；③ cookie 值超 4KB 静默丢弃、域写成子域正则化失败（apple.com vs apple.com 仿冒）；④ locals 上挂大对象（整份用户记录）传给所有下游渲染=内存与越权面。加分句：响应头是"多写入者的共享协议字段"，每个字段有唯一 owner（安全头归 helmet、cookie 归 auth、缓存归业务），append 型多头是 ownership 被破坏的信号。

**来源**：Express 官方 res API 文档；MDN Set-Cookie；SegmentFault《一个 Set-Cookie 数组引发的登录循环》
