# node-streams 面试题精选

> 共 15 题，覆盖 **流的本质与分类 / 读模式与事件 / 写与 finish / 背压与 highWaterMark / Transform 与 objectMode / 实战与陷阱** 六类。

---

## 一、流的本质与分类

### 1. 什么是 Stream？它和"一次性读完"的 Buffer 方案相比优势在哪？

Stream 是**随时间到达的数据序列**的抽象，把"数据"看成一条传送带而非一整块。相比 `readFile` 一次性把全部字节装进 Buffer：① **内存恒定**——任意时刻只处理一个 chunk，10GB 文件也不 OOM；② **可以边读边处理/边写**——无需等全部到齐，降低首字节延迟；③ **可组合**——用 pipe/pipeline 串成处理流水线。代价：编程模型更复杂（事件、背压、异步错误）。流的底座是 EventEmitter，搬运的单位通常是 Buffer（呼应 node-events、node-buffer、node-streams 第一节）。

**来源**：Node.js — "Streams overview"; nodejs.org — "Stream handbook"

### 2. Readable / Writable / Duplex / Transform 各是什么？举一个真实例子。

- **Readable**：数据流出（`fs.createReadStream`、HTTP `req`、`process.stdin`）。
- **Writable**：数据流入（`fs.createWriteStream`、HTTP `res`、`process.stdout`）。
- **Duplex**：读写两端**独立**（`net.Socket`——收和发互不干扰）。
- **Transform**：**特殊 Duplex**，读出端是写入端数据的变换结果（`zlib.createGzip`、`crypto` 加解密流）。
区分 Duplex 与 Transform：电话线是 Duplex（两头内容无因果关系）；"输入经函数映射成输出"是 Transform（呼应 node-streams 第一节）。

**来源**：Node.js — "Types of streams (Readable/Writable/Duplex/Transform)"

---

## 二、读模式与事件

### 3. flowing 与 paused 两种读取模式区别？分别在何时进入？

- **flowing（流动）**：挂 `on('data')` 或调 `resume()` 后进入，流以尽可能快的速度把每块推给你，你不处理也会流失。适合"数据只是路过（转写别处）"。
- **paused（暂停/拉取）**：不挂 `data`、改挂 `'readable'`，你用 `read()` **主动拉**，拿多少处理多少。适合"要按自己节奏取、配合背压"。
`pause()`/`resume()` 可在 flowing 与 paused 间切换。切记 `data` 与 `readable` **二选一**，混用会互相抢数据（呼应 node-streams 第二节、quiz 第 7 题）。

**来源**：Node.js — "What you should know about streams / modes"

### 4. Readable 的 `'end'`、`'close'`、`'error'` 分别在何时触发？为什么 `'error'` 一定要监听？

`'end'`：数据被**正常读完**（EOF），不会再有 `'data'`。`'close'`：底层资源（fd/socket）已释放，可能紧随 end、也可能因提前 `destroy()` 而来。`'error'`：读取过程出错（文件消失、权限、网络断），流随即停止。**`'error'` 必须监听**——因为 EventEmitter 的 `'error'` 事件**无人监听会抛出未捕获异常直接崩进程**（呼应 node-events 第三节、node-async-errors）。每个可能出错的流都要 `.on('error', ...)`，或用 pipeline 统一收口。

**来源**：Node.js — "Event: 'end' / 'close' / 'error'"; 社区 — "unhandled stream error crashes"

---

## 三、写与 finish

### 5. `writable.write()`、`end()`、`'finish'` 事件三者的职责分别是什么？

- `write(chunk[, cb])`：把一块数据放进写缓冲队列，返回 `true`（还能继续）或 `false`（缓冲已达 highWaterMark，该歇歇，呼应背压）。
- `end([chunk][, cb])`：声明"我不再写了"，可选最后再塞一块；调用后流进入 closing，写完队列里剩余数据后关闭。
- `'finish'`：`end()` 之后、**所有缓冲数据都已成功交给底层 OS** 时触发——是"写真正写完"的信号（`res` 发完、文件落盘）。要在"写完"后做收尾（删临时、汇报）应等 `'finish'`，而不是 `write` 返回或 `end()` 调用那一刻（呼应 node-streams 第三节）。

**来源**：Node.js — "writable.write / writable.end / event finish"

---

## 四、背压与 highWaterMark

### 6. 什么是"背压（backpressure）"？为什么它是流最重要的机制？

背压 = **当下游（Writable）消费速度跟不上上游（Readable）生产速度时，把"慢一点"的信号反向传导回上游**的机制。没有它，快读慢写会让数据在内存缓冲里无限堆积→OOM。Node 流用两个信号实现：① `writable.write()` 在缓冲超阈值时返回 `false`；② 缓冲腾出空间后发 `'drain'`。`pipe`/`pipeline` 自动遵守：收到 `false` 就 `pause()` 读端，等 `'drain'` 再 `resume()`（呼应 node-streams 第五节）。理解了背压，就理解了"流为什么能扛任意大数据"。

**来源**：Node.js — "Backpressure / highWaterMark"; 社区 — "what is backpressure node streams"

### 7. `highWaterMark` 到底控制什么？调大/调小有何影响？

它是每个流**内部缓冲的阈值**。字节流下单位是字节（可读流默认约 16KB、可写流默认 16KB），`objectMode` 下单位是"对象个数"（默认 16）。超过它，`read()` 返回 null / `write()` 返回 false，即触发背压。调大：缓冲更多、吞吐可能更平滑但内存占用更高、背压更晚触发；调小：更频繁读写系统调用、更"实时"但开销大。多数场景默认即可，特殊 I/O（高延迟网络、超大块）才微调（呼应 node-streams 第五、六节）。

**来源**：Node.js — "stream.highWaterMark"

---

## 五、Transform 与 objectMode

### 8. 如何自定义一个 Transform？`transform()` 里 `cb(err, data)` 与 `this.push()` 有何区别？

```js
import { Transform } from "node:stream";
const upper = new Transform({
  transform(chunk, encoding, cb) {
    // 1:1 简单映射：直接把结果作为第二个参数交给 cb
    cb(null, chunk.toString().toUpperCase());
    // 2:1 或多/零：先 this.push(若干块)，再 cb(null)  （不传 data）
  },
});
```
规则：**一个输入产生恰好一个输出** → `cb(null, out)`；**产生 0 个或多个输出** → 自行 `this.push()` 若干次后 `cb(null)`。还有 `flush(cb)` 钩子——在所有输入处理完、结束前吐出残留（如未凑齐的最后一行、压缩尾块）。别在 `transform` 里做未回调的异步（会卡住，呼应 node-async-errors）。

**来源**：Node.js — "new Transform([options]) / transform / flush"

### 9. objectMode 是什么？和普通字节流比有什么要注意的？

开启 `{ objectMode: true }`（可分别对 readable/writable 端开）后，流可以 `push`/`write` **任意 JS 值**（对象、字符串、数组），不再限 Buffer/字符串；`highWaterMark` 含义变成"缓冲对象个数"。适合"逐条记录"型流水线（逐行 JSON、逐条 DB 记录）。注意：① 不能写 `null`（保留给 EOF）；② 一旦某端不是 objectMode，对象会被强转 Buffer 出错；③ 每对象大小差异大时，用"个数"限流可能仍占很多内存（呼应 node-streams 第六节）。

**来源**：Node.js — "objectMode"

---

## 六、实战与陷阱

### 10. `readable.pipe(writable)` 相比 `readable.on('data', c => writable.write(c))` 好在哪？

手写 `on('data')+write` 有两个坑：① **完全忽略背压**——`write()` 返回 `false` 时你还在猛写，内存堆积；② **不会自动 `end`** 写端（数据读完你没 `writable.end()`，文件/响应不关闭）。`pipe` 帮你：自动遵守 `false`/`drain` 的背压、读端 `end` 时自动 `writable.end()`、支持一个源 pipe 到多个目标。但 `pipe` 仍**不传播 error**（这是它的遗留缺陷，要用 pipeline，呼应下一关、quiz 第 6 题）。

**来源**：Node.js — "readable.pipe(dest)"; 社区 — "pipe vs on data write"

### 11. 把大文件边压缩边写盘，你会怎么搭这条流？内存为什么会稳定？

```
fs.createReadStream(src)
  → zlib.createGzip()            // Transform：每块进、压缩块出
  → fs.createWriteStream(dst.gz)
```
（推荐再包成 `pipeline(read, gzip, write)`，见下一关。）读端每次只从磁盘取约 16KB、gzip 只缓冲少量、写端缓冲 16KB，任一环缓冲满了就通过 `false`/`drain` 反向节流整条链（背压），所以**峰值内存 ≈ 几个 highWaterMark 之和**，与文件大小无关。这就是"恒定内存处理任意大文件"（呼应 node-streams 第一、五节、node-fs 第七节）。

**来源**：Node.js — "zlib with streams"; 社区 — "gzip a file node stream memory"

### 12. 线上发现"用了流但内存还是无限涨"，最可能的三个原因是什么？

① **忽略了背压**：手写 `on('data')+write` 没管 `write()` 返回 false，或自定义 Transform 的 `transform` 里同步 `push` 过多却从不限速——缓冲无上限堆积；② **下游根本没消费 / 消费极慢**（比如 pipe 的目标 Writable 卡在慢速网络，而你又没用 pipeline 的背压传导）；③ **累积引用**：在 `'data'` 里把每块 push 进一个数组"最后统一处理"（把流又退化回了 readFile），或某个大对象被闭包长期持有（呼应 node-events 监听器泄漏、node-deploy-perf）。排查方向：确认是否真在"边处理边丢"、有没有人为攒 chunk、背压有没有被自动机制接管。

**来源**：Node.js — "performance considerations / backpressure"; 社区 — "node stream memory leak causes"

---

## 补充（新专题 13-15）

### 13. streams 3（Node 16+ 重写）相对老流修了什么？迁移时行为差异有哪些？

修：① 错误传播终于一致——任意环节 destroy(err) 都能沿 pipeline 到达终点（老流 error 事件各挂各的）；② 生命周期清晰：close/destroy/end 语义分离、autoDestroy 默认 true（消费完自动拆，老流要手动 destroy）；③ 读侧不再「push(null) 后还能写」等状态机裂缝；④ async iterator 原生。迁移差异：① 'readable'/'data' 混用模式仍可用但事件序有差；② 老代码里 `stream.on('end')` 的时机（数据全读出后 vs destroy 后）与 close 的先后变了；③ objectMode 的 null 推送老流当 EOF（push(null)）——streams3 仍如此但要用 undefined 规避的心可以放下（null 保留哨兵语义）；④ destroy 里回调错误要 err 传递（callback(err)）而非 emit。验收：把每个 pipe 链改 pipeline（本关 pipeline 关主题）后跑错误注入测试（中途 ECONNRESET）看是否干净收尾。

**来源**：Node 官方《Streams: A new implementation》（v16 BREAKING CHANGE 清单）；streams 3 设计文档（destroy/autoDestroy 语义）。

### 14. 一个「读 DB → 压缩 → 上传 S3」的流式作业，你会怎么搭管道、怎么处理失败与背压？

骨架：pipeline(queryStream(对象流) → Transform 序列化成 JSON 行 → zlib.createGzip() → UploadStream(S3 multipart))。要点：① 对象流→字节流：序列化 Transform 的 highWaterMark 用 objectMode:1（对象计数），字节段默认 16KB——两段水位独立调（压缩比高时上游快，靠 gzip 段背压自然限速）；② S3 分片上传做自定义 Writable：攒够 part 大小（5MB）再 PUT，缓冲窗口=并发分片数×5MB，背压=write 返回 false 时等 part 上传完再 drain——**外部 I/O 必须进背压环**，fire-and-forget 上传=内存无界（本关「用了流还 OOM」题的标准案例）；③ 失败：pipeline 一处 catch，清理=abort multipart（拿 uploadId 在 finally abort，漏 abort 产生隐形存储费）；④ 可观测：bytes written/背压等待时间计数器；⑤ 进度/断点：记录已 flush part 号，可续传则从 checkpoint 续。测试：注入「S3 第 3 分片 500」验证 abort 与内存回落。

**来源**：AWS SDK v3 multipart upload 指南；Node pipeline 文档组合流错误处理示例。

### 15. 怎么给流写「单元测试」？给 Readable 造替身、断言输出、测错误传播各用什么？

替身输入：Readable.from(asyncIterable)（最省事，塞自定义 async generator 造半包/慢速/抛错剧本）；断言输出：stream/consumers 的 buffer()/text()（小流一把抓，本关 consumers 题的测试面）或 pipeline(underTest, collectTransform) 收集数组断言；大流断言「内存有界」：自定义 counting Writable 记录 write 峰值队列长度。错误传播测试：源 push Error（destroy(err)）→ 断言 pipeline 的 catch 收到同 err、所有中间流 destroyed=true（防「错误蒸发」回归）。超时：AbortSignal.timeout 传 pipeline（本关 signal 题的测试版）；fake timers 测节流/背压等待。反模式：断言事件顺序的每个细节（耦合实现）——断言「最终收到什么+错误落在哪」。工具链：node:test + 上述原语即可，不引第三方。

**来源**：Node stream/consumers 文档；Node-core-test 风格流测试示例（Readable.from + pipeline 错误注入）。
