# node-event-loop 面试题精选

> 共 15 题，覆盖 **三层队列 / 六阶段与 poll / 线程池 / 顺序判断 / nextTick 陷阱 / 卡顿与退出** 六类。

---

## 一、三层队列与优先级

### 1. 请解释 `process.nextTick`、微任务（Promise）、宏任务（timer/IO）三者的优先级与执行时机。

优先级从高到低：**nextTick > 微任务 > 宏任务（事件循环各阶段）**。执行模型：同步代码把调用栈跑干净后，Node 先**排空整个 nextTick 队列**，再**排空整个微任务队列**，然后才进入事件循环的下一个宏任务阶段；而且**每执行完一个宏任务回调**，都会再次排空 nextTick + 微任务。所以：

```js
Promise.resolve().then(() => console.log('micro'));
process.nextTick(() => console.log('tick'));
// 输出 tick → micro（nextTick 永远插队在微任务前）
```

nextTick 是 Node 专有、不属于语言标准，设计初衷是"当前操作完成后、进入下一次事件循环之前"的小尾巴（呼应 node-event-loop 第一节）。

**来源**：Node.js — "Event Loop / process.nextTick and microtask queue"; 社区 — "nextTick vs promise microtask order"

### 2. 为什么会有 `process.nextTick` 这种东西？它和 `setImmediate` 解决的是不同问题吗？

不同问题。`nextTick`：在**当前同步操作一结束、还没进事件循环**时就跑，用于"把某事推迟到本 tick 之后立即做"——历史上常用来让 API 的报错**异步抛出**（避免构造函数里同步 throw 让 try/catch 难处理）。`setImmediate`：在**下一个事件循环的 check 阶段**跑，是"真正让出、等 I/O 之后再续"的调度点。区别：递归 `nextTick` 会饿死事件循环（进不了下一阶段），递归 `setImmediate` 会让每一轮 I/O/timer 有机会被处理（呼应 node-event-loop 第五节）。选谁取决于"你要不要给事件循环喘息"。

**来源**：Node.js — "process.nextTick vs setImmediate"; StackOverflow 经典问答

---

## 二、六阶段与 poll

### 3. 画出/描述事件循环的六个阶段，并说明 poll 阶段的特殊之处。

一轮 tick 依次：**timers**（到期的 setTimeout/setInterval）→ **pending callbacks**（上轮延迟的系统回调）→ **idle/prepare**（内部）→ **poll**（等待并执行 I/O 回调）→ **check**（setImmediate）→ **close callbacks**（如 socket close）。阶段之间排空 nextTick + 微任务。**poll 的特殊**：① 它执行绝大多数 I/O 回调（网络、fs 完成）；② 若 poll 队列空且有预期 I/O，它会**阻塞（挂起）等待**新事件——这是 Node "没活时睡眠而非空转"的地方；③ 若 poll 队列非空，它处理到一定限额后进入 check（呼应 node-event-loop 第二节）。

**来源**：Node.js — "The Node.js Event Loop / phases"; libuv 文档 — "event loop"

### 4. 一段代码没有定时器、没有网络、没有 I/O，只有同步语句执行完，进程会怎样？为什么不需要 `process.exit()`？

事件循环走完发现**没有任何保持运行的活跃句柄/请求**（无未到期 timer、无进行中 I/O、无监听中的 server、无 ref 的 handle），poll 阶段无事可等 → **本轮之后事件循环结束、进程自然退出**（退出码取 `process.exitCode`，默认 0）。这正是"单线程 + 事件驱动"的优雅之处：Node 靠"是否还有挂起的工作"决定生死，无需你手动 `exit`（乱用 `process.exit()` 反而可能截断未 flush 的输出，呼应 node-basics 第 4 题、node-event-loop 第二节）。

**来源**：Node.js — "Event Loop lifecycle / when Node exits"; 社区 — "why does my node process exit / keep alive"

---

## 三、线程池

### 5. Node 号称单线程，那 `fs.readFile` 1000 个文件时是谁在执行读取？会无限并发吗？

读取由 **libuv 线程池**（默认 4 根线程，`UV_THREADPOOL_SIZE` 可调至最多 1024）执行：JS 把 1000 个读请求交给 libuv，池里的线程各自做真正的同步系统调用，完成后把回调排进 poll 阶段回到单线程。**不会无限并发**——同一时刻最多 4（默认）个 fs 操作在跑，其余在 libuv 队列排队。这解释了"高并发读文件吞吐受限、调大 UV_THREADPOOL_SIZE 有时能提升"的现象（呼应 node-event-loop 第三节、node-fs）。而网络 I/O 走内核异步（epoll/kqueue/IOCP），**不占线程池**，所以几万并发连接没问题。

**来源**：libuv — "Thread pool"; Node.js — "Threadpool usage / UV_THREADPOOL_SIZE"

### 6. 为什么"同步跑一个大循环"和"用 fs 做大量 IO"对事件循环的影响完全不同？

因为二者**执行的线程不同**。`for(...){}中做纯 JS 大计算`发生在**主线程**，它不交还控制权，事件循环彻底停摆（无法处理任何 I/O/timer）——这是最危险的（呼应 node-basics 第八题）。而 `fs.readFile`（异步版）只是把活儿**丢给线程池**，主线程立刻返回、继续跑事件循环，读完后回调再回来。所以"IO 用异步 API 不会卡循环，CPU 密集才卡"。若被迫用 `fs.readFileSync` 或做同步加密，那又回到主线程、照样卡死（呼应 node-workers 的"CPU 密集外包给 worker"）。

**来源**：Node.js — "Blocking the Event Loop vs threadpool"; 社区 — "CPU-bound vs I/O-bound in Node"

---

## 四、顺序判断题

### 7. 给经典题定顺序：

```js
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
Promise.resolve().then(() => console.log('promise'));
process.nextTick(() => console.log('nextTick'));
console.log('sync');
```

顶层输出：**`sync` → `nextTick` → `promise` → 然后 `immediate` 与 `timeout` 顺序不定**。理由：`sync` 同步先跑；跑完后 nextTick 队列先于微任务，故 `nextTick` 再 `promise`；剩下 `timeout`（timers 阶段）与 `immediate`（check 阶段）分属宏任务，二者相对顺序**在主模块里不确定**（取决于进入循环时 0ms 定时器是否已"到期"——而 timers 最小延时实为约 1ms，同步代码耗时可能已越过它）。若把这段放进**一个 fs I/O 回调**里，则 `immediate` 必在 `timeout` 前（因为当前一定在 poll 阶段，紧接着就是 check，再到下一轮才 timers）（呼应 node-event-loop 第四节）。

**来源**：Node.js — "process.nextTick vs setImmediate ordering"; 社区经典事件循环面试题

### 8. `setTimeout(fn, 100)` 就保证 100ms 后精确执行吗？为什么？

**不保证，只保证"不早于"**。100ms 后定时器在 timers 阶段变为"就绪"，但要等：① 当前正在执行的任务跑完（单线程，前面有活就得排队）；② nextTick/微任务排空；③ 若事件循环此刻在别的阶段，要转到 timers。若主线程被一个 200ms 的同步任务占住，这个 100ms 回调会在约 200ms 后才跑（延迟）。加上 timers 阶段每轮最多处理有限个 timer 的限额、以及系统调度抖动——**timer 是"最少等待"语义，不是实时精确**（呼应 node-deploy-perf 的 loop lag：延迟大小正是卡顿度量）。要"到点必执行、不累积漂移"需自己记录实际触发时间做补偿。

**来源**：Node.js — "Timers / minimum delay & not guaranteed"; 社区 — "setTimeout not precise drift"

---

## 五、nextTick / 微任务陷阱

### 9. 递归 `process.nextTick` 与递归微任务（Promise）都会饿死事件循环，但递归 `setImmediate` 不会，为什么？

因为 nextTick 队列和微任务队列的**排空发生在每次进入事件循环阶段之前**——只要这两条队列持续非空，Node 就**永远走不到** poll/timers 去处理 I/O 和定时器 → I/O 饿死。而 `setImmediate` 的回调属于 **check 阶段的宏任务**：一次只排入当前事件循环一轮，递归 `setImmediate` 会在下一轮 check 才跑，中间 poll/timers 有机会执行，所以不饿死。结论：**"我要下一轮事件循环再做、且给 I/O 喘息"→ setImmediate；"当前操作完立刻做"→ nextTick**（后者慎用递归，呼应 node-event-loop 第五节）。

**来源**：Node.js — "nextTick starvation"; 社区 — "setImmediate vs nextTick for yielding"

### 10. `await` 一个 Promise 后，被挂起的函数体是从事件循环哪个环节恢复执行的？

`await` 之后的代码被编译成 Promise 的 `.then` 回调，属于**微任务**。所以每次 `await` 恢复都发生在**当前宏任务之后、nextTick 之后的微任务排空**里（若期间又有同步段则在阶段间微任务点）。含义：大量 `await` 不会占用事件循环的宏任务阶段，但**密集的微任务链**同样可能推迟进入 poll/下一阶段的时间；而跨真实异步（如 `await fetch`、`await fs`）则会让出、等 I/O 在 poll 回调里 resolve 后再回到微任务继续。理解这点才能解释"为什么 `await` 一个已 resolve 的值仍不是同步继续"（呼应 node-async-errors、ES async）。

**来源**：TC39 — "await / async functions desugaring to promises"; 社区 — "where does await resume in event loop"

---

## 六、监控与实战

### 11. 生产环境如何测量并降低"事件循环延迟"？给工具 + 两类根因的对策。

**测量**：`perf_hooks.monitorEventLoopDelay()`、`performance.eventLoopUtilization()`，或用 `setTimeout` 基准对比算 lag；APM（如 OpenTelemetry）会采集为 `eventloop.lag` 指标。**根因与对策**：① **CPU 密集占主线程**（大 JSON.parse、同步加密、巨型数组操作、每次请求做重正则）→ 拆成分片让出（setImmediate/await）、或迁到 **worker_threads/子进程**（呼应 node-workers）、或缓存结果；② **微任务/nextTick 风暴或过多并发回调排队**（一次 resolve 巨量 Promise）→ 分批处理、减少无谓 await。原则：**绝不在请求路径里跑长同步代码**（呼应 node-deploy-perf、Express L8）。

**来源**：Node.js — "perf_hooks / monitorEventLoopDelay"; 社区 — "event loop lag in production"

### 12. 面试官问"讲讲 Node 事件循环"，一道题答出满分结构，你会怎么组织？

四条主线：① **定位**：Node 单线程跑 JS，靠事件循环 + libuv 异步 I/O 支撑高并发（区分 CPU/IO 密集）；② **结构**：同步 → nextTick → 微任务 → 六阶段（timers/pending/idle-prepare/**poll**/check/close），阶段间排空 tick+微任务；③ **底层**：网络 I/O 走内核异步不占线程池，fs/dns/crypto/zlib 走 libuv 线程池（默认 4）；④ **易错点**：nextTick vs setImmediate vs 递归饿死、timer 是"至少等待"、进程无活跃句柄才退出、CPU 密集会卡死整个循环。能把"顺序判断题 + 为什么"讲透，比背阶段名更能体现理解（呼应本课全篇、node-basics、node-workers）。

**来源**：Node.js 官方 Event Loop 文档; 社区 — "explain the node event loop interview"

---

## 补充（新专题 13-15）

### 13. 给一条「事件循环延迟」诊断决策树：CPU 高/低分别说明什么、下一步查什么？

指标先行：perf_hooks monitorEventLoopDelay 或 `node --inspect` 的 loop 面板拿 p99 延迟，CLI 观测用 clinic.js（event-loop 冒烟枪）/0x。分叉：① **CPU 高**=主线程被同步占（大循环、序列化、正则回溯、同步 fs）→ --cpu-prof/clinic flame 找热点栈；② **CPU 低但 loop 延迟高**=等待异常：libuv 线程池饥饿（并发大文件/crypto 满屏）、信号/句柄风暴（每轮回调巨多摊薄时间片）、GC 长暂停（堆濒临上限，看 --trace-gc）；③ 都不明显→ 外部依赖慢（DB 池耗尽表现为 await 堆积，查活跃句柄数 process._getActiveHandles 与队列长度）。口诀「延迟高先分忙与饿」，修复方向完全不同（挪计算 vs 调池 vs 限并发）。

**来源**：Node 官方《Diagnostic User Guide: Event Loop Delay》与 perf_hooks monitorEventLoopDelay 文档；clinic.js event-loop 工具页。

### 14. nextTick 为什么在微任务之前？这个「优先级特权」为什么被设计成不可递归？

nextTick 有独立队列且在**当前宏任务结束、微任务之前**清空——历史动机：CJS 模块加载/事件发射需要「本 tick 立即续跑」的确定性（早于 Promise 存在的时代产物，官方现建议新代码用 queueMicrotask）。微任务在其后（Promise 回调、await 续体）。防饿死：nextTick 递归会在微任务之前无限自我续约 → I/O 永不处理，Node 对 nextTick 队列**单轮不重复补充**（每轮清空一次，微任务同理按规范跑空但微任务里再 spawn 微任务同样能饿死 loop——浏览器/Node 都有此风险）。判定口径：递归 nextTick/微任务=同步死循环的伪装形态（本关题干考过），需要分片让位就 setImmediate 或 timer 让步。

**来源**：Node 官方《nextTick and microphone queue 顺序》process 文档；TC39 微任务语义与「starvation」讨论。

### 15. 六个阶段背下来只是开始——说说 poll 阶段的完整决策流程与「什么时候会卡在 poll」。

poll 决策两步：① 有已到期 I/O 回调 → 循环执行直到队列空或达到系统上限；② 队列空 → **阻塞等待**回调（epoll_wait）：若有 setImmediate 待跑则提前结束等待进 check；若代码调度了近 timer，Node 计算 sleep 先到 timers 再回到 poll。卡住的三种含义：a) 真在等网络/磁盘（正常空闲，不叫延迟）；b) 大量 readable/connection 回调排队（惊群/连接风暴）——单轮太长；c) 回调里同步重活让 poll「名义在跑实则没收新事件」。观测：`--inspect` 的 Performance 面板、`node --cpu-prof` 的 idle 栈占比。理解 poll 才能解释「I/O 回调里 setImmediate 优先于 setTimeout(0)」（本关经典顺序题的机理层）。

**来源**：Node 官方《The Node.js Event Loop, timers, and process.nextTick》图解；libuv 文档 uv_run 阶段说明。
