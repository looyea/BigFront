# 面试题 · Node.js 运行时与事件循环

1. **Node.js 的单线程模型为什么能高并发？**
   JS 主线程单线程，但 **libuv 线程池 + 内核异步 I/O（epoll/kqueue/IOCP）** 让 I/O 并发不受限。CPU 密集任务才会卡住主线程。

2. **说说 Node 的事件循环六个阶段。**
   timers → pending callbacks → idle/prepare → **poll**（I/O 回调）→ check（setImmediate）→ close callbacks。每阶段处理完微任务队列（process.nextTick 优先，然后 promise）。

3. **setTimeout(fn,0)、setImmediate(fn)、process.nextTick(fn) 谁先？**
   - `nextTick` 最先（不属于事件循环，在阶段切换后立刻排空）。
   - 主模块中 `setTimeout 0` 与 `setImmediate` 顺序**不确定**（受启动耗时影响），在 I/O 循环内 setImmediate 稳定优先。

4. **Buffer 与 TypedArray 的关系？**
   Buffer 是 Uint8Array 的子类，Node 专门加了 `Buffer.alloc/from`、编码转换、内存池。

5. **Stream 的四种类型？**
   Readable / Writable / Duplex / Transform。核心价值是**流式**处理，不需要一次性把数据放内存。

6. **背压（backpressure）是什么？怎么处理？**
   下游消费速度跟不上上游。用 `pipe()` 或 `pipeline()`（Node 10+，推荐）自动处理背压，或用 async iterator。

7. **cluster 与 worker_threads 区别？**
   cluster：多**进程**（多个 V8 实例，通过 IPC），可复用端口。worker_threads：一个进程内多**线程**，共享内存（SharedArrayBuffer），启动更快，但不共享模块作用域。

8. **手写一个不会爆栈的重试**
   ```js
   async function retry(fn, n=3, delay=100) {
     for (let i=0;i<n;i++) {
       try { return await fn(); }
       catch (e) { if (i===n-1) throw e; await new Promise(r=>setTimeout(r, delay*2**i)); }
     }
   }
   ```
