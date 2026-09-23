# 组合流与背压：pipe 与 pipeline

> 目标：把上一关埋的雷彻底拆除——**为什么裸 `pipe` 不够安全，`stream.pipeline` / `stream/promises` 的 `pipeline` 才是生产级组合流的方式**。讲清 `pipe` 的错误处理缺陷、`pipeline` 的"任一环节 error 统一回调 + 自动销毁所有流 + Promise 化"、`stream/consumers` 把流收成字符串/Buffer，以及 `finished()` 这个小工具。这是把 fs/zlib/http/crypto 串成健壮数据管道的最后一块拼图（呼应 node-streams、node-events 第三节、node-async-errors）。

---

## 一、`pipe` 到底错在哪

`src.pipe(a).pipe(b).pipe(dest)` 优雅地处理了背压和 `end`，但**错误是黑洞**：

```js
fs.createReadStream("missing.txt")
  .pipe(zlib.createGzip())
  .pipe(fs.createWriteStream("out.gz"));
// 若源文件不存在 → 源流 emit('error')
//   · 这个 error 不会顺着 pipe 往下传
//   · dest 不会收到、也不会被关闭 → out.gz 留一个空/半成品文件在磁盘
//   · 若你没给『源流』单独挂 .on('error') → 'error' 无人监听 → 进程崩（呼应 node-events 第三节）
```

要自己补，得给**链上每一个流**都挂 error 监听、还要手动 `destroy` 其它流、删半成品文件——极其繁琐易漏。这正是 `pipeline` 存在的理由。

---

## 二、`stream.pipeline`：错误与资源的统一收口

`pipeline(...streams, callback)` 把一串流接起来，并保证：

1. **任一环节出错，callback 只被调用一次、拿到那个 error**；
2. **所有流都会被自动 `destroy`**（不会泄漏 fd、不留挂起 socket）；
3. 正常完成时 callback 收到 `err === null`。

```js
import { pipeline } from "node:stream";
import fs from "node:fs";
import zlib from "node:zlib";

pipeline(
  fs.createReadStream("input.txt"),
  zlib.createGzip(),
  fs.createWriteStream("output.txt.gz"),
  (err) => {
    if (err) {
      console.error("管道失败，所有流已清理", err);   // ★ 一处收口所有错误
      // 不会出现"写了半个 out.gz 还开着 fd"的情况
    } else {
      console.log("完成");
    }
  }
);
```

对比 `pipe`：错误不黑洞、资源不泄漏。这就是社区长期推荐 `pipeline` 取代 `pipe` 的原因（也是 `pump` 库要解决的问题，Node 已内建）。

---

## 三、`stream/promises`：用 await/async-await 写管道

回调版仍要嵌一层。Node 15+ 提供 **`stream/promises` 的 `pipeline`，返回 Promise**——错误直接走 `reject`，能 `await`、能被外层 `try/catch` 抓（呼应 node-async-errors 第一、三节）：

```js
import { pipeline } from "node:stream/promises";

async function compress(src, dst) {
  await pipeline(
    fs.createReadStream(src),
    zlib.createBrotliCompress(),
    fs.createWriteStream(dst),
  );                       // 任一环节 error → 这个 await 抛出 → 外层 try/catch 抓
  console.log("完成");      // 全部 finish 才走到这
}
try { await compress("a.txt", "a.txt.br"); }
catch (e) { console.error("失败", e); }   // 统一的 async 错误路径
```

还能在中间插**自定义 Transform**（异步转换），并传 `{ signal }` 支持 `AbortController` 取消（呼应 Express L6、node-deploy-perf 的优雅中止）。这是当下组合流的**默认写法**。

---

## 四、`finished()`：await 一个流结束

`stream/promises` 还有 `finished(stream)`，返回 Promise，在流 `'end'`/`'finish'`（或 `'error'`）时落定。适合"我只关心某个流何时写完/读完"，而不组整条管道：

```js
import { finished } from "node:stream/promises";
const ws = fs.createWriteStream("x");
ws.write("hello");
ws.end();
await finished(ws);      // 等真正落盘（等价于 await 'finish'，且会转发 error）
```

用它替代"手写 `ws.on('finish', ...)` 再包 Promise"，且自动处理 error 分支（呼应第 三节收口理念）。

---

## 五、`stream/consumers`：把流收成一个值

有时你确实需要"最终整个结果"（小数据）。`stream/consumers` 提供把 Readable 一次性消费为 Promise 的工具，且**内部已正确收集 Buffer/处理编码**：

```js
import { Readable } from "node:stream";
import { buffer, text, json } from "node:stream/consumers";

const buf  = await buffer(readable);     // Buffer.concat(所有块)
const str  = await text(readable);       // 按 utf8 拼接（内部用 StringDecoder，避免分块乱码，呼应 node-buffer 第四节）
const data = await json(someRespStream);// 收文本再 JSON.parse
```

它们和 `readable.toArray()`、Web 的 `Response.text()` 一脉相承。要点：**只在数据量可控时用**——否则又回到 readFile 式的全量内存（呼应 node-fs 第七节）。

---

## 六、Readable.from / toWeb：与迭代器、Web 流互转

```js
import { Readable } from "node:stream";
const rs = Readable.from(["ab", "cd"]);         // 从数组/生成器/异步迭代器造可读流
for await (const chunk of rs) console.log(chunk); // 流可用 for-await 消费（async 迭代）

const web = rs.toWeb();   // Node Readable ↔ Web ReadableStream（呼应 fetch、Deno/Browser）
const back = Readable.fromWeb(web);
```

`for await...of` 消费流自带背压语义（每轮迭代读完才要下一块），是"逐行处理大文件"的优雅写法（配合 `readline`）。`toWeb/fromWeb` 在跨运行时（Node/浏览器/Edge）传流时越来越常见（呼应 07-next SSR、node-http）。

---

## 七、把两关串起来：一个健壮的大文件处理模板

```js
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import fs from "node:fs";
import zlib from "node:zlib";

async function processLarge(input, output) {
  const countLines = new Transform({
    transform(chunk, _enc, cb) { this.push(chunk); cb(); },  // 示例：透传（真实里在此统计）
  });
  await pipeline(
    fs.createReadStream(input, { highWaterMark: 64 * 1024 }), // 块大小可按 I/O 调
    countLines,                                              // 自定义加工（Transform，呼应 node-streams 第四节）
    zlib.createGzip(),                                       // 压缩
    fs.createWriteStream(output),
  );   // ← 任一环节抛错：自动销毁全部流、此 await reject、外层 try/catch 收
}
```

三条铁律收尾：**① 组合流一律用 `pipeline`（Promise 版），别用裸 `pipe`；② 错误在链尾一处收口、资源交给 pipeline 自动清理；③ 只有小数据才用 `consumers`/`readFile` 收成整块。**

---

## 八、自检清单

- [ ] 裸 `pipe` 在"源流出错"时会引发哪两类问题？
- [ ] `pipeline` 相比 `pipe` 多保证了我什么（错误 + 资源）？
- [ ] `stream/promises.pipeline` 返回什么？错误走哪条路？
- [ ] `finished()` 用来替代什么手写模式？
- [ ] `stream/consumers` 的 `text()` 为什么不会分块乱码？何时不该用它？
- [ ] `for await (const c of readable)` 消费流有什么好处？

---

## 🚀 部署预告

- 本关的"HTTP 请求/响应即流、用 pipeline 转发上传/下载"会在 **node-http** 与 **Express L3 上传 / L8 性能**里落地（呼应）；
- `AbortController`+`{ signal }` 取消流，与 **node-deploy-perf** 的 graceful shutdown（收到 SIGTERM 停止接新流、drain 现有流）同源（呼应 node-events 部署预告）；
- zlib/crypto Transform 串接，是 **node-https-tls** 之外"内容压缩中间件"的底层（呼应 Express L8）；
- 恒定内存处理大文件的整条链路（fs→buffer→streams→pipeline）到本关闭环，回扣 **node-fs、node-buffer、node-streams**。

下一关进入 **node-net-dns**：从 TCP/UDP 字节流理解"网络协议"的地基。
