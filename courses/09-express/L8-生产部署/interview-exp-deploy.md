# exp-deploy 面试题精选

> 共 15 题，覆盖 **多进程 / Docker / 反代 / HTTPS / 探活 / 优雅关闭 / 发布 / 12-Factor** 八类。

---

## 一、多进程与扩展

### 1. Node 单线程怎么利用多核？cluster 和 PM2 是什么关系？

Node 事件循环跑在单线程，一个进程只能有效用一个 CPU 核。`cluster` 模块由 primary 进程 fork 多个 worker，共享监听句柄、由内核/轮转分发连接，从而打满多核、并在 worker 崩溃时自动补起。PM2 是运行在 cluster 之上的**进程管理器**，提供 `exec_mode: cluster`、`instances: max`、零停机 reload、日志聚合、内存阈值重启、守护等运维能力。自己写 cluster 只管 fork，PM2 帮你把重启/reload/监控都接管。

**来源**：Node.js docs — "Cluster module"; PM2 — "Clustering / modes"; NearForm Node Best Practices — "scale / multi-core"

### 2. Kubernetes 环境还需要 PM2 cluster 吗？为什么？

一般**不需要**。K8s 自己负责横向扩缩 Pod、健康重启、调度、零停机滚动更新，每个容器跑**单进程**即可（12-Factor 建议）。若再在容器里开 PM2 cluster 多进程，会与 K8s 的重启/探针/资源模型打架（一个容器多进程难监控、难优雅关闭）。取舍：裸机/单 VM 用 PM2；上编排平台交给平台，容器内 `node server.js` 单进程。

**来源**：12-Factor — "Processes"; Kubernetes — "one container one process"; PM2 — "Docker/Kubernetes guide"

---

## 二、容器化

### 3. 为 Node 服务写 Dockerfile 有哪些最佳实践？

① 多阶段构建，devDeps/构建工具/源码不进最终镜像；② `npm ci --omit=dev` 严格锁版本可复现；③ `NODE_ENV=production`；④ 非 root `USER node` 运行降权；⑤ `.dockerignore` 排除 node_modules/.env/.git；⑥ 选小基础镜像（alpine/slim，注意 alpine 的 musl/原生模块坑）；⑦ 层顺序利用缓存（先 COPY lockfile 再装依赖）；⑧ 加 `HEALTHCHECK` 或交给平台探针；⑨ 镜像 tag 用不可变版本。

**来源**：Node — "Dockerizing a Node.js app"; Docker — "Best practices / multi-stage builds"; OWASP — "Docker security"

### 4. 用 alpine 基础镜像要注意什么？

体积小、漏洞面小是优点；但 alpine 用 musl libc 而非 glibc，某些**原生依赖/二进制模块**（如老版本 sharp、部分 node-gyp 模块、需要 glibc 的包）会编译失败或运行异常。对策：优先选纯 JS 依赖或用预构建 musl 版本的包，实在不行退回 `-slim`（Debian）；生产以稳定为先，别为省几十 MB 引入运行风险。

**来源**：Docker — "Node images (alpine vs slim)"; nodejs/docker-node — "Alpine caveats"; alpine — "musl known issues"

---

## 三、反向代理与网络

### 5. 为什么生产要用 Nginx/负载均衡反代，而不让 Node 直接暴露公网？

反向代理统一负责：TLS 终结（证书集中、CPU 卸载）、静态资源直出、gzip/压缩、限流与 WAF、连接缓冲（慢客户端不占 Node）、多实例负载均衡与健康摘除、隐藏后端拓扑。Node 专注业务逻辑。直接暴露则要把这些都在应用层重复实现且难运维。Caddy/云 LB 是同类角色。

**来源**：Nginx — "Reverse proxy guide"; Express — "Behind proxies"; AWS — "Load balancer targets / best practices"

### 6. `trust proxy` 是干什么的？不设会怎样？

应用位于反代/LB 后面时，TCP 连接来自代理，`req.ip`/`req.connection.remoteAddress` 会变成代理 IP，`X-Forwarded-*` 头里才有真实客户端信息。`app.set('trust proxy', ...)` 告诉 Express 信任这些头，让 `req.ip`、`req.ips`、`req.secure`（由 `X-Forwarded-Proto`）还原真实值。不设：基于 IP 的限流全打在代理 IP 上（要么误伤全体、要么形同虚设）、日志 IP 失真、secure/协议判断错误。设过头（信任任意来源头）则可被伪造 IP 绕过限流——只信任最近的、已知可信的代理跳数。

**来源**：Express — "trust proxy setting"; MDN — "X-Forwarded-For"; OWASP — "IP spoofing via forwarded headers"

### 7. HTTPS 应该在哪一层终结？HSTS 有什么用？

多数在边缘（LB/Nginx）终结 TLS：证书集中管理、避免 Node 承担握手 CPU、后端走内网。若合规要求端到端加密，则在 Node 也起 https。终结后务必回传 `X-Forwarded-Proto` 并配 `trust proxy`。HSTS（`Strict-Transport-Security`）告诉浏览器"此后一段时间只用 HTTPS 访问本站"，防降级/首次 http 被劫持（sslstrip）；`helmet.hsts()` 一行开启，注意 includeSubDomains/preload 的收紧与"难以回退"的副作用。

**来源**：OWASP — "Transport Layer Security Cheat Sheet"; helmet — "HSTS"; MDN — "Strict-Transport-Security"

---

## 四、健康检查与优雅关闭

### 8. liveness 和 readiness 探针为什么必须分开？各自失败会触发什么？

liveness 回答"进程是否还活着、有没有陷入死循环/死锁"，失败→**重启**容器；readiness 回答"现在能不能接流量"（依赖是否就绪、是否在预热），失败→**摘出负载均衡转发但不重启**。若合并成一个"检查 DB"的重探针当 liveness：DB 抖一下，所有实例被判定不健康 → 全体重启 → 雪崩。正确：liveness 极轻量（甚至只看进程能响应），readiness 才检查下游依赖。

**来源**：Kubernetes — "Liveness/Readiness probes"; Google SRE — "Health checking / are you sure?"; Nginx — "health checks"

### 9. 讲讲一次完整的优雅关闭，以及 K8s 里为什么还要 preStop sleep。

收到 `SIGTERM`：① 置标志并让 `/readyz` 返回 503，先从 LB 摘流量；② `server.close()` 停止 accept 新连接、等在途请求处理完（超时兜底强退）；③ 关闭 DB/Redis/队列连接、flush 日志/metrics；④ `exit(0)`。K8s 里终止 Pod 与"从 Service endpoints 摘除"是**异步两条链**，可能 SIGTERM 已发出但 kube-proxy 转发规则还没更新，仍有新请求打进来 → 用 `preStop` hook（如 `sleep 5`）制造缓冲，让摘流量先完成，再触发 SIGTERM，避免关闭竞态造成 5xx。

**来源**：Node — "server.close() / graceful shutdown"; Kubernetes — "Pod termination / preStop hook"; 12-Factor — "graceful shutdown"

---

## 五、配置与日志

### 10. 12-Factor 对 config、日志、进程分别怎么说？落地到 Node 是怎样的？

Config：严格与代码分离，全放环境变量，区分 dev/prod，密钥外部注入（不进库/镜像）。日志：把日志当事件流，进程只写 stdout/stderr，采集/聚合交给环境。进程：无状态、共享状态外置（Redis/DB），可随意启停、横向扩展，优雅启动/关闭。Node 落地：dotenv 仅本地，运行时读 `process.env`（zod 启动校验）；pino JSON→stdout；会话/限流计数→Redis；SIGTERM 优雅关闭。

**来源**：12-Factor App — "Config / Logs / Processes & Port Binding"; pino docs; OWASP — "Secrets Management"

---

## 六、发布与回滚

### 11. 蓝绿、金丝雀、滚动发布各适合什么场景？

- 滚动：逐实例换新，资源省、无额外环境；适合常规发布。
- 蓝绿：两套完整环境原子切流，回滚=切回旧环境，秒级；适合高风险大版本、要求瞬间回退，但要双倍资源。
- 金丝雀：先放小比例真实流量，观察错误率/延迟指标达标再逐步放量，出问题只影响小部分；适合重要服务谨慎上线。
前提都是**无状态 + 优雅关闭 + 就绪探针 + 向后兼容的 DB 迁移**（迁移与代码分开发布）。

**来源**：Martin Fowler — "Blue-Green / Canary deployment"; Google SRE — "canarying releases"; Azure DevOps — "deployment strategies"

### 12. 上线一个 Express 服务，你的发布前检查清单有哪些？

`NODE_ENV=production`、关 x-powered-by、开 view cache；无共享内存态（会话/限流进 Redis）；Docker 多阶段 + `--omit=dev` + 非 root + .dockerignore；反代 + trust proxy + TLS + HSTS；liveness/readiness 分离；优雅关闭（摘流量→close→关依赖→超时兜底）；结构化日志→stdout、密钥外部注入、启动 fail-fast；不可变镜像 tag + 可回滚 + 监控告警；DB 迁移向后兼容、与代码解耦；压测/benchmark 基线（见下一关）。

**来源**：Express — "Production best practices / performance"; 12-Factor — "build, run, release"; Google SRE — "release engineering checklist"

---

## 补充（新专题 13-15）

### 13.  给 Node/Express 服务写一个生产级 Dockerfile，逐层讲你的每个决定。

骨架决定：多阶段构建（builder 装 devDeps+编译 TS/prisma generate → 运行阶段只带 prod 产物与引擎）。逐行讲：① 基镜像选 node LTS 具体版本号（禁 latest：不可重现+意外大版本跳级），alpine 的 musl 取舍（体积小但 native 模块/时区/字体坑，含 sharp/bcrypt 等原生依赖时评估 debian slim——体积差几 MB 换排查省下几小时）；② 依赖层缓存：先 package*.json + npm ci（锁文件是唯一事实、ci 保可重现），后 COPY 源码，.dockerignore 挡 node_modules/.env/git（泄露与构建污染双防）；③ 权限：非 root 用户（node 镜像自带 node 用户，USER node）、文件属主显式 chown——K8s 的 runAsNonRoot 策略前置满足；④ 进程信号：exec node server.js（PID1 转发 SIGTERM，shell 包装吞信号=优雅关闭全废的经典坑）或加 tini；⑤ 健康检查：HEALTHCHECK 调 /healthz（镜像级兜底）+ 真正的探针在编排层；⑥ 配置零内置：密钥不 layer 不 env 默认值，全运行时注入；⑦ 产物卫生：prune devDeps、源码映射按需（生产带 sourcemap 上错误平台但不上公网 CDN）、清理 npm 缓存。进阶治理层：SBOM 生成（syft）+ 镜像 CVE 扫描（trivy）进 CI、镜像签名（cosign）验供应链、基础镜像月度更新策略（不是"出问题才更新"——补丁疲劳时要有自动 PR 消化）。加分句：Dockerfile 是"运行时的架构文档"——每一行都是一个"为什么不"的答案，评审 Dockerfile 比评审镜像配置有效得多。

**来源**：Node 官方 Docker 最佳实践；Docker 官方最佳实践文档；InfoQ《基础镜像里的供应链问题》

### 14.  发布之后怎么知道"没出事"？给 Express 服务设计发布观测与自动回滚的完整方案。

指标四金刚按"发布敏感度"改造：错误率（HTTP 5xx + 业务错误码分布）、时延（P99 按端点而非全局均值——某个端点 P99 翻倍就是事故）、流量（断崖=入口问题）、饱和度（内存爬升/事件循环 lag/池等待）；发布专用补充：新错误签名检测（日志 error type 与历史集合 diff——没有先例的异常最值钱的告警）、依赖调用量突变（新代码少调了某接口=功能悄悄坏）。发布节奏与观测对齐：金丝雀阶段（1%→10%→50%→100%，每档停留一个"观测窗"≥ 低峰流量覆盖一个完整业务周期的时长），分析器自动比对 canary 与 baseline 的指标分布（同时间片对照比历史基线可靠——流量日内波动大）。判定分级：硬红线（错误率绝对阈值、新致命签名）秒级自动回滚；软指标（P99 涨 15%）人工确认窗。回滚工程化：镜像不可变 tag 一键指回（发布系统的第一操作）、回滚后告警自动关联发布事件（值班第一眼看到"哪个版本回滚的"）；数据回滚的诚实边界——expand-contract 纪律保证代码回滚不牵连 schema，破坏性变更没有自动回滚只有前向修复（这是把纪律前置的根本理由）。配置与特性开关独立于代码发布通道（开关变更也是发布，同样要观测窗与回滚）。事后复盘度量：MTTD/MTTR、发布引起的告警占比、回滚率趋势（回滚率上升先怀疑的是观测窗太短而不是测试变差）。

**来源**：Google SRE（发布与回滚）；Weave Scope/Flagger 金丝雀分析实践；InfoQ《自动回滚上线一年后的误报清单》

### 15.  K8s 上跑 Express，HPA 该看什么指标？冷启动、连接风暴与容量规划讲讲你的实践。

CPU 做 HPA 指标在 Node 上的失真：事件循环饱和时 CPU 可以很低（都在等 I/O 排队）、GC 抖动时 CPU 很高但不缺容量——指标候选按"与排队直接相关"排序：事件循环 lag（perf_hooks monitorEventLoopDelay 导出自定义指标，最接近"忙不过来"的真信号）、活跃请求数/并发度（简单可靠）、P99 时延（滞后但贴 SLO）；CPU 保留作辅助与 VPA。连接风暴：扩容后新 pod 冷（V8 JIT 未热、Prisma 连接池新建、本地缓存空）——预热三件套：readiness 探针延后到"完成一轮自检请求"（内部打端点触发关键路径 JIT）、连接池初始化限额（启动期集中握手打挂 DB）、流量梯度（服务网格 slow start / 加权渐进）。缩容的对称面：连接 draining（preStop sleep + server.close 收尾 + 长连接 SSE/WS 需要主动通知客户端重连，pod 删了流才断=用户可见卡顿）、缩容下限（至少 2-3 副本+拓扑分布约束，单副本重启就是全站抖动）。容量规划实操：压测得"单 pod 在 P99 SLO 内的 QPS"，按峰值系数与故障冗余（N+1 起）定 min replicas；大促类已知脉冲不等 HPA（反应窗 1-3 分钟）改定时/预测扩容。HPA 参数细节：稳定窗（防抖动扩缩震荡）、scaleUp 快 scaleDown 慢的非对称策略、行为策略里禁 0。成本视角：request 设得虚高=集群浪费，Node 服务的内存增长曲线（缓存与泄漏的边界）要用压测后的 RSS 分布而不是感觉定 limit——limit 过紧 OOMKill 的现场与内存泄漏的事故报告长得一模一样，这是最易混淆的排查题。

**来源**：Kubernetes HPA 自定义指标文档；Node 性能与 GC 调优实践；SegmentFault《HPA 按 CPU 扩了个寂寞》
