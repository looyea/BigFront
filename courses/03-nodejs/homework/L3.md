# L3 课后作业：文件系统与二进制

> 覆盖 **node-fs / node-path-url / node-buffer** 三关。先读代码判断输出/找 bug，再动手写，最后场景与简答。环境：Node 20+。

---

## 一、读代码，找 bug / 预测输出（10 小题）

**1.** 指出这段服务端代码的问题并说明后果：
```js
app.get("/cfg", (req, res) => {
  const data = fs.readFileSync("config.json", "utf8");  // ← ？
  res.json(JSON.parse(data));
});
```

**2.** 输出什么？
```js
const b = Buffer.from("a中", "utf8");
console.log(b.length, [..."a中"].length);
```

**3.** 为什么这段读图片再写回会损坏文件？
```js
const img = fs.readFileSync("logo.png", "utf8");
fs.writeFileSync("copy.png", img);
```

**4.** 打印什么？
```js
console.log(path.join("/etc", "..", "usr", "./bin"));
console.log(path.resolve("src", "index.js"));   // 假设 cwd = /proj
```

**5.** 一个 ESM 模块 `lib/run.mjs` 里写：
```js
const cfg = fs.readFileSync(path.join(process.cwd(), "cfg.json"));
```
换到别的目录用 `node /proj/lib/run.mjs` 启动就 ENOENT，为什么？怎么改？

**6.** 预测：
```js
const pkt = Buffer.alloc(4);
pkt.writeUInt32BE(256, 0);
console.log(pkt.toString("hex"), pkt.readUInt32LE(0));
```

**7.** 这段解析 query 有什么隐患？
```js
const q = req.url.split("?")[1].split("&")
  .map(kv => kv.split("=")).reduce((a,[k,v])=>(a[k]=v,a),{});
// 请求：/?a=1&a=2&name=%E4%B8%AD&flag
```

**8.** 输出什么？
```js
const u = new URL("/search?q=x", "https://api.demo");
console.log(u.href, u.searchParams.get("q"));
new URL("/a");   // ← 这行为什么抛错？
```

**9.** 会发生什么？
```js
const x = Buffer.allocUnsafe(4);
console.log(x);
```
和 `Buffer.alloc(4)` 的区别？

**10.** 这段有什么问题（关于内存/共享）？
```js
const big = Buffer.from("h中a", "utf8");
const view = big.subarray(1, 3);
view[0] = 0x41;              // 写视图
console.log(big.toString("utf8"));   // ？
```

---

## 二、手写编程题（5 题）

**11.** 用 `fs.promises` 写 `walk(dir)` 递归列出目录下所有文件的**绝对路径**（用 `readdir({withFileTypes:true})` + `path.join`，别对每项 `stat`）。

**12.** 写 `readJsonSafe(path, fallback)`：读并 `JSON.parse`，用 `err.code` 区分——`ENOENT` 返回 `fallback`，`SyntaxError` 抛带 `{ cause }` 的新错误，其它错误原样上抛（呼应 node-fs 第 11 题、node-async-errors）。

**13.** 在 ESM 里，基于**当前模块文件位置**（而非 cwd）解析出同目录 `data/sample.json` 的绝对路径，写成一个可复用片段（`fileURLToPath` + `path`）。

**14.** 用 `node:url` 与 `URLSearchParams` 实现 `buildSearch(base, params)`：给定 `base` 与 `{q, tags:[..], page}`，返回拼好且正确编码的完整 URL（`tags` 用多个同名参数）；再写 `parseSearch(urlStr)` 还原成对象（用 `getAll`）。

**15.** 实现第 六节的**长度前缀分帧**：`encodeFrame(str)` 与一个**流式** `FrameParser`——它内部维护缓冲，`push(chunk)` 喂入任意切分的 Buffer 块，每凑齐一完整帧就回调 `onFrame(str)`，正确处理粘包/拆包（用 `readUInt32BE` + `subarray`，注意别共享污染）。

---

## 三、场景题（1 题）

**16.** 你要写一个把**任意大小 CSV 上传文件**转成 JSON 行的 CLI 工具，运行在受限内存的容器里。有人提议：
```js
const text = await readFile(uploadPath, "utf8");
const rows = text.split("\n").map(parseRow);
writeFileSync(outPath, JSON.stringify(rows));
```
请回答：
- (a) 这个方案在"文件 5GB"时会出什么问题？（呼应 node-fs 第七节、node-buffer）
- (b) 若改成流式读，为什么"按字节切块 + `chunk.toString('utf8')` 逐块解码"可能出现乱码？怎么解决？（呼应 node-buffer 第四节、StringDecoder）
- (c) `outPath`、`uploadPath` 从用户参数来，拼路径时要注意什么安全风险？怎么防？（呼应 node-path-url 第 11 题）

---

## 四、简答题（3 题）

**17.** `path.join` 与 `path.resolve` 区别？`process.cwd()` 与 `__dirname`/`import.meta.url` 区别，以及"库定位自身资源"该用哪个、为什么？（呼应 node-path-url 第二、三节）

**18.** 解释 `Buffer.alloc` vs `allocUnsafe` 的安全差异，以及 `b.length` 为什么不能当"字符数"用（举 `Content-Length` 的例子）。（呼应 node-buffer 第二、五节）

**19.** 用一句话分别说清：`fs.readFile` / `createReadStream` / `open+read 到定长 Buffer` 三种读取方式各自的内存模型与适用场景。（呼应 node-fs 第 8 题）

---

## 五、挑战题 🏆

**20.** 🏆 手写一个 `safeCopy(src, dest)`，要求：
- 用**流**（`createReadStream`/`createWriteStream`）拷贝任意大小文件，内存恒定；
- 拷贝到**临时文件**再 `fs.rename` 原子落位，避免读者读到半截（呼应 node-fs 第 9 题）；
- 用 `events.once` 或 `stream/promises.pipeline` 统一收口 `'error'`（绝不出现"没挂 error 监听导致崩溃"，呼应 node-events 第三节）；
- `dest` 所在目录不存在时自动 `mkdir -p`（`recursive`）；
- 出错时清理临时文件、并抛出带 `{ cause }` 的错误。
写完用一个大文件（几百 MB）验证：任务管理器里 node 进程内存应稳定在几 MB 级，而非随文件大小增长。
