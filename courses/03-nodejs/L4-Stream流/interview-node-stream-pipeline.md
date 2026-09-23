# node-stream-pipeline 面试题精选

> 共 15 题，覆盖 **pipe 的缺陷 / pipeline 语义 / 错误与资源清理 / finished 与 consumers / async 迭代与 Web 流 / 取消与实战** 六类。

---

## 一、pipe 的缺陷

### 1. `readable.pipe(writable)` 在错误处理上有什么问题？为什么生产代码不建议裸用 pipe？

`pipe` 只关心"把数据从源搬到目标 + 背压 + 自动 end"，**完全不碰 `'error'`**：

- 源流出错：error 沿源流自己 `emit('error')`，若你没给**源流**挂 `.on('error')`，就触发"未监听 error → 崩进程"（呼应 node-events 第三节）；
- 目标流出错：同理；
- 而且**一个流出错不会自动销毁另一个**：目标 `writable` 还开着 fd、源还在读，留下**半成品文件 + 句柄泄漏**。

于是你得给链上**每个**流手动挂 error、再手动 `destroy` 其余流——脆弱易漏。`pipeline` 把这些一次性解决（呼应 node-stream-pipeline 第一、二节）。

**来源**：Node.js — "pipe() error handling pitfalls"; 社区 — "why not use pipe / use pipeline (pump)"

---

## 二、pipeline 语义

### 2. `stream.pipeline` 做了哪几件 pipe 没做的事？

① **错误统一收口**：链上任意一环 emit error，最终回调 `callback(err)` **只被调用一次**、拿到首个错误；② **自动销毁**：无论成功或失败，所有参与的流都被 `destroy`（关闭 fd、断开 socket），不泄漏、不留半成品；③ 正常结束回调 `err` 为 `null`。它把"你本该手写的一堆 error 监听 + cleanup"封装成一行（历史上由 `pump` 库解决，现 Node 内建）。

**来源**：Node.js — "stream.pipeline(streams[, options], callback)"

### 3. `stream` 与 `stream/promises` 两个 `pipeline` 怎么选？

**功能等价，只是错误传递形式不同**：回调版 `pipeline(...s, cb)` 用 `(err)=>`；Promise 版 `await pipeline(...s)` 出错时 reject。既然全栈都在 async/await，**默认用 `stream/promises` 版**——能和外层 try/catch、`Promise` 组合、AbortController 的 `signal` 无缝协作，写起来的错误路径与业务代码一致（呼应 node-async-errors、node-stream-pipeline 第三节）。只有在"确实处于纯回调风格的老代码"里才用回调版。

**来源**：Node.js — "stream.promises.pipeline"

---

## 三、错误与资源清理

### 4. pipeline 中途失败时，已经写了一部分的 `out.gz` 会怎样？你要额外做什么？

pipeline 会**销毁写流**（fd 被关闭），但**磁盘上那个半成品文件不会被自动删除**——pipeline 管的是"流资源"，不是"业务产物"。所以你应在错误分支里 `fs.rm(tmpFile, {force:true})` 清理，或采用"**写临时文件 + 成功后 rename**"的原子写模式（呼应 node-fs 第 9 题、homework 挑战题），失败时临时文件直接丢弃、绝不污染正式路径。

**来源**：Node.js — "pipeline destroy semantics"; 社区 — "cleanup partial file on stream error"

### 5. 在一个 pipeline 里，如果某个自定义 Transform 的 `transform()` 回调了 `cb(err)`，会发生什么？

pipeline 会**立即停止喂新数据、把整条链上的所有流依次 `destroy`，然后让最终回调/Promise 收到那个 `err`**——不会继续往下游写、不会让别的流卡在等待。这就是把错误"抛给 pipeline"比"自己 `emit('error')` 却忘挂监听"安全得多的地方（呼应 node-streams interview 第 8 题、node-events 第三节）。写 Transform 时：**异步失败就把错误作为 `cb(err)` 的第一个参数回传**，pipeline 帮你收口。

**来源**：Node.js — "transform callback(err) / pipeline error propagation"

---

## 四、finished 与 consumers

### 6. `finished(stream)`（stream/promises）解决什么？它和 `await pipeline(...)` 有何分工？

`finished(stream)` 返回一个 Promise，在**单个流**结束（读端 `'end'` / 写端 `'finish'`，或出错 reject）时落定。用于你**不组整条管道**、只是"发起写操作 + 等它写完"的场景（如手动 `res.write(...)` 后等响应发完、`ws.end()` 后等文件写完）。而 `pipeline` 用于"把多个流串起来、一起等"。二者都会把 error 转成 reject，避免手写 `stream.on('finish', ...)` 又漏挂 `on('error', ...)`（呼应 node-stream-pipeline 第四节）。

**来源**：Node.js — "stream.promises.finished"

### 7. 什么时候该用 `stream/consumers`（buffer/text/json），什么时候不该？

当你**确实需要把整个流收成一个值**、且**数据量可控**时用 `consumers`——它们帮你正确收集 Buffer、用 StringDecoder 避免 utf8 分块乱码（`text`）、或直接 `json` 解析（呼应 node-buffer 第四节）。**不该用的场景**：数据可能很大（上传文件、导出报表）——`await text(stream)` 会把全量读进内存，等价于 readFile，OOM 风险回归（呼应 node-fs 第七节）。判据：**"最终产物是内存里的一个值 且 大小有上限"→ consumers；"边到边处理/落盘"→ pipeline**。

**来源**：Node.js — "stream.consumers (buffer/text/json)"

---

## 五、async 迭代与 Web 流

### 8. `for await (const chunk of readable)` 相比 `on('data')` 有什么好处？它会正确处理背压吗？

`for await` 把流当**异步可迭代对象**：每轮循环 `await` 到下一块才继续，**天然遵守背压**（你在循环体里处理慢，就不会向流要下一块），且能直接 `try/catch` 包裹整个消费过程统一处理错误与结束。相比 `on('data')`（事件回调式、要自己管 pause/drain 与 error），命令式 `for await` 可读性和错误处理都好得多。配合 `readline` 逐行处理大文件是经典组合（呼应 node-stream-pipeline 第六节、node-async-errors）。

**来源**：Node.js — "Readable as async iterable"; MDN — "for...await of"

### 9. Node 流和 Web Streams（`ReadableStream`）能互转吗？为什么这越来越重要？

可以：Node 17+ 提供 `readable.toWeb()` / `Readable.fromWeb(webStream)`（Duplex 同理）。意义在于 **fetch/Response、Service Worker、Deno/Bun/Cloudflare Workers、浏览器**用的是 WHATWG Web Streams，而 Node 传统用自身 Stream；跨运行时框架（Next.js/Nuxt 的 Edge runtime、流式 SSR）需要在两套流间桥接（呼应 07-nextjs、08-nuxt）。掌握互转让你在"Node 后端产生流 → 交给 Web 层/Response 消费"的链路里游刃有余（呼应 node-http、Express）。

**来源**：Node.js — "readable.toWeb / Readable.fromWeb"; WHATWG — "Streams API"

---

## 六、取消与实战

### 10. 客户端在下载中途断开连接，服务端怎么及时停止读盘/转发、避免资源浪费？

用 **AbortController**：给 `pipeline(read, ..., write, { signal })` 传 signal，并在监听到响应/写流的 `'close'`（客户端提前断开，`res.destroyed`/`writable.writableEnded` 为 false 时的 close）时 `controller.abort()`。pipeline 收到 abort 会**立即销毁所有流**（关闭读文件的 fd、停止继续读盘），Promise 以 `AbortError` reject，你在 catch 里判断是"正常取消"还是"真错误"。这比"任由源流把整个大文件读完写进一个已断开的连接"高效得多（呼应 node-stream-pipeline 第三节、node-deploy-perf graceful shutdown）。

**来源**：Node.js — "pipeline signal / AbortController"; 社区 — "client abort download node stream"

### 11. 设计一个"读取大 CSV → 逐行解析成对象 → 过滤 → 批量写库"的流管道，你会怎么搭？

```js
await pipeline(
  fs.createReadStream(file, { highWaterMark: 64*1024 }),
  new CsvRowTransform(),          // Transform: 缓冲残行、逐行吐对象（objectMode，呼应 node-streams 第六节）
  new FilterTransform(pred),      // Transform: 过滤/映射
  new async BatchWriteTransform({ size: 500 }),  // objectMode，攒 500 行一次 bulk insert，flush 里写剩余
);
```
要点：① **objectMode** 让中间环节处理"行对象"而非字节；② CSV 解析要处理"一行被 chunk 切断"（缓冲残行，`flush` 吐最后一段，呼应 node-buffer 第四节）；③ 批量写用攒批 + `flush` 收尾，别每条 await（吞吐）；④ 任一环节出错，pipeline 自动清理、`await` reject，外层 try/catch 统一处理（呼应第 5 题）。全程恒定内存、自动背压——DB 写慢会反向让读盘暂停。

**来源**：Node.js — "pipeline + Transform objectMode"; 社区 — "csv import node streams batch insert"

### 12. 你在 code review 里看到 `a.pipe(b).pipe(c)`，会建议改成什么、理由是什么？

建议改成 **`await pipeline(a, b, c)`**（`stream/promises`）。理由：① 裸 `pipe` 链上任一流出错都可能"无 error 监听崩进程"（呼应 node-events 第三节）或**静默泄漏**（fd/半成品文件未清）；② `pipe` 链的错误要你自己给每段补 `.on('error')` 且要手动 `destroy`，易漏；③ `pipeline` 一处收口错误、自动销毁所有流、Promise 化能与 async 上下文与 AbortController 协同（呼应第 2、3、5、10 题）。若必须用回调风格，退而用回调版 `pipeline`。这也是为什么老牌的 `pump` 最终被 Node 内建 `pipeline` 取代（呼应 node-stream-pipeline 第二节）。

**来源**：Node.js — "pipeline vs pipe recommendation"; 社区 — "replace pipe with pipeline"

---

## 补充（新专题 13-15）

### 13. pipe 到底漏在哪：用一个「读文件→gzip→写盘、中途磁盘满」的例子把错误路径走一遍。

ENOSPC 时 write 流 emit error：① 裸 pipe 链上只有 dest 知道错误，src 与 gzip 全被遗忘——它们继续读盘压缩，写端已 destroyed，数据进黑洞，无错误冒泡（监听 dest error 的救火代码漏挂 src=泄漏 FD）；② 无统一收尾：谁 destroy 谁？手工链要三层 each 挂；③ 背压与 error 竞态老实现行为不一致。pipeline 的对照：任一环节 error → **所有其他流 destroy**（传播方向定义好），promise reject 携带原始 err（cause 保留），结束保证每个流 close 后落定（本关「半写文件」题：还留 ENOSPC 时的 partial out——需要「要么完整要么没有」就 tmp+rename，pipeline 不代管原子性）。结论句：pipe 只转发数据与「dest 断供」，错误与生命周期归 pipeline。

**来源**：Node 官方《pipe 与 pipeline 对错误处理差异》文档示例；stream.promises.pipeline 错误语义说明。

### 14. 手写一个背压正确的 Transform（如按行切分），说明每个回调与状态机的责任。

骨架：_transform(chunk, enc, cb)：缓冲累积 remainder+=chunk.toString；while（含完整行且 this.push(line)===true）继续推；**this.push 返回 false 不是错误**——继续吃输入但停止再 push？不对：Transform 的正确姿势是照 push、由内部 writable 侧高水位自然让上游 read 停（push false 时可读侧挂起是 Duplex 读写两半的事）；行残段留 remainder。_flush(cb)：EOF 时把 remainder（无换行尾行）push 出去再 cb——漏 flush=最后一行蒸发（本关 CSV 题的经典失分点）。状态：跨块引号内换行（CSV 带引号）要 FSM 不能 split。测试剧本：单行多块/多块一行/无尾换行/多字节切断（用 string_decoder！本关 Buffer 题——TextDecoder({stream:true}) 或 StringDecoder 处理跨块 utf8）。纪律：cb 只调一次、错误 destroy(err) 而非 emit。

**来源**：Node Transform 文档（_transform/_flush 契约）；string_decoder 模块动机段。

### 15. 「大文件转码 pipeline」上线后内存锯齿飙升甚至 OOM，排查与修复路线图。

看形态：平稳高位=缓冲设计容量问题；**锯齿飙升**=背压断了某处。查：① 找「双速环节」——下游 I/O（网络/磁盘）抖动时上游仍以满速 push，谁在攒？在每段流挂 queueLength/write-call 统计（自定义 Transform 里 this.readableLength/ writableLength 打点）；② 定位常见元凶：collect 型 Transform（全进一出=缓冲无界，转码里「整段缓冲」是反模式）、事件桥（data 里 async 处理不 await 即 fire-and-forget）、外部 API 上传不 await（本关 S3 题）；③ 工具：--trace-gc + heap 采样看 ArrayBuffer 去向（external）、clinic heap 看闭包。修：无界点改 Writable 攒批+await、加 highWaterMark 显式、并发上传用 p-limit 入 pipeline 内、给整链超时/AbortSignal。验收：抖动注入测试（下游人为 sleep(5s)）峰值有界。制度：流式作业上线前必测「下游停顿」场景——没测过背压的流等于没写完。

**来源**：Node《Backpressuring in Streams》官方指南；clinic.js heap 分析文档。
