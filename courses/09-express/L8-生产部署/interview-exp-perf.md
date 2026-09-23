# exp-perf 面试题精选

> 共 12 题，覆盖 **事件循环 / 连接复用 / 连接池 / 压缩 / 缓存 / 内存 / 压测 / 观测** 八类。

---

## 一、事件循环与阻塞

### 1. 为什么"阻塞事件循环"是 Node 最严重的性能问题？如何避免？

Node 主线程单线程跑事件循环，所有并发请求共享它。一个 handler 里执行同步 CPU 密集（大计算/同步 fs/大 JSON parse/正则回溯）会独占线程，期间**所有其它请求都无法推进** → P99 飙升、吞吐塌方、健康检查超时。避免：I/O 一律异步、CPU 密集丢 `worker_threads`/子进程/独立服务、拆分大任务让出循环（setImmediate）、给同步重活设上限。定位靠 `monitorEventLoopDelay`/clinic autocue。

**来源**：Node.js docs — "Event Loop / libuv worker pool"; NearForm Node Best Practices — "avoid blocking"; clinic.js — "autocue"

### 2. libuv 线程池能帮你做什么、不能做什么？

libuv 用线程池（默认 4）承接**部分异步 I/O**：文件 fs、DNS、部分 crypto/zlib。所以异步 fs 不阻塞主循环。但**不能**指望它做你的 JS CPU 密集——你写的同步 JS 永远在主线程。且线程池会被大量文件操作/zlib 打满而排队。真 CPU 密集要用 worker_threads（各自独立事件循环+核）或外部服务。

**来源**：Node.js docs — "libuv / UV_THREADPOOL_SIZE"; libuv — "threadpool"; blog — "Node worker pool explained"

---

## 二、连接复用

### 3. keep-alive 对性能有什么价值？配错了会引发什么线上问题？

HTTP keep-alive 复用 TCP（和 TLS）连接，省掉每请求握手的往返与慢启动，显著降延迟、减后端连接数。配错的经典事故：Node server 的 `keepAliveTimeout` **小于** 前置 LB/Nginx 的空闲超时 → 代理以为连接还活着并复用，而后端已关闭 → 偶发 `502`/`ECONNRESET`。对策：`keepAliveTimeout` 略大于下游空闲超时，`headersTimeout > keepAliveTimeout`；并处理 `clientError`。

**来源**：Node http.Server — "keepAliveTimeout/headersTimeout"; AWS — "ALB 502 keep-alive race"; Express — "performance considerations"

### 4. 做出站 HTTP 调用（调第三方 API）时如何优化性能？

复用连接池/agent，别每次新建：用 undici 的 `Agent`/`Pool`（`connections`、keep-alive）或 axios 配 `httpAgent` 复用；设合理超时与重试（幂等才重试）+ 熔断降级；并发受控（批量时用池限并发防打爆对端）；能缓存的响应缓存；HTTP/2 多路复用进一步减连接。核心：连接建立是最大隐藏成本。

**来源**：undici — "Agent / Pool / perf"; axios — "transformRequest / agents"; Node — "http keep-alive"

---

## 三、数据库

### 5. 数据库连接池大小怎么定？是不是越大越好？

不是。连接数超过 DB 承载后，DB 端上下文切换、锁竞争、内存占用反而拖慢，且把压力转移给数据库。起点经验 `(2 × CPU核数) + 磁盘数`，再按压测调。要点：设 `connectionTimeoutMillis`（拿不到连接快速失败而非无限等）、`idleTimeoutMillis`（回收空闲）、**用完必须 release**（try-finally）否则池被占满、请求全挂起——这是典型"连接泄漏"故障。

**来源**：pg — "Pool options"; HikariCP wiki — "about pool sizing"; StackOverflow — "how many DB connections"

### 6. 接口慢，DBA 说 SQL 慢，你会从哪些方面优化查询？

① **索引**（最高杠杆）：WHERE/JOIN/ORDER 列建合适索引，遵循 ESR（Equality→Sort→Range，呼应 L5），看 EXPLAIN 是否走索引、有无全表扫/回表；② 消除 `SELECT *`，只取需要列（覆盖索引）；③ 解决 `N+1`（批量查/JOIN/一次 in）；④ 分页改游标避免深分页 offset 扫描（呼应 L5）；⑤ 热数据上缓存（Redis）；⑥ 读写分离/分库分表（末位手段）。先 EXPLAIN 定位再动手。

**来源**：use-the-index-luke — "SQL performance / ESR"; MySQL/Postgres — "EXPLAIN / query optimization"; Percona — "indexing checklist"

---

## 四、压缩与传输

### 7. gzip/brotli 压缩放在应用层还是 Nginx/CDN？各权衡是什么？

放 Nginx/CDN：靠近用户、卸载应用 CPU、可缓存压缩结果，是首选。放应用层（`compression`）：需要动态内容/无独立代理时，简单直接但吃 Node CPU（而 CPU 正是 Node 稀缺资源，呼应事件循环）。折中：静态与可缓存内容交代理/CDN 压，动态小响应应用层压；调 `level`（4-6 常是性价比拐点）、`threshold`（<1KB 不压）、别压已压缩/流式内容。

**来源**：compression — "npm perf notes"; Nginx — "gzip / brotli module"; Cloudflare — "compression best practices"

### 8. 什么叫 BREACH 攻击？和压缩有什么关系？

当响应被**压缩**且同时包含**攻击者可预测/可控制的输入**与**密钥类稳定秘密**（如 CSRF token）时，攻击者通过观察密文长度变化可逐字节猜出秘密——压缩让"与已知输入相同的前缀更短"这一侧信道成立。防御：对含敏感值的接口关闭压缩、把 token 每次随机化、或用不长度泄露的机制。启示：性能优化（压缩）也懂安全边界（呼应 L6）。

**来源**：BREACH — "Crime/BREACH compression side-channel"; OWASP — "Compression Side-Channel (BREACH)"

---

## 五、缓存

### 9. 讲讲缓存分层，以及'最快的一次请求是不用算'。

延迟从低到高：浏览器缓存 → CDN 边缘 → 应用内存 → Redis → DB。越靠前命中越省（省网络+计算）。让静态资源 contenthash+immutable 长期缓存、HTML no-cache（呼应 L4）；热点读结果进 Redis（cache-aside + TTL）。每次少打一层 DB/CPU 都是巨大收益——所以先问"这个结果真的每次都要重算吗"。但缓存引入一致性复杂度，按数据"读多写少 + 可容忍短暂陈旧"才值得。

**来源**：AWS — "caching patterns / cache-aside"; Martin Fowler — "Performance / caching"; High Performance Browser Networking — "CDN"

### 10. 缓存穿透、击穿、雪崩分别是什么？如何解决？

- **穿透**：大量查询**根本不存在**的数据，缓存永远 miss，全打 DB。解：空值缓存（短 TTL）、布隆过滤器前置拦截。
- **击穿**：某个**热点 key** 过期瞬间，海量并发同时查库回填。解：互斥锁/singleflight（只放一个去重建，其余等待）、热点 key 逻辑过期不真删。
- **雪崩**：大量 key **同一时刻集中过期**，DB 瞬时被打爆。解：TTL 加随机抖动打散、多级缓存、限流降级、DB 侧容量兜底。
另注意**一致性**：写时删缓存 + 容忍短暂陈旧窗口，避免"写成功但缓存还是旧值"。

**来源**：Redis docs — "cache patterns"; 中文技术社区 — "缓存穿透/击穿/雪崩"; AWS — "caching pitfalls"

---

## 六、内存与观测

### 11. 生产 Node 进程内存持续上涨，如何定位是不是泄漏？

先在监控看 `heapUsed`/RSS 是否只增不减、GC 后不回落。开 `--inspect` 用 Chrome DevTools 打**两次堆快照**（间隔一段时间、跑一批请求）做 diff，看数量持续增长的对象类；或用 `clinic heap`/`heapsnapshot` 分析。常见泄漏：无界 Map/数组当缓存、未 `clearInterval`、事件监听累积（每次请求 `emitter.on` 不 `off`）、闭包捕获大对象、未归还连接/未销毁流。修：LRU + max + TTL、用完即清理、WeakRef。

**来源**：Node — "Memory / heap snapshots"; Google Chrome DevTools — "Memory: heap snapshots"; clinic.js — "heap"

### 12. 如何做一次有意义的性能压测？看哪些指标？

目的先明确（定容量 / 验优化 / 找拐点）。步骤：准备贴近生产的数据与环境 → 逐步加压（阶梯并发）→ 采集 **吞吐(RPS)、延迟分布(P50/P95/P99)、错误率、资源(CPU/内存/事件循环延迟/DB)**。找"延迟/错误开始恶化的拐点吞吐"= 容量上限，据此定实例数与限流阈值（呼应 L6）。工具 autocannon/artillery/wrk/k6。原则：测**代表性混合流量**而非单接口，关注尾延迟（均值会骗人），改一处复测一处、留基线做回归（呼应"先测量再优化"）。

**来源**：autocannon / artillery / k6 — docs; Google SRE — "SLO / tail latency"; Node — "performance / benchmarking"
