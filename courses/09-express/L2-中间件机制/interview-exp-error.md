# exp-error 面试题精选

> 共 15 题，覆盖 **错误分类 / 设计模式 / 异步传播 / 进程兜底 / 日志策略 / 监控集成** 六类。

---

## 一、错误分类

### 1. 操作错误和编程错误的区别？各自处理策略？

**操作错误**（Operational）：预期内的异常情况——DB 超时、用户输入不合法、文件不存在。处理：catch → 映射到 HTTP 状态码 → 返回有意义的错误信息。**编程错误**（Programmer）：bug——TypeError、数组越界、逻辑分支漏了。处理：**不 catch** → 让它 crash → 监控告警 → 修复代码。混在一起 catch 会让 bug 永远隐藏。

**来源**：Node.js — "Error handling"; Felix Geisendörfer — "Node.js Error Handling Best Practices"

### 2. 为什么不推荐用 `err.status = 400` 在普通 Error 上挂属性？

普通 `new Error()` 没有类型保障 → `err.status` 可能被其他代码覆盖或拼错（`err.staus`）。用自定义类 `HttpError extends Error` → 构造时强制传 status → 类型安全 → IDE 自动补全 → instanceof 检查可靠。

**来源**：http-errors npm README; TypeStrong — "Custom Error Classes"

---

## 二、全局 Error Handler

### 3. 为什么 error handler 必须注册在所有路由之后？

Express 按注册顺序遍历 stack——如果 error handler 在路由之前 → 它只捕获"已经经过它的"路由抛的错 → 后面注册的路由抛错 → 找不到它（它已被跳过）。放最后 → 所有路由的 next(err) 都能到达。

**来源**：Express error handling guide

### 4. error handler 里如果 `res.headersSent === true` 怎么办？

响应已经发出（比如流式传输中途出错）→ 不能再设状态码/JSON → **唯一选择**：`next(err)` 传给 Express 默认 handler（销毁连接）或手动 `req.destroy()`。判断代码：

```js
if (res.headersSent) return next(err);
res.status(status).json(body);
```

**来源**：Express — "Error handling"; StackOverflow — "res.headersSent"

---

## 三、异步传播

### 5. Express 5 的 Promise 自动捕获有什么限制？

1. **只限 handler 返回的 Promise**——`setTimeout(() => throw)` 不在链上；
2. **不覆盖 EventEmitter 错误**——`stream.on('error', ...)` 要手动 next；
3. **middleware 内 `Promise.all` 不 await** → 游离 Promise → 不捕获。
解决：确保所有异步用 await 串到 handler 的 async 函数上。

**来源**：Express 5 migration guide — "Promise handling"

### 6. 如何在 error handler 中区分"预期错误返回给用户"和"bug 返回 500"？

通过 `err instanceof HttpError`（预期）vs 其他（bug）：

```js
if (err instanceof HttpError) {
  res.status(err.status).json({ error: err.message });
} else {
  logger.fatal({ err });  // bug 进 error 日志
  res.status(500).json({ error: 'Internal Server Error' });
}
```

关键是把"预期错误"收敛成单一类型（HttpError 及其业务子类），error handler 只做一次 instanceof 分叉——散落的 `err.status` 手挂字段会让判断退化为字段猜测。

**来源**：Express 官方 Error Handling 文档；MetaBrainz — "Custom error classes in Node.js"

---

## 四、进程兜底

### 7. 为什么 process.exit(0) 在 uncaughtException 里不对？

`exit(0)` = "正常退出" → 进程管理器不会重启。应该 `exit(1)` → pm2/systemd 判断非零 → 自动重启。或者不 exit → 让 `--unhandled-rejections=strict` 自然 crash → supervisor 重启。

**来源**：Node.js — "process.exit()"; pm2 docs — "Exit codes"

### 8. 优雅关闭的正确步骤？

```
1. SIGTERM 信号到达
2. server.close()   — 停止接受新连接，等待已有请求完成
3. 关 DB/Redis 连接池
4. 取消定时任务 / consumer
5. process.exit(0)
6. 超时 30s 仍没关完 → process.exit(1)  强杀
```

`--force` 兜底保证不无限挂起。

**来源**：NearForm — "Graceful shutdown"; Node HTTP — "server.close()"

---

## 五、日志策略

### 9. 日志里如何避免打印敏感信息？

1. **字段脱敏**：pino `redact: ['req.headers.authorization', 'req.body.password']`；
2. **error handler 只 log message + stack**，不 log req.body（可能含密码）；
3. **结构化日志分离**：access log（无 body）给运维；app log（选择性 body）给开发——权限不同。

**来源**：OWASP — "Logging Cheat Sheet"; pino docs — "redact"

### 10. 4xx 错误要不要记 error 级别？

不推荐。4xx = 客户端错误（正常业务流量）→ `warn` 或不记（取决于安全需要，如 401 大量 = 可能被暴力破解）。5xx = 服务端 bug → `error`。日志级别策略：`debug` < `info` < `warn`(4xx) < `error`(5xx) < `fatal`(crash)。

**来源**：Google SRE — "Logging"; 12-Factor — "Logs as event streams"

---

## 六、监控集成

### 11. 如何用 Prometheus 统计各状态码的请求数？

```js
import client from 'prom-client';
const httpCounter = new client.Counter({
  name: 'http_requests_total',
  labelNames: ['method', 'status', 'path'],
});
app.use((req, res, next) => {
  res.on('finish', () => {
    httpCounter.inc({ method: req.method, status: res.statusCode, path: req.baseUrl + req.route?.path });
  });
  next();
});
app.get('/metrics', async (req, res) => { res.set('Content-Type', client.register.contentType); res.end(await client.register.metrics()); });
```

Grafana → rate(http_requests_total{status=~"5.."}[5m]) > 0 → alert。

**来源**：prom-client README; Prometheus — "HTTP requests rate"

### 12. Sentry 的 request handler 和 error handler 分别做什么？

- `Sentry.Handlers.requestHandler()`：**普通中间件**（3 参数）——在路由前 → 为当前请求创建 scope（记录 user/IP/route）→ 后续错误上报自动带 context；
- `Sentry.Handlers.errorHandler()`：**error 中间件**（4 参数）——在路由后 → catch 所有未处理错误 → 上报 Sentry → `next(err)` 传递给后续 handler（或自己结束响应）。

两者配合才能上报完整上下文。

**来源**：@sentry/node docs — "Express integration"

---

## 补充（新专题 13-15）

### 13.  把线上错误分成四类（用户/业务预期/系统依赖/编程 bug），每类的响应策略、日志级别、告警口径怎么定？

四类四表：① 用户错误（4xx 输入/权限）——响应给精确 code+可展示文案；日志 info/warn 带路径不打栈；不告警但看聚合异常（注册失败率突升=产品或攻击信号）。② 业务预期失败（库存不足/余额不够）——也是 4xx/422 语义，但 code 进业务码注册表；日志 info；不告警，进业务指标。③ 系统依赖错误（DB 断/上游超时）——对用户给 503/降级响应+Retry-After，绝不透传内部信息；日志 error 带堆栈与 requestId；告警主力（按依赖维度聚合，5 分钟窗口阈值），处理走熔断/降级预案（perf 关）。④ 编程 bug（undefined/断言）——对外统一 500 兜底话术；error 级+Sentry 单条去重上报；告警看"新错误签名"（首次出现即通知比阈值更灵敏）。横切三件：每类在 createError 层就带 category 字段（响应/日志/路由都读它）、错误码前缀空间隔离（U-/B-/S-/P-）、SLO 只吃 ③④ 两类当分子（4xx 不进可用性）。加分句：错误分类的价值不在"分得细"，在每类的告警响应人不同——分错类=叫错人。

**来源**：Google SRE 错误预算与告警哲学；InfoQ《错误分类学：从一次误告警复盘说起》

### 14.  "错误处理代码本身引发的事故"你经历过或设计过哪些防线？举三类反例讲防线。

反例①：错误处理器里取 req.body 补充上下文，但请求是超时中断的半成品流，body undefined 再抛 TypeError——错误链顶头炸穿默认处理器返回 HTML 500（API 客户端 JSON 解析又崩一层）。防线：error handler 只读"标量安全字段"（method/url/headers/requestId），一切可能缺失的深层读取包 try-catch 且降级为"上下文缺失"；handler 本身要进单测（喂残缺 req 断言不炸）。反例②：Sentry handler 放在自定义错误格式化之后，生产 5xx 被先"友好化"吞成 next() 无参——上报永远漏这批。防线：上报 handler 注册在错误链第一位（先记后表演），并用"故意抛错的 e2e 用例"断言 Sentry 与响应两头都收到。反例③：自动重试中间件对 5xx 无退避猛重试，DB 抖一下 30 秒全站流量放大 4 倍雪崩。防线：重试只配幂等+瞬时错误（503/网络错）、指数退避+最大次数+熔断闸，"是否自动重试"写进错误契约（Retry-After）。总纪律：错误路径是代码里测试最少、生产最常走的路——它的覆盖率要求应该最高而不是最低。

**来源**：Node 官方 handleErrors 指南；SegmentFault《error handler 里再抛错之后》

### 15.  进程级错误（uncaughtException/OOM/事件循环卡死）与应用级 HTTP 错误是两套体系——你的进程守护与自愈方案怎么配？

应用层：HTTP 错误止步于 request context（错误中间件+上报），绝不因单请求失败伤进程——除非进程状态可信度已被破坏。进程层三件套：① 重启策略——PM2 集群或 K8s（推荐后者：探针 liveness 判"卡死即杀"，OOMKilled 看内存 limit，重启退避防 crash loop）；uncaughtException 监听器只做"记日志→延迟几百 ms 退出"，别抢救请求（状态不可信）；② 检测盲区——事件循环卡死（同步大计算/序列化大对象）进程"活着"但无响应，靠 liveness 探针（/healthz 里带 event loop delay 测量）+ 堆内存告警阈值发现，光看"进程在不在"必漏；③ 取证现场——heap snapshot（--heapsnapshot-near-heap-limit 或 kill -USR 触发）、CPU profile 定时窗口（pprof 端点），死后验尸好过无从查起。编排细节：优雅关闭链（SIGTERM→停止 accept→在途限时→清定时器→关连接池）+ preStop 延迟（K8s 摘流量与进程退出的时序差）常配错导致每次发布掉一批请求。收口句：HTTP 错误保"这一次请求死得明白"，进程守护保"这个进程死得起"——两层各有协议，混治必出玄学。

**来源**：Node 官方 process 文档；PM2/Kubernetes 重启策略文档；InfoQ《从一次"服务还活着但不响应"说起》
