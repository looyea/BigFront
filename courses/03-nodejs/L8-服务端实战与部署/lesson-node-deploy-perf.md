# 部署、性能与生产就绪

> 目标：把 Node 服务安全、稳定地跑在生产。串起 **Dockerfile（多阶段、`node_modules` 缓存、非 root、 tini/PID1 信号）**、**优雅退出 graceful shutdown（SIGTERM→停接单→drain→关资源→超时兜底）**、**进程守护（pm2/系统服务/容器编排）**、**性能剖析（`--prof`/`--inspect`/clinic/0x、事件循环延迟、`eventLoopUtilization`）**、**内存与泄漏排查（heap snapshot、`--max-old-space-size`）**，以及一份**生产就绪检查清单**（呼应 node-http keepAlive、node-cluster、node-config、09-express L8）。

---

## 一、Dockerfile：多阶段 + 依赖缓存 + 非 root

```dockerfile
# ---- 构建阶段：装全依赖(dev)、编译/打包 ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci                       # 装全部依赖含 dev（用于 build）
COPY . .
RUN npm run build                # tsup/esbuild 产出 dist（呼应 node-publish）

# ---- 运行阶段：只带生产依赖与产物 ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force   # 只装运行依赖（呼应 node-npm 第五节）
COPY --from=build /app/dist ./dist
USER node                        # 别用 root 跑（缩小逃逸面，呼应 node-config 最小权限）
EXPOSE 3000
# 用 tini 作为 PID1 正确转发信号/回收僵尸（见第三节）
ENTRYPOINT ["node", "dist/server.js"]
```

要点：**先 COPY `package*.json`+`npm ci` 再 COPY 源码**——依赖层可缓存，改代码不重装依赖；多阶段让运行镜像不含 devDependencies/编译器；`NODE_ENV=production`、非 root、`.dockerignore` 掉 `node_modules`/`.env`/`.git`（呼应 node-config 第五节）。

---

## 二、优雅退出 graceful shutdown

生产更新/缩容时，进程收到终止信号，必须**先处理完在途请求再退出**，否则用户 502/半截响应：

```js
import http from "node:http";
const server = http.createServer(app);
let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error(`收到 ${signal}，开始优雅退出`);
  server.close(() => finish());           // 停止接受新连接，等在途请求 drain 完（呼应 node-cluster 第六节）
  // 兜底：超时仍有连接没走完就强退，避免永久挂起
  const timer = setTimeout(() => { console.error("强制退出"); process.exit(1); }, 10_000);
  timer.unref();
}
["SIGTERM", "SIGINT"].forEach((s) => process.on(s, () => shutdown(s)));

async function finish() {
  await closeDb(); await closeCache();    // 关 DB/连接池/worker/临时文件句柄
  process.exit(0);
}
```

- **SIGTERM**（容器/pm2 优雅停）先 close→drain→关资源→exit；**SIGKILL（-9）不可捕获**，别指望收尾；
- 若用 cluster/多副本，还要**先从负载均衡摘除**（K8s preStop / readiness 转 failing）再退，避免"已 close 但 LB 还在发新连接"；
- 记得 `keepAliveTimeout`/`headersTimeout` 与反代超时对齐（呼应 node-http interview 第 9 题），否则 drain 不干净。

---

## 三、PID 1、信号与进程守护

容器里若直接 `node server.js` 作为 **PID 1**，历史上不默认处理 SIGTERM、不回收僵尸子进程 → `docker stop` 要等 30s 被 SIGKILL、留僵尸。解决：

- **`--init` / tini / dumb-init** 作 PID1 正确转发信号 + 回收僵尸（呼应 node-child-process 进程组/僵尸）；
- 或非容器环境用 **pm2**（`pm2 start` 托管重启、cluster `-i max`，呼应 node-cluster 第八节）/ systemd / K8s 探针；
- **fail fast 与重启结合**：worker 崩了就补新进程，比在坏状态硬撑更安全（呼应 node-async-errors、node-cluster interview 第 9 题）。

---

## 四、性能剖析：先测量后优化

**别猜，先 profile**：

- **CPU 密集/事件循环卡顿**：`node --cpu-prof server.js` 生成 `.cpuprofile`（Chrome DevTools 打开看火焰图）；`clinic.js`（`clinic doctor` 综合诊断、`clinic flame` 火焰图）、`0x` 也常用；
- **事件循环延迟**：`perf_hooks.monitorEventLoopDelay()` / `performance.eventLoopUtilization()` 量化"卡不卡"（呼应 node-event-loop、node-workers）；
- **常见优化点**：热路径避免同步阻塞（大 `JSON.parse`、正则回溯、同步 fs）→ 挪进 worker（node-workers）；加缓存；`cluster`/多副本吃满多核（node-cluster）；流式处理大文件（node-stream-pipeline）；连接池 + keep-alive（node-http）；`compression`、静态资源交给 CDN/反代（呼应 Express L8）。

---

## 五、内存与泄漏

- **堆上限**：容器里 Node 默认 `--max-old-space-size` 约取物理内存比例，**在受限 cgroup 里可能超出被 OOM-kill**——显式 `NODE_OPTIONS=--max-old-space-size=...` 设成小于容器限额；
- **泄漏信号**：RSS 持续爬升、GC 后不回落、最终 OOM。用 `node --heapsnapshot-signal=SIGUSR2` 或 `v8.writeHeapSnapshot()` 抓两个时间点的堆快照对比，找被 retain 的对象（闭包、全局 Map、未清理的事件监听/定时器、`req`/`socket` 被长期引用，呼应 node-events maxListeners 泄漏）；
- **无界队列/缓存**要设上限（LRU、背压，呼应 node-streams 背压）。

---

## 六、可观测与生产就绪清单

上线前逐项核对：

- [ ] `NODE_ENV=production`、配置来自环境、密钥用 secret（呼应 node-config）；
- [ ] **结构化日志**（pino）到 stdout + trace id + 脱敏（呼应 node-config 第六节）；
- [ ] **优雅退出**（SIGTERM→close→drain→关资源→超时兜底）；PID1 用 tini；
- [ ] **健康/就绪探针**：`/healthz`（活着）、`/readyz`（能接流量，含 DB 连接检查）（呼应 Express L8）；
- [ ] 进程守护/多副本 + 资源 limits/requests（cluster 或 K8s，呼应 node-cluster）；
- [ ] `keepAliveTimeout`/反代超时对齐，`trust proxy` 配好（呼应 node-http、node-https-tls）；
- [ ] TLS/安全基线（helmet、限流、校验、依赖 audit，呼应 Express L6/OWASP）；
- [ ] CI：`npm ci` + `node --test --experimental-test-coverage` 质量闸门（呼应 node-testing）；
- [ ] 监控 APM/指标（QPS、p99、事件循环延迟、内存、错误率）+ 告警；
- [ ] 多阶段镜像、非 root、`.dockerignore`、镜像扫描（呼应第一节）。

---

## 七、自检清单

- [ ] 多阶段 Dockerfile 为什么先 COPY package 再 COPY 源码？运行镜像为何只 `--omit=dev`？
- [ ] graceful shutdown 的完整步骤？SIGKILL 为何拦不住？PID1 信号有什么问题？
- [ ] 容器里 Node 堆内存上限要注意什么？如何定位内存泄漏？
- [ ] 事件循环延迟怎么量化？CPU 密集任务怎么治？
- [ ] 健康探针与就绪探针区别？生产就绪清单里你最容易漏哪几项？

---

## 🚀 收官：03-nodejs 全景

- 到这里 L8 三关（config→cli→deploy-perf）把"能写"补成"能上线、能运维、能诊断"；
- 与 **09-express L8**（框架层部署/性能）、**10-vite**（构建产物上 CDN）、**node-cluster/pm2**、**node-testing**（CI 闸门）全线打通——Node 这台"异步 I/O 引擎"至此从运行时、模块、事件循环、fs/buffer/stream、网络/http、多进程并发、npm 生态到部署性能形成闭环。

（本关为 03-nodejs 课程包最后一关；复习建议回到 L1 node-basics 重看全局，或用 homework/L8 做综合实战。）
