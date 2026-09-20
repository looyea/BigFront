# L4 课后作业：Stream 流

> 覆盖 **node-streams / node-stream-pipeline** 两关。先读代码找 bug / 预测，再动手写，最后场景与简答。环境：Node 20+。

---

## 一、读代码，找 bug / 预测（10 小题）

**1.** 这段有什么问题？（关于错误与资源）
```js
fs.createReadStream("nope.txt").pipe(fs.createWriteStream("copy.txt"));
```

**2.** 输出顺序大概是？`read` 是整块还是分块？
```js
const rs = fs.createReadStream("a.txt"); // 文件 40KB，默认 highWaterMark≈16KB
let n = 0;
rs.on("data", () => n++);
rs.on("end", () => console.log("chunks:", n));
```

**3.** 为什么这段可能内存爆掉？
```js
const ws = fs.createWriteStream("out.txt");
for (let i = 0; i < 1e7; i++) ws.write(line(i));   // 从不检查返回值
```

**4.** 判断对错并说明：
```js
ws.on("finish", () => console.log("文件已可读，写完"));
ws.end("x");
```
> `'finish'` 触发时数据一定已经 flush 到磁盘了吗？

**5.** 这一段有什么"消费模式混用"的问题？
```js
rs.on("data", h1);
rs.on("readable", () => rs.read());
```

**6.** 预测：`src.pipe(a).pipe(b)` 中若 `a` 的 transform 回调 `cb(new Error('x'))`，`b` 会收到这个 error 吗？`src`、`b` 会被关闭吗？（对比 `pipeline(src,a,b)`）

**7.** 输出什么？
```js
const { Readable } = require("node:stream");
const r = Readable.from(["a", "b", "c"]);
r.on("data", (c) => process.stdout.write(c));
r.on("end", () => console.log("|done"));
```

**8.** 这两行有区别吗？各何时用？
```js
await pipeline(read, gzip, write);
await finished(write);   // 假设 write 已在别处被写
```

**9.** 为什么不该用 `await text(hugeUploadStream)` 处理用户上传？
（呼应 node-fs 第七节、node-stream-pipeline 第五节）

**10.** 逐块解码乱码：
```js
for await (const chunk of readUtf8Stream) {
  out += chunk.toString("utf8");   // 若某块切在多字节字符中间？
}
```
> 这样会乱码吗？如果会，改用哪种已学过的方式？

---

## 二、手写编程题（5 题）

**11.** 写一个 **大写转换器** `upper()`（自定义 Transform）：把每个 chunk 转大写透传。用 `pipeline(createReadStream(in), upper(), createWriteStream(out))` 完成一次文件转换，并 `try/catch` 处理源文件不存在的错误。

**12.** 用 `for await (const chunk of rs)` 实现 `countBytes(path)`：统计文件字节数，要求恒定内存（不许 `readFile`）。再改成统计**行数**（提示：处理"最后一行没有换行结尾"）。

**13.** 实现 `hashFile(path)`：用 `pipeline` 把 `fs.createReadStream(path)` 接进一个"累加型" Transform，或在 `'data'` 里 `crypto.createHash('sha256').update(chunk)`，结束时输出 hex 摘要。（对比：能否直接 `pipeline(read, hash)` 后拿结果？体会 Transform 的 `flush`）

**14.** 写一个遵守背压的**生产者**：向一个慢速 Writable 写入 100 万行，要求**当 `write()` 返回 false 时暂停生产、等 `'drain'` 再继续**（手写 `pump` 逻辑），并用一行注释解释为什么不能无脑 for 循环 write。

**15.** 给第 11 题的 `pipeline` 加一个 `AbortController`：3 秒后 `abort()`，观察 Promise 以 `AbortError` reject，并在 catch 里区分"取消"与"真错误"，同时确保读流 fd 被关闭（可用 `--trace` 或验证进程能正常退出）。

---

## 三、场景题（1 题）

**16.** 需求：把服务器上一个可能 **几十 GB** 的 `.log` 文件，过滤出含 `ERROR` 的行，压缩成 `errors.gz` 提供下载。有人写了：
```js
const data = fs.readFileSync("huge.log", "utf8");
const lines = data.split("\n").filter(l => l.includes("ERROR")).join("\n");
fs.writeFileSync("errors.tmp", lines);
fs.renameSync("errors.tmp", "errors.gz");   // 还以为是压缩
```
请回答：
- (a) 至少指出 3 个严重问题（内存、"压缩"其实没压、原子写用错、同步阻塞……）；（呼应 node-fs 第一/七节、node-streams）
- (b) 用 `stream/promises` 的 `pipeline` 重写成恒定内存、真正 gzip 的版本，写出流的串接顺序；
- (c) 如果客户端下到一半断开，你怎么让服务端**立刻停止读盘**、不泄漏 fd？（呼应 node-stream-pipeline 第 10 题）

---

## 四、简答题（3 题）

**17.** 解释"背压"：`write()` 返回 `false` 和 `'drain'` 各自含义，`pipe`/`pipeline` 如何据此自动节流上游？（呼应 node-streams 第五节）

**18.** `pipeline` 相比 `pipe` 多解决了哪两件事？为什么说它把"错误黑洞 + 资源泄漏"一次修好？（呼应 node-stream-pipeline 第二、三节）

**19.** Readable 的 `'end'`、Writable 的 `'finish'`、以及通用的 `'close'` 分别在何时触发？`objectMode` 下 `highWaterMark` 的含义有何变化？（呼应 node-streams 第二、三、六节）

---

## 五、挑战题 🏆

**20.** 🏆 实现一个 `batch(stream, size, ms)` 异步生成器（或 Transform），把上游的 **objectMode 流**按"每 `size` 条 **或** 距上次 flush 超过 `ms` 毫秒（以先到者为准）"聚成数组批次 yield 出来，用于"攒够一批就 bulk 写库、但低峰期也别让数据等太久"。要求：
- 正确遵守背压（消费者处理慢时不要在上游无限攒）；
- 流结束时（`'end'`）用定时器兜底把**最后不足一批的残余**也吐出来（别丢数据，呼应 Transform 的 `flush`）；
- 清理所有 `setTimeout`，不留活跃句柄导致进程不退出（呼应 node-event-loop、node-fs 第六节）。
写一个用 `Readable.from(异步生成器)` + `for await` 消费的验证脚本，打印每批大小与时间间隔。
