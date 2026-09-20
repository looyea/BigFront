# 静态资源服务与缓存

> 目标：**掌握 `express.static` 的全部配置**——maxAge / etag / index / redirect / immutable；理解 HTTP 缓存分层（强缓存 + 协商缓存）；掌握 Content Hash 与 CDN 缓存策略；构建"永久缓存 + 秒级失效"的现代静态资源方案。

---

## 一、express.static 基础

```bash
# Express 5 内置，无需单独安装（serve-static 已提升）
```

```js
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 服务 public/ 目录
app.use(express.static(path.join(__dirname, 'public')));
```

请求 `GET /images/logo.png` → 自动映射到 `public/images/logo.png` 并返回（带正确 Content-Type、ETag、Last-Modified）。放在路由**前面**（先尝试静态，命中即短路，不进后续 handler）。

### 1.1 多个静态目录

```js
// 顺序查找，命中即返回
app.use(express.static('public'));
app.use(express.static('uploads'));
app.use('/downloads', express.static('files'));   // 挂载到指定路径前缀
```

---

## 二、核心配置项

```js
app.use(express.static('public', {
  maxAge: '7d',              // 强缓存时长 → Cache-Control: public, max-age=604800
  etag: true,                // 生成 ETag（默认开）
  lastModified: true,        // 设置 Last-Modified（默认开）
  index: false,             // 不提供 index.html（API 服务常关）
  redirect: true,            // 目录请求 301 到带斜杠路径
  extensions: ['html'],      // /about 可匹配 about.html
  immutable: true,           // 配合 maxAge → Cache-Control immutable
  setHeaders: (res, path) => {   // 自定义响应头
    if (path.endsWith('.woff2')) res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('X-Served-By', 'static');
  },
  fallthrough: true,         // 未找到时 next() 继续（false 则直接 404）
}));
```

---

## 三、HTTP 缓存分层（核心考点）

浏览器缓存 = 两层：

### 3.1 强缓存（不请求服务器）

`Cache-Control`（优先级高于 Expires）：

```
Cache-Control: public, max-age=31536000, immutable   # 1 年内不发请求
Cache-Control: no-cache    # 不用强缓存，但每次走协商缓存验证
Cache-Control: no-store    # 完全不缓存
```

`max-age` 内 → 直接 `(disk cache)` / `(memory cache)`，0 网络请求。

### 3.2 协商缓存（请求服务器，可能返回 304）

强缓存过期后，浏览器带条件头发请求，服务器判断是否可用：

- `ETag` / `If-None-Match`：文件内容哈希，精度最高（推荐）；
- `Last-Modified` / `If-Modified-Since`：修改时间，秒级精度、可能误判。

未变 → **304 Not Modified**（无 body，极省带宽）；变了 → 200 + 新内容。

```
请求首次：GET /app.a1b2.js  → 200 + Cache-Control: max-age=31536000, ETag
一年后：  资源过期 → GET + If-None-Match → 304（文件名带 hash 根本不会变，实际不请求）
```

---

## 四、Content Hash + 永久缓存（黄金方案）

现代前端构建（Vite/Webpack）给 JS/CSS 文件名注入内容哈希：

```
index.html                        → no-cache（每次都验证）
assets/app.3f8a2c.js              → Cache-Control: max-age=31536000, immutable
assets/vendor.9b1d4e.js           → max-age=31536000, immutable
assets/logo.a2c3d4.png            → max-age=31536000, immutable
```

**原理**：文件内容变 → 哈希变 → 文件名变 → index.html（no-cache）引用了新文件名 → 浏览器下载新文件；内容没变 → 文件名不变 → 命中一年强缓存。

这解决了"缓存 vs 更新"的终极矛盾：**所有资源永久缓存，靠改文件名来失效**。发版即秒生效（因为 index.html 变了）。

---

## 五、immutable 指令

`Cache-Control: immutable` 告诉浏览器："这个 URL 的内容永远不会变，即便 max-age 到了也别再发条件请求验证"。配合 content hash 文件名，可省去 304 往返。Safari 尤其受益（它即使在 max-age 后也可能发请求，immutable 阻止此行为）。

---

## 六、index.html 的陷阱

**入口 HTML 绝不能强缓存！** 否则：

1. 发版后 index.html 被缓存在浏览器 → 里面引用的还是旧 hash 文件名 → 用户白屏（旧文件已删）。

正确：

```js
// HTML 用协商缓存，保证发版即时生效
app.get('/*.html', (req, res, next) => {
  res.set('Cache-Control', 'no-cache');   // 每次验证 → 变更即拉新
  next();
});
// 或者：
app.use(express.static('dist', { maxAge: '1y', index: false }));  // 带 hash 的资源
app.get('/', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});
```

`no-cache` ≠ 不缓存：它仍缓存内容，但每次用前发条件请求验证（304 则复用）→ 既省带宽又保证最新。

---

## 七、下载与文件服务

```js
// 强制下载（Content-Disposition: attachment）
app.get('/export', (req, res) => {
  res.download(path.join(__dirname, 'report.pdf'), '月度报表.pdf');
});

// 带 Range 的视频/大文件（断点续传，见 L3）
res.sendFile(file, { root: dir, maxAge: '1h' });
```

> 生产建议：静态资源尽量交给 **Nginx/CDN** 直接服务，Express 只做 API——让 Node 处理文件 IO 是浪费（单线程 + 占连接）。`express.static` 适合小规模或开发。

---

## 八、CORS 与字体

字体文件（woff2）常被跨域 CDN 引用，需 CORS 头：

```js
app.use('/fonts', express.static('fonts', {
  maxAge: '1y',
  setHeaders: (res) => res.setHeader('Access-Control-Allow-Origin', '*'),
}));
```

否则 `@font-face` 跨域加载字体失败。

---

## 九、自检清单

- [ ] Cache-Control 和 Expires 谁优先？
- [ ] no-cache 和 no-store 的区别？
- [ ] ETag 相比 Last-Modified 的优势？
- [ ] 为什么带 hash 的资源可以设一年 max-age？
- [ ] index.html 为什么必须 no-cache？
- [ ] immutable 解决什么问题？
- [ ] 生产为什么建议用 Nginx/CDN 而非 express.static？

---

## 十、缓存头速查表

| 资源 | Cache-Control | 理由 |
| --- | --- | --- |
| 带 hash 的 JS/CSS/图片 | `public, max-age=31536000, immutable` | 内容变则文件名变，永久缓存安全 |
| index.html / SW | `no-cache`（或 `no-store` 对 SW） | 保证发版即时生效 |
| API JSON（个性化） | `no-store` 或 `private, max-age=0` | 用户相关不能共享缓存 |
| 第三方库（未 hash） | `public, max-age=86400` | 变化少 |

---

## 🚀 部署预告

- **CDN 缓存**：静态资源上 CDN → 边缘节点 max-age 命中直接返回，不回源；
- **Nginx 服务静态**：`location /assets { expires 1y; add_header Cache-Control "public, immutable"; }`，Express 只处理 `/api`；
- **缓存刷新**：发版后如需立刻失效某资源，改 hash 文件名即可（而非清 CDN）；
- **压缩联动**：静态资源开 gzip/brotli（呼应 L2 compression），HTML no-cache + 资源长缓存是标准组合。

L4 到此完成，下一关进入 **L5 RESTful API 实战**（exp-rest）——设计规范的资源路由。
