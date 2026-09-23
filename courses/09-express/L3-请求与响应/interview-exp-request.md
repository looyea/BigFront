# exp-request 面试题精选

> 共 15 题，覆盖 **req 核心属性 / IP 获取 / 内容协商 / 条件请求 / Body 解析 / 生命周期** 六类。

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

---

## 补充（新专题 13-15）

### 13.  req.fresh / res.fresh 的条件请求闭环：ETag、Last-Modified、If-None-Match 在 Express 里怎么完整配合？

机制链条：res.send/res.json 对 200 响应自动生成弱 ETag（按 body 哈希，大小写不敏感的 W/ 前缀）+ Last-Modified（req.modified 或 server 启动时间兜底）；浏览器复访带 If-None-Match/If-Modified-Since，Express 在 handler 里可用 req.fresh（两个头都比对通过且 method 安全）短路返回 304 零 body。工程细节：① 强 ETag vs 弱 ETag——gzip 中间件/CDN 重编码会让字节级 ETag 失配，内容等价场景主动用 res.set("ETag", "W/...")；② 计算成本——大对象每次 send 全量 stringify+hash，热点接口改"数据版本号拼 ETag"（etag: v1.2.3-contentHash 前缀策略）把哈希成本降为字符串比较；③ 缓存器干扰——中间层（代理/Service Worker）可能吞掉校验头，req.fresh 恒 false 时先抓真实头；④ 必须处理 304 语义：不写 body、保留 Cache-Control/Vary 等头。加分句：条件请求是"服务器授权缓存器复用副本"的协议，fresh 判断放应用层做还是让 CDN 做（stale-while-revalidate），取决于内容个性化程度。

**来源**：MDN HTTP caching（conditional requests）；Express 官方 res.fresh/req.fresh 文档

### 14.  反向代理链（CDN→LB→网关→应用）下，如何可靠地拿到客户端真实 IP、协议与端口？踩过的坑讲两个。

协议层：XFF 是追加式列表（客户端自带头也在最左），唯一可信做法是"从右往左数、跳过自己信任的代理段"——trust proxy 的数字 n 表示信任右侧 n 跳，true 表示全信（危险），CIDR 列表（如 10.0.0.0/8）是云环境正解；req.ip 取到的是链最左（声称的）地址、req.ips 是全列表、req.socket.remoteAddress 才是物理真相。四个高频坑：① 没配 trust proxy 时限流/审计全按 LB 内网 IP（一个键限掉全部流量或全部放行）；② CDN 改写策略不一致——某家把 XFF 拼进已有值、某家新开 X-Real-IP，多 CDN 容灾时要统一取头策略并在边缘归一；③ IPv6 双栈下地址不是字符串预期（同一用户 v4/v6 两串键），灰度 v6 后限流键与风控画像分裂；④ WebSocket/gRPC 的转发头体系又不同（proxy_protocol v2 在 TCP 层带真实地址，LB 开 PP 但应用没解析=握手失败）。加分句：客户端 IP 是"数据"不是"事实"——任何风控/合规用它之前要说得出这串经过了谁的签名或几跳可信代理。

**来源**：MDN X-Forwarded-For；Express 官方 trust proxy 文档；SegmentFault《限流把全公司 IP 限黑了》

### 15.  手写一个健壮的分页查询参数解析（?page=&limit=&sort=），你会考虑哪些边界？和校验库怎么分工？

边界清单：① 类型——query 全是字符串且可能是数组（重复键），先规约"取最后一个/第一个"的策略再转型；② 数值域——page 下限 1、limit 上限硬顶（如 100，超限截断而不是报错，配响应头告知实际值）、NaN/负数/科学计数法（1e9 是合法 Number 也是灾难）、小数（1.5 取整方向要定）；③ 深翻页——page=999999 的 OFFSET 是数据库性能炸弹，超过阈值改游标（呼应 pagination 关）并对 API 暴露两种模式；④ sort 白名单——字段名来自数据字典不允许自由字符串（order by 注入经典面）、方向 asc/desc 枚举、多字段排序的分隔约定；⑤ 默认值语义——不带 page 时返回第 1 页还是 400，对外 API 要文档锁定。与校验库分工：zod schema 声明类型+域+默认（z.coerce.number().int().min(1).max(100).catch(default) 一行吞掉"字符串转数+越界兜底"），但"业务级防御"（深翻页阈值、排序白名单来自数据模型）库管不了，是解析层的策略代码；测试要覆盖 1e9、数组键、空串、BOM 编码这几类 fuzz 样本。收口：分页参数是"外部可控的资源请求规模"，任何此类入口都要有硬顶——这是比校验更根本的安全原则。

**来源**：RFC 9110 查询组件；Google API 设计规范（分页）；知乎《一个 limit=1e9 打挂数据库的下午》
