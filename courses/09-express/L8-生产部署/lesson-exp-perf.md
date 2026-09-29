# 性能调优

> 目标：**把"能跑"变成"跑得又快又稳"**——先测量后优化；keep-alive 与连接复用；数据库连接池；压缩；缓存分层；避免事件循环阻塞；内存泄漏检测；基准测试与压测。

---

## 一、第一原则：先测量，再优化

没有数据的优化是猜。**别凭感觉改**。流程：

```
建立基线（benchmark/压测） → 定位瓶颈（profile/APM/日志耗时） → 改一处 → 复测对比 → 保留有效改动
```

关注三指标：**延迟（P50/P95/P99）、吞吐（RPS）、错误率**。看 P99 而非平均值（平均会掩盖长尾卡顿）。优化工具：clinic.js、0x、node --prof、Chrome DevTools、APM。

---

## 二、别阻塞事件循环（Node 性能第一杀手）

事件循环单线程（呼应 L1）。任何**同步 CPU 密集**或**同步阻塞 API**都会卡住整个进程，让所有请求排队：

```js
// 目的：避免阻塞事件循环—同步重活会卡住整个进程，所有请求排队
// ❌ 反例：同步阻塞，一个大请求拖垮全站
const data = fs.readFileSync(hugeFile);              // ❌ 同步读大文件期间 event loop 完全卡死，其余请求排队
for (let i = 0; i < 1e10; i++) {}                    // ❌ 密集计算占满单线程
crypto.pbkdf2Sync(pw, salt, 100000, 64, 'sha512');   // ❌ 同步慢哈希：并发登录时整站卡死

// ✅ 用异步 / worker_threads 卸载 CPU 密集任务
import { Worker } from 'node:worker_threads';
const data = await fs.promises.readFile(file);       // ✅ 异步读：等待期间循环照转其他请求
// ✅ CPU 密集重活 new Worker('./heavy.worker.js') 丢给工线程，不堵主循环
```

- I/O 用异步（天然非阻塞）；
- CPU 密集（图像/加解密/大 JSON 解析/压缩）丢给 `worker_threads` 池或独立服务；
- 序列化/反序列化超大对象、正则回溯（ReDoS）也是隐形阻塞源。

> 一个 P99 突然飙高，八成是某处同步代码在特定输入下卡住了循环。

---

## 三、HTTP keep-alive 与连接复用

### 3.1 对客户端/上游

每次请求新建 TCP+TLS 握手代价高。开启 keep-alive 复用连接：

```js
// 目的：服务端开启 keep-alive—复用 TCP 连接，省每请求握手代价
import http from 'node:http';
// Node 19+ 默认对 server 启用 keep-alive
const server = http.createServer({ keepAlive: true }, app);   // ✅ 复用连接，高并发下显著降延迟
```

出网调用（axios/undici）**复用 agent/连接池**，别每次新建：

```js
// 目的：出网调用复用连接池—别每次新建 Agent，否则握手风暴
import { Agent } from 'undici';
const client = new Agent({ connections: 100, keepAliveTimeout: 10_000 });  // ✅ 池化，最多 100 并发复用
// ❌ 每请求 new Agent() → 频繁 TCP+TLS 握手，高并发下 CPU 和端口都被打爆
```

### 3.2 keep-alive 超时链（易踩坑）

原则：**上游 keep-alive 空闲超时 > 下游**。若 Node 比 Nginx/LB 更早关连接，代理复用一条已被后端关闭的连接 → 偶发 `502`。

```js
// 目的：keep-alive 超时链—Node 空闲超时必略大于上游代理，否则代理复用已死连接报 502
server.keepAliveTimeout = 65_000;   // ✅ 略大于 LB/Nginx 的空闲超时(如 60s)
server.headersTimeout = 66_000;     // ✅ 必 > keepAliveTimeout
// ❌ Node 比 Nginx 更早关连接 → Nginx 复用一条已被后端 RST 的连接，偶发 502 难以复现
```

### 3.3 反代到后端也复用

Nginx `upstream { keepalive 64; }` + `proxy_http_version 1.1`（见 L8 部署），减少后端连接数。

---

## 四、数据库连接池

**每条 SQL 现建连接 = 灾难**（握手/认证开销 + 连接数爆炸）。用池复用：

```js
// 目的：数据库连接池—借→用→自动还，避免每 SQL 现建连接
// pg
const pool = new pg.Pool({ max: 20, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });   // ✅ 上限 20，获连接最多等 5s
const { rows } = await pool.query('SELECT ... WHERE id=$1', [id]);   // ✅ 从池借连接，查完自动归还

// mongoose：本身是连接池，设合理 maxPoolSize
mongoose.connect(url, { maxPoolSize: 50 });
// ❌ 手动 const client = await pool.connect() 后不 release → 连接泄漏耗尽池，后续请求全挂在 connectionTimeout
```

- `max` 不是越大越好：连接数 ≈ `(核数 × 2) + 磁盘数` 量级，过大反而 DB 端上下文切换/锁竞争加剧；
- **用完必还**（`client.release()` / try-finally），泄漏连接会耗尽池导致请求全挂起；
- 慢查询先看**索引**（呼应 L5 ESR），别只加机器。

---

## 五、压缩

响应体大时 gzip/brotli 省带宽（CPU 换网络）。用 `compression`：

```js
// 目的：响应压缩—用 CPU 换带宽，小体不值得压
import compression from 'compression';
app.use(compression({ level: 6, threshold: 1024 }));  // ✅ <1KB 跳过（压缩可省不了几个字节反耗 CPU）
// ❌ 把 compression 装在 res.sendFile/流式 SSE 前 → 已压内容/逐块推送被缓冲，SSE 直接失效
```

注意：
- **别压已压缩内容**（图片/视频/zip、流式/SSE）——浪费 CPU 还可能变大；
- 压缩吃 CPU，高并发下适度调低 level 或交给 Nginx/CDN 做；
- 对**含敏感值的响应 + 攻击者可控制部分输入**时，警惕 BREACH 类压缩侧信道攻击（Token 类接口可关压缩）。

---

## 六、缓存分层（最快的是不算）

```
浏览器/CDN  →  应用内存  →  Redis  →  DB
  越靠前越快、越该先命中
```

- **HTTP 缓存**（呼应 L4）：静态资源 contenthash + `immutable`；HTML `no-cache`；合理 ETag/`Cache-Control` 让 304 与 CDN 命中；
- **应用/分布式缓存**：热点查询结果、渲染片段放 Redis（`cache-aside`：先查缓存，miss 再查库并回填，设 TTL）：

```js
// 目的：cache-aside 缓存—先查 Redis，miss 再查库并回填带 TTL
async function getProfile(id) {
  const key = `profile:${id}`;
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit);                     // ✅ 命中缓存，不碰 DB
  const row = await db.users.findById(id);
  await redis.set(key, JSON.stringify(row), 'EX', 60);   // ✅ 回填并设 TTL 60s
  return row;
}
// ❌ TTL 不加随机抖动→大量 key 同时过期（雪崩）；不缓存空值→恶意 id 频繁穿透直打 DB
```

- 缓存三患：**穿透**（查不存在的 key，用空值/布隆过滤器）、**雪崩**（同时过期，TTL 加随机抖动）、**击穿**（热 key 过期瞬间打爆 DB，用互斥锁/逻辑过期）；
- 失效策略：写时删缓存（比写时更简单可靠），警惕缓存与 DB 不一致窗口。

---

## 七、其他高频加速点

- **索引与查询**：`SELECT` 只取需要字段、避免 `N+1`（批量/JOIN）、分页用游标（呼应 L5）；
- **JSON 序列化**：超大响应是隐形热点，裁剪字段、分页、避免在循环里 `JSON.stringify`；
- **启用 `query parser`/路由**：大量路由时 Router 组织、避免正则灾难；
- **`app.disable('x-powered-by')`**、生产开 `view cache`（呼应 L4）减少开销；
- **静态资源交 CDN/反代**，别让 Node 传大文件；
- **限流降级**（呼应 L6）保护后端不被打垮——性能也含"过载下的稳定性"。

---

## 八、内存泄漏检测

Node 内存持续爬升不回落 → OOM/被 `max_memory_restart` 反复重启（呼应 L8）。常见源：

- 无界缓存/数组只增不减（`Map`/全局变量当缓存不设上限或 TTL）；
- 未清理的定时器/事件监听（`setInterval` 不 clear、`req` 上 `on(...)` 累积）；
- 闭包捕获大对象、模块级累积状态；
- 未 `release` 的连接/流。

排查：

```bash
# 目的：堆快照与内存监控，定位只增不减的泄漏
node --inspect server.js       # ✅ Chrome DevTools 连 Memory 打堆快照
npx clinic heap -- node server.js   # ✅ 自动采样堆增长
process.memoryUsage().heapUsed  # ✅ 打点监控（可定期写日志看趋势）
```

打法：拍两次堆快照对比（take heap snapshot），看持续增长的对象；用 WeakMap/WeakRef、给缓存设 `max`+TTL（如 `lru-cache`）、用完即 `clearInterval`/`removeListener`。

---

## 九、基准测试与压测

### 9.1 微基准（单函数）

```js
// 目的：微基准—相对比较两种写法快慢（不信绝对值）
import { Bench } from 'tinybench';
const b = new Bench();
b.add('map', () => arr.map(f)).add('for', () => { const r=[]; for(const x of arr) r.push(f(x)); return r; });   // ✅ 同一任务两个候选实现
await b.run();                     // ✅ 跑足时长让 JIT 预热
console.table(b.results);          // ✅ 输出 ops/sec 对比
// ❌ JIT 预热/GC 抖动使微基准绝对值不可靠，只作相对比较，别拿单次数值下结论
```

> JS 微基准坑多（JIT 预热、内联缓存、GC 抖动），只作相对比较，别过度解读绝对值。

### 9.2 端到端压测（看系统容量）

```bash
# 目的：端到端压测—探系统容量拐点
# autocannon / artillery / wrk
autocannon -c 100 -d 30 http://localhost:3000/api/products   # ✅ 100 并发压 30s，看 p99/RPS/错误率
```

关注 `p99 latency`、`requests/sec`、错误率；找拐点（加压到延迟飙升/错误出现的吞吐即容量上限），据此定实例数与限流阈值。

### 9.3 APM/持续观测

生产接 Prometheus（`prom-client` 暴露 `/metrics`）+ Grafana，或 Datadog/New Relic，持续看 P99、事件循环延迟（`eventLoopUtilization`/`monitorEventLoopDelay`）、GC、内存、DB 慢查询——性能是长期观测不是一次性冲刺。

---

## 十、性能自检清单

- [ ] 有没有同步阻塞代码（fs 同步/CPU 密集/大 JSON/正则回溯）卡事件循环？
- [ ] 出网/DB 是否用连接池并复用，用完是否归还？
- [ ] keep-alive 超时链：Node > LB/Nginx？
- [ ] 静态与 API 缓存头是否合理（immutable/contenthash/no-cache）？
- [ ] 热点读是否上 Redis（并防穿透/雪崩/击穿）？
- [ ] 慢 SQL 是否加索引、消除 N+1？
- [ ] 是否建立压测基线、看 P99 而非均值？
- [ ] 有无内存只增不减的缓存/监听/定时器？

---

## 🚀 部署预告

- **性能与容量进 CI**：每次发布跑压测阈值（P99/错误率超标即 gate 红），防性能回退（呼应 L8 发布策略）。
- **可观测性三支柱**：metrics（Prometheus）+ logs（pino→Loki）+ traces（OpenTelemetry），瓶颈定位靠它。
- **自动扩缩 HPA**：按 CPU/自定义 QPS 指标增减副本，配合无状态 + 优雅关闭才平滑。

至此 Express 5 全链路（入门→中间件→请求响应→模板静态→REST→安全工程→测试→部署性能）收官。回看 L1 初心——你已能独立把一个 Express 服务安全、可测、可扩展地送上生产并跑得又快又稳。
