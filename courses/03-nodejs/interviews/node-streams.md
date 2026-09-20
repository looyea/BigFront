# node-streams 面试题精选

> 共 12 题，覆盖 **流的本质与分类 / 读模式与事件 / 写与 finish / 背压与 highWaterMark / Transform 与 objectMode / 实战与陷阱** 六类。

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
