# cluster：用多核跑同一个服务

> 目标：Node 的 JS 执行是**单线程**的（呼应 node-event-loop），一个进程只能吃满一个 CPU 核。要榨干多核机器，就要**跑多个进程分摊连接**——这正是 `cluster` 模块干的事：**master（primary）持有一个监听 socket，把进来的连接分发给多个 worker**。掌握 primary/worker 模型、`isPrimary`/`isWorker`、端口为何能"共享"、连接分发策略、worker 挂了怎么重启、优雅重启，以及它和 **pm2** 的关系。

---

## 一、为什么需要 cluster

一台 8 核机器上，单个 Node 进程：

- 只用到 **1 个核**（libuv 线程池只做 I/O/加密等，JS 计算仍在主线程）；
- 一个同步大计算/未捕获异常会**卡住/拖垮整个服务**（呼应 node-async-errors）。

`cluster` 用 `os.cpus().length` 个进程各自跑一份服务、共享端口，请求被分摊到多核——**这是 I/O 密集 Web 服务横向扩到多核的标准做法**。

---

## 二、primary / worker 模型

同一份代码，既可以是 master 也可以是 worker，用 `cluster.isPrimary` 区分：

```js
import cluster from "node:cluster";
import os from "node:os";
import http from "node:http";

if (cluster.isPrimary) {
  const n = os.cpus().length;                 // 通常 = CPU 核数
  console.log(`primary ${process.pid} 启动 ${n} 个 worker`);
  for (let i = 0; i < n; i++) cluster.fork();
  cluster.on("exit", (worker) => {
    console.log(`worker ${worker.process.pid} 退出，重启`);
    cluster.fork();                            // 挂了就补一个（见第五节）
  });
} else {
  http.createServer((req, res) => {
    res.end(`handled by worker ${process.pid}\n`);
  }).listen(3000);                             // 看似都 bind 3000，其实没冲突（见第三节）
}
```

- `cluster.isPrimary` / `cluster.isWorker`：判断当前进程身份；
- `cluster.fork()`：**仅 primary 调用**，派生一个 worker（本质是带 IPC 的 `fork`，呼应 node-child-process 第五节）。

---

## 三、端口为什么能"共享"？

worker 里都写 `listen(3000)` 却**不报 EADDRINUSE**（呼应 node-net-dns 第八节），因为：

- 真正的**监听 socket 由 primary 持有**；
- primary 通过 IPC **把这个 socket 句柄 transfer 给 worker**（正是 node-child-process interview 第 9 题说的"可 transfer 句柄"）；
- 新连接进来，primary/OS 把它**派发**给某个 worker 处理。

所以多进程"共享"一个端口的本质是**句柄传递 + 连接分发**，不是每个进程都真 bind 了一次 3000。

---

## 四、连接分发策略：round-robin vs OS

`cluster.schedulingPolicy` 决定怎么把连接分给 worker：

- **`SHOULD_USE_RR`（round-robin，Linux 默认）**：primary 轮询把 accepted 连接发给各 worker，**分布更均衡**；
- **`NO_USE_RR`（OS 调度）**：所有 worker 在同一 socket 上竞争 `accept`，由内核决定谁拿到——实现简单但**可能不均**（惊群/倾斜）。

生产想更均匀一般用 round-robin。单个 TCP **长连接**始终落在同一 worker（连接级分发，不是请求级）——所以**内存里不要放会话状态**（呼应 Express 的 session 存 Redis）。

---

## 五、worker 挂了怎么办（存活与自愈）

- worker 因未捕获异常/被 kill/OOM 退出时，primary 收到 **`'exit'`** 事件 → **重新 `fork()` 补上**（见第二节代码）；
- 若所有 worker 都挂了、又重启不起来，服务就 502 → 要监控 `worker.process.connected`、`'disconnect'` 事件；
- **worker 内部**要处理好 `unhandledRejection`/`uncaughtException`（呼应 node-async-errors）：是"让 worker 崩、由 primary 重启"（**fail fast**，推荐），还是"吞掉继续跑"（可能状态已脏）——通常选前者，让多进程把爆炸半径限制在单个 worker。

---

## 六、优雅重启（不丢连接地换代码）

改代码要重启，但直接杀会切断正在处理的请求。cluster 的经典零停机套路：

1. worker 收到信号（如自定义 `message` 或 `SIGHUP`）后 `server.close()`——**停止接受新连接，但把在途请求处理完**；
2. 在途连接清空（`close` 回调 / 计数器归零）后 `process.exit()`；
3. primary 监听到该 worker `'exit'`，`fork()` 一个加载了**新代码**的 worker 补上。

**graceful shutdown 的完整信号处理（SIGTERM/SIGINT + 超时强杀 + 清理资源）留到 node-deploy-perf 展开**，本关先建立"close→等 drain→exit→补 fork"的心智模型。

---

## 七、`setupPrimary` 与配置

`cluster.setupPrimary({ exec, args, ... })`（Node 16+，旧名 `setupMaster`）在 fork 前统一配置：

- `exec`：worker 跑的脚本路径；
- 默认 worker 继承 primary 的 `argv`/`env`，可用 `env` 覆盖；
- 通过 `cluster.workers` 可遍历在线 worker，做健康检查/统计。

---

## 八、和 pm2 的关系

手写 cluster 只能解决"多核 + 挂了重启"。**pm2** 把这层封装成运维工具，还多了：

- **`pm2 start app.js -i max`**：一条命令按核数起 cluster（内部就用 cluster/或自管 fork）；
- 日志聚合、**reload（滚动重启零停机）**、监控、开机自启、集群跨机则由 K8s/负载均衡负责；
- 无代码侵入：不写 `if (isPrimary)`，pm2 用"process manager + IPC"托管你的单进程脚本。

理解 cluster 原理，才能明白 pm2 `reload`/`-i` 背后到底发生了什么。**能上 K8s/容器水平扩容时，未必需要单机 cluster**（用多副本 + Service 负载均衡即可）——见 node-deploy-perf。

---

## 九、自检清单

- [ ] 单线程 Node 为什么吃不满多核？cluster 如何解决？
- [ ] `isPrimary`/`isWorker` 各自该做什么？`fork()` 谁能调？
- [ ] 多个 worker `listen(3000)` 为什么不冲突？端口"共享"的本质？
- [ ] round-robin 与 OS 调度有何区别？为什么连接级分发不能放内存会话？
- [ ] worker 崩了怎么自动补？"fail fast"在 cluster 下意味着什么？
- [ ] 优雅重启的核心步骤是什么？pm2 帮你多做了什么？

---

## 🚀 部署预告

- cluster 的"多进程分摊 HTTP"是**生产 Web 服务**默认形态，pm2 `-i max`/`reload` 即此理（呼应 Express L8 部署、node-deploy-perf）；
- 优雅重启的 `close→drain→exit` 会在 **node-deploy-perf** 补上完整 SIGTERM 信号处理与超时兜底；
- cluster 是"**多进程、各有独立堆**"；若你要的是"**同进程内多线程 + 共享内存跑 CPU 密集**"，那是下一关 **node-workers**。

下一关进入 **node-workers**：worker_threads 与共享内存，把重计算挪出事件循环。
