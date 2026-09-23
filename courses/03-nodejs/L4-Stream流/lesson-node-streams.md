# Stream 基础：读、写、转换

> 目标：理解 Node 最强大的抽象之一——**流**。它是"随时间到达的数据序列"，让你以**恒定内存**处理任意大小的数据（正面兑现 node-fs 第七节"大文件不能整读"的承诺）。掌握四种流（Readable / Writable / Duplex / Transform）、事件（`data`/`end`/`error`/`close`）、两种读模式（**flowing vs paused**）、`highWaterMark` 与 **背压（backpressure）** 的本质，以及 `objectMode`。流是 EventEmitter（呼应 node-events）、数据块是 Buffer（呼应 node-buffer），HTTP/fs/zlib 全靠它。

---

## 一、流是什么，为什么省内存

`readFile` = "把所有字节一次性搬进内存再给你"。`stream` = "给你一条传送带，数据一小段一小段（chunk）到达，处理完一段丢一段"。内存里任何时刻只驻留约一个 chunk，所以 **10GB 文件和 10KB 文件占用内存几乎一样**。四类：

| 类型 | 方向 | 例子 |
| --- | --- | --- |
| **Readable** | 读（数据流出） | `fs.createReadStream`、`req`、`process.stdin` |
| **Writable** | 写（数据流入） | `fs.createWriteStream`、`res`、`process.stdout` |
| **Duplex** | 双向独立 | `net.Socket`、`zlib` |
| **Transform** | 双向且"输出是输入的变换" | `zlib.createGzip`、加密流、`crypto.createHash` |

Duplex = Readable + Writable 两端互不影响；Transform 是"写进去的会变换后从读出端冒出来"的特殊 Duplex。

---

## 二、Readable：两种消费模式

### 2.1 flowing（自动全速吐数据）

一旦 `on('data')`（或 `resume()`），流进入"流动模式"，把数据**尽可能快**地一块块推给你：

```js
const rs = fs.createReadStream("big.txt", "utf8");
rs.on("data", (chunk) => process.stdout.write(chunk));  // 每来一块触发
rs.on("end", () => console.log("\n读完"));               // 正常结束（非 error）
rs.on("error", (e) => console.error(e));                 // ★ 必须挂（呼应 node-events）
```

### 2.2 paused（手动拉取）

不挂 `data`、只用 `read()`：适合"我要按自己的节奏取"（背压场景的基础）。

```js
let chunk;
while ((chunk = rs.read()) !== null) handle(chunk);   // 内部缓冲有货才给
rs.on("readable", () => { /* 可读，自行 read */ });
```

**关键事件语义**：`'end'` 只在**正常读完**触发；`'close'` 表示资源释放（呼应 node-events 第六节）；`'error'` 一旦发生流即终止。**`data` 与 `readable` 二选一**，混用会行为怪异。

---

## 三、Writable 与"写完再说"

```js
const ws = fs.createWriteStream("out.txt");
const ok = ws.write("第一块\n");      // 返回 boolean：是否还能继续无脑写
if (!ok) { /* 缓冲区已满，等 'drain' 再写（见背压） */ }
ws.end("最后一块", () => console.log("全部落盘完成"));  // end = 写完这几块就关闭
ws.on("error", console.error);
```

- `write(chunk)` 把数据放进**内部缓冲队列**，立即返回 `true`（还没写满）或 `false`（缓冲超阈值，即 `highWaterMark`）；
- `end()` 表示"我写完了，可以关闭"，可带最后一块与回调；
- **`'finish'` 事件**：所有 `write` 的数据已交给底层 OS（`res` 发完、文件写完）才触发——注意它和 Readable 的 `'end'` 是两回事。

---

## 四、Transform：链式加工

Transform 有进有出，中间做变换，最适合串成"流水线"：

```js
const { createGzip } = require("node:zlib");
const upper = new (require("node:stream").Transform)({
  transform(chunk, enc, cb) {           // 每块进来，加工后 push 出去
    cb(null, chunk.toString().toUpperCase());
  },
});
src.pipe(upper).pipe(gz).pipe(dest);    // pipe 串接（错误处理缺陷见下一关 pipeline）
```

典型 Transform：`zlib`（压缩/解压）、`crypto` 加解密、`StringDecoder`（utf8 分块解码，呼应 node-buffer 第四节）、CSV 解析、JSON 转行。

---

## 五、highWaterMark 与背压（本关灵魂）

**问题**：读得快、写得慢怎么办？若 Readable 无脑全速推，Writable 处理不过来，数据就会**在内存里堆积**（缓冲暴涨 → OOM）。

**背压机制**：每个流内部有一段缓冲，上限由 `highWaterMark` 决定（字节流默认约 16KB，`objectMode` 默认 16 个对象）。

- Writable 缓冲满（`write()` 返回 `false`）→ 通知上游"**慢点，别写了**"；
- `pipe` 会自动遵守这个信号：暂停读，等 Writable 清空缓冲发出 **`'drain'`** 事件后再继续写；
- 于是"快的读端"被"慢的写端"反向节流，整条链内存恒定。

```js
// 手动写一个遵守背压的循环（理解原理用；实际请优先 pipeline，见下一关）
function pump(readable, writable) {
  readable.on("data", (chunk) => {
    if (!writable.write(chunk)) readable.pause();   // 满了就先暂停读
  });
  writable.on("drain", () => readable.resume());    // 缓冲腾空再继续
  readable.on("end", () => writable.end());
}
```

一句话：**背压 = 下游用 `write()` 的 `false` + `'drain'` 告诉上游"缓一缓"，`pipe`/`pipeline` 帮你自动做这件事。** 忘了处理 `false` 而自己 `write` 到底，就是流版 OOM。

---

## 六、objectMode：流里跑对象而非字节

设 `{ objectMode: true }` 后，流搬运的是任意 JS 对象/字符串，不再是 Buffer；`highWaterMark` 含义变成"最多缓冲多少个对象"（默认 16）。适合"逐条记录"型管道：`readline` 按行产出字符串、解析器产对象、转换器消费对象（呼应 node-line 场景、L3 的 CSV 转 JSON）。注意：objectMode 下 `write(chunk)` 的 `chunk` 不能是 `null`（保留给 EOF 语义）。

---

## 七、`pipe` vs 手写 vs `pipeline`

`src.pipe(dest)` 帮你自动处理背压与 `end`，比手写 `on('data')+write` 安全得多。但它有个**致命缺陷**：**不传播 `'error'`**——`src` 出错时你只 `pipe` 到 `dest`，若没单独给 `src.on('error')`，错误要么漏掉、要么（若是 `'error'` 事件无监听）直接崩进程（呼应 node-events 第三节）。要"一条链上任何一环 error 都能被统一捕获、且资源都被正确关闭"，得用 **`stream.pipeline` / `stream/promises` 的 `pipeline`**——这正是下一关的主角。

---

## 八、自检清单

- [ ] 四种流分别是什么方向？Duplex 和 Transform 差别？
- [ ] flowing 与 paused 模式怎么切换？`data` 和 `readable` 能混用吗？
- [ ] Writable 的 `'finish'` 和 Readable 的 `'end'` 分别何时触发？
- [ ] `highWaterMark` 限的是什么？`write()` 返回 `false` 意味着什么、之后该做什么？
- [ ] 背压用哪两个信号实现？`pipe` 如何自动遵守？
- [ ] `objectMode` 下 `highWaterMark` 单位变了没？

---

## 🚀 部署预告

- 本关结尾埋的"`pipe` 不传播 error"这颗雷，下一关 **node-stream-pipeline** 用 `pipeline` 彻底拆除（统一错误 + 自动清理资源）；
- 流分块切断多字节字符的乱码，用 `StringDecoder`/Transform 解决（呼应 node-buffer 第四节）；
- `req`/`res` 就是流，HTTP 大文件下载、上传转发在 **node-http**、**Express L3 上传**里天天用（呼应）；
- 没消费的流/没关的 fd 是活跃句柄，会让进程不退出、句柄泄漏，回扣 **node-fs** 与 **node-deploy-perf**。

下一关进入 **node-stream-pipeline**：`pipe` 的坑与 `pipeline` 的组合艺术。
