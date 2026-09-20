# node-cluster 面试题精选

> 共 12 题，覆盖 原理 / 端口共享 / 分发策略 / 容错自愈 / 优雅重启 / 运维选型 六类。

---

## 一、原理与模型

### 1. Node 是单线程的，怎么利用多核 CPU？

JS 运行在主线程、一个进程只吃一个核（libuv 线程池只处理文件 I/O、DNS、加密等，不并行执行你的 JS）。要利用多核就**跑多个进程**：`cluster` 让 primary fork 出与核数相当的 worker，各自持有一份服务、分摊连接；或用 **worker_threads** 处理 CPU 密集并共享内存（呼应 node-workers）。

**来源**：Node.js — "Cluster Module"、Node.js — "Worker Threads"

### 2. 描述一下 cluster 的 primary / worker 模型和典型代码结构。

一份入口用 `cluster.isPrimary` 分支：primary 里 `for (...) cluster.fork()` 起 N 个 worker，并监听 `'exit'` 做重启；worker 分支里正常 `http.createServer(...).listen(port)`。worker 本质是带 IPC 的 `fork`（`child_process.fork` 特化）。

**来源**：Node.js — "Cluster Module: usage example"

### 3. `cluster.fork()` 能在 worker 里调用吗？`isPrimary` 和 `isWorker` 分别用来干嘛？

`fork()` 由 **primary** 调用来派生 worker。`cluster.isPrimary`/`cluster.isWorker` 用于在同一份代码里区分身份，走"管理逻辑"还是"业务服务逻辑"。worker 里再 fork 不是标准用法（会脱离统一的分发/守护）。

**来源**：Node.js — "cluster.isPrimary / isWorker"

---

## 二、端口共享

### 4. 多个 worker 都 `listen(3000)`，为什么不会 EADDRINUSE？

因为**真正 bind 端口的是 primary 持有的监听 socket**；primary 通过 IPC **把该 socket 句柄 transfer 给各 worker**（handle sharing），worker 的 `listen` 实际是复用这个已监听句柄。所以不是每个进程各自 bind 了一次。

**来源**：Node.js — "How It Works (cluster)"、node-child-process interview 第 9 题（句柄 transfer）

### 5. cluster 分发新连接依赖什么底层机制？

依赖 **child IPC**：primary 接收到 accepted 连接（或把 server 句柄交给 worker 后由 OS 派发），通过 IPC 消息把 socket 描述符传给选定 worker，由该 worker 读写这条连接。

**来源**：Node.js — "IPC and Handle Sharing"

---

## 三、分发策略

### 6. round-robin 调度和 OS 调度有什么区别？各有什么问题？

- **OS 调度**：所有 worker 在同一监听 socket 上争抢 `accept`，由内核决定谁拿到——实现简单，但**分布可能严重不均**（历史上还有惊群问题）。
- **round-robin（Linux 上 cluster 默认）**：primary 自己 accept 后**轮询**把连接发给 worker，**均衡性更好**，但 primary 多了一次转发开销。

**来源**：Node.js — "Scheduling hints / round-robin"、社区 — "Node cluster thundering herd"

### 7. 用了 cluster 之后，能把用户 session 存在进程内存里吗？为什么？

**不能（或不该）**。分发是**连接级**的，一条 keep-alive 连接固定落在某个 worker，但不同连接/请求可能落到不同 worker；内存 session 会导致用户在不同 worker 间"登录态丢失"。应把会话外置到 **Redis/共享存储**（呼应 Express 的 session 存储、node-cluster 第四节）。

**来源**：Node.js — "Caveats"、社区 — "Sticky sessions vs shared store"

---

## 四、容错与自愈

### 8. worker 崩溃后会发生什么？你要做什么保证服务不降级？

primary 会收到该 worker 的 **`'exit'`** 事件，但 **cluster 不会自动补 fork**——你要在 `'exit'` 回调里 `cluster.fork()` 补上，否则 worker 数会越来越少。同时监控是否进入"反复崩溃循环"（如启动即挂），要加退避/告警。

**来源**：Node.js — "cluster 'exit' event"、node-cluster 第五节

### 9. cluster 下推荐的错误处理策略是 fail fast 还是 try/catch 兜住一切？

倾向 **fail fast**：让出错 worker 崩掉、由 primary 重启一个新 worker，**把爆炸半径限制在单个进程**、且新 worker 是干净状态。吞掉异常继续跑可能让进程处于**已损坏的状态**处理后续请求（呼应 node-async-errors）。但要保证客户端能重试到其它 worker。

**来源**：Node.js Best Practices — "Error handling / fail fast"

---

## 五、优雅重启

### 10. 如何做到改代码后"零停机"重启 worker？

滚动重启：给某个 worker 发指令 → worker `server.close()` **停止接受新连接**、让**在途请求 drain** 完 → 该 worker `process.exit()` → primary 收 `'exit'` 后 fork 一个**加载了新代码**的 worker；逐个 worker 轮换即零停机。pm2 的 `reload` 就是自动做这套（呼应 node-cluster 第六节、node-deploy-perf）。

**来源**：Node.js — "server.close() and graceful shutdown"、pm2 — "Reload / zero-downtime"

### 11. `worker.process.disconnect()`、`.kill()`、`.send('shutdown')` 有何区别？

- `send('shutdown')`：走 IPC 发**自定义消息**，让 worker **自己**执行优雅收尾（推荐，能配合 drain）；
- `disconnect()`：关闭 IPC 通道，worker 仍存活（触发 `'disconnect'`）；
- `kill(signal)`：直接给 worker 进程发信号（默认 SIGTERM），**不给优雅机会**，粗暴。

优雅重启应优先让 worker 收到消息后主动 close→drain→exit。

**来源**：Node.js — "worker.kill / disconnect / send"

---

## 六、运维与选型

### 12. 都上 Kubernetes / 容器了，还需要 Node cluster 吗？pm2 呢？

**通常不需要在容器内跑 cluster**。K8s 用**多副本 Pod + Service 负载均衡**在更高层做多核/多机分摊，每 Pod 一个单进程 Node 更符合"一容器一进程"、便于水平扩缩。此时 pm2 的守护/日志也多半被 K8s 探针、sidecar、集中式日志取代。裸机/单机 VM 部署时，cluster + pm2 才更有价值（呼应 node-deploy-perf、Express L8）。

**来源**：Kubernetes docs — "one process per container"、社区 — "pm2 vs Kubernetes for Node"
