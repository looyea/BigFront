# L3 作业：请求 / 响应 / 文件上传

> 覆盖：exp-request / exp-response / exp-upload

---

## 一、读代码（10 题）

### 1. 请求 GET /api/users/42?tab=posts 到达内层 router 时，各属性分别是什么？

```js
const router = express.Router();
router.get('/users/:id', (req, res) => {
  console.log(req.url, req.originalUrl, req.baseUrl, req.params, req.query);
});
app.use('/api', router);
```
（填空：url=___ originalUrl=___ baseUrl=___ params=___ query=___）

### 2. 部署在 Nginx 后面，以下代码返回的 clientIp 是什么？为什么会是内网地址？如何修复？

```js
app.get('/whoami', (req, res) => {
  res.json({ clientIp: req.ip });
});
```

### 3. 以下响应在 Express 5 中哪一行会报错？为什么？

```js
app.get('/old', (req, res) => {
  res.send(404);            // A
  res.status(404).send();   // B
  res.sendStatus(404);      // C
});
```

### 4. 阅读代码，第二次请求同一资源时浏览器收到的状态码是什么？

```js
app.get('/data', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.set('ETag', '"abc123"');
  if (req.fresh) return res.sendStatus(304);
  res.json({ time: Date.now() });
});
// 第一次请求无 If-None-Match；第二次带 If-None-Match: "abc123"
```

### 5. 以下 SSE 端点有什么问题会导致 Nginx 后客户端收不到实时数据？

```js
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  setInterval(() => {
    res.write(`data: ${Date.now()}\n\n`);
  }, 1000);
});
```
（提示：缓存缓冲 + 缺少清理逻辑）

### 6. 这个上传接口存在哪些安全隐患？列出至少 3 个。

```js
app.post('/upload', upload.single('file'), (req, res) => {
  const path = 'uploads/' + req.file.originalname;
  fs.writeFileSync(path, req.file.buffer);
  res.json({ url: path });
});
```

### 7. fileFilter 里为什么拿不到 req.body.title？如何调整前端代码解决？

```js
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    console.log(req.body.title);  // undefined！
    cb(null, true);
  },
});
```

### 8. 以下 Range 请求代码，客户端发 `Range: bytes=0-999`，响应头 Content-Length 应该是多少？

```js
const start = 0, end = 999, fileSize = 5000;
res.writeHead(206, {
  'Content-Range': `bytes ${start}-${end}/${fileSize}`,
  'Content-Length': end - start,   // ← 这里对吗？
});
```

### 9. res.locals 和 app.locals 的作用域区别是什么？下面输出什么？

```js
app.locals.siteName = 'BigFront';
app.use((req, res, next) => { res.locals.user = 'alice'; next(); });
app.get('/page', (req, res) => {
  res.render('t', {});  // 模板里 siteName 和 user 分别可访问吗？
});
```

### 10. 上传一个 200MB 视频，用 memoryStorage 会有什么问题？应该换成什么方案？

---

## 二、手写（5 题）

### 1. 编写一个工具函数 `getClientInfo(req)`，返回 `{ ip, protocol, host, isAjax, accepts }`，正确处理 trust proxy 场景。

### 2. 实现一个带条件请求（ETag）的 JSON 接口 `GET /config`，命中缓存返回 304，否则返回配置并设置 `Cache-Control: public, max-age=60`。

### 3. 用 multer + file-type + sharp 实现安全图片上传：校验真实类型（仅 JPEG/PNG）、重编码为 WebP、UUID 命名、存 uploads/。

### 4. 实现大文件分片上传的后端两个端点：`POST /chunk`（接收并落盘 tmp）和 `POST /merge`（按 index 顺序合并 + 清理临时文件）。

### 5. 编写一个 SSE 端点 `GET /stream`：设置正确头、每 2 秒推送时间、发送心跳注释、客户端断开时 clearInterval。

---

## 三、场景题（1 题）

### 1. 用户上传文件后偶发"文件损坏"（图片只显示一半）。已知用了 Nginx 反代 + memoryStorage + sharp 转码后写 S3。请分析可能的 3 个原因（涉及 Nginx 缓冲、stream 未 finish 就读取、超时），并给出排查与修复方案。

---

## 四、简答题（3 题）

### 1. 简述 req 对象从接收到请求头到解析完 body 的完整生命周期，以及中途可能触发的关键事件。

### 2. 为什么 res.json() 对大对象（含循环引用 / BigInt）会抛错？生产环境如何安全序列化？

### 3. 直传对象存储（S3/OSS）相比经过 Express 中转，在安全性和成本上各有什么权衡？

---

## 五、挑战题（1 题）

### 🏆 构建"文件上传微服务"

实现一个生产级上传服务，要求：
- 支持三种模式：小文件（multer 直传）、大文件（分片 + merge + 断点续传）、超大文件（S3 预签名直传）
- 安全：magic bytes 校验 + UUID 重命名 + uploads 目录禁执行 + 图片重编码去 EXIF
- 秒传：基于文件 MD5 哈希查重，命中直接返回已有 URL
- 进度：SSE 端点实时推送上传百分比
- 完善的错误处理（413 超限 / 415 类型 / 缺片）+ 临时文件定时 GC
- 集成测试（supertest 模拟真实 multipart 请求）
- README 含前端对接示例（FormData / 并发分片池）
