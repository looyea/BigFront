# 异步错误处理：回调、Promise 与进程级兜底

> 目标：讲清"错误在异步世界里为什么难抓、怎么抓、抓不到会怎样"。核心是**每个异步回调都在一次全新的调用栈里执行**，所以同步的 `try/catch` 抓不到它（呼应 node-event-loop）。串起错误优先回调、Promise 的 reject、`unhandledRejection`/`uncaughtException` 两道进程级兜底，以及"崩之前如何优雅收尾"（呼应 node-deploy-perf、Express L6 错误中间件）。

---

## 一、为什么 try/catch 抓不住异步错误

```js
try {
  setTimeout(() => { throw new Error("boom"); }, 0);   // ✗ 抓不到！
} catch (e) { console.log("catch", e); }               // 永远不执行
```

因为 `setTimeout` **同步返回**、try 块随即结束、调用栈早已弹出；等回调真正在**下一轮事件循环**里抛错时，那个 `try` 栈早没了（每个 timer/IO 回调都是全新调用栈，呼应 node-event-loop 第一节）。`async` 函数里 `await` 后的同步 `throw` 能被抓，是因为 `try` 块跨越了 `await` 挂起点、栈还在：

```js
try {
  await somethingAsync();     // ✓ 这里 throw/reject 能被这个 try/catch 抓到
} catch (e) { /* handle */ }
```

**规律**：能否 `try/catch`，看抛错发生时**你的 `try` 调用栈是否还在**。这是理解全课的地基。

---

## 二、错误优先回调（error-first）：CJS 时代的约定

Node 传统 API 的签名是 `callback(err, result)`——**第一个参数是错误**，没有错误时为 `null`：

```js
fs.readFile("a.txt", (err, data) => {
  if (err) return handleError(err);   // ★ 每次回调第一件事：检查 err
  use(data);
});
```

约定俗成，但极易忘记检查 `err`（漏一次就吞错）。现代一律用 **`fs/promises`**：

```js
import { readFile } from "node:fs/promises";
try { use(await readFile("a.txt", "utf8")); }
catch (e) { handleError(e); }         // 统一的 try/catch，配合 async/await
```

`util.promisify` 可把老 callback API 包成 Promise。用 `fs.promises`/`promisify` 后，异步错误回到"能被 try/catch 抓"的世界（呼应 node-fs）。

---

## 三、Promise 链的错误：别漏 catch

```js
doA().then(doB).then(doC)
  .catch(handleAll);        // ✓ 链上任一环 reject 都汇到这里
```

要点：

- `.then(onFul, onRej)` 的两个参数**只捕获其前面**的失败；链尾放一个 `.catch` 是常见收口；
- `async/await` 里用 `try/catch` 包住 `await`；**并行**要分别处理：`await Promise.allSettled([...])` 后逐个看 `status`，而不是 `Promise.all`（一个失败即整体 reject、其余错误可能被吞，呼应 ES）；
- **忘了 catch 的 Promise rejection 会升级成 `unhandledRejection`**（下一节），这是"悄悄丢错"的头号来源。

```js
// ✗ 危险：fire-and-forget 不 catch
void asyncOperation();     // reject 了没人管 → unhandledRejection
// ✓ 至少兜一层
asyncOperation().catch(report);
```

---

## 四、进程级兜底：uncaughtException 与 unhandledRejection

当错误逃过所有 catch，Node 提供两个**最后防线**事件（在 `process` 上监听，呼应 node-events）：

```js
process.on("unhandledRejection", (reason, promise) => {
  logger.error("未处理的 Promise rejection", reason);
  // 现代 Node：默认会让进程崩溃；这里至少能记录/上报
});
process.on("uncaughtException", (err) => {
  logger.error("未捕获异常", err);
  // ⚠️ 进程状态已不可靠：清理后应尽快退出，由守护进程重启
  process.exit(1);
});
```

关键认知：

- **`uncaughtException` 里"假装没事继续跑"是危险的**——出现它意味着有本不该抛的错穿透了程序，内存/连接/锁状态可能已损坏（呼应 node-deploy-perf 的"crash-only"设计）。正确姿势：**记录 → 尽力 flush → 退出**，交给 pm2/systemd/K8s **重启一个干净进程**；
- 自 Node 15 起，未处理的 rejection **默认使进程退出**（不再只是警告），逼你正视；
- 这两者要**成对注册**，否则一旦触发反而因"没有监听者"被默认行为终止（`uncaughtException` 有监听者才不崩）。

---

## 五、Express/HTTP 里的异步错误

裸 `http` handler 里抛错不会自动变成 500（呼应 node-http）；Express 的**老**版本不自动捕获 `async` 路由抛出的 rejection——错误会**挂住请求**（不响应）直到超时。解法：

```js
// Express 4：手动把错误交给下一个(err)中间件
app.get("/u", async (req, res, next) => {
  try { res.json(await getUser()); } catch (e) { next(e); }   // ★ 显式 next(e)
});
// 或包一个 asyncHandler 高阶函数统一转 next(e)
// Express 5 / 4.17+ 的 router 已自动 catch async 错误转给错误中间件（呼应 09-express）
```

错误中间件（4 参数 `(err, req, res, next)`）是最后的"统一出口"，负责打日志 + 返回合适状态码（呼应 Express L6）。

---

## 六、可组合的错误策略（最佳实践清单）

1. **优先 async/await + try/catch**，远离手写 callback err 检查；
2. 并行用 `Promise.allSettled` 或 `AggregateError`，别用 `Promise.all` 吞错误；
3. 每个"发起但未 await"的 Promise 都要 `.catch` 或纳入兜底（禁 fire-and-forget 裸奔）；
4. `uncaughtException`/`unhandledRejection` 只用于**记录 + 优雅退出**，绝不"记完继续跑"；
5. 抛**带上下文的 Error**（`throw new Error('读取配置失败', { cause: err })`，`cause` 见 ES2022）而非字符串，保留错误链（呼应 ES）；
6. 生产配**重启策略**（pm2/K8s）形成"崩了就换干净进程"的闭环（呼应 node-deploy-perf）。

---

## 七、自检清单

- [ ] 为什么 `try/catch` 抓不到 `setTimeout` 里的 throw，却能抓 `await` 后的 throw？
- [ ] error-first 回调的约定是什么？怎么把它 Promise 化？
- [ ] `Promise.all` 和 `allSettled` 在错误处理上有何区别？
- [ ] 在 `uncaughtException` 里"继续运行"为什么危险？正确动作是什么？
- [ ] Express 老版本里 async 路由抛错为什么会"挂住"请求？怎么修？
- [ ] `{ cause: err }` 解决了什么？

---

## 🚀 部署预告

- 本关的进程级 `uncaughtException`/`unhandledRejection` 兜底，正是下一关 **node-events**（EventEmitter 与 `'error'` 事件——**没有监听者的 `'error'` 事件会抛出未捕获异常**）的直接伏笔；
- "崩了就重启干净进程"的 crash-only 思路，会在 **node-deploy-perf**（pm2/systemd/K8s、graceful shutdown）长成完整运维闭环；
- 错误经 `next(err)` 汇入错误中间件，是 **09-express L6** 的核心（呼应）；
- 未捕获异常与 Promise 语义回扣 ES 的错误处理。

下一关进入 **node-events**：EventEmitter——Node 的事件驱动内核。
