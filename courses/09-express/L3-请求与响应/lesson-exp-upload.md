# 文件上传完整方案

> 目标：**掌握 Node.js/Express 文件上传的三大方案**（multer / busboy / formidable）；理解 multipart/form-data 协议；实现大文件分片上传、S3 直传、安全校验、进度通知。

---

## 一、multipart/form-data 协议

浏览器 `<form enctype="multipart/form-data">` 或 `FormData` 发送时，HTTP Body 格式：

```
------WebKitFormBoundary7MA4YWxk
Content-Disposition: form-data; name="title"

我的照片
------WebKitFormBoundary7MA4YWxk
Content-Disposition: form-data; name="photo"; filename="cat.png"
Content-Type: image/png

<二进制数据>
------WebKitFormBoundary7MA4YWxk--
```

- Boundary 随机生成 → 分隔字段与文件；
- 每个 Part 有 headers（name / filename / Content-Type）+ body；
- Express `express.json()` 不能处理此格式 → 需专用中间件。

---

## 二、multer（最主流）

### 2.1 基本用法

```bash
npm i multer
```

```js
import multer from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';

// 磁盘存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    cb(null, randomUUID() + extname(file.originalname));  // 防覆盖/防中文名
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },  // 10MB × 5
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'));
  },
});
```

### 2.2 三种接收方式

```js
// 单文件（字段名 avatar）
app.post('/profile', upload.single('avatar'), (req, res) => {
  req.file;  // { fieldname, originalname, filename, path, size, mimetype }
});

// 多文件同名字段（photos[]）
app.post('/gallery', upload.array('photos', 10), (req, res) => {
  req.files;  // 数组
});

// 混合字段
app.post('/post', upload.fields([
  { name: 'cover', maxCount: 1 },
  { name: 'images', maxCount: 5 },
]), (req, res) => {
  req.files.cover;   // [{...}]
  req.files.images;  // [{...}, ...]
});

// 任意字段
app.post('/any', upload.any(), handler);

// 文本+文件混合（非文件的进 req.body）
app.post('/doc', upload.single('file'), (req, res) => {
  req.body.title;  // 普通字段
  req.file;         // 上传的文件
});
```

### 2.3 Memory Storage（转存 S3）

```js
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
app.post('/upload', upload.single('file'), async (req, res) => {
  const { buffer, mimetype, originalname } = req.file;
  await s3Client.putObject({ Bucket: 'my-bucket', Key: originalname, Body: buffer, ContentType: mimetype });
  res.json({ url: `https://cdn.example.com/${originalname}` });
});
```

---

## 三、安全校验

### 3.1 Magic Bytes 检测

```js
import { fileTypeFromBuffer } from 'file-type';

app.post('/upload', upload.single('file'), async (req, res) => {
  const type = await fileTypeFromBuffer(req.file.buffer);
  if (!type || !['image/jpeg', 'image/png', 'image/webp'].includes(type.mime)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }
  // type.ext = 真实扩展名（不信任 filename）
});
```

### 3.2 文件名处理

| 风险 | 防御 |
| --- | --- |
| 路径穿越 `../../etc/passwd` | `path.basename(file.originalname)` + root 限定 |
| 特殊字符 / XSS 文件名 | UUID 重命名 |
| 同名覆盖 | UUID + 时间戳 |
| 超大文件 | `limits.fileSize` |
| 伪装文件 | magic bytes + re-encode（sharp） |

### 3.3 图片安全重编码

```js
import sharp from 'sharp';
const processed = await sharp(req.file.buffer)
  .resize(1920, 1920, { fit: 'inside' })
  .webp({ quality: 80 })
  .toBuffer();
// 去除 EXIF / 嵌入恶意 payload
```

---

## 四、大文件分片上传

### 4.1 前端分片

```js
async function uploadInChunks(file, chunkSize = 5 * 1024 * 1024) {
  const totalChunks = Math.ceil(file.size / chunkSize);
  const uploadId = crypto.randomUUID();
  for (let i = 0; i < totalChunks; i++) {
    const chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('uploadId', uploadId);
    formData.append('index', i);
    formData.append('total', totalChunks);
    await fetch('/api/upload/chunk', { method: 'POST', body: formData });
  }
  await fetch('/api/upload/merge', { method: 'POST', body: JSON.stringify({ uploadId, total: totalChunks }) });
}
```

### 4.2 后端合并

```js
app.post('/upload/chunk', upload.single('chunk'), async (req, res) => {
  const { uploadId, index } = req.body;
  await fs.writeFile(`tmp/${uploadId}_${index}`, req.file.buffer);
  res.json({ ok: true });
});

app.post('/upload/merge', async (req, res) => {
  const { uploadId, total } = req.body;
  const writeStream = fs.createWriteStream(`uploads/${uploadId}.final`);
  for (let i = 0; i < total; i++) {
    const chunk = await fs.readFile(`tmp/${uploadId}_${i}`);
    writeStream.write(chunk);
    await fs.unlink(`tmp/${uploadId}_${i}`);
  }
  writeStream.end();
  writeStream.on('finish', () => res.json({ url: `/uploads/${uploadId}.final` }));
});
```

---

## 五、S3 预签名直传（推荐大文件方案）

**不让文件流经 Express**——前端直传 S3/OSS：

```js
// 后端生成 presigned URL
app.get('/upload-url', async (req, res) => {
  const { filename, contentType } = req.query;
  const key = `uploads/${Date.now()}_${filename}`;
  const url = await s3.getSignedUrlPromise('putObject', {
    Bucket: 'my-bucket', Key: key, ContentType: contentType, Expires: 3600,
  });
  res.json({ url, key });
});
```

前端：`fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })`。

---

## 六、上传进度通知（SSE）

```js
app.get('/upload/progress/:uploadId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  const id = req.params.uploadId;
  const interval = setInterval(() => {
    const progress = globalProgress[id] || 0;
    res.write(`data: ${progress}\n\n`);
    if (progress >= 100) { clearInterval(interval); res.end(); }
  }, 500);
  req.on('close', () => clearInterval(interval));
});
```

---

## 七、替代方案对比

| 库 | 特点 | 适用 |
| --- | --- | --- |
| **multer** | Express 生态标准 / API 简洁 | 中小文件 / 通用 |
| **busboy** | 流式 / 无内存缓冲 | 超大文件 / 内存敏感 |
| **formidable** | v3 重写 / 自动清理 | 简单表单+文件混合 |
| **S3 presigned** | 文件不过服务器 | 大文件 / 减压 / 直传 |
| **tus** | 可恢复上传协议 | 断点续传标准 |

---

## 八、自检清单

- [ ] multipart/form-data 和 application/json 在上传时区别？
- [ ] 为什么 fileFilter 检查 mimetype 不够安全？
- [ ] S3 直传的好处？为什么不所有文件都走 S3？
- [ ] memoryStorage vs diskStorage 的选择标准？
- [ ] 分片上传的 merge 步骤要注意什么？
- [ ] 文件名为什么必须重命名？

---

## 🚀 部署预告

- **容器无盘**：K8s Pod 本地写临时文件 → emptyDir volume / 或直接 S3 不落盘；
- **Nginx 客户端限制**：`client_max_body_size 50m` → 超过 Nginx 直接 413 不转给 Express；
- **CDN 回源上传**：上传 API 直连 Origin → 文件下载走 CDN；
- **病毒扫描**：上传后异步走 ClamAV / VirusTotal API。

下一关进入 L4 模板引擎与静态页面。
