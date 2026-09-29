# Express 错误处理全策略

> 目标：**建立完整的错误处理体系**——操作错误 vs 编程错误、HTTP 错误类封装、全局 error handler、异步传播链、uncaughtException / unhandledRejection 兜底、日志与告警集成。

---

## 一、错误分类

| 类型 | 例子 | 处理 |
| --- | --- | --- |
| **操作错误**（预期） | 数据库连接失败、用户输入不合法、第三方 API 超时 | 捕获 → 返回 4xx/5xx JSON |
| **编程错误**（bug） | TypeError、ReferenceError、逻辑分支遗漏 | 不应 catch → 让进程崩 → 监控告警 → 修复 |
| **外部错误** | `uncaughtException` / `unhandledRejection` | 记日志 → 优雅关闭 → 重启 |

**原则**：只 catch 你**知道怎么处理**的错误。

---

## 二、HTTP 错误类封装

```js
// 目的：封装带状态码的 HTTP 错误类——业务处 throw 一个就能携带 status/详情/是否对外 expose
// src/utils/httpError.js
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);              // ✅ 继承 Error，保留 stack
    this.status = status;        // ✅ 供错误中间件读来定响应码
    this.details = details;      // ✅ 可选的字段级错误详情
    this.expose = status < 500;  // ✅ 4xx 可暴露真实消息，5xx 不泄露内部细节
  }
  static badRequest(msg, details) { return new HttpError(400, msg, details); }   // ✅ 快捷工厂
  static unauthorized(msg = 'Unauthorized') { return new HttpError(401, msg); }
  static forbidden(msg = 'Forbidden') { return new HttpError(403, msg); }
  static notFound(msg = 'Not Found') { return new HttpError(404, msg); }
  static conflict(msg) { return new HttpError(409, msg); }
  static tooMany(msg = 'Too Many Requests') { return new HttpError(429, msg); }
  static internal(msg = 'Internal Server Error') { return new HttpError(500, msg); }
}
// ❌ 若忘了 extends Error 或未调 super(message) → err.message 为空、无 stack，日志里并无法定位
```

使用：
```js
// 目的：业务处直接 throw HttpError——Express5 自动捕获并转给全局 errorHandler
if (!user) throw HttpError.notFound(`User ${id} not found`);        // ✅ 404，expose=true → 消息回给客户端
if (!valid) throw HttpError.badRequest('Validation failed', fieldErrors);  // ✅ 400 + details
// ❌ 旧写法 new Error() 不带 status → errorHandler 里 err.status 为 undefined，只能默认当 500
```

---

## 三、全局 Error Handler

```js
// 目的：全局错误中间件—统一记日志 + 按 expose/env 决定回什么，四参数签名
// src/middlewares/errorHandler.js
import { HttpError } from '../utils/httpError.js';

export function errorHandler(err, req, res, next) {   // ✅ 必须 (err,req,res,next) 四参数
  // 1. 记录日志
  const status = err.status || 500;                    // ✅ 无 status 的意外错误兜底为 500
  const logLevel = status >= 500 ? 'error' : 'warn';   // ✅ 5xx 严重、4xx 仅告警
  logger[logLevel]({
    method: req.method,
    url: req.originalUrl,
    status,
    message: err.message,
    stack: err.stack,
    requestId: req.id,                                 // ✅ 关联 requestId 便于全链路回查
  });

  // 2. 构造响应
  const body = {
    error: {
      message: err.expose === false ? 'Internal Server Error' : err.message,  // ✅ 5xx 不外泄内部错文
      ...(err.details && { details: err.details }),                            // ✅ 有详情才带
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),    // ✅ 仅开发环境回 stack
    }
  };

  // 3. 发送
  res.status(status).json(body);   // ✅ 真正结束响应，客户端拿到统一格式
}
// ❌ 参数写成 (err, req, res) 三参数 → Express 不识别为错误中间件，这个函数永远不被调用
```

注册在**最后**：`app.use(errorHandler);`

---

## 四、404 Handler

```js
// 目的：404 兜底—放在所有路由之后、error handler 之前，把未命中请求统一交给 errorHandler
app.use((req, res, next) => {
  next(HttpError.notFound(`Cannot ${req.method} ${req.originalUrl}`));  // ✅ 包成 err 经 next(err) 下发
});
// ❌ 若写在 app.use('/api',...) 之前 → 每个请求都先命中它，404 吞掉后续所有真实路由
```

**用 next(err)** 而不是直接 `res.status(404).json(...)` → 让 error handler 统一处理响应格式 + 日志。

---

## 五、异步传播链

### 5.1 Express 5 自动机制

```
async handler throws → Promise reject
  → Express 5 内部 .catch(next)
  → next(err)
  → 跳过普通中间件
  → 找到 errorHandler (4 参数)
  → 统一响应
```

### 5.2 多中间件接力

```js
// 目的：async handler 里直接 await 危险操作，reject 会自动转给 errorHandler，无需 try/catch
app.get('/complex',
  async (req, res) => {
    const data = await riskyOp();  // ✅ reject → Express 内部 .catch(next) → 进 errorHandler
    res.json(data);
  }
);
```

如果需要在 error handler **之前**做清理（如回滚事务），可在 error handler 链中传递：

```js
// 目的：错误中间件也能接力—先做清理（回滚事务），再把 err 往下传
// 第一层 error handler
app.use((err, req, res, next) => {
  if (err.code === 'TRANSACTION_ABORT') {
    db.rollback(req.txId);        // ✅ 先回滚
    return res.status(409).json({ error: '事务已回滚' });  // ✅ 必须自己结束响应，否则挂起
  }
  next(err);  // ✅ 其余错误继续传给下一个 error handler
});

// 最终 handler
app.use(errorHandler);
// ❌ 回滚后只 return 不 res.end/json → 既不往下传也不回响应，请求永久挂起
```

---

## 六、uncaughtException / unhandledRejection 兜底

```js
// 目的：进程级兜底—抓不住逃逸事件循环的致命错误，记日志后优雅退出并交给监控重启
// src/server.js
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception — shutting down');  // ✅ 先留现场日志
  server.close(() => process.exit(1));   // ✅ 同步关闭，先 drain 在途请求再退出（此处不能 await）
  setTimeout(() => process.exit(1), 5000).unref();  // ✅ 5s 兜底强杀，unref 不阻止正常退出
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason }, 'Unhandled Rejection');  // ✅ 记日志
  // ⚠️ Node 20 默认对 unhandledRejection 直接 crash；若选择退出则同上加 process.exit(1)
});
// ❌ uncaughtException 后只记日志不退出 → 进程状态已不可靠，可能反复出错或默默丢数据，必须重启
```

**原则**：`uncaughtException` 后进程状态不可靠 → **必须重启**（pm2 / systemd / K8s）→ 不要 try to recover。

---

## 七、错误码体系设计

| 范围 | 含义 | 示例 |
| --- | --- | --- |
| 400 | 参数校验失败 | 缺字段、格式错、范围越界 |
| 401 | 未认证 | Token 过期/无效 |
| 403 | 无权限 | 已登录但角色不足 |
| 404 | 资源不存在 | ID 查不到 |
| 409 | 冲突 | 重复注册、乐观锁失败 |
| 422 | 语义错误 | 格式对但业务不通过（余额不足） |
| 429 | 限流 | 超出速率限制 |
| 500 | 服务器内部错误 | 未知 bug |
| 502/503/504 | 网关/不可用/超时 | 下游服务挂了 |

---

## 八、监控与告警集成

### 8.1 Sentry

```js
// 目的：接入 Sentry 上报—初始化后挂请求/错误两个处理器
import * as Sentry from '@sentry/node';
Sentry.init({ dsn: process.env.SENTRY_DSN });            // ✅ 未配 DSN 则上报无效
app.use(Sentry.Handlers.requestHandler());               // ✅ 尽量靠前，为每个请求建隔离域采集上下文
app.use(Sentry.Handlers.errorHandler());                 // ✅ 放在自定义 errorHandler 之后，上报同时不抢响应格式
// ❌ requestHandler 放到路由之后→ 采集不到完整请求上下文，许多 Sentry 特性失效
```

### 8.2 业务错误率告警

```js
// 目的：在 errorHandler 里埋 Prometheus 计数器—驱动 5xx 错误率告警
// 在 errorHandler 里统计
import client from 'prom-client';
const errorCounter = new client.Counter({
  name: 'http_errors_total',
  labelNames: ['status', 'route'],   // ✅ 按状态码与路由分维度，便于面板下钻
});
// handler 里
errorCounter.inc({ status, route: req.baseUrl + req.path });  // ✅ 每发生一次错误 +1
// ❌ label 值基数爆炸（如把用户 ID 放进 label）→ Prometheus 时间线爆涨，切勿高基数入 label
```

Grafana / Prometheus AlertManager → >5% 5xx → Slack 告警。

---

## 九、常见错误处理反模式

| 反模式 | 问题 | 正确做法 |
| --- | --- | --- |
| 空 catch `catch(e) {}` | 吞掉错误→难排查 | 至少 log |
| 在 handler 里 `res.status(500).end()` | 绕过 error handler → 格式不统一 | throw / next(err) |
| 所有错误返回 500 | 信息丢失、客户端无法分支处理 | 精确状态码 + message |
| 在 error handler 里再 throw | 死循环或 Express 默认 handler 接管 | 用 next(err) 传递或 res.json 终止 |
| `process.exit(0)` in uncaughtException | 可能丢数据 | 先 close 再 exit |

---

## 十、自检清单

- [ ] HttpError.expose 的作用是什么？
- [ ] 为什么 error handler 必须 4 参数？
- [ ] 404 handler 用 `res.status(404).json()` 还是 `next(HttpError.notFound())`？
- [ ] uncaughtException 后为什么必须重启？
- [ ] Express 5 async handler 里 setTimeout throw 能被捕获吗？
- [ ] 如何在 error handler 中区分 4xx 和 5xx 日志级别？

---

## 🚀 部署预告

- **优雅关闭**：`SIGTERM → server.close() → drain 已有请求 → exit`；
- **健康检查降级**：`/healthz` 里检测 DB 连接池 → 不健康返回 503 → K8s readiness probe 摘流；
- **Sentry Release 关联**：CI 构建时注入 `SENTRY_RELEASE=git commit sha` → 错误面板按版本分组。

下一关 `exp-3rd-party` 集成常用第三方中间件。
