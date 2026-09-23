# worker_threads：把重计算挪出事件循环

> 目标：cluster 是"**多进程分摊网络请求**"，而当一个**同步 CPU 密集任务**（图片处理、加解密、大 JSON/正则、压缩）跑在主线程上时，会把**整个事件循环卡死**——所有请求都停摆（呼应 node-event-loop 阻塞之害）。`worker_threads` 让你在**同一进程内开线程**跑 JS，既**不阻塞主线程**，又能通过 `SharedArrayBuffer`+`Atomics`/transfer **共享内存**。掌握 `new Worker`/`postMessage`/`workerData`、`parentPort`、两种共享内存方式、线程池，以及它和 cluster 的场景分野。

---

## 一、什么时候需要 worker_threads

先分清三种"并发"手段：

| 机制 | 粒度 | 内存 | 适合 |
| --- | --- | --- | --- |
| cluster | 多**进程** | 各自独立堆 | HTTP 服务**多核分摊 I/O** |
| child_process.fork | 多**进程** | 各自独立堆 | 跑外部命令 / 隔离任务（呼应 node-child-process） |
| **worker_threads** | 同进程内**线程** | **可共享 ArrayBuffer** | **CPU 密集**计算，别卡主线程 |

**判据**：如果你的瓶颈是"一段要算很久的 JS"，用 worker_threads；如果是"很多并发请求吃不满多核"，用 cluster。

---

## 二、开一个 worker：postMessage / workerData

```js
// main.js
import { Worker } from "node:worker_threads";

const w = new Worker("./fib-worker.js", { workerData: { n: 42 } }); // workerData 初始化只读传入
w.on("message", (result) => console.log("worker 算完:", result));
w.on("error", (e) => console.error("worker 出错", e));    // 呼应 node-async-errors
w.on("exit", (code) => code !== 0 && console.warn("异常退出", code));

// fib-worker.js
import { parentPort, workerData } from "node:worker_threads";
function fib(n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); }
parentPort.postMessage(fib(workerData.n));   // 算完回传，主线程一直空闲可处理请求
```

- 主线程用 `worker.on('message')` 收结果，`postMessage` 发任务；worker 里用 `parentPort.postMessage`/`parentPort.on('message')`。
- 消息同样走**结构化克隆**（呼应 node-child-process interview 第 9 题）：**函数、类实例方法传不过去**。
- worker 有自己的**事件循环、V8  isolate、堆**——不是"免费的"，创建/通信有序列化成本。

---

## 三、共享内存之一：transfer ArrayBuffer（所有权转移，零拷贝）

`postMessage` 默认**拷贝**大 Buffer 很贵。对普通 `ArrayBuffer` 可以**转移所有权**（不拷贝，发送方立即失去访问）：

```js
const buf = new ArrayBuffer(1e8);
parentPort.postMessage({ buf }, [buf]);   // 第二个参数 = transferList
```

适用："把一块大数据交给对方处理、我这边不再用"。注意同一块 buffer 不能两处同时持有。

---

## 四、共享内存之二：SharedArrayBuffer + Atomics（真并发读写）

`SharedArrayBuffer`（呼应 ES 包 TypedArray/SAB）可**跨线程同时读写同一块内存**，实现真正的共享：

```js
import { Worker } from "node:worker_threads";
const sab = new SharedArrayBuffer(4);
const i32 = new Int32Array(sab);
new Worker("./worker.js", { workerData: { i32 } });   // 传引用，非拷贝
i32[0] = 10;                                          // 主线程写，worker 立刻能看到
```

- 多个线程同时写同一位置会**竞态**，必须用 **`Atomics`**（`add/load/store/compareExchange/wait/notify`）保证单操作原子性与线程同步（`Atomics.wait` 阻塞等待、`notify` 唤醒）。
- SAB/Atomics 需要**跨源隔离**等安全前提（浏览器端 Spectre 缓解；Node 端主要用于计算）。

---

## 五、别把线程池用满：默认 libuv 池 vs worker 数

- Node 有个**libuv 线程池**（默认 4，`UV_THREADPOOL_SIZE` 可调，上限 1024）处理 fs/DNS/crypto——**这是内核级 I/O 线程，不执行你的 JS**（呼应 node-net-dns 第六节、node-event-loop）。
- `worker_threads` 是**另一回事**：每个 Worker 跑你的 JS。别误以为"fs 慢是因为没开 worker"。开太多 Worker 会抢 CPU、内存翻倍，一般 CPU 密集型开 ≈ 核数个即可。

---

## 六、用 Worker 池复用（避免反复创建）

`new Worker` 开销不小（起 isolate）。生产常见做法是**固定大小线程池 + 任务队列**，或用现成库（如 `piscina`）：提交任务、内部复用 N 个 worker、自动负载均衡。

```js
import Piscina from "piscina";
const pool = new Piscina({ filename: "./worker.js", maxThreads: 4 });
const result = await pool.run({ n: 42 });   // 队列 + 复用
```

---

## 七、isMainThread、resourceLimits、退出

- `threadId` / `isMainThread`：判断当前在主线程还是 worker；
- `{ resourceLimits: { maxOldGenerationSizeMb } }`：给单个 worker 限堆，防止一个失控任务 OOM 拖垮进程；
- worker 内任务结束、无活跃句柄时会自然退出（呼应 node-event-loop 退出条件）；也可 `worker.terminate()` 强制终止。

---

## 八、自检清单

- [ ] CPU 密集任务直接放主线程为什么会卡所有请求？
- [ ] worker_threads 和 cluster 分别解决什么问题？
- [ ] `postMessage` 能传函数吗？`workerData` 和 message 有何区别？
- [ ] transfer ArrayBuffer 与 SharedArrayBuffer 共享，差别是什么？各适合什么？
- [ ] 为什么用 SharedArrayBuffer 需要 Atomics？
- [ ] libuv 线程池和 worker_threads 是一回事吗？
- [ ] 频繁创建 Worker 有什么问题？怎么用线程池复用？

---

## 🚀 部署预告

- worker_threads 治的是"**单请求里的那段重计算**"，cluster 治的是"**很多请求吃不满多核**"——L8 **node-deploy-perf** 会把两者放进"性能剖析→定位 CPU 密集→选并发模型"的完整链路；
- 把大 JSON 解析、图像/压缩、加解密搬进 worker，是避免"事件循环延迟飙升"（`performance.eventLoopUtilization`）的常用手段（呼应 node-event-loop、node-deploy-perf）；
- 至此 L6「并发与多进程」三关（child_process → cluster → workers）讲完"一个 Node 如何变多"；

下一关进入 L7 **node-npm**：scripts、bin、依赖与 semver、lockfile、npm/pnpm/yarn——把"写代码"升级到"管包与工程"。
