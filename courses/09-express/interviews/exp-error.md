# exp-error 面试题精选

> 共 12 题，覆盖 **错误分类 / 设计模式 / 异步传播 / 进程兜底 / 日志策略 / 监控集成** 六类。

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
