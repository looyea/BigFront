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
// 目的：读请求头——优先用 req.get（大小写不敏感）而不是直摸 req.headers
req.get('User-Agent');          // ✅ 取单个，不关心大小写
req.get('Accept-Language');     // ✅ 'zh-CN,zh;q=0.9'
req.headers;                    // ✅ 全对象（键全小写）
req.headers['content-type'];    // ✅ 原始小写键；写成 ['Content-Type'] 会取到 undefined
// ❌ req.get 对不存在的头返 undefined，直接 .split 会报 TypeError，用前先判空
```

---

## 三、IP 与 Trust Proxy

```js
// 目的：区分两种 IP——不开 trust proxy 时反代背后可见 IP 会错
req.ip;            // ⚠️ 默认 socket remote address（Nginx 反代后 = 127.0.0.1）
req.ips;           // ✅ X-Forwarded-For 拆成的数组（未经信任，不可直接当真值）
```

开启 trust proxy：
```js
// 目的：告知 Express 可信代理层数，让 req.ip 从 X-Forwarded-For 取真实客户端 IP
app.set('trust proxy', 1);  // ✅ 信任一跳代理（Nginx）
// 或 true 信任所有；或自定义函数
req.ip;  // ✅ 现在是真实客户端 IP（限流/风控才能按 IP 生效）
// ❌ 不设 trust proxy 就做按 IP 限流 → 所有请求都算 127.0.0.1，要么全放行要么全错杀
```

**场景**：Nginx → Express（一跳）→ `trust proxy: 1` → req.ip 正确。

---

## 四、内容协商

```js
// 目的：内容协商——根据 Accept 系列头判断客户端支持什么
req.accepts(['html', 'json']);          // ✅ 客户端 Accept 里支持哪个就返回哪个（都不支持返 false）
req.acceptsEncodings(['gzip', 'br']);   // ✅ 读 Accept-Encoding
req.acceptsLanguages(['en', 'zh']);     // ✅ 读 Accept-Language
req.acceptsCharsets(['utf-8']);         // ✅ 读 Accept-Charset
```

实战——API 按 Accept 返回格式：
```js
// 目的：实战—根据客户端 Accept 返回 json 或 xml
app.get('/data', (req, res) => {
  const accept = req.accepts(['json', 'xml']);   // ✅ 返客户端最优先且服务端支持的类型
  if (accept === 'xml') return res.type('xml').send(toXml(data));  // ✅ 命中 xml 分支短路返回
  res.json(data);                                 // ✅ 否则默认 JSON
});
// ❌ accept 可能是 false（客户端只要 text/csv）→ 若不处理会默默回 JSON，应用 406 Not Acceptable
```

---

## 五、条件请求（Cache Revalidation）

```js
// 目的：协商缓存—基于条件头判缓存是否新鲜，新鲜就回 304 不发 body
// req.fresh + req.stale 基于：
// If-Modified-Since / If-None-Match / If-Match / If-Unmodified-Since
if (req.fresh) {
  res.sendStatus(304);  // ✅ 缓存有效，不发 body（省带宽）
}
// ❌ req.fresh 只有在你已设过 ETag/Last-Modified 且客户端带了对应条件头才有意义，否则恒为 false
```

配合 `res.set('ETag', ...)` / `res.set('Last-Modified', ...)` 实现协商缓存。

---

## 六、Range 请求（断点续传）

```js
// 目的：断点续传—解析 Range 头得到要返回的字节区间
const range = req.range(1024 * 1024);  // ✅ 传入文件总大小 1MB
// ✅ range = [{start: 0, end: 512*1024-1, type: 'bytes'}]，或 -1 无范围 / -2 不满足
if (range === -2) return res.status(416).end();  // ✅ Range Not Satisfiable（越界）
// ✅ range === -1 表示未带 Range 头 → 回全文件
// ❌ 忘记处理返回值为 number（-1/-2）就当我数组 .map → range.length 为 undefined 直接报错
```

`req.range(size)` 是 `range-parser` 的内置别名。

---

## 七、请求生命周期事件

```js
// 目的：监听请求异常中断—客户端提前断开时做资源清理
req.on('aborted', () => {
  // ✅ 客户端提前断开连接（上传中断）
  // → 清理资源 / 取消 DB 写入 / 删临时文件
});

req.on('close', () => {
  // ✅ 底层连接关闭（无论正常/异常）
  // Express 5 / Node 16+：response 完成也会触发
});
// ❌ 在 aborted 里还试图 res.end 写响应 → 连接已断，写入无效并可能报 ERR_STREAM_WRITE_AFTER_END
```

**用途**：流式上传中途客户端取消 → aborted → 删临时文件。

---

## 八、req 实战技巧

### 8.1 获取完整 URL

```js
// 目的：拼出含域名完整 URL（回调/分享场景常用）
const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
// ✅ 例 https://example.com/api/users?page=1
// ❌ 用 req.url 代替 originalUrl → 在 Router 内 url 已被截去挂载前缀，拼出来缺 /api
```

### 8.2 判断请求来源

```js
// 目的：判断请求来源页面/跨域来源（CSRF/埋点参考）
req.get('Referer');       // ✅ 上一个页面 URL（注意头本身就是少一个 r 的拼写）
req.get('Origin');        // ✅ 跨域请求来源（仅协议+域名+端口）
// ❌ Referer 可被隐私策略/no-referrer 置空，不能单靠它做安全判定
```

### 8.3 文件类型验证

```js
// 目的：上传时双重校验文件类型（看 multer 解析的 MIME + 看 Content-Type）
req.files[0].mimetype;     // ✅ multer 解析后的 MIME
req.is('multipart/*');     // ✅ 判断请求体 Content-Type 是否 multipart
req.is('application/json'); // ✅ true/false
// ❌ 只信客户端 mimetype 不做服务端二次检测 → 伪装 image/png 的可执行文件可能混进来
```

### 8.4 读取自定义 Header

```js
// 目的：读自定义业务头（API Key/多租户标识）
const apiKey = req.get('X-API-Key');    // ✅ 不存在时为 undefined，用前判空
const tenant = req.get('X-Tenant-ID');  // ✅ 自定义头统一走 req.get，大小写不敏感
// ❌ 直接索引 req.headers['X-API-Key'] → headers 键全小写，取不到，应用 ['x-api-key']
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
