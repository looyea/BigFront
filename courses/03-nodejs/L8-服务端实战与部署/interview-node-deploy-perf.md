# node-deploy-perf 面试题精选

> 共 12 题，覆盖 容器化 / 优雅退出 / 进程守护 / 性能剖析 / 内存与就绪 五类。

---

## 一、容器化

### 1. 给 Node 服务写 Dockerfile，多阶段构建解决什么问题？

**减小运行镜像、隔离构建工具链**：build 阶段装全依赖（含 dev）、编译/打包；runtime 阶段只 `COPY --from` 产物 + `npm ci --omit=dev` 装运行依赖。避免把 TS 编译器、构建缓存、devDependencies 带进生产，体积更小、攻击面更弱（呼应 node-deploy-perf 第一节、node-npm 第五节）。

**来源**：Docker — "Multi-stage builds"、Node.js — "Dockerizing a Node.js app"

### 2. 为什么 COPY `package.json` 与 `npm ci` 要放在 COPY 源码之前？

**层缓存**：依赖清单很少变、源码频繁变。先装依赖把结果缓存成一层；改源码只让之后的层失效，重建秒级完成。反序则每次改代码都重装依赖（呼应 node-deploy-perf 第一节）。

**来源**：Docker — "Build cache / instruction order"

### 3. 生产容器里跑 Node 有哪些安全/规范基线？

`NODE_ENV=production`；**非 root** 用户（`USER node`）；`.dockerignore` 排除 `node_modules`/`.env`/`.git`；不把 secret 打进镜像（运行时注入，呼应 node-config interview 第 9 题）；基础镜像用官方精简 tag 并**扫描漏洞**；加**健康检查**；用 tini 处理信号（呼应 node-deploy-perf 第一、三节）。

**来源**：OWASP — "Container Security"、Node.js Docker Best Practices

---

## 二、优雅退出

### 4. 什么是 graceful shutdown？请给出完整步骤。

进程收到终止信号时不立刻死，而是**收尾在途工作再退出**：① 从负载均衡摘除（K8s readiness 转 failing / preStop）；② `server.close()` 停止接受新连接；③ 等**在途请求 drain** 完成；④ 关闭 DB/连接池/worker/文件句柄；⑤ 超时兜底强退；⑥ `exit(0)`。避免用户收到 502/截断响应（呼应 node-deploy-perf 第二节、node-cluster 第六节）。

**来源**：社区 — "Graceful shutdown in Node.js"、Kubernetes — "Pod termination / preStop hook"

### 5. SIGTERM、SIGINT、SIGKILL 在退出语义上有何不同？

- **SIGTERM**：请求终止，**可被捕获**→做优雅收尾（容器 `docker stop`、K8s 缩容发它）；
- **SIGINT**：交互中断（Ctrl+C）；
- **SIGKILL(-9)**：**不可捕获/忽略**，内核立即回收进程——没机会跑任何清理。因此先 SIGTERM、给超时，最后才 SIGKILL 兜底（呼应 node-deploy-perf 第二节）。

**来源**：Wikipedia — "Signal (POSIX) / SIGTERM / SIGKILL"、Node.js — "process signals"

### 6. 光做 graceful shutdown 为什么在 K8s 里还不够？还要配什么？

存在**竞态**：Pod 被删时"从 Service endpoints 摘除"与"收到 SIGTERM"是两条异步路径，可能 SIGTERM 已到、流量还在进来。所以要配 **`preStop` 钩子（sleep 几秒）+ readiness 探针**，确保先不再被路由到新请求，再 close/drain（呼应 node-deploy-perf 第二节、第三题）。

**来源**：Kubernetes — "Zero downtime termination / readiness gates"、社区 — "Why preStop sleep is needed"

---

## 三、进程守护与 PID1

### 7. 容器里 PID 1 直接是 node 进程有什么坑？如何解决？

PID 1 有特权语义：默认**不处理未显式注册的信号**（尤其 SIGTERM）、要负责**回收僵尸子进程**。裸 `node` 作 PID1 时 `docker stop` 可能等满超时被 SIGKILL、且子进程变僵尸。用 **tini/dumb-init** 或 `docker run --init` 作 PID1 转发信号 + reaping（呼应 node-deploy-perf 第三节、node-child-process 进程组）。

**来源**：GitHub — "tini: A zero-interrupt reaper"、Docker — "--init"

### 8. pm2 和 Kubernetes 都能"保证进程活着"，思路差异是什么？

- **pm2**：**单机进程管理器**——崩溃重启、cluster 多核、reload 零停机、日志、监控，适合 VM/裸机；
- **K8s**：**跨机编排**——多副本 + 调度 + 自愈（探针失败就重启/替换 Pod）+ Service 负载均衡，一容器一进程即可，通常不再在容器内跑 cluster/pm2。两者一般二选一，别在 K8s Pod 里再塞 pm2 daemon（呼应 node-cluster interview 第 12 节）。

**来源**：pm2 — "Process Manager"、Kubernetes — "Self-healing / replicas"

---

## 四、性能剖析

### 9. 如何系统性地定位 Node 服务的性能瓶颈？

**先测量后改**：`--cpu-prof`/`clinic flame`/`0x` 出火焰图找 CPU 热点；`perf_hooks.monitorEventLoopDelay()`/`performance.eventLoopUtilization()` 看事件循环是否被阻塞（呼应 node-event-loop）；APM/压测看 QPS 与 p99；再看 I/O、GC 日志（`--trace-gc`）、DB 慢查询。针对性优化：CPU 密集→worker（node-workers）、I/O→连接池/keep-alive、大文件→stream。

**来源**：Node.js — "CPU Profiler / Diagnostics"、clinic.js — "doctor / flame"

### 10. "接口偶发变慢，且一慢就拖垮所有请求"，最可能的 Node 层原因与验证方法？

大概率**事件循环被同步/长任务阻塞**（大 `JSON.parse`、正则灾难性回溯、同步 fs、复杂序列化在主线程）。验证：记录 **event loop delay / ELU** 指标，或用 `--cpu-prof` 抓火焰图看在主线程上的长帧。治法：把该计算挪进 **worker_threads**、或拆成可让出的异步分片（呼应 node-workers、node-deploy-perf 第四节）。

**来源**：Node.js — "Event loop lag"、社区 — "Don't block the event loop"

---

## 五、内存与就绪

### 11. 怎么判断并定位 Node 进程内存泄漏？

看趋势：RSS 持续涨、full GC 后不回落、最终 `OOM`/崩溃。定位：`--inspect` + Chrome DevTools 抓两张 **heap snapshot** 对比"增长且被 retain 的对象"，或 `node --heapsnapshot-signal=SIGUSR2`；关注闭包、全局 Map/缓存无上限、未 `off` 的事件监听（呼应 node-events maxListeners）、未清定时器、`req/res`/socket 被长期引用。修：设上限（LRU）、及时释放监听/句柄、用 stream 而非整读（呼应 node-deploy-perf 第五节）。

**来源**：Node.js — "Memory tuning / heap snapshots"、MemLab / v8 — "Finding memory leaks"

### 12. 健康检查（liveness）与就绪检查（readiness）有何区别？为什么要区分？

- **liveness（活着）**：进程是否卡死，失败→**重启**容器；
- **readiness（就绪）**：是否**准备好接流量**（DB 连上了、缓存预热了），失败→从负载均衡**摘流**但不重启。
区分原因：依赖暂时不可用（如下游抖动）应**摘流**而非重启（重启只会雪上加霜）；而真正死锁才重启（呼应 node-deploy-perf 第六节、Express L8）。

**来源**：Kubernetes — "Liveness / Readiness probes"、社区 — "Health check endpoints best practices"
