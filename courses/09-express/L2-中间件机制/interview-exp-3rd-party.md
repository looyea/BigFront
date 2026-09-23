# exp-3rd-party 面试题精选

> 共 15 题，覆盖 **Cookie/Session / CSRF / 文件上传 / 日志选型 / 限流 / 压缩 / 监控** 七类。

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

---

## 补充（新专题 13-15）

### 13.  把 session 存 Redis 之后，express-session 这套还剩哪些坑？和直接上 JWT 比你怎么选？

Redis 化后的残留坑：① 每请求一跳 Redis——latency 预算要计入（本地 ioredis 连接池、keys 用 hash tag 避免集群 CROSSSLOT），会话体超 1KB 就是设计失误（存 id 引用而不是塞对象）；② 过期与续期策略——rolling 与 cookie maxAge 双时钟容易配出"客户端还有效服务端已过期"，统一以服务端 TTL 为准并明确滑动窗口语义；③ 序列化陷阱——session 里塞 class 实例（反序列化变普通对象方法丢失）、塞 Date/BigInt（JSON 序列化失真），会话内容必须是纯 JSON；④ 删除风暴——登出/封禁用户要联动删 Redis 会话（JWT 阵营做不到吊销正是它的死穴，对比要讲这条）。选型账：服务端渲染 + 浏览器为主 → session（可吊销、体积零风险）；跨服务无中心验证 / 移动原生 / 三方 API → JWT（验签免查存储），且 JWT 也要配刷新+吊销表，"无状态"是幻觉。收口：认证方案的选择本质是"吊销需求 vs 验证成本"的权衡，与框架无关。

**来源**：express-session 官方 README（performance/security 警告）；InfoQ《Session vs Token 之争的当代结论》

### 14.  如何用 OpenTelemetry 给 Express 服务建立请求追踪？和打日志的边界在哪？

接入形态：① NodeSDK 启动期初始化 + @opentelemetry/instrumentation-express 自动包裹路由（http 层自动 span），pg/redis/axios 等 instrumented 包自动续链，业务代码零侵入；② traceparent 头传播——入口 extract、出站 inject（W3C 标准头），跨服务同一 traceId，这是"网关到 DB"一张火焰图的前提；③ 采样策略——头部采样（1/N）省成本但会丢"低频错误请求"这种最该看的样本，重要服务用尾部采样（全收→按错误/慢保留，配 collector）；④ 手动埋点——关键业务段（支付对账、批量任务）用 span.addEvent 打里程碑，别把每个循环都开 span。与日志的边界：trace 回答"这次请求慢在哪个环节"（采样、结构化链路），日志回答"这次请求为什么错"（全量、带上下文细节）；衔接点是日志注入 traceId/spanId（pino mixin 统一出口），从告警日志一键跳 trace。常见反模式：把 span 当日志用（成本爆炸）、只接服务不接消息队列（追踪断链在 consumer 处）、忘配 exporter 批处理同步 flush（P99 被拖高）。

**来源**：OpenTelemetry JS 官方文档（express instrumentation）；掘金《一个慢请求在 8 个微服务里的旅程》

### 15.  压缩、HTTPS 终止、缓存这些"中间件该不该开"的问题，在反向代理架构下怎么划界？

划界原则——"能在边缘做的别进应用，需要业务语义的别放边缘"。归代理/Nginx 层：TLS 终止（证书集中管理、会话复用）、静态资源强缓存（配置化）、粗粒度限流（连接数/请求速率）、gzip 对已缓存/高压缩比资源的重复劳动（已压缩的 jpg/zip 再 gzip 白烧 CPU，配 gzip_comp_level 与 gzip_min_length/gzip_types 才不烧冤枉钱）。归 Express 层：需要业务语义的决策——按用户角色决定 Vary/缓存键（代理不知道这个人是谁）、SSE/流式响应的逐块 flush（compression 要处理 flush 时机，代理缓冲会把流变成块，必须 proxy_buffering off 或应用直出）、针对响应内容的动态压缩豁免（已签名/加密 payload）。经典事故串：① 应用 ETag + 代理改 body（gzip 层不一致）→ 弱 ETag 分家，代理重压缩会让应用 strong ETag 失效；② Nginx buffering 打开 + SSE → 客户端收不到心跳判定断线；③ HTTPS 在代理终止但应用 req.secure 恒 false → 重定向死循环（trust proxy + X-Forwarded-Proto 才解）。收口句：中间件开不开不是框架问题，是"这个能力在你的拓扑里由哪个节点做成本最低"的架构问题——面试考的就是你有没有画过这张拓扑图。

**来源**：Nginx 官方 gzip 模块文档；MDN 压缩与内容协商；知乎《谁来做 gzip：网关还是应用》
