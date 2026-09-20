# L6 课后作业：并发与多进程

> 覆盖 **node-child-process / node-cluster / node-workers** 三关。先读代码/找 bug，再动手写，最后场景与简答。环境：Node 20+。

---

## 一、读代码，找 bug / 预测（10 小题）

**1.** 这段执行图片转换有什么安全隐患？怎么改？
```js
app.get("/thumb", (req, res) => {
  exec(`convert ${req.query.file} -resize 200x thumb.png`, cb);
});
```

**2.** 输出预测 / 潜在问题：
```js
const { exec } = require("node:child_process");
exec("find /", (err, stdout) => console.log(stdout.length));
```
> 大输出时会发生什么？该换成哪个 API？（呼应 node-child-process 第二、三节）

**3.** 下面 `on("exit")` 里的 `fs.readFileSync(child.stdout...)` 为什么可能读不全？该等哪个事件？
```js
child.on("exit", () => { /* 处理子进程输出 */ });
```

**4.** 这个 cluster 代码有什么问题？worker 数会不会保持稳定？
```js
if (cluster.isPrimary) {
  for (let i = 0; i < os.cpus().length; i++) cluster.fork();
} else { http.createServer(handler).listen(3000); }
```

**5.** 判断对错并说明理由：
> "8 个 worker 都 `listen(3000)`，第 2 个开始会 EADDRINUSE 崩掉。"

**6.** 这段 worker 通信为什么拿不到结果？
```js
// main
const w = new Worker("./w.js");
w.on("message", (fn) => fn(5));            // worker postMessage 了一个函数
```

**7.** 找出问题：想让主线程"看到" worker 对 `obj.count` 的累加
```js
const obj = { count: 0 };
w.postMessage(obj);        // worker 里 obj.count++ 后……
console.log(obj.count);    // 主线程
```
> 要真正共享计数该怎么写？（呼应 node-workers interview 第 11 题）

**8.** 这段 CPU 密集代码为什么让接口全部变慢？挪到哪里合适？
```js
app.get("/hash", (req, res) => res.end(String(hugeSyncLoop(req.query.n))));
```

**9.** `Atomics` 缺失时的 bug：两个 worker 都对同一 `Int32Array[0]` 做 `i[0]++`，结果可能小于预期，为什么？该用什么？

**10.** 这段"给子进程喂输入"有什么问题？
```js
const cat = spawn("cat");
cat.stdin.write("hi\n");
// 忘记 end()，会发生什么？
```

---

## 二、手写编程题（5 题）

**11.** 用 `execFile`（**不经 shell**）实现"安全地取 `git log -n <num>`"：`num` 来自用户，需保证无法注入（提示：参数数组 + 校验 num 为整数）。再写一个用 `exec` 拼接的**反面版本**并说明会怎样被 `; rm -rf` 攻击（呼应 node-child-process 第二节）。

**12.** 用 `fork` 做一对父子：父 `send({n})`，子算 `n` 以内素数个数并 `process.send` 回来；父处理多个并发任务后正确 `kill` 所有子进程、让父进程能退出（呼应 node-child-process 第五节、interview 第 10 题）。

**13.** 用 `cluster` 写一个最小多核 HTTP 服务：primary 按 `os.cpus().length` fork，`'exit'` 里自动补位；worker 里 `listen(3000)` 返回 `process.pid`。用 `autocannon`/压测观察多核利用率，并 kill 掉一个 worker 验证自愈。

**14.** 用 `worker_threads` 把**第 8 题的 hugeSyncLoop** 改写为非阻塞：主线程 `postMessage` 下发、worker 算完回传；用 `transferList` 把一个 100MB `ArrayBuffer` 零拷贝交给 worker 求和，对比"拷贝 vs transfer"的耗时（呼应 node-workers 第三节）。

**15.** 用 `SharedArrayBuffer` + `Atomics.add` 让 4 个 worker 并发对同一计数器各加 1e6，验证最终结果恰为 4e6；再故意去掉 Atomics 改成 `i[0]++` 复现竞态（呼应 node-workers interview 第 7 题）。

---

## 三、场景题（1 题）

**16.** 你的图像处理 API 既有很多并发上传（I/O 密集），单张图又要跑 2~3 秒的同步压缩（CPU 密集），部署在单机 16 核、前面有 Nginx。请给出并发架构方案并说明理由：
- (a) 用不用 cluster？为什么？几个进程？（呼应 node-cluster）
- (b) 那张图的压缩放哪？worker_threads 还是 child_process？要不要线程池？（呼应 node-workers）
- (c) 上传临时文件与压缩结果落盘，如何用流避免爆内存？（呼应 node-stream-pipeline）
- (d) 发布新版本时如何不切断在途请求？（呼应 node-cluster interview 第 10 题、node-deploy-perf）

---

## 四、简答题（3 题）

**17.** 一句话分别说清 `spawn`/`exec`/`execFile`/`fork` 的定位；`'exit'` 与 `'close'` 区别。（呼应 node-child-process 第一、三节）

**18.** cluster 里多 worker "共享一个端口"的本质是什么？分发是"连接级"还是"请求级"，这对写 session 有什么影响？（呼应 node-cluster 第三、四节）

**19.** 比较 child_process / cluster / worker_threads 三者在"内存是否共享、崩溃影响范围、启动开销、适用负载"四个维度的差异。（呼应三关第七/八节）

---

## 五、挑战题 🏆

**20.** 🏆 实现一个**通用线程池**（不借助 piscina）：
- 启动时创建 N 个 worker 常驻（队列 + 空闲 worker 复用，呼应 node-workers 第六节）；
- 暴露 `run(taskFile, data): Promise`——空闲时直接派发，忙时排队，worker 出错要能 reject 并**替换**该 worker（呼应 node-workers interview 第 12 题）；
- 支持 `transfer` 传 ArrayBuffer 加速大数据；
- `destroy()` 优雅关闭全部 worker（等在途任务 drain）；
- 用第 14/15 题的压缩/计数任务压测，贴出吞吐与主线程事件循环延迟前后对比（呼应 node-event-loop、node-deploy-perf）。
