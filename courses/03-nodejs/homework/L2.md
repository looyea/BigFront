# L2 课后作业：事件循环与异步模型

> 覆盖 **node-event-loop / node-async-errors / node-events** 三关。先做"读代码预测输出"，再动手写，最后场景与简答。所有代码假设在 Node 20+ 环境运行。

---

## 一、读代码，预测输出顺序（10 小题）

**1.**
```js
console.log("1");
setTimeout(() => console.log("2"), 0);
Promise.resolve().then(() => console.log("3"));
process.nextTick(() => console.log("4"));
console.log("5");
```

**2.**
```js
setTimeout(() => {
  console.log("timer");
  Promise.resolve().then(() => console.log("micro-in-timer"));
}, 0);
setImmediate(() => console.log("immediate"));
```
> 说明：顶层 `setTimeout(0)` 与 `setImmediate` 的相对顺序为什么"不确定"？

**3.**
```js
const fs = require("node:fs");
fs.readFile(__filename, () => {
  setTimeout(() => console.log("A"), 0);
  setImmediate(() => console.log("B"));
});
```
> 在 I/O 回调里，A 和 B 谁先？为什么这次是确定的？

**4.**
```js
function loop() {
  process.nextTick(() => { console.log("tick"); loop(); });
}
loop();
setTimeout(() => console.log("never?"), 100);
```
> `setTimeout` 会不会执行？这体现了 nextTick 的什么风险？

**5.**
```js
try {
  setTimeout(() => { throw new Error("boom"); }, 0);
  console.log("sync ok");
} catch (e) {
  console.log("caught", e.message);
}
```

**6.**
```js
async function f() { throw new Error("async boom"); }
try {
  await f();
} catch (e) {
  console.log("caught:", e.message);
}
```
> 为什么这里 `try/catch` 又能抓到（对比第 5 题）？

**7.**
```js
Promise.all([
  Promise.reject(new Error("e1")),
  new Promise(() => {}),          // 永不 settle
  Promise.reject(new Error("e2")),
]).catch((e) => console.log("all caught", e.message));
```

**8.**
```js
const results = await Promise.allSettled([
  Promise.resolve("ok"),
  Promise.reject(new Error("bad")),
]);
console.log(results.map((r) => r.status));
```

**9.**
```js
const { EventEmitter } = require("node:events");
const ee = new EventEmitter();
ee.emit("error", new Error("nobody listens"));
```
> 这段代码会发生什么？（呼应 node-events 第三节）

**10.**
```js
const { EventEmitter } = require("node:events");
const ee = new EventEmitter();
const h = () => console.log("hi");
ee.on("x", h);
ee.off("x", () => h());     // 注意：传的是新函数
ee.emit("x");
console.log("count:", ee.listenerCount("x"));
```

---

## 二、手写编程题（5 题）

**11.** 实现 `logOrder()`，用一行内的输出证明优先级顺序 `nextTick > 微任务(Promise) > 宏任务(setTimeout)`，并写注释标出每个回调属于哪类队列。

**12.** 写一个 `delay(ms, value)` 返回 Promise，在 `ms` 后 resolve `value`；再用 `await` 串起三个不同延时，打印完成顺序与各自耗时，观察它们是否真的"并行"（对比 `Promise.all([...delays])`）。

**13.** 用 `util.promisify` 把 `fs.readFile`（回调版）包成 Promise 版本，写一个 `readJson(path)`：读文件 + `JSON.parse`，用 `try/catch` 分别处理"文件不存在"和"JSON 非法"两类错误，并用 `{ cause }` 保留原始错误。

**14.** 手写一个 `retry(fn, { times, delay })`：`fn` 是返回 Promise 的函数，失败则最多重试 `times` 次、每次间隔 `delay` 毫秒；全部失败则抛出**带 cause 的最后错误**。要求：任一成功立即返回、无 fire-and-forget 裸 Promise。

**15.** 自定义 `class BusyWorker extends EventEmitter`：有 `start()` 方法，工作过程中依次 `emit('progress', n)`（n=0..100）、完成 `emit('done', result)`、异常 `emit('error', err)`。写一段使用代码，用 `on('progress')`、`once('done')`、`on('error')` 消费，并**演示如果不挂 `on('error')` 会怎样**。

---

## 三、场景题（1 题）

**16.** 你维护一个 Express 服务，最近线上偶发"进程静默退出、监控里没有 5xx"。翻日志发现崩溃前有一行 `UnhandledPromiseRejection`，来源是一条 `router.get('/report', async (req,res) => { res.json(await buildReport()); })`。请回答：
- (a) 为什么这个 async 路由的错误会绕过你的错误中间件、还可能让请求"挂住"？（呼应 node-async-errors 第五节、09-express）
- (b) 给出两种修法（Express 4 语境），并说明 Express 5 为何能自动捕获。
- (c) 作为"最后防线"，你会如何注册 `unhandledRejection`/`uncaughtException`？为什么在 `uncaughtException` 里"记录完继续跑"是危险的，正确动作是什么？（呼应 node-async-errors 第四节、node-deploy-perf）

---

## 四、简答题（3 题）

**17.** 用语言描述 libuv 事件循环的六个阶段（timers → pending → idle/prepare → poll → check → close），并说明：`setTimeout` 回调、I/O 回调、`setImmediate` 分别在哪个阶段被处理？为什么进程"没有活跃句柄"才退出？（呼应 node-event-loop）

**18.** `Promise.all` 与 `Promise.allSettled` 在"某个任务失败"时的行为差异是什么？各举一个业务场景说明该用哪个。（呼应 node-async-errors 第三节）

**19.** EventEmitter 里 `'error'` 事件与其它事件在"无监听者"时的行为有什么不同？`MaxListenersExceededWarning` 通常在提示什么问题、你应如何系统排查？（呼应 node-events 第三、四节）

---

## 五、挑战题 🏆

**20.** 🏆 不查资料，实现一个极简 `MiniEmitter`（类），要求兼容以下语义：
- `on(evt, fn)` / `once(evt, fn)`（once 触发后自动移除）/ `off(evt, fn)`（同一引用才移除）；
- `emit(evt, ...args)` **同步、按注册顺序**调用，并返回"是否有监听者"；
- **特殊 `'error'`**：当 `emit('error')` 且无任何 `'error'` 监听时，`throw` 出那个错误（模拟 Node 的崩溃语义）；
- `listenerCount(evt)`；当某事件监听数超过阈值（默认 10）时 `console.warn` 一条 `MaxListenersExceededWarning` 风格提示。

写完用第 10 题与第 15 题的片段验证：你的 `MiniEmitter` 行为是否与原生 `EventEmitter` 一致？（提示：`emit` 时对监听列表做快照，避免遍历中 `off` 漏调/多调）
