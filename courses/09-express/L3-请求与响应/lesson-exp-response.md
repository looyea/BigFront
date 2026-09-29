# Express Response 对象全用法

> 目标：**精通 res 对象所有方法**——状态码/头/Body 发送/重定向/Cookie/文件下载/流式传输/内容协商/Vary/缓存控制。

---

## 一、状态码与 Headers

### 1.1 设置状态码

```js
// 目的：设状态码——sendStatus 一步到位，status 可链式
res.status(201);              // ✅ 只设码、返回 res 本身，可 .json() 链式
res.sendStatus(404);          // ✅ 状态码 + 同名文字 body（如 "Not Found"）
// ❌ Express 5 移除了 res.send(404)（数字当状态码的旧写法）→ 需改 res.status(404).send()
```

### 1.2 设置响应头

```js
// 目的：写响应头——set 覆盖、append 追加、removeHeader 删除
res.set('X-Custom', 'value');                       // ✅ 单个设值
res.set({ 'X-A': '1', 'X-B': '2' });                // ✅ 批量对象
res.append('Link', '</style.css>; rel=preload');    // ✅ 追加不覆盖（如多个 Set-Cookie/Link）
res.header('Content-Type', 'text/csv');             // ✅ set 的别名
res.get('Content-Type');                             // ✅ 读取已设的值
res.removeHeader('X-Powered-By');                    // ✅ 删除（隐藏技术栈）
// ❌ 已 res.send 之后再 set → 头已发出无效，报 Cannot set headers after they are sent
```

### 1.3 类型设置

```js
// 目的：快捷设 Content-Type——传扩展名或 MIME 都行
res.type('html');       // ✅ text/html; charset=utf-8
res.type('application/pdf');  // ✅ 直接给完整 MIME
res.type('json');       // ✅ application/json; charset=utf-8
res.contentType('css'); // ✅ type 的别名
```

---

## 二、Body 发送

### 2.1 res.send(body)

| body 类型 | 效果 |
| --- | --- |
| String | Content-Type: text/html |
| Object/Array | 自动调 res.json() |
| Buffer | Content-Type: application/octet-stream |
| Number (Express 5 移除) | ❌ 不再支持 |

```js
// 目的：res.send 根据 body 类型自动定 Content-Type
res.send('Hello');        // ✅ text/html
res.send({ key: 'val' }); // ✅ 等于 res.json()
res.send(Buffer.from('x')); // ✅ application/octet-stream 二进制
// ❌ res.send(200) 在 Express 5 不再把数字当状态码——需拆成 res.status(200).send()
```

### 2.2 res.json(obj)

```js
// 目的：res.json 序列化对象并自动加 charset，内部走 send 触发 ETag
res.json({ user: { name: 'Alice' } });
// ✅ Content-Type: application/json; charset=utf-8
// ✅ Body: {"user":{"name":"Alice"}}
// ❌ 对象里含循环引用 → JSON.stringify 抛 TypeError，需先处理或改 res.send 纯文本
```

### 2.3 res.jsonp(obj)

JSONP 跨域（已少用；需 `app.set('jsonp callback name', 'cb')`）。

### 2.4 res.end()

无 body 结束响应。`res.end()` vs `res.send('')` → 前者不触发 ETag / Content-Type。

---

## 三、重定向

```js
// 目的：重定向——302 临时默认可被改 301 永久；Express5 自动校验 Location 防开放重定向
res.redirect('/login');                    // ✅ 302 相对路径
res.redirect(301, 'https://example.com');  // ✅ 永久重定向（SEO 传权重）
res.location('/new-path');                 // ✅ 只设 Location 不发 3xx（配合自行 status）
// ❌ 把用户可控参数直接当跳转目标 res.redirect(req.query.to) → 开放重定向钓鱼（即便有校验也应白名单）
```

**Express 5 安全增强**：`res.redirect` / `res.location` 自动验证 Location 值防 open redirect（不允许 `http://evil.com` 除非显式配）。

---

## 四、Cookie 操作

```js
// 目的：Set-Cookie—用安全属性三件套保护会话 cookie
res.cookie('token', 'abc123', {
  maxAge: 24 * 60 * 60 * 1000,  // ✅ 存活时长（ms，会换算成 Expires）
  httpOnly: true,                // ✅ JS document.cookie 读不到，防 XSS 窃取
  secure: true,                  // ✅ 仅 HTTPS 下发
  sameSite: 'Strict',            // ✅ 跨站请求不带，防 CSRF
  path: '/',                      // ✅ 生效路径（删除时 path 需一致）
  domain: '.example.com',         // ✅ 包域内子域共享
  signed: true,                   // ✅ 需 cookie-parser 带密钥才能验签
});

res.clearCookie('token', { path: '/' });  // ✅ 删 cookie = 设一个已过期的同名（path 必须与设置时一致！）
// ❌ 设置时 path:'/api'、删除时不传 path（默认'/'）→ 删了但浏览器里还在（path 不匹配）
```

---

## 五、文件传输

### 5.1 res.download(filepath, [filename], [cb])

触发浏览器下载——设 `Content-Disposition: attachment; filename="xxx"`：

```js
// 目的：res.download 触发浏览器下载（自动加 Content-Disposition: attachment）
res.download('/reports/2024.pdf', 'Annual Report.pdf', (err) => {   // ✅ 第二参是展示给用户的文件名
  if (err && !res.headersSent) res.status(500).json({ error: 'Download failed' });  // ✅ 头未发才能改回 500
});
// ❌ 文件不存在时回调已触发、头可能已发→ 再 res.status 无效，故要先判 headersSent
```

### 5.2 res.sendFile(absPath, [options])

发送单个文件（inline / download）：

```js
// 目的：res.sendFile 发单个文件——用 root 锁目录防路径穿越
res.sendFile('image.png', {
  headers: { 'X-Custom': 'val' },
  maxAge: 3600000,        // ✅ 缓存时长
  root: '/var/data',      // ✅ 安全根目录：路径相对于它解析
}, (err) => { ... });
// ❌ 把用户传入的 req.params.file 直接拼进绝对路径不配 root → '../../../../etc/passwd' 路径穿越读系统文件
```

**安全**：必须用 `root` 选项限定目录 → 防路径穿越攻击（`../../etc/passwd`）。

---

## 六、流式传输

### 6.1 管道（pipe）

```js
// 目的：流式管道传大文件——不一次性读入内存，边读边发
import { createReadStream } from 'fs';
app.get('/video/:id', (req, res) => {
  const stream = createReadStream(`/videos/${req.params.id}.mp4`);  // ⚠️ 此处 id 需先校验防穿越
  res.type('video/mp4');                       // ✅ 声明类型，浏览器能边下边播
  stream.pipe(res);                             // ✅ 背压自动处理，比手工 write 安全
});
// ❌ 用 fs.readFileSync + res.send 传大视频 → 整个文件塞进内存，并发几个就 OOM
```

### 6.2 分块传输（Chunked）

```js
// 目的：分块传输—不预设 Content-Length，多次 write 后 end
res.setHeader('Transfer-Encoding', 'chunked');   // ✅ HTTP/1.1 分块（Node 对无 Content-Length 响应自动加）
res.write('chunk 1\n');                            // ✅ 先推一块
await sleep(1000);
res.write('chunk 2\n');                            // ✅ 隔一会儿再推一块
res.end();                                         // ✅ 必须 end，否则客户端一直等
// ❌ 只 write 不 end → 响应永不完成，客户端挂起
```

### 6.3 Server-Sent Events (SSE)

```js
// 目的：SSE 服务端主动推—长连接每 1s 推一条，注意必须清理定时器
res.setHeader('Content-Type', 'text/event-stream');   // ✅ SSE 固定类型
res.setHeader('Cache-Control', 'no-cache');            // ✅ 不缓存事件流
res.setHeader('Connection', 'keep-alive');             // ✅ 保持长连接
const interval = setInterval(() => {
  res.write(`data: ${JSON.stringify({ time: Date.now() })}\n\n`);  // ✅ 每条以空行分隔
}, 1000);
req.on('close', () => clearInterval(interval));        // ✅ 客户端断开就清定时器，否则泄漏
// ❌ 漏 req.on('close') 清 interval → 每个连接泄漏一个永久定时器，服务端越跑越卡
```

---

## 七、缓存控制

```js
// 目的：三种缓存策略——强缓存、协商缓存、禁用缓存
// 强缓存
res.set('Cache-Control', 'public, max-age=31536000, immutable');   // ✅ 一年内直接用本地副本不发请求

// 协商缓存
res.set('ETag', `"${crypto.createHash('md5').update(json).digest('hex')}"`);   // ✅ 内容指纹，变了才重传
res.set('Last-Modified', fs.statSync(file).mtime.toUTCString());               // ✅ 修改时间，精度到秒

// 不缓存
res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');  // ✅ 敏感页禁用缓存
res.setHeader('Pragma', 'no-cache');                                     // ✅ 兼容 HTTP/1.0
// ❌ 给登录态/支付页忘了 no-store → 浏览器/CDN 缓存了带凭证的页面，造成信息泄露
```

`req.fresh` + `res.sendStatus(304)` 实现协商缓存快速路径。

---

## 八、Vary 头

```js
// 目的：Vary 告诉中间缓存“按哪些头区分副本”
res.vary('Accept-Encoding');  // ✅ CDN 按 gzip/br 分别缓存
res.vary('Accept-Language');  // ✅ 按语言分别缓存
// ❌ 响应内容随 Origin/Cookie 变却不 res.vary('Origin') → CDN 把 A 用户的响应缓存后错发给 B
```

多值：`res.vary(['Origin', 'Cookie'])` → 告诉中间缓存"这些头不同时响应不同"。

---

## 九、locals（模板变量）

```js
// 目的：res.locals—当前请求-响应周期内的模板变量（比全局 app.locals 作 per-request 隔离）
res.locals.user = req.user;        // ✅ 仅本次响应可见，无串号风险
res.locals.version = '2.0';
res.render('dashboard');            // ✅ 模板里直接用 user / version
// ❌ 把用户数据挂到 app.locals（全局共享）→ 不同请求串号，A 看到 B 的信息
```

中间件里设 `res.locals` → 所有下游 handler + 模板可读。

---

## 十、res 生命周期事件

```js
// 目的：监听响应生命周期—finish 已发出、close 连接关闭
res.on('finish', () => { console.log('响应已发出'); });     // ✅ res.end 后触发（数据已交给 OS）
res.on('close', () => { console.log('连接已关闭'); });      // ✅ Node 12.9+，客户端提前断也触发
// ℹ️ morgan 就是监听 res.on('finish') 拿 statusCode + 响应时间
```

---

## 十一、自检清单

- [ ] res.send(404) 在 Express 5 中能用吗？
- [ ] res.sendFile 为什么必须配 root？
- [ ] res.vary 的作用？
- [ ] SSE 和 WebSocket 的区别？
- [ ] res.locals 和普通 res.set 的区别？
- [ ] ETag 和 Last-Modified 的区别？

---

## 🚀 部署预告

- **gzip/br**：`compression()` 自动按 `Accept-Encoding` 选最优 + `res.vary('Accept-Encoding')`；
- **CDN 缓存**：`Cache-Control: public, s-maxage=86400` → CDN 边缘缓存；
- **大文件传输**：用 `res.download` + Range header → 支持断点续传；
- **HTTPS 重定向**：`if (!req.secure) return res.redirect(301, 'https://' + req.hostname + req.url)`。

下一关 `exp-upload` 详解文件上传完整方案。
