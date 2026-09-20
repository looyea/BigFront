# fs 模块：同步、回调与 Promise 三副面孔

> 目标：吃透 Node 读写文件系统的基础设施 `fs`。它同一个操作往往有**三种 API 形态**——同步（`readFileSync`）、错误优先回调（`readFile`）、Promise（`fs.promises.readFile`）。理解各自适用场景、`stat`/目录操作、文件描述符与权限，以及最关键的判断：**为什么大文件绝不能一把 `readFile` 读进内存**（这句直接引出 L4 的 Stream）。呼应 node-async-errors（回调 vs Promise）、node-event-loop（同步 fs 会阻塞主线程）。

---

## 一、同一个 `readFile` 的三副面孔

```js
import fs from "node:fs";
import fsp from "node:fs/promises";

// ① 同步：一行返回，但会阻塞事件循环，直到读完
const a = fs.readFileSync("a.txt", "utf8");

// ② 错误优先回调（传统异步）
fs.readFile("b.txt", "utf8", (err, data) => {
  if (err) return console.error(err);      // 呼应 node-async-errors 第二节
  console.log(data);
});

// ③ Promise（现代推荐）：能 await、能 try/catch
const data = await fsp.readFile("c.txt", "utf8");
```

选择原则：

| 形态 | 何时用 | 代价 |
| --- | --- | --- |
| `*Sync` | 启动阶段读配置、脚本、CLI——一次性、在主逻辑开始前 | **阻塞事件循环**，服务端请求路径里禁用（呼应 node-event-loop） |
| 回调版 | 维护老代码 | 手动 `if(err)`、易嵌套 |
| `fs.promises` | 业务代码首选 | 记得 catch（否则 unhandledRejection，呼应 node-async-errors） |

**为什么同步版危险**：`readFileSync` 期间，事件循环的 poll 阶段被占死，所有其它请求/定时器全部停摆（呼应 node-event-loop："同步大循环卡死主线程"）。在 HTTP 服务里对一个慢盘用同步读，等于给整个服务按下暂停键。

---

## 二、编码与"裸 Buffer"

`readFile(path, encoding)` 不传 `encoding` 时返回 **Buffer**（原始字节，呼应 node-buffer）：

```js
const buf = await fsp.readFile("logo.png");   // <Buffer 89 50 4e 47 ...> 二进制没有"utf8 字符串"概念
const txt = await fsp.readFile("a.txt", "utf8"); // 指定编码 → 字符串
```

图片、zip、字体等**二进制文件绝不能指定 `utf8`** 去读——会把字节按文本解码成乱码甚至损坏。写也一样：`writeFile(path, bufferOrString)`，字符串配编码、二进制直接给 Buffer。

---

## 三、写文件：writeFile、appendFile 与"整文件覆盖"

```js
await fsp.writeFile("out.txt", "hello");         // ★ 覆盖写入（不存在则创建，存在则清空重写）
await fsp.appendFile("log.txt", "一行日志\n");    // 追加，不覆盖
await fsp.truncate("out.txt", 0);                // 清空
```

`writeFile` 是"开文件 → 全量写 → 关文件"的封装，适合**内容已在内存、体量不大**的场景。要"边生成边写"或"超大内容"，同样不能靠一次性字符串，得用流（`createWriteStream`，L4）。

---

## 四、stat、目录与"元信息"

```js
const st = await fsp.stat("a.txt");
st.isDirectory(); st.isFile(); st.size; st.mtime;   // 类型/大小/修改时间

await fsp.mkdir("dist/assets", { recursive: true }); // ★ recursive 让多级目录不报错
await fsp.rm("dist", { recursive: true, force: true }); // 删目录树（Node 14.14+）
const entries = await fsp.readdir("src", { withFileTypes: true });
for (const e of entries) e.isDirectory() ? walk(e) : handle(e.name);  // 递归遍历
```

`stat` vs `lstat`：符号链接下 `stat` 跟踪到目标、`lstat` 给你链接本身。`access(path)` 只判"有没有权限/存不存在"，别用"`readFile` 报错"来判断存在性（昂贵且有副作用）。

---

## 五、底层：文件描述符与 open/read/write/close

前面都是"一步到位"的封装。真正的手动流程揭示 OS 视角：

```js
const fd = await fsp.open("big.bin", "r");     // open 返回 FileHandle
const buf = Buffer.alloc(1024);
const { bytesRead } = await fd.read(buf, 0, 1024, 0); // 从偏移 0 读进 buf
await fd.close();
// 或用自动管理：
await using h = await fsp.open("x", "r");      // ES 显式资源管理，出作用域自动 close
```

`open` 的模式串：`r` 读、`w` 写(清空/创建)、`a` 追加、`r+` 读写…。文件描述符(fd)是有限系统资源，**开了必须关**，否则泄漏（呼应 node-deploy-perf 句柄泄漏、node-events 监听器泄漏同属"资源未释放"家族）。`fs.promises.open` 返回的 `FileHandle` 比裸 fd 更安全。

---

## 六、watchers：fs.watch / fs.watchFile

```js
import { watch } from "node:fs";
const w = watch("src", (eventType, filename) => console.log(eventType, filename));
w.close();   // 记得关，否则进程不退出（有活跃句柄，呼应 node-event-loop）
```

`fs.watch` 基于 OS 原生事件（高效但跨平台行为有差异），`fs.watchFile` 靠轮询 `stat`（慢但一致）。热更新、构建工具（呼应 10-vite 的 dev server 文件监听）底层就靠它们。记得 `close()`——一个没关的 watcher 就是让进程"赖着不退出"的活跃句柄之一。

---

## 七、为什么大文件不能 readFile 一把读

`readFile` 会把**整个文件的字节全部读进内存**再给你。10MB 还好，10GB 日志/视频直接 **OOM**。而且"读完才开始处理"意味着内存峰值 = 文件大小，且处理前的等待 = 完整 I/O 时间。正解是**分块流式处理**：读一块、处理一块、丢一块，内存占用恒定——这就是 **Stream**（node-streams）。`fs` 提供 `createReadStream`/`createWriteStream`，L4 展开。一句话记忆：**"内容大小不可控 / 要边读边写" → 上流，别 readFile。**

---

## 八、自检清单

- [ ] 同一个 `readFile` 有哪三种形态？各自适用场景与代价？
- [ ] 为什么服务端请求路径里禁用 `*Sync`？
- [ ] 读二进制文件为什么要避开 `encoding: 'utf8'`？
- [ ] `writeFile` 和 `appendFile` 区别？`mkdir` 的 `recursive` 解决什么？
- [ ] `open/read/write/close` 手动流程里，为什么"关了"很重要？
- [ ] 10GB 文件你会怎么处理？为什么不能 `readFile`？

---

## 🚀 部署预告

- 本关"大文件不能整读"直接引出下一阶段的 **node-streams / node-stream-pipeline**——分块、背压、`pipeline` 收口 error（呼应 node-events 第三节）；
- 路径拼接、`__dirname` vs `import.meta.url` 的跨平台问题在 **node-path-url** 专治（本关例子里的相对路径就依赖 cwd，坑在下一关揭）；
- 读回来的 Buffer、编码乱码，在 **node-buffer** 深挖；
- 没关的 fd/watcher 让进程不退出、句柄泄漏，在 **node-deploy-perf** 与 node-events 泄漏呼应。

下一关进入 **node-path-url**：跨平台路径、`fileURLToPath` 与 WHATWG URL 解析。
