# node-fs 面试题精选

> 共 15 题，覆盖 **三形态取舍 / 编码与 Buffer / 目录与元信息 / 文件描述符与资源 / 大文件与流 / 权限与原子写** 六类。

---

## 一、三形态取舍

### 1. `fs` 的同步、回调、Promise 三种 API 分别在什么场景用？为什么服务端不该用同步版？

- **同步 `*Sync`**：阻塞直到完成，占死事件循环（poll 阶段不返回，所有并发请求停摆，呼应 node-event-loop）。只适合**进程启动阶段**（读配置）、**一次性脚本/CLI**（主逻辑开始前，无并发可言）。
- **错误优先回调**：Node 早期异步范式，`cb(err, data)`，维护老代码会遇到（呼应 node-async-errors 第二节）。
- **`fs.promises`**：现代首选，能 `await`+`try/catch`、能和 `Promise.all` 组合并行。
一句话：**"有并发/在请求路径" → 异步；"启动/脚本一次性" → 才考虑同步**。在服务里对慢盘用同步读=给整个服务按暂停键。

**来源**：Node.js — "File system / fs.promises vs sync"; 社区 — "why not use readFileSync in a server"

### 2. `fs.promises` 和 `require('util').promisify(fs.readFile)` 有什么区别？该用哪个？

`fs.promises` 是 Node 官方**内建**的 Promise API（`require('node:fs/promises')`），实现完整、覆盖全部方法、错误语义统一、无需你手动包装。`promisify(fs.readFile)` 是把**单个**回调函数临时包成 Promise，只包了那一个方法、且每次 `promisify` 都新建包装。现代代码直接用 `fs/promises`，`promisify` 只在"给某个没有 Promise 版的老回调 API 兜底"时才用（呼应 node-async-errors 第二节）。

**来源**：Node.js — "fs.promises / util.promisify"

---

## 二、编码与 Buffer

### 3. `readFile(path, 'utf8')` 和不传编码，返回类型有什么不同？为什么读二进制不能指定编码？

不传 `encoding` 返回 **Buffer**（原始字节数组视图，呼应 node-buffer）；传 `'utf8'` 等则返回**解码后的字符串**。二进制文件（png/zip/字体）的字节序列并非合法文本编码，用 `'utf8'` 去解读会**产生乱码甚至不可逆损坏**（非法字节被替换成 U+FFFD）。所以：**要拿到原始字节就别传编码**，处理文本才传 `'utf8'`。写方向同理：字符串配编码、Buffer 直接写。

**来源**：Node.js — "Buffer / character encodings"; MDN — "TextDecoder vs raw bytes"

---

## 三、目录与元信息

### 4. `stat` 和 `lstat` 有什么区别？如何"优雅判断一个文件是否存在"？

对**符号链接**：`stat` 跟踪链接去看**目标**的信息，`lstat` 返回**链接本身**的信息（是否真是 symlink、链接自身大小）。判断存在性别用"`readFile` 看会不会抛错"——昂贵且有 I/O 副作用。首选 `fs.access(path, constants.F_OK)`（只探权限/存在，捕获 `ENOENT`），或直接操作后**针对性 catch 错误码** `err.code === 'ENOENT'`（呼应 node-async-errors 错误设计）。"先 existsSync 再 readFile" 存在 TOCTOU 竞态（两步之间文件可能变），生产更推荐"直接做+按 code 处理错"。

**来源**：Node.js — "fs.stat vs lstat / fs.access"; 社区 — "how to check if file exists in node"

### 5. `readdir` 怎么高效地递归遍历目录树？

用 `{ withFileTypes: true }` 拿到 `Dirent` 数组，`dirent.isDirectory()` 当场判断类型，**省掉对每个 entry 再 `stat` 一次**的开销：

```js
async function walk(dir) {
  for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p);   // 递归
    else handle(p);
  }
}
```

否则默认 `readdir` 只给名字，你得对每个再 `stat`/`lstat` 才知道是目录还是文件——N 次额外系统调用（呼应 node-path-url 的 `path.join`）。

**来源**：Node.js — "fs.readdir withFileTypes / Dirent"

---

## 四、文件描述符与资源

### 6. 为什么"忘了 close 文件描述符/流/watcher"是严重的 bug？

fd 是**有限的 OS 资源**（每进程有上限），不 close 会耗尽→`EMFILE`（too many open files），新连接/读文件全部失败。同理：没关的 **watcher/流**持有活跃句柄，只要事件循环还有活跃句柄，**进程就不会退出**（呼应 node-event-loop、node-fs 第六节）——表现为"脚本跑完却卡着不退"。这类"资源未释放"与 EventEmitter 监听器泄漏、定时器未清同属一族，都会在长跑服务里累积成故障（呼应 node-deploy-perf）。对策：`try/finally` 保证 close，或用 `FileHandle`/`await using` 自动释放。

**来源**：Node.js — "file descriptors / EMFILE"; 社区 — "why node process doesn't exit (active handles)"

---

## 五、大文件与流

### 7. 让你拷贝一个 8GB 文件，为什么不能用 `writeFile(dest, await readFile(src))`？正确姿势？

`readFile` 会把 8GB 全部读进内存（Buffer），峰值内存≈文件大小，多并发一来直接 **OOM**；且"读完才开始写"= 两倍延迟、两倍内存。正确用**流对拷**，恒定小缓冲区分块搬运：

```js
import { pipeline } from "node:stream/promises";
await pipeline(
  fs.createReadStream(src),      // 读一块
  fs.createWriteStream(dest)     // 写一块、丢一块
);
```

内存占用只约等于 `highWaterMark`（默认几百 KB），且读写重叠进行。这正是 L4 Stream 的核心动机（呼应 node-fs 第七节、node-stream-pipeline）。

**来源**：Node.js — "Streams / backpressure"; 社区 — "copy large file node stream vs readFile"

### 8. `readFile`、`createReadStream`、`open+read 到 Buffer` 三者内存模型有何不同？

- `readFile`：一次性分配"等于文件大小"的 Buffer，全量驻留内存。
- `createReadStream`：内部分配若干 `highWaterMark` 大小的块，处理完即释放，峰值内存与文件大小**无关**。
- 手动 `open`+定长 `read(buf,...)`：你自己给一个固定 Buffer 反复复用读不同偏移（适合"只读某几段/随机访问"，如读文件头尾、解析定长记录）。
选择依据：**小文件要整体内容**→`readFile`；**大文件/边读边处理**→流；**只需部分字节/随机访问**→fd+定长读。

**来源**：Node.js — "FileHandle.read / streams highWaterMark"

---

## 六、权限、原子写与常见坑

### 9. 什么叫"原子写文件"？为什么写配置/缓存要用"写临时文件 + rename"？

直接 `writeFile` 覆盖一个正在被读的文件，读者可能读到**写了一半**的内容（非原子）。原子写：把新内容 `writeFile` 到同目录临时文件（如 `x.tmp`），`fsync`/关闭后 `rename(tmp, x)`。POSIX 下**同文件系统内 `rename` 是原子的**——读者要么看到旧完整文件、要么新完整文件，绝无中间态。数据库/配置热更新、构建产物发布都靠这招防"读到半截"。

**来源**：Node.js — "fs.rename atomicity"; 社区 — "atomic write tmp+rename pattern"

### 10. `fs.appendFile` 并发写同一个日志文件，会交错/丢失吗？

单个小的 `appendFile` 通常以 O_APPEND 打开写入，多数 OS 下单次 write 追加是原子的、不会覆盖彼此；但**并发大量 append 同一文件**仍可能因多次系统调用产生**行间交错**、且反复 open/close 效率极低。正确做法：**复用一个 `createWriteStream`**（内部排队串行化写入），或经一个专门的日志流/winston/pino 汇聚后再写（呼应 node-streams、node-config 结构化日志）。

**来源**：Node.js — "O_APPEND / createWriteStream"; 社区 — "concurrent appendFile to same file"

### 11. `EACCES`、`ENOENT`、`EMFILE` 分别代表什么？代码里怎么按错误码分支处理？

- `ENOENT`：文件/目录不存在（路径写错、已被删）——迁移/回退默认配置。
- `EACCES`：权限不足（不可读/不可写/目录无执行位）——提示改权限或换路径。
- `EMFILE`：进程打开文件数达上限（fd 泄漏，呼应第 6 题）——排查未 close。
处理：catch 后**判 `err.code`** 分支，而不是匹配 `err.message` 文本（message 随版本/语言变，code 稳定）：

```js
try { await fsp.readFile(p, "utf8"); }
catch (e) { if (e.code === "ENOENT") return def; throw e; }  // 只兜"不存在"，其余照抛
```

**来源**：Node.js — "System errors / err.code"; 社区 — "handle ENOENT EACCES EMFILE"

### 12. 相对路径 `readFile('config.json')` 为什么有时突然找不到文件？怎么根治？

相对路径是相对**当前工作目录 `process.cwd()`**（进程从哪启动），**不是**相对脚本所在目录（呼应 node-basics 的 `__dirname` vs `process.cwd()`）。`cwd` 随启动方式（`node src/x.js` vs 从别处调用/pm2/systemd）变化，于是"明明在目录里，运行位置一变就 ENOENT"。根治：**基于脚本自身位置拼绝对路径**——CJS 用 `path.join(__dirname, 'config.json')`；ESM 无 `__dirname`，用 `fileURLToPath(import.meta.url)` 还原（详细在 **node-path-url** 展开）。绝不把裸相对路径写进可能被不同 cwd 启动的代码。

**来源**：Node.js — "process.cwd vs __dirname"; 社区 — "ENOENT because of cwd not script dir"

---

## 补充（新专题 13-15）

### 13. os.rename 是原子写的基石——讲讲「写临时文件+rename」的完整工序与它的失效边界。

工序：写 `target.tmp-随机串` → 数据落地（关键：filehandle.sync()/fs.fsync 刷**数据**，rename 只保证目录项原子）→ rename 覆盖目标（POSIX 单文件系统内原子替换：读者永远看到「旧完整版或新完整版」）→ 目录 fsync（掉电保目录项）。失效边界：跨文件系统 rename 报 EXDEV（tmp 必须与目标同盘，别丢 /tmp）；Windows 覆盖需 MOVEFILE_REPLACE_EXISTING（Node rename 在 Win 可覆盖已存在文件但非无锁）；并发追加写者会在 rename 后继续写旧 inode（日志 rotate 的丢行根源，需 SIGHUP 重开文件）。应用：配置保存、sqlite WAL checkpoint、日志轮转 copytruncate vs create 之争——本关原子写与 appendFile 交错题的展开。

**来源**：Node fs.rename 文档（UV_ERR_FS_* 与平台差异）；PostgreSQL/etcd fsync 讨论与 LWN《filesystem sync 语义》。

### 14. fs.watch 为什么「不可靠」？跨平台文件监听工程上怎么做？

底层异构：macOS FSEvents（可能合并事件、路径粒度粗）、Linux inotify（移动=unlink+create 两事件、目录递归要逐子目录挂、watch 数受 fs.inotify.max_user_watches）、Windows ReadDirectoryChangesW（网络盘/重命名语义漂移）。通病：不保证事件不丢（高负载队列溢出只给你一个 "event overflow"）、同一变更次数不定、rename 语义缺信息。工程：① 去抖+二次确认（setTimeout 收束窗口，写完再 stat 验存在与 mtime）；② 递归自己 walk 挂；③ 兜底轮询（chokidar 的 usePolling 就是给 NFS/Docker 挂载卷的——容器 volume 里 inotify 穿不透是部署经典坑）；④ 优先「事件源改造」：能让写方发通知（Redis pub/sub、DB CDC）就别监听文件系统。库选 chokidar 但理解它也只是缓解。

**来源**：Node fs.watch「not guaranteed across platforms」官方警告段；chokidar README《non-realtime filesystems》。

### 15. 一个 HTTP 服务频繁报 EMFILE，从错误语义到根因到修复列一条完整线。

语义：进程文件描述符表满——fd 不只对应文件，socket/epoll/timer(uv handle 占 fd 或 pipe) 全算。根因排查：① 泄漏：open/createReadStream 无 close/destroy（错误分支漏 finally 是本关「隐藏患」题实装）、keepAlive 连接数超预期（每客户端连接一个 fd）；② 合法高并发：ulimit -n 默认 1024 太低。工具：lsof -p /dev/fd 计数、process._getActiveHandles 粗看、/proc/self/fd 数量监控。修复：代码层 finally 关流、server.maxRequestsPerSocket + keepAliveTimeout 收紧、系统层 ulimit/nofile（容器要改 security-opt 或 systemd LimitNOFILE）；防复发：fd 使用量进监控曲线。顺带：集群多进程时 listen socket 是共享的，worker 泄漏才是增量元凶。

**来源**：Node 官方《Handling EMFILE》诊断指引（fd 资源模型）；lsof/ulimit 运维手册与 K8s nofile 配置文档。
