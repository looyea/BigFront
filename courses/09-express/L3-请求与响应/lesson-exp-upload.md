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
# 目的：安装 multipart 上传中间件
npm i multer
```

```js
// 目的：配置 multer—磁盘存储 + UUID 重命名 + 大小/类型限制
import multer from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';

// 磁盘存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),   // ✅ 目录需预先存在且进程有写权限
  filename: (req, file, cb) => {
    cb(null, randomUUID() + extname(file.originalname));  // ✅ 防覆盖/防中文名/防路径注入
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },  // ✅ 超 10MB 或超 5 个→ multer 报错转 next(err)
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
    if (allowed.includes(file.mimetype)) cb(null, true);   // ✅ 接受
    else cb(new Error('Invalid file type'));               // ✅ 拒绝→传 err 给 cb，文件不落盘
  },
});
// ❌ 只靠 fileFilter 看 file.mimetype 不安全（客户端可伪造）→ 真实校验看下面 magic bytes
```

### 2.2 三种接收方式

```js
// 目的：根据前端字段结构选对应的接收器
// 单文件（字段名 avatar）
app.post('/profile', upload.single('avatar'), (req, res) => {
  req.file;  // ✅ { fieldname, originalname, filename, path, size, mimetype }（单数）
});

// 多文件同名字段（photos[]）
app.post('/gallery', upload.array('photos', 10), (req, res) => {
  req.files;  // ✅ 数组（最多 10 个）
});

// 混合字段
app.post('/post', upload.fields([
  { name: 'cover', maxCount: 1 },
  { name: 'images', maxCount: 5 },
]), (req, res) => {
  req.files.cover;   // ✅ [{...}]（fields 下每个字段都是数组）
  req.files.images;  // ✅ [{...}, ...]
});

// 任意字段
app.post('/any', upload.any(), handler);   // ✅ 不限字段名，全部进 req.files

// 文本+文件混合（非文件的进 req.body）
app.post('/doc', upload.single('file'), (req, res) => {
  req.body.title;  // ✅ 普通字段
  req.file;         // ✅ 上传的文件
});
// ❌ upload.single 却前端发了多个同名字段 → 除第一个外被丢弃；字段名与表单 name 不一致→ req.file 为 undefined
```

### 2.3 Memory Storage（转存 S3）

```js
// 目的：内存存储—文件不落盘直接拿 buffer 转存 S3（适合不需要本地留档的场景）
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });  // ✅ 内存必须限大小防 OOM
app.post('/upload', upload.single('file'), async (req, res) => {
  const { buffer, mimetype, originalname } = req.file;   // ✅ buffer 是文件内容
  await s3Client.putObject({ Bucket: 'my-bucket', Key: originalname, Body: buffer, ContentType: mimetype });
  res.json({ url: `https://cdn.example.com/${originalname}` });
});
// ❌ memoryStorage 不限 fileSize 又接大文件 → 整文件入内存，并发直接 OOM
```

---

## 三、安全校验

### 3.1 Magic Bytes 检测

```js
// 目的：不信任客户端声明的 MIME，用文件头 magic bytes 反推真实类型
import { fileTypeFromBuffer } from 'file-type';

app.post('/upload', upload.single('file'), async (req, res) => {
  const type = await fileTypeFromBuffer(req.file.buffer);   // ✅ 读二进制头识别真实格式
  if (!type || !['image/jpeg', 'image/png', 'image/webp'].includes(type.mime)) {
    return res.status(400).json({ error: 'Invalid file type' });   // ✅ 非白名单类型直接拒
  }
  // ✅ type.ext = 真实扩展名（不信任 filename）
});
// ❌ fileTypeFromBuffer 需 memoryStorage 才有 req.file.buffer；用 diskStorage 时 buffer 不存在→报错
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
// 目的：图片重编码—抹掉 EXIF/嵌入的恶意 payload，只保留干净像素
import sharp from 'sharp';
const processed = await sharp(req.file.buffer)
  .resize(1920, 1920, { fit: 'inside' })   // ✅ 限长边，超大图缩到合理尺寸
  .webp({ quality: 80 })                     // ✅ 统一转 webp 减体积
  .toBuffer();                                // ✅ 重新编码 → 原始嵌入数据丢弃
// ❌ sharp 是原生依赖，alpine(musl) 镜像可报 module not found/GLIBC，需确保安装匹配预编译包
```

---

## 四、大文件分片上传

### 4.1 前端分片

```js
// 目的：前端把大文件切片逐片上传，最后通知后端合并（断点续传基础）
async function uploadInChunks(file, chunkSize = 5 * 1024 * 1024) {
  const totalChunks = Math.ceil(file.size / chunkSize);      // ✅ 向上取整算总片数
  const uploadId = crypto.randomUUID();                        // ✅ 同一次上传用同一 ID 串联
  for (let i = 0; i < totalChunks; i++) {
    const chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);  // ✅ 按字节切
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('uploadId', uploadId);
    formData.append('index', i);                               // ✅ 带序号供后端正确拼接
    formData.append('total', totalChunks);
    await fetch('/api/upload/chunk', { method: 'POST', body: formData });
  }
  await fetch('/api/upload/merge', { method: 'POST', body: JSON.stringify({ uploadId, total: totalChunks }) });
}
// ❌ 不传 index 或并发乱序上传→ 后端无法确定片顺序，合并出的文件损坏
```

### 4.2 后端合并

```js
// 目的：后端先落每片（按 index 命名），再按序合并为最终文件
app.post('/upload/chunk', upload.single('chunk'), async (req, res) => {
  const { uploadId, index } = req.body;                        // ✅ index 来自表单文本字段
  await fs.writeFile(`tmp/${uploadId}_${index}`, req.file.buffer);  // ✅ 每片单独存，乱序也不影合并
  res.json({ ok: true });
});

app.post('/upload/merge', async (req, res) => {
  const { uploadId, total } = req.body;
  const writeStream = fs.createWriteStream(`uploads/${uploadId}.final`);
  for (let i = 0; i < total; i++) {                            // ✅ 严格按 0..total 顺序读片
    const chunk = await fs.readFile(`tmp/${uploadId}_${i}`);   // ⚠️ 缺片会抛 ENOENT，需先校验齐不齐
    writeStream.write(chunk);
    await fs.unlink(`tmp/${uploadId}_${i}`);                    // ✅ 合完删临时片
  }
  writeStream.end();
  writeStream.on('finish', () => res.json({ url: `/uploads/${uploadId}.final` }));  // ✅ 写磁盘完成才回 URL
});
// ❌ 未等 writeStream 'finish' 就 res.json → 文件可能还没写完，URL 指向残缺文件
```

---

## 五、S3 预签名直传（推荐大文件方案）

**不让文件流经 Express**——前端直传 S3/OSS：

```js
// 目的：后端只签一个限时 PUT URL，文件本体不过 Express—大文件首选
// 后端生成 presigned URL
app.get('/upload-url', async (req, res) => {
  const { filename, contentType } = req.query;
  const key = `uploads/${Date.now()}_${filename}`;   // ⚠️ filename 来自 query，应用白名单/清洗防越权写任意 key
  const url = await s3.getSignedUrlPromise('putObject', {
    Bucket: 'my-bucket', Key: key, ContentType: contentType, Expires: 3600,  // ✅ 1h 内有效
  });
  res.json({ url, key });
});
// ❌ 把 key 完全交给用户控制 → 可能覆盖他人对象；ContentType 不限→可与前端实际不符导致签名失效 403
```

前端：`fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })`。

---

## 六、上传进度通知（SSE）

```js
// 目的：SSE 向前端推上传进度，进度满 100 或断开都要清理定时器
app.get('/upload/progress/:uploadId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');   // ✅ SSE 固定类型
  const id = req.params.uploadId;
  const interval = setInterval(() => {
    const progress = globalProgress[id] || 0;               // ✅ 轮询共享进度变量
    res.write(`data: ${progress}\n\n`);                     // ✅ 每条以空行结尾
    if (progress >= 100) { clearInterval(interval); res.end(); }  // ✅ 完成即收尾
  }, 500);
  req.on('close', () => clearInterval(interval));           // ✅ 客户端中断也清定时器防泄漏
});
// ❌ 漏 req.on('close') 清 interval → 客户端刷新后定时器永运跑，内存/句柄泄漏
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
