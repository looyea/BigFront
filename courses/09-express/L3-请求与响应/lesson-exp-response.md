# Express Response 对象全用法

> 目标：**精通 res 对象所有方法**——状态码/头/Body 发送/重定向/Cookie/文件下载/流式传输/内容协商/Vary/缓存控制。

---

## 一、状态码与 Headers

### 1.1 设置状态码

```js
res.status(201);              // 返回 res 支持链式
res.sendStatus(404);          // 状态码 + 文字 body（Express 5）
```

### 1.2 设置响应头

```js
res.set('X-Custom', 'value');
res.set({ 'X-A': '1', 'X-B': '2' });   // 批量
res.append('Link', '</style.css>; rel=preload');  // 追加（不覆盖）
res.header('Content-Type', 'text/csv');  // set 别名
res.get('Content-Type');                  // 读取
res.removeHeader('X-Powered-By');         // 删除
```

### 1.3 类型设置

```js
res.type('html');       // text/html; charset=utf-8
res.type('application/pdf');
res.type('json');       // application/json; charset=utf-8
res.contentType('css'); // 别名
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
res.send('Hello');        // text/html
res.send({ key: 'val' }); // = res.json()
res.send(Buffer.from('x')); // binary
```

### 2.2 res.json(obj)

```js
res.json({ user: { name: 'Alice' } });
// Content-Type: application/json; charset=utf-8
// Body: {"user":{"name":"Alice"}}
```

### 2.3 res.jsonp(obj)

JSONP 跨域（已少用；需 `app.set('jsonp callback name', 'cb')`）。

### 2.4 res.end()

无 body 结束响应。`res.end()` vs `res.send('')` → 前者不触发 ETag / Content-Type。

---

## 三、重定向

```js
res.redirect('/login');                 // 302
res.redirect(301, 'https://example.com'); // 永久重定向
res.location('/new-path');              // 只设 Location 不发 3xx
```

**Express 5 安全增强**：`res.redirect` / `res.location` 自动验证 Location 值防 open redirect（不允许 `http://evil.com` 除非显式配）。

---

## 四、Cookie 操作

```js
res.cookie('token', 'abc123', {
  maxAge: 24 * 60 * 60 * 1000,  // ms
  httpOnly: true,
  secure: true,
  sameSite: 'Strict',
  path: '/',
  domain: '.example.com',
  signed: true,
});

res.clearCookie('token', { path: '/' });  // 删 cookie（设过期）
```

---

## 五、文件传输

### 5.1 res.download(filepath, [filename], [cb])

触发浏览器下载——设 `Content-Disposition: attachment; filename="xxx"`：

```js
res.download('/reports/2024.pdf', 'Annual Report.pdf', (err) => {
  if (err && !res.headersSent) res.status(500).json({ error: 'Download failed' });
});
```

### 5.2 res.sendFile(absPath, [options])

发送单个文件（inline / download）：

```js
res.sendFile('/var/data/image.png', {
  headers: { 'X-Custom': 'val' },
  maxAge: 3600000,
  root: '/var/data',  // 安全根目录
}, (err) => { ... });
```

**安全**：必须用 `root` 选项限定目录 → 防路径穿越攻击（`../../etc/passwd`）。

---

## 六、流式传输

### 6.1 管道（pipe）

```js
import { createReadStream } from 'fs';
app.get('/video/:id', (req, res) => {
  const stream = createReadStream(`/videos/${req.params.id}.mp4`);
  res.type('video/mp4');
  stream.pipe(res);
});
```

### 6.2 分块传输（Chunked）

```js
res.setHeader('Transfer-Encoding', 'chunked');
res.write('chunk 1\n');
await sleep(1000);
res.write('chunk 2\n');
res.end();
```

### 6.3 Server-Sent Events (SSE)

```js
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
const interval = setInterval(() => {
  res.write(`data: ${JSON.stringify({ time: Date.now() })}\n\n`);
}, 1000);
req.on('close', () => clearInterval(interval));
```

---

## 七、缓存控制

```js
// 强缓存
res.set('Cache-Control', 'public, max-age=31536000, immutable');

// 协商缓存
res.set('ETag', `"${crypto.createHash('md5').update(json).digest('hex')}"`);
res.set('Last-Modified', fs.statSync(file).mtime.toUTCString());

// 不缓存
res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
res.setHeader('Pragma', 'no-cache');
```

`req.fresh` + `res.sendStatus(304)` 实现协商缓存快速路径。

---

## 八、Vary 头

```js
res.vary('Accept-Encoding');  // CDN 按 gzip/br 分别缓存
res.vary('Accept-Language');  // 按语言分别缓存
```

多值：`res.vary(['Origin', 'Cookie'])` → 告诉中间缓存"这些头不同时响应不同"。

---

## 九、locals（模板变量）

```js
res.locals.user = req.user;        // 当前响应上下文
res.locals.version = '2.0';
res.render('dashboard');           // 模板里直接用 user / version
```

中间件里设 `res.locals` → 所有下游 handler + 模板可读。

---

## 十、res 生命周期事件

```js
res.on('finish', () => { console.log('响应已发出'); });     // res.end 后触发
res.on('close', () => { console.log('连接已关闭'); });      // Node 12.9+
```

morgan 就是监听 `res.on('finish')` 拿 statusCode + 响应时间。

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
