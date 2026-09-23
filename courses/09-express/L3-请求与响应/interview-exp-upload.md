# exp-upload 面试题精选

> 共 12 题，覆盖 **multipart 协议 / multer 配置 / 安全校验 / 分片上传 / 直传方案 / 异常处理** 六类。

---

## 一、multipart 协议

### 1. multipart/form-data 的 Boundary 是什么？为什么需要它？

Boundary 是一段随机字符串（如 `----WebKitFormBoundary7MA4`），出现在 Content-Type 头里，用作每个 Part 之间的分隔符。文件是二进制数据（可能包含任意字节），无法用固定字符分隔 → 用足够长且随机的 Boundary 保证不会与文件内容冲突。每个 Part 头含 `Content-Disposition: form-data; name="..."`。

**来源**：RFC 7578 — "Defining MIME Multipart"; MDN — "multipart/form-data"; WHATWG HTML — "Constructing form data"

### 2. 上传时浏览器发的 Content-Length 可信吗？为什么？

不可信——Content-Length 是客户端自报的声明值，攻击者可谎报一个小值但实际发很多字节（或反之）。服务端必须**以实际接收字节数为准**，用流计数 + 超阈值主动 destroy 连接。express.json 的 limit 选项和 multer 的 limits 都基于此原理。

**来源**：RFC 9110 §8.6 — "Content-Length"; OWASP — "Upload Cheat Sheet — size validation"

---

## 二、multer 配置

### 3. multer 的 single / array / fields / any 分别在什么场景使用？

- `single('avatar')`：一个文件字段（头像上传）→ 结果在 req.file
- `array('photos', 10)`：同名字段多文件（相册）→ req.files 数组
- `fields([{name:'cover',maxCount:1},{name:'imgs',maxCount:5}])`：不同字段各上传 → req.files 按字段名分组
- `any()`：不限字段 → 不推荐（不安全 / 无法校验字段）

**来源**：multer README — "Installation Usage"; Express API — "req.file"

### 4. 上传时文本字段和文件字段的顺序有要求吗？为什么？

有——multipart 按发送顺序流式解析。若文件字段在前、文本在后 → fileFilter 回调时 req.body 还是空的（拿不到文本字段做判断）。最佳实践：**先 append 文本字段再 append 文件**（FormData 保持 JS 插入顺序）。

**来源**：multer GitHub Issue — "req.body empty in fileFilter"; MDN — "FormData.append() ordering"

### 5. multer 报错 `LIMIT_FILE_SIZE` 后，已经上传到磁盘的临时文件会被清理吗？

会——diskStorage 触发限制时 multer 自动删除当前文件。但如果用自定义 storage 引擎或在 storage 写入中途出错 → 可能残留需自行清理。memoryStorage 无残留（GC 回收 buffer）。注意：被拒绝的文件（fileFilter 返回 false）multer 会删除。

**来源**：multer README — "Error handling / storage engine"; Multer source — `lib/storage/disk.js`

---

## 三、安全校验

### 6. 除了 magic bytes，还有哪些上传攻击面？如何防御？

- **文件名注入**：`shell.jsp` → UUID 重命名 + 存储目录禁止脚本执行
- **图片马**（EXIF 嵌 PHP/WebShell）：sharp 重编码剥离元数据 + 重新压缩
- **超大解压炸弹（zip bomb）**：不解压直接存 + 限制解压层数
- **SVG XSS**（内嵌 script）：转 PNG 或 CSP 隔离域
- **扩展名双后缀**（`a.php.jpg`）：以解析出的真实类型为准（不是 split('.').pop）
- **DoS 慢速上传（Slowloris）**：Nginx `client_body_timeout` + 总时限

**来源**：OWASP — "Unrestricted File Upload Cheat Sheet"; PortSwigger Web Security Academy — "File upload vulnerabilities"; CWE-434

### 7. 为什么"检查扩展名"这种老方法不够？

扩展名（.jpg/.png）完全由客户端 filename 决定，攻击者可上传 `evil.php` 改名 `evil.jpg` 提交 → 服务端按扩展名放行 → 若存在解析漏洞（Nginx/Apache 多后缀解析）→ 上传目录可执行脚本。必须读文件头 magic bytes（如 PNG 以 `\x89PNG\r\n\x1a\n` 开头）+ 服务端不执行 uploads 目录。

**来源**：OWASP — "File Extensions / Whitelist"; Nginx — "cgi.fix_pathinfo" PHP 漏洞 CVE-2019-11043

---

## 四、分片上传

### 8. 大文件分片上传的完整流程是什么？如何实现断点续传？

流程：① 前端计算文件哈希（spark-md5）→ 请求后端"秒传检测"；② 后端返回已上传分片列表 → 前端跳过已有分片；③ 逐片上传（每片带 uploadId + index）；④ 全部到达后 merge；⑤ 后端二次校验总哈希。断点续传 = 靠已上传分片记录 + 文件 hash 定位未完成 index → 只补传缺失部分（tus 协议即基于 offset 实现）。

**来源**： tus — "Resumable File Upload Protocol"; resumable.js /uppy 文档; "秒传"原理 — CSDN/掘金 — "大文件分片、秒传、断点续传"

### 9. 前端如何限制并发上传分片数量（不用第三方库）？

维护任务队列 + 计数：

```js
async function pool(files, limit = 3) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < files.length) {
      const cur = idx++;
      results[cur] = await uploadChunk(files[cur]);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}
```

**来源**：MDN — "Promise.all"; JavaScript 设计模式 — "Concurrency limiting"; 掘金 — "前端上传并发控制"

---

## 五、直传与第三方存储

### 10. S3 预签名直传时如何处理 CORS 和跨域问题？

S3 Bucket 需配置 CORS 允许前端域名 `PUT` + 暴露 `ETag` 头（`AllowedHeaders: *`）。presigned URL 已含签名 → 前端 PUT 时不能再加自定义头（会破坏签名）。跨域失败常见原因：`Access-Control-Allow-Origin` 未回显前端域名 / 缺少 preflight OPTIONS 允许。

**来源**：AWS S3 docs — "PostObject CORS / Presigned URLs"; MDN — "CORS preflight"; AWS — "Client-side encryption uploads"

### 11. 为什么大文件推荐"分片 + 直传对象存储"而不是让文件走 Express？

① 服务器带宽是瓶颈（尤其国内服务器出带宽贵）；② 大文件占内存/磁盘 IO；③ 上传时间长 → 易超时/断连；④ 对象存储自带高可用 + CDN 回源 + 生命周期管理；⑤ 后端只处理元数据 + 生成签名 → 无状态可横向扩展。

**来源**：阿里云 OSS — "直传与服务端签名"; AWS Well-Architected — "Upload scalability"; Uppy/AWS S3 multipart docs

---

## 六、异常与运维

### 12. 生产环境上传接口的监控应该关注哪些指标？

① 上传成功率 / 失败原因分布（413 超限 / 415 类型 / magic bytes 拒绝）；② 平均文件大小与上传耗时；③ 临时文件残留数量（未 merge 的分片）→ 定期 GC；④ 磁盘/内存占用（memoryStorage OOM 风险）；⑤ 慢上传告警（带宽异常）；⑥ 病毒扫描队列积压。

**来源**：Google SRE Workbook — "Monitoring / Four Golden Signals"; NearForm — "Node.js production observability"; 云原生 — "上传服务 SLO"
