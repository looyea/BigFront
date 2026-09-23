# Express Request 对象详解

> 目标：**全面掌握 req 对象的所有属性和方法**——HTTP 信息获取、内容协商、trust proxy、IP/hostname/protocol、header 操作、body/params/query 实战、req.on('aborted'/'close') 生命周期。

---

## 一、HTTP 基本信息

| 属性/方法 | 返回 | 示例 |
| --- | --- | --- |
| `req.method` | HTTP 方法 | `'GET'` |
| `req.url` | 路径+query（Router 内被截前缀） | `/users?page=1` |
| `req.originalUrl` | 完整原始 URL | `/api/users?page=1` |
| `req.path` | 仅路径 | `/api/users` |
| `req.query` | 查询参数对象（qs） | `{page: '1'}` |
| `req.params` | 路径参数 | `{id: '42'}` |
| `req.body` | 请求体（需 body parser） | `{name:'Alice'}` |
| `req.baseUrl` | Router 挂载前缀 | `/api` |
| `req.protocol` | `'http'` / `'https'` | |
| `req.secure` | 是否 HTTPS | boolean |
| `req.hostname` | Host 去端口 | `'example.com'` |
| `req.port` | 端口（5+新增） | `'3000'` |
| `req.stale` | If-None-Match/Modified 验证失败 | boolean |
| `req.fresh` | 缓存命中（304 可发） | boolean |
| `req.xhr` | 是否 XMLHttpRequest | boolean |
| `req.id` | 自定义（中间件设） | UUID |

---

## 二、Header 操作

```js
req.get('User-Agent');          // 取单个（大小写不敏感）
req.get('Accept-Language');     // 'zh-CN,zh;q=0.9'
req.headers;                    // 全对象
req.headers['content-type'];    // 原始小写
```

---

## 三、IP 与 Trust Proxy

```js
req.ip;            // 默认 socket remote address（反代后 = 127.0.0.1）
req.ips;           // X-Forwarded-For 拆分数组
```

开启 trust proxy：
```js
app.set('trust proxy', 1);  // 信任一跳代理
// 或 true 信任所有；或自定义函数
req.ip;  // 现在是真实客户端 IP
```

**场景**：Nginx → Express（一跳）→ `trust proxy: 1` → req.ip 正确。

---

## 四、内容协商

```js
req.accepts(['html', 'json']);          // 客户端 Accept 里支持哪个？
req.acceptsEncodings(['gzip', 'br']);   // Accept-Encoding
req.acceptsLanguages(['en', 'zh']);     // Accept-Language
req.acceptsCharsets(['utf-8']);         // Accept-Charset
```

实战——API 按 Accept 返回格式：
```js
app.get('/data', (req, res) => {
  const accept = req.accepts(['json', 'xml']);
  if (accept === 'xml') return res.type('xml').send(toXml(data));
  res.json(data);
});
```

---

## 五、条件请求（Cache Revalidation）

```js
// req.fresh + req.stale 基于：
// If-Modified-Since / If-None-Match / If-Match / If-Unmodified-Since
if (req.fresh) {
  res.sendStatus(304);  // 缓存有效，不发 body
}
```

配合 `res.set('ETag', ...)` / `res.set('Last-Modified', ...)` 实现协商缓存。

---

## 六、Range 请求（断点续传）

```js
const range = req.range(1024 * 1024);  // 总大小 1MB
// range = [{start: 0, end: 512*1024-1, type: 'bytes'}] 或 -1 无范围 / -2 不满足
if (range === -1) return res.status(416).end();  // Range Not Satisfiable
if (range === openRanges) { /* 全文件 */ }
```

`req.range(size)` 是 `range-parser` 的内置别名。

---

## 七、请求生命周期事件

```js
req.on('aborted', () => {
  // 客户端提前断开连接（上传中断）
  // 清理资源 / 取消 DB 写入
});

req.on('close', () => {
  // 底层连接关闭（无论正常/异常）
  // Express 5 / Node 16+：response 完成也会触发
});
```

**用途**：流式上传中途客户端取消 → aborted → 删临时文件。

---

## 八、req 实战技巧

### 8.1 获取完整 URL

```js
const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
```

### 8.2 判断请求来源

```js
req.get('Referer');       // 上一个页面 URL
req.get('Origin');        // 跨域请求来源
```

### 8.3 文件类型验证

```js
// 上传时
req.files[0].mimetype;     // multer 解析后的 MIME
req.is('multipart/*');     // 判断 Content-Type
req.is('application/json'); // true/false
```

### 8.4 读取自定义 Header

```js
const apiKey = req.get('X-API-Key');
const tenant = req.get('X-Tenant-ID');
```

---

## 九、自检清单

- [ ] req.url 和 req.originalUrl 什么时候不同？
- [ ] trust proxy 不开会怎样？
- [ ] req.fresh / req.stale 的依据是什么头？
- [ ] req.accepts 返回什么？
- [ ] req.on('aborted') 什么时候触发？
- [ ] req.is('json') 判断的是什么？

---

## 🚀 部署预告

- **CDN 回源**：CDN 带 `X-Forwarded-For` → `trust proxy` 正确记录真实 IP；
- **WAF/防火墙**：`X-Request-ID` 被网关生成 → 直接透传给 Express → 日志关联；
- **gRPC/WebSocket 升级**：`req.headers.upgrade === 'websocket'` → 非 HTTP 路由跳过。

下一关 `exp-response` 深入 res 对象全用法。
