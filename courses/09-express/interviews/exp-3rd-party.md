# exp-3rd-party 面试题精选

> 共 12 题，覆盖 **Cookie/Session / CSRF / 文件上传 / 日志选型 / 限流 / 压缩 / 监控** 七类。

---

## 一、Cookie / Session

### 1. cookie-parser 的 signed 签名防篡改原理是什么？

设 cookie 时计算 `value + '.' + HMAC-SHA256(value, secret)` → 存签名值。读取时拆分 value 和 signature → 重新 HMAC → 对比 → 不一致则视为篡改丢弃。secret 泄露 = 签名失效 → 用环境变量管理。

**来源**：cookie-parser README; RFC 2104 — HMAC

### 2. httpOnly / Secure / SameSite 三个 Cookie 属性各防什么？

| 属性 | 防 |
| --- | --- |
| `httpOnly` | XSS 脚本读 cookie（`document.cookie` 看不到） |
| `Secure` | 中间人明文截取（仅 HTTPS 传输） |
| `SameSite=Lax/Strict` | CSRF（跨站请求不自动带 cookie） |

三者组合是 Cookie 安全基线。

**来源**：MDN — "Set-Cookie"; OWASP — "Session Management Cheat Sheet"

---

## 二、CSRF

### 3. 双重提交 Cookie（Double Submit Cookie）的原理？

服务器生成随机 token → 同时放在 **Set-Cookie** 和 **响应体（HTML/JSON）** 里。前端提交表单时把 token 放请求头（如 `X-CSRF-Token`）→ 服务器对比 Cookie 里的值和 Header 里的值是否一致。CSRF 攻击时，恶意站点能自动带 cookie 但**无法读取响应体设自定义 header** → 校验失败。

**来源**：OWASP — "CSRF Prevention - Synchronizer Token Pattern"

### 4. 为什么 session-based 认证需要 CSRF 防护而 JWT in header 不需要？

session 认证靠 **cookie** 自动携带 → 跨站 POST 表单也带 cookie → 能伪造请求。JWT 放 **Authorization header** → 浏览器跨站自动请求（form / fetch 不带 credentials）不会携带自定义 header → 攻击者拿不到 token → 无法伪造。除非把 JWT 也存 cookie → 又回到 CSRF 问题。

**来源**：Auth0 Blog — "CSRF attacks and how to mitigate them"

---

## 三、文件上传

### 5. multer 的 memoryStorage 和 diskStorage 怎么选？

- **memoryStorage**：文件存 Buffer → 适合小文件（<5MB）+ 需要转存 S3/OSS → 不落盘 → 快；
- **diskStorage**：直接写磁盘 → 适合大文件（视频）→ 不占内存 → 防 OOM。
生产推荐：memoryStorage + multer-s3 → 直接传云存储（不存本地）。

**来源**：multer storage docs; AWS SDK — "S3 upload"

### 6. fileFilter 能防住上传伪装图片的 .exe 吗？

仅检查扩展名 + mimetype 不够（攻击者可伪造 Content-Type）。安全做法：① 用 `file-type`（magic bytes）检测真实文件类型；② 上传后服务端用 `sharp` 解析并重新编码（去除 EXIF/嵌入 payload）；③ 存到非执行目录 + CDN 域名（不共享 cookie）。

**来源**：OWASP — "Unrestricted File Upload"; file-type npm

---

## 四、日志选型

### 7. pino vs winston vs bunyan 怎么选？

| 维度 | pino | winston | bunyan |
| --- | --- | --- | --- |
| 性能 | 极快（JSON.stringify 优化 + SonicBoom 同步写） | 中等 | 较慢 |
| 输出格式 | 只 JSON | 多格式（JSON/彩色） | JSON |
| transport | 需 pino-transport | 内置 file/http | 内置 |
| 生态 | Grafana Loki 原生支持 | 最老最成熟 | Elastic 友好 |

微服务 / Cloud Native → pino（JSON stdout → Fluentd/Loki）；传统单机 → winston。

**来源**：pino benchmarks; Rising Stack — "Node.js logging"

---

## 五、限流

### 8. express-rate-limit 在多进程/多实例部署下如何共享计数？

默认 MemoryStore **每进程独立** → cluster 4 个 worker → 实际限额变 4 倍。解决：配 **RedisStore**（`rate-limit-redis`）→ 所有进程/实例共用一个 Redis → INCR + EXPIRE 原子操作 → 计数全局一致。

**来源**：express-rate-limit docs — "Store"; rate-limit-redis GitHub

---

## 六、压缩

### 9. 压缩中间件的 CPU 开销和缓存策略如何权衡？

压缩是 CPU 密集——大 JSON 响应 gzip level 6 约 1ms/100KB。优化：① 静态资源预压缩（`vite-plugin-compression` 构建时生成 .gz/.br → CDN 直接发）→ 运行时不压缩；② 只对 >1KB 的响应压缩（threshold）；③ 反向代理层做（Nginx gzip）→ 省 Node CPU。

**来源**：compression docs — "threshold"; Nginx — "gzip_module"

---

## 七、监控/健康检查

### 10. 为什么 /healthz 不应该检查数据库连接？

**Liveness** 探针 = "进程是否还活着（没死锁）" → 如果 DB 临时抖动 → healthz 返回 503 → K8s 杀掉 Pod → 其实只是 DB 暂时不可用 → Pod 重启也没用（新 Pod 连不上 DB）。DB 检查应放 **Readiness** (`/readyz`) → 不 Ready 只是摘流量不杀进程 → DB 恢复后自动重新 Ready。

**来源**：Kubernetes docs — "Liveness/Readiness probes"; Google SRE — "Health check patterns"

### 11. GraphQL 端点如何和 REST 共用同一个 Express 中间件链？

Apollo Server 的 `expressMiddleware` 本身就是一个 Express 中间件 → 可直接挂在 `app.use('/graphql', ...)` 上 → 共享 helmet / cors / session / morgan。注意：GraphQL 所有请求都 POST 到 /graphql → 限流策略需单独配（query 复杂度不同）。

**来源**：Apollo Server docs — "Integration with Express"

### 12. 如何在 pino-http 中记录慢请求？

```js
pinoHttp({
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 400) return 'warn';
    if (res.statusCode >= 500) return 'error';
    if (res.elapsedTime > 1000) return 'warn';  // 慢请求 >1s
    return 'info';
  },
})
```

或用中间件：`res.on('finish', () => { if (duration > SLOW_MS) logger.warn({ duration, url }, 'Slow request'); })`。

**来源**：pino-http README — "customLogLevel"; Google SRE — "Latency vs Response Size"
