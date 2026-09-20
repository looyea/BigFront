# 事件循环与 libuv：六个阶段

> 目标：把 Node 的心脏——**事件循环（Event Loop）**——从"心智模型"升级到"能解释任意一段异步代码的执行顺序"。讲清调用栈 / 微任务 / 宏任务的分层，libuv 的**六个阶段**与线程池，`process.nextTick`、微任务(Promise)、`setTimeout`、`setImmediate` 的**优先级与顺序**，以及"事件循环卡顿"到底卡在哪（呼应 node-basics 第五/七题、node-async-errors、node-workers）。

---

## 一、先分清三层队列

很多人把"微任务/宏任务/nextTick"混为一谈，其实是**三个不同层级**：

```
┌ 调用栈（同步代码，一次跑到底，跑完才轮到下面）
├ process.nextTick 队列         ← Node 专有，优先级最高
├ 微任务队列 microtask          ← Promise.then / queueMicrotask
└ 事件循环各阶段（宏任务）       ← timers / poll / check / close...
```

一条铁律贯穿全课：**每执行完一个"任务"，Node 会先把 nextTick 队列 + 微任务队列彻底清空，才进入下一步。**（严格说：nextTick 与 microtask 在每个阶段之间、以及每个回调之后都会被排空。）

---

## 二、libuv 与六个阶段

Node 启动后，主线程跑完同步代码，进入事件循环，一轮 tick 依次经过：

```
   ┌───────────────────────────┐
┌─▶│         timers            │  执行到点的 setTimeout/setInterval 回调
│  └────────────┬──────────────┘
│  ┌────────────┴──────────────┐
│  │     pending callbacks      │  上一轮延迟的系统回调（如 TCP error）
│  └────────────┬──────────────┘
│  ┌────────────┴──────────────┐
│  │  idle / prepare           │  内部使用
│  └────────────┬──────────────┘
│  ┌────────────┴──────────────┐
│  │        poll（最重要）      │  等待 I/O 完成、执行 I/O 回调；没有则可能在此阻塞
│  └────────────┬──────────────┘
│  ┌────────────┴──────────────┐
│  │         check             │  执行 setImmediate 回调
│  └────────────┬──────────────┘
│  ┌────────────┴──────────────┐
│  │      close callbacks       │  如 socket 'close' 事件
│  └────────────┬──────────────┘
└───────────────┘
   每个阶段之间：排空 nextTick 队列 + 微任务队列
```

**为什么 poll 能"阻塞"？** 当没有就绪的 I/O 回调时，poll 阶段会短暂挂起等待新事件——这就是"没有任务时 Node 不空转、自动睡眠"的机制；当没有任何待处理的 timer/IO/immediate 时，事件循环结束、**进程自然退出**。

---

## 三、libuv 线程池：单线程 ≠ 只有一个线程

"JS 单线程"指**你的代码**在一根线程上跑。但文件 I/O、DNS、部分加密、压缩等无法全异步的操作，libuv 会把活儿丢给一个**默认 4 线程的池**（`UV_THREADPOOL_SIZE`，最大 1024）：

```js
// 4 个 fs.readFile 并发度受线程池大小（默认4）限制，而非"无限并发"
// 网络 I/O（http/net）走操作系统异步（epoll/kqueue/IOCP），不占线程池！
```

关键区分：**网络 I/O 不进线程池**（内核异步）、**fs/dns/crypto/zlib 进线程池**。所以"同时发 1000 个 HTTP 请求"轻松，但"同时读 1000 个文件"会在线程池排队（4 个一批）。CPU 密集的同步 JS 既不异步也不进池——它就是霸占主线程、卡死事件循环（呼应 node-basics 第八题、node-workers）。

---

## 四、顺序判断实战：nextTick > microtask > 阶段

```js
console.log('1 同步');
setTimeout(() => console.log('6 timer'), 0);
setImmediate(() => console.log('5 immediate'));
queueMicrotask(() => console.log('3 microtask'));
Promise.resolve().then(() => console.log('4 promise'));
process.nextTick(() => console.log('2 nextTick'));
console.log('1 同步(末)');
```

输出：`1 同步` → `1 同步(末)`（同步先跑完）→ `2 nextTick` → `3 microtask` → `4 promise`（nextTick 队列先于微任务，且 promise/microtask 同属微任务层，按注册顺序）→ 进入事件循环后 `5 immediate`（check）与 `6 timer`（timers）——**这两者顶层顺序不确定**（取决于同步代码耗时是否越过 timer 的 1ms 阈值）。

口诀：
- **同步 → nextTick → 微任务 → 事件循环阶段**；
- **nextTick / 微任务会在每个阶段之间、每个回调之后被排空**（不是"只在最开头"）；
- `setImmediate` vs `setTimeout(fn,0)` 在**顶层**顺序不定，但在 **I/O 回调（poll 阶段）里** `setImmediate` **总是先于** 下一轮 timer。

---

## 五、nextTick 的"滥用陷阱"

`process.nextTick` 优先级高于微任务，若在回调里递归 `nextTick`，会**饿死事件循环**——永远排不空的 tick 队列让 poll/timer 再也轮不到，I/O 与定时器全停：

```js
function spin() { process.nextTick(spin); }   // ✗ 事件循环永远进不了下一阶段
spin();   // 服务假死：没有 I/O、没有 timer 能触发
```

Promise 递归（`Promise.resolve().then(spin)`）同理会饿死微任务之后的阶段。**准则**：需要"下一轮再让出给事件循环"用 `setImmediate`，而不是 nextTick 套 nextTick。nextTick 适合"当前操作完成后、马上要做的小尾巴"（如模拟错误优先回调的异步抛出）。

---

## 六、事件循环卡顿怎么被发现

- `performance.eventLoopUtilization()`（14.10+）/ `monitorEventLoopDelay`（perf_hooks）测量 **loop lag**：两次 tick 间隔远超预期 = 有同步任务霸占主线程；
- 症状：定时器集体迟到、请求 P99 飙升但 CPU 打满或某个回调里藏了同步大循环；
- 解法：把大计算拆成分片（每步 `setImmediate`/`await`）、或丢进 worker_threads/子进程（呼应 node-workers、node-deploy-perf）。

---

## 七、自检清单

- [ ] nextTick、微任务、宏任务分别在哪个层级？谁先被排空、什么时候排？
- [ ] 事件循环六个阶段各跑什么？poll 为什么能"睡眠"？进程何时退出？
- [ ] 哪些 I/O 走线程池、哪些走内核异步？默认线程池几根线程？
- [ ] 顶层 `setImmediate` vs `setTimeout(0)` 为何顺序不定？在 I/O 回调里呢？
- [ ] 为什么递归 `process.nextTick` 会饿死事件循环？该用什么替代？
- [ ] 如何量化"事件循环卡顿"？

---

## 🚀 部署预告

- 理解了"回调何时跑"，下一关 **node-async-errors** 解决"回调/Promise 抛错时为什么 try/catch 抓不到、进程为什么会崩"——正是异步任务分属不同调用栈的直接后果；
- EventEmitter（**node-events**）的 `'error'` 事件语义、stream 背压的调度都跑在本关这套循环上；
- "同步任务卡死 loop / 线程池排队"是 **node-workers**（CPU 密集外包）与 **node-deploy-perf**（loop lag 监控）的问题根源（呼应 Express L8 性能）。

下一关进入 **node-async-errors**：异步世界的错误处理。
