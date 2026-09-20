# node-workers 面试题精选

> 共 12 题，覆盖 场景选型 / 通信 / 共享内存 / 线程池与性能 / 陷阱 五类。

---

## 一、场景与选型

### 1. Node 单线程，遇到 CPU 密集任务怎么办？worker_threads 解决什么？

把重计算放主线程会**阻塞事件循环**，拖垮所有并发请求。`worker_threads` 在**同进程内开线程**跑独立 JS（各有自己的事件循环/isolate/堆），把 CPU 密集任务挪出去、主线程继续处理 I/O。它相较 `child_process`/cluster 的优势是**能共享内存**（ArrayBuffer）。

**来源**：Node.js — "Worker Threads"、node-workers 第一节

### 2. worker_threads、cluster、child_process 三者如何选？

- 跑**外部命令**或需完全隔离进程 → child_process；
- **HTTP 服务多核分摊 I/O**、各进程独立堆 → cluster；
- 同进程内**跑 CPU 密集并共享内存**（不阻塞主线程）→ worker_threads。

**来源**：Node.js — "Comparing concurrency models"、node-child-process interview 第 11 题

### 3. 一个纯 I/O 密集（大量 DB/HTTP 调用）的服务，需要 worker_threads 吗？

一般**不需要**。Node 的异步 I/O + libuv 已能单线程高并发处理 I/O；瓶颈多是下游/连接池，不是 JS 计算。真要扩吞吐用 cluster/多副本把多核用起来即可。worker_threads 主要治**CPU 密集**。

**来源**：Node.js — "When to use worker threads"、社区最佳实践

---

## 二、通信

### 4. 主线程和 worker 之间怎么传数据？能传函数吗？

用 `postMessage`/`message`（worker 内 `parentPort`），初始化可用 `workerData`。传输走**结构化克隆**——可传对象/数组/Buffer/Map 等，**不能传函数、Symbol、类方法、DOM/句柄外的不可克隆值**。要"执行一段逻辑"就得把逻辑预先放进 worker 脚本。

**来源**：Node.js — "postMessage / workerData"、MDN — "Structured clone algorithm"

### 5. `workerData` 和 `postMessage` 有何区别？

`workerData` 在 `new Worker(url, { workerData })` 时**一次性**传入、worker 内以只读方式获取，适合初始配置；`postMessage` 是**运行期双向、可多次**的消息通道，适合任务下发/结果回传。两者都受结构化克隆限制。

**来源**：Node.js — "worker workerData option"

---

## 三、共享内存

### 6. transferList 转移 ArrayBuffer 和 SharedArrayBuffer 共享，有何不同？

- **transfer**：把普通 `ArrayBuffer` 的**所有权转移**给对方（零拷贝），**发送方随即失去访问**——适合"交接一块数据、我不用了"；
- **SharedArrayBuffer**：双方**同时持有并并发读写**同一块内存——适合持续共享的状态/环形缓冲。

**来源**：Node.js — "transferList"、MDN — "SharedArrayBuffer"

### 7. 用 SharedArrayBuffer 时为什么必须配 Atomics？举例。

普通多线程读-改-写同一内存位置会**数据竞态**（读到中间态、丢失更新）。`Atomics.add/load/store/compareExchange` 保证**单个操作不可分割**；`Atomics.wait/notify` 实现线程间阻塞/唤醒（做无锁队列、自旋锁）。例：多 worker 对 `Int32Array[0]` 计数，用 `Atomics.add` 才不会丢计数。

**来源**：MDN — "Atomics"、ECMAScript — "SharedArrayBuffer & Atomics"

### 8. SharedArrayBuffer 有什么安全顾虑？

因高精度计时 + 共享内存可被用作 **Spectre 侧信道**，浏览器端要求**跨源隔离**（COOP/COEP）才可用；Node 端不受此限制但同样要警惕把敏感数据放进可被并发读的共享内存。设计上 SAB 传的是**原始字节、非 JS 对象**。

**来源**：web.dev — "Why is SharedArrayBuffer not available on your website?"、MDN — "Atomics"

---

## 四、线程池与性能

### 9. libuv 线程池（UV_THREADPOOL_SIZE）和 worker_threads 是一回事吗？

**不是**。libuv 线程池（默认 4、上限 1024）跑 **fs/DNS/crypto 等内核/库级 I/O**，**不执行你的 JS**（呼应 node-net-dns 第六节）；worker_threads 是**执行你 JS 的线程**。fs 排队慢是 libuv 池不够，调 `UV_THREADPOOL_SIZE`；而一段大计算卡住主线程要靠 worker_threads。

**来源**：Node.js — "The libuv threadpool"、libuv docs

### 10. 频繁 `new Worker` 有什么问题？工程上怎么优化？

每个 Worker 要创建 V8 isolate、内存翻倍、启动有序列化/初始化成本，线程数无上限还会互相抢 CPU。优化：用**固定大小线程池 + 任务队列**复用 worker（`piscina`/`workerpool`），大小设≈核数（呼应 node-workers 第六节）。

**来源**：社区 — "piscina / worker pools"、node-workers 第六节

---

## 五、陷阱与运维

### 11. 主线程能直接读到 worker 里修改过的普通对象吗？为什么？

**不能**。普通消息是**拷贝**（结构化克隆），两边各持独立副本；worker 内对普通对象的修改不会反映到主线程。要真正共享，只能显式用 **SharedArrayBuffer**（共享原始字节）。这是"以为是引用其实不是"的常见误区。

**来源**：Node.js — "postMessage copies data"、MDN — "Structured clone"

### 12. 一个 worker 抛未捕获异常会连累主进程吗？怎么处理？

worker 有独立 isolate，未捕获异常触发主线程侧的 worker `'error'` 事件、该 worker 退出，**默认不直接崩主线程**（与"共享地址空间的线程崩一个全崩"不同）。但你**必须监听 `'error'`/`'exit'`**，否则错误被静默、任务悬挂；线程池场景还要重试/替换该 worker（呼应 node-async-errors、node-workers 第二节）。

**来源**：Node.js — "worker 'error' / 'exit' events"
