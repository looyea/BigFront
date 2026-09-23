# exp-perf 面试题精选

> 共 15 题，覆盖 **事件循环 / 连接复用 / 连接池 / 压缩 / 缓存 / 内存 / 压测 / 观测** 八类。

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

---

## 补充（新专题 13-15）

### 13.  序列化与响应组装层（JSON.stringify、模板、ORM 实体到 DTO）在热点接口上的性能预算怎么做？

成本解剖：一次 res.json = 实体图遍历选字段 + JSON.stringify 全量同步序列化 + 可能的 compression；中大型 payload 下这三段常占接口 CPU 时间的一半以上（DB 反而不慢）。优化阶梯：① 先减体积——select 精确取列（ORM 全字段查再手工 delete 是双重浪费：DB 传输+序列化都按全量计）、DTO 层只出契约字段（大字段如富文本进详情不进列表）、分页与字段裁剪参数（fields=）；② 再换工具——热点接口用 fast-json-stringify（按 schema 编译序列化器，2-5 倍提速且顺带完成输出裁剪，Express 里 res.json 前手动 stringify + res.type 发送），Date/Decimal/ObjectId 的 toJSON 定制要在 schema 里固化而不是运行时试错；③ 缓存序列化产物——"序列化后字节"是可缓存单元（同版本数据不变则缓存 buffer 而不是对象，命中时零序列化，配合 ETag 走 304 更是零字节）；④ 结构性回避——超大数据改流式（NDJSON 分块序列化，每块之间让出事件循环）或预生成（报表类落文件走对象存储）。度量：clinic js/火焰图里给 stringify 圈占比、autocannon 对比 payload 大小与 RPS 的曲线拐点。收口句：Node 的吞吐杀手常不是"算得慢"而是"一次同步算太多"——序列化预算的本质是控制任何单回调的同步工作量。

**来源**：V8 官方性能文档（JSON 序列化）；Fastify 团队 serialization 基准；掘金《我们把响应从 40ms 优化到 6ms》

### 14.  Node 服务的 JIT 预热与冷启动问题：重启后第一波流量为什么慢？怎么办？

成因分层：① JIT 分级——热点函数在解释器/SparkPlug/Baseline/Maglev/TurboFan 间爬梯，冷代码慢数倍，流量爬升期（滚动发布/扩容 pod/定时任务首跑）最热路径还没被优化；② 内联缓存单态假设——同一段代码首次处理多种 shape 的对象（不同字段序的 SQL 结果行）megamorphic 化后退化；③ 依赖层冷——连接池初建握手、DNS 缓存空、本地缓存空（第一波全打 DB 即缓存雪崩的微缩版）、文件句柄与 OS page cache 冷。应对组合：就绪门控（readiness 不只看端口——启动后自打代表性请求集（覆盖热点路由）通过才接流，K8s 下等价于"预热完成的定义"）、流量梯度（网格 slow-start/加权发布，让 JIT 有时间爬梯）、预热脚本（启动时对关键路径跑合成输入——争议做法，收益要基准验证而不是感觉）、缓存预载（本地热点缓存在 readiness 前批量装填）、连接池预建（min 连接>0 且启动即握手）。可观测：perf_hooks 的 BOOTSTRAP 事件+自定义启动阶段计时导出"启动到热"时长指标，发布系统按它调 rollout 节奏。诚实边界：微秒级 JIT 差异对 I/O 型接口影响小——这题的价值在"重启风暴叠加"场景（弹性扩容 20 pod 同时冷=下游 DB 被冷缓存打穿），单 pod 不是问题、群体同时冷才是。加分句：把"新实例多久达到稳态性能"当发布参数管理，是 SRE 视角与开发视角的分水岭。

**来源**：V8 官方优化指南（warmup）；_nearForm Node.js 性能指南；InfoQ《发布后 5% 超时的真凶》

### 15.  怎么防"性能回退"进生产？设计一套性能 CI 与线上性能预算体系。

离线侧（CI 门禁）：① 连续基准（continuous benchmarking）——固定热点场景（下单接口、列表序列化）在每次 PR 跑短时压测（autocannon/artillery 脚本化，30-60 秒样本），与主干滚动基线比对，劣化超阈值（如 RPS -8% 或 P99 +15%）挂门并出 diff 报告；工程细节：基准 runner 的噪声控制（同机型亲和调度、CPU 绑核、关闭 turbo 抖动、多次取中位数）——不稳定基准比没有基准更糟（大家学会忽略红灯就开始漏真回归）；② 微基准守关键库（序列化、校验、路由匹配层单独 bench，定位回退来源不靠猜）；③ 产物体积与依赖守护（bundle/依赖数门禁对 BFF 层同样适用）。在线侧（预算与告警）：接口级性能预算写进契约（P99 目标进 OpenAPI 扩展字段与 dashboard），SLO burn rate 告警（预算消耗速率比绝对阈值更早发现问题）；变更关联——每次发布自动 diff"版本 A/B 的 P99 分布"（金丝雀对照天然提供，呼应 deploy 关）；慢查询与事件循环 lag 的基线漂移周报。组织闭环：性能预算有 owner（接口属主团队）、红灯处理有流程（回滚/修复/豁免登记三选一，豁免带过期）、"性能债看板"与功能需求同台排期（不给排期的预算体系第一年就名存实亡）。常见反模式：只在大促前压测（一次性运动）、基准测试跑在共享 CI 上比出三位小数（噪声自欺）、用平均值设预算（P50 优化到烂 P99 照样爆炸）。收口句：性能回退与功能 bug 同构——没有 CI 门禁前它一定来自你的代码，有了门禁前它一定来自你看不见的地方（依赖/数据量/流量结构），两个都要治。

**来源**：NearForm Node 性能监控实践；WebPageBench/连续基准方法论；Google SRE（性能回归）
