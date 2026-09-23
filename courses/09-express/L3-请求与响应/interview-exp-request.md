# exp-request 面试题精选

> 共 12 题，覆盖 **req 核心属性 / IP 获取 / 内容协商 / 条件请求 / Body 解析 / 生命周期** 六类。

---

## 一、req 核心属性

### 1. req.url 和 req.originalUrl 什么时候不同？举一个 Router 嵌套的例子。

`app.use('/api', router)` → 请求 `/api/users?page=1` 到达 router 内部时：`req.url = '/users?page=1'`（截去 mount 前缀 `/api`），`req.originalUrl = '/api/users?page=1'`（完整不变）。日志/签名验证需要 originalUrl，路由匹配用 url。

**来源**：Express 4.x/5.x API Reference — "req.originalUrl"; StackOverflow — "Difference between req.url and req.originalUrl"

### 2. req.params 和 req.query 的数据类型有什么不同？为什么？

`req.params` 永远是 string（从 URL 路径匹配出来）——`/:id` 匹配到 `/42` → params.id = "42"。`req.query` 由 qs 库解析 → 支持数组（`?tags=a&tags=b` → ["a","b"]）、嵌套对象（`?user[name]=x`）、但数字仍为 string。Express 5 默认 extended query（允许 `[]`/嵌套）。

**来源**：Express API — "req.params" / "req.query"; qs npm README

### 3. req.get('Content-Type') 和 req.headers['content-type'] 有什么区别？

`req.get(field)` 大小写不敏感 + 自动 referer→referrer 兼容 + 返回 undefined（非 404）如果 header 不存在。`req.headers[...]` 精确 key 匹配（Node http 全部 lowerCase）→ 必须写全小写。官方推荐 `req.get()` 更安全。

**来源**：Express API — "req.get()"; Node.js http.IncomingMessage.headers docs

---

## 二、IP 与协议获取

### 4. 反向代理后面如何正确获取客户端真实 IP？

必须 ① 设置 `app.set('trust proxy', 1)` 或信任列表；② 代理正确传递 `X-Forwarded-For` 头；③ `req.ip` 取 XFF 最左侧（或 `req.ips` 取完整链路）。不设 trust proxy → req.ip 永远是代理内网 IP（10.x/172.x）。

**来源**：Express API — "req.ip" / "trust proxy"; MDN — "X-Forwarded-For"

### 5. req.secure 为 false 但请求确实是 HTTPS，最可能的原因是什么？

Nginx/ELB 终结 TLS → 转发给 Express 是 HTTP → Express 看不到加密层。解决：① `trust proxy` + Nginx 传 `X-Forwarded-Proto: https` → req.secure = true；② 或用 `req.headers['x-forwarded-proto'] === 'https'` 手动判断。

**来源**：Express — "req.secure" / "trust proxy"; Nginx docs — "X-Forwarded-Proto"

---

## 三、内容协商

### 6. req.acceptsEncodings(['gzip','br']) 的匹配算法是什么？

按 Accept-Encoding 头的 q 权重排序 → 与传入数组逐一比较 → 返回第一个匹配的编码字符串。`*` 通配匹配任意。全不匹配返回 false → 应响应 406 Not Acceptable。浏览器通常发 `gzip, deflate, br, zstd`。

**来源**：Express API — "req.acceptsEncodings()"; MDN — "Accept-Encoding header"; RFC 9110 §12.5.3

### 7. req.xhr 判断原理是什么？移动端原生请求会有什么问题？

检查 `X-Requested-With: XMLHttpRequest` 头 → true。但 fetch API 默认**不**添加此头（只有 XMLHttpRequest/jQuery $.ajax 自动加）→ fetch 请求 req.xhr = false。需要前端手动 `headers: { 'X-Requested-With': 'XMLHttpRequest' }`。

**来源**：Express API — "req.xhr"; MDN — "fetch()"; jQuery — "jQuery.ajax settings"

---

## 四、条件请求与缓存

### 8. 如何手动实现一个完整的 304 条件响应流程？

```js
app.get('/article/:id', (req, res) => {
  const article = getArticle(req.params.id);
  res.set('ETag', crypto.createHash('md5').update(article.content).digest('hex'));
  res.set('Last-Modified', article.updatedAt.toUTCString());
  if (req.fresh) { res.sendStatus(304); return; }
  res.send(article.content);
});
```
`req.fresh` 对比 If-None-Match vs ETag / If-Modified-Since vs Last-Modified → 只要任一对不匹配 = stale。

**来源**：Express API — "req.fresh" / "req.stale"; RFC 9110 §13 — "Conditional Requests"; MDN — "ETag"

---

## 五、Body 解析

### 9. Express 5 内置了 express.json/express.text/express.raw/express.urlencoded，那 express-body-parser 第三方包还需要吗？

不需要——Express 5 已把 body-parser 提升为内置中间件。唯一注意：`express.json({ type: 'application/vnd.api+json' })` 自定义 MIME 匹配。若用 JSON 流式解析超大 body（>500MB）仍需 `stream-buffers` 等专用方案。

**来源**：Express 5 Release Notes — "Built-in middleware"; body-parser GitHub README

### 10. Content-Type 是 multipart/form-data 时 express.json() 会怎么处理？

express.json 的 type 选项默认 `application/json` → 不匹配 multipart → **跳过不解析** → req.body 为 undefined。需 multer/busboy/formidable 专用处理。如果两个都注册在同一请求路径 → multer 先消费 stream → json 无法再读。

**来源**：body-parser docs — "type option"; multer GitHub README; Express 5 — "req.body"

---

## 六、生命周期

### 11. req.on('aborted') 和 res.on('close') 分别在什么时候触发？处理逻辑有何不同？

`aborted`：请求体未完整接收就断开（上传中途关浏览器）。`close`：底层连接关闭（无论正常结束还是异常）。aborted 后 body 不完整 → 不要继续处理；close 后不能再 writeHead → 清理资源（关 DB stream / clearInterval）。Node 16+ 推荐统一监听 res.on('close')（包含 aborted 场景）。

**来源**：Node.js http — "request 'aborted' event"; Express API — "res.on('close')"; Node — "IncomingMessage destroyed"

### 12. Range 请求（断点续传）如何在 Express 中实现？

```js
app.get('/video', (req, res) => {
  const range = req.headers.range;
  if (!range) { res.sendFile(videoPath); return; }
  const { start, end } = parseRange(range, fileSize);
  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': end - start + 1,
    'Content-Type': 'video/mp4',
  });
  fs.createReadStream(videoPath, { start, end }).pipe(res);
});
```
206 Partial Content + Content-Range 头 → 播放器/下载器可分段请求。

**来源**：MDN — "Range header" / "HTTP 206"; Node.js — "fs.createReadStream({ start, end })"
