# node-async-errors 面试题精选

> 共 12 题，覆盖 **try/catch 与调用栈 / error-first 与 Promise 化 / Promise 链与并行 / 进程级兜底 / Web 框架错误 / 错误设计** 六类。

---

## 一、try/catch 与调用栈

### 1. 为什么 `try { JSON.parse(bad) } catch {}` 能抓到，而 `try { setTimeout(()=>{throw 1},0) } catch {}` 抓不到？能否抓 `await` 后的错？

区别在**抛错发生时你的 `try` 调用栈是否还在**。`JSON.parse` 同步抛错，栈就在 try 帧内 → 抓到。`setTimeout` 同步注册后立即返回、try 块结束、栈弹出；回调在**下一轮事件循环的全新栈**里抛，没有任何 try 帧罩着 → 抓不到。而 `try { await f() } catch {}` 能抓，是因为 `await` 让出后恢复的续体仍在**同一个 async 函数的 try 块作用域内**（引擎帮你跨挂起点保留了 catch 上下文）。一句话：**能否 catch 取决于"抛错的那一瞬间，catch 是否在调用栈上"**（呼应 node-async-errors 第一节、node-event-loop）。

**来源**：MDN — "try...catch / synchronous vs async"; Node.js — "Async error handling"

### 2. 一个没被任何 catch 处理的 `async` 函数调用（fire-and-forget）抛错，最终会发生什么？

`async` 函数抛错会变成一个 **rejected Promise**。如果调用处既没 `await` 也没 `.catch`（fire-and-forget），这个 rejection 就"无人处理"，在下一个微任务检查点触发 **`unhandledRejection`** 事件；Node 15+ 默认因此**让进程崩溃退出**（除非你注册了 `unhandledRejection` 监听器接管）。这就是最隐蔽的"错误凭空消失/进程莫名重启"来源之一。对策：任何发起的 Promise 要么 `await`+try/catch，要么至少挂 `.catch`，绝不让它裸奔（呼应 node-async-errors 第三、四节）。

**来源**：Node.js — "unhandledRejection / --unhandled-rejections=throw"; MDN — "unhandled promise rejection"

---

## 二、error-first 与 Promise 化

### 3. 什么是"错误优先回调"？它有什么问题，Node 又为何长期用它？

约定 `callback(err, value)`：首参恒为错误（成功时 `null`），其余为结果。它的问题：① 每个回调都要手写 `if (err) return ...`，**漏检就静默吞错**；② 深层嵌套（callback hell）里错误层层手动透传，极易在某层忘记往上 `cb(err)`；③ 无法用 try/catch 统一处理。当年用它是因为 Promise/async 尚未出现，而"同步 throw"又不适配异步——需要一个把错误作为**数据**显式传回来的约定（呼应 node-async-errors 第二节）。如今用 `fs/promises`、`util.promisify` 把它 Promise 化，错误重新回到"能 throw、能 catch"。

**来源**：Node.js — "Error handling / error-first callbacks"; 社区 — "why (err, data) convention"

### 4. `util.promisify` 做了什么？用它包装一个 error-first 函数时，返回的 Promise 如何映射 err/成功值？

`promisify(fn)` 把一个 `fn(...args, callback)` 风格的函数转成返回 Promise 的版本：调用返回的函数时你传 `(...args)`，它内部替你挂上 `callback(err, result)`——**`err` 非空则 reject(err)**，否则 **resolve(result)**（多参回调默认 resolve 第一个结果值，或配 `customPromisifyArgs` 指定，如 `exec` 的 `error, stdout, stderr`）。它把"错误即首参"的约定无缝翻译成"错误即 reject"，从而能 `await` + try/catch。反向有 `callbackify`（Promise 函数转回调风格）。这是新旧异步 API 的桥梁（呼应 node-async-errors 第二节、node-fs）。

**来源**：Node.js — "util.promisify / util.callbackify"; MDN — "util.promisify"

---

## 三、Promise 链与并行错误

### 5. `Promise.all` 和 `Promise.allSettled` 在"其中一个失败"时行为差异？各自适合什么场景？

`Promise.all`：**任一** promise reject 就立刻整体 reject（fail-fast），其它 promise 继续跑但结果被丢弃、且**它们的错误可能没人处理**（变成 unhandledRejection）。适合"全成功才有意义，一个挂就整个回滚"（如并行拉取拼成一个响应）。`Promise.allSettled`：等**全部**落定，返回 `{status:'fulfilled'|'rejected', value|reason}[]`，永不整体 reject。适合"尽力而为、要保留每个独立结果/错误"（如批量发通知、健康检查、并行导入要看每条成败）（呼应 node-async-errors 第三节、ES）。要点：用 `all` 做并行时，常要给每个子 promise 各自兜 `.catch`，否则失败分支错误会漏。

**来源**：MDN — "Promise.all / Promise.allSettled"; 社区 — "all vs allSettled error handling"

### 6. `.then(a, b)` 和 `.then(a).catch(b)` 语义有何不同？为什么推荐后者？

`.then(onFulfilled, onRejected)` 的第二个参数 `onRejected` **只捕获它之前**那一步的失败；而 `.then(a).catch(b)` 的 `.catch` 位于链尾，会捕获**链上任意前置环节**（包括 `a` 自己内部抛出的错）的 rejection。举例：`p.then(v => JSON.parse(v), handleErr)` 里若 `JSON.parse(v)` 抛错，`handleErr` **不会**被触发（它只管 `p` 的失败）；而 `p.then(v => JSON.parse(v)).catch(handleErr)` 能捕获。所以想要"一处收口所有上游错误"用 `.catch`，别依赖 `.then` 的双参（呼应 node-async-errors 第三节）。

**来源**：MDN — "Promise.then vs catch semantics"; 社区 — "then(fn, err) gotcha"

---

## 四、进程级兜底

### 7. `uncaughtException` 和 `unhandledRejection` 分别在何时触发？捕获后能"让程序继续正常跑"吗？

`uncaughtException`：抛出的**同步/异步异常**穿透到事件循环顶层、无任何 try/catch 时触发（含 EventEmitter 未监听的 `'error'`，呼应 node-events）。`unhandledRejection`：某个 Promise 被 reject 且没有对应 `.catch`/无 await-try 接收时，在微任务检查点后触发。**"继续正常跑"是不可靠的**：这类错误出现意味着程序进入了你没预料、可能不一致的状态（半更新的对象、泄漏的连接/文件句柄、持有的锁未释放）。最佳实践是把它当"**临终遗言处理器**"：记录、flush 日志、关闭 server、然后 `process.exit(非0)`，由外部守护（pm2/systemd/K8s）重启干净进程（crash-only design，呼应 node-async-errors 第四节、node-deploy-perf）。

**来源**：Node.js — "process 'uncaughtException' / 'unhandledRejection'"; 社区 — "crash-only software / fail fast"

### 8. 为什么监听器自己不要在 `uncaughtException` 里再做可能抛错/异步很久的事？

因为进程已处于"未定义"状态、且 Node 对这类监听有特殊语义：如果你的监听器又抛错或触发新的 rejection，可能陷入递归/雪崩；若你在里面做长异步（await），事件循环虽还在但整体状态已不可信，越跑越糟。稳妥做法：监听器里**只做同步或小心的收尾**（写一条日志、置个标志位），然后尽快 `process.exit`。真要优雅关闭（drain 连接）应通过**正常信号路径**（SIGTERM，呼应 node-deploy-perf）而非崩溃路径去做。

**来源**：Node.js — "uncaughtException caveats"; 社区 — "what to do in uncaughtException"

---

## 五、Web 框架里的错误

### 9. Express 4 里 `app.get('/', async (req,res)=>{ throw new Error('x') })` 为什么会"请求一直挂着不返回"？怎么根治？

因为 Express 4 的路由派发**不 await** 你的 async 函数：async 函数返回的 Promise 被 reject 后，Express **没能力捕获**（它只同步调用 handler、看是否显式 `next(err)`），既不会触发错误中间件、也不会发响应——于是请求悬挂到连接超时。根治三选一：① handler 内 `try/catch` 后 `next(err)`；② 用 **`asyncHandler` 高阶包装**（`.catch(next)` 统一转发）；③ 升级到 **Express 5 / 4.17+ 的 router**，它自动捕获 async rejection 转给错误处理链（呼应 09-express、node-async-errors 第五节）。错误中间件 `(err,req,res,next)` 是最终出口。

**来源**：Express — "Error handling / async errors"; Express 5 — "handles rejected Promises"

### 10. 一个统一错误处理中间件应该做哪些事？为什么生产环境不能把 err.stack 直接发给客户端？

职责：① **分类**（业务错误 vs 程序错误，用带 statusCode/code 的自定义 Error 区分）；② **记录**（服务端日志记完整 stack + 上下文 requestId，供排查）；③ **响应**（给客户端合适状态码 + **脱敏**的结构化错误信息）。生产绝不能回传 `err.stack`/内部信息——会**泄漏文件路径、依赖版本、框架、甚至 SQL/密钥片段**，是典型的**信息泄露漏洞**（呼应 Express L6 安全、node-deploy-perf）。正确：5xx 统一回"服务器内部错误 + 一个可关联日志的 traceId"，细节只进日志。开发环境可回 stack。

**来源**：Express — "Error handling middleware"; OWASP — "Improper Error Handling / information disclosure"

---

## 六、错误设计

### 11. 为什么"throw 一个字符串/普通对象"是坏味道？抛 Error 实例好在哪？

`throw "not found"` 或 `throw { code:404 }` 的问题：没有 **stack**（丢失抛错位置与调用链）、没有 `instanceof Error` 一致性、很多框架/工具（如 Express、`util.inspect`、日志库）对非 Error 处理各异甚至吞掉。抛 `Error` 实例的好处：自带 `message` + `stack`（含文件名行号）+ `name`，能被 `catch(e instanceof 自定义Error)` 精确分流；扩展 `class NotFoundError extends Error { constructor(){ super('...'); this.name='NotFoundError'; this.statusCode=404; } }` 可携带业务码。再配 `{ cause }`（ES2022）保留底层错误链（呼应 node-async-errors 第六节、ES）。

**来源**：MDN — "throw / Error"; 社区 — "always throw Error instances, not strings"

### 12. 你会如何为一个 Node 服务设计"分层错误处理"，从底层库到最外层进程兜底？

自内向外：**① 领域层**抛类型化的自定义 Error（带 `code`/`statusCode`/`cause`，别抛字符串）；**② 业务/编排层**用 async/await + try/catch，能处理就地处理、不能处理则包 `cause` 往上抛；**③ 边界层**（HTTP）Express 错误中间件统一收口：分类、记 requestId 日志、脱敏响应（第 10 题）；**④ 进程层**注册 `unhandledRejection`+`uncaughtException` 作为**最后防线**：记录 + flush + 退出，交给 **pm2/systemd/K8s 重启**（crash-only，呼应 node-deploy-perf）；**⑤ 可观测**：错误上报（Sentry）+ loop lag/崩溃次数指标。铁律：错误**要么被处理、要么被抛出**，绝不"只 console.log 一下就咽掉"，也不在崩溃监听器里假装一切正常（呼应 node-async-errors 全篇）。

**来源**：Node.js — "Error handling guidance"; 社区 — "robust error handling in Node services / crash-only"
