# node-basics 面试题精选

> 共 12 题，覆盖 **运行时本质 / process 与全局 / argv-退出码 / 单线程与事件循环 / 路径与模块作用域 / 工程习惯** 六类。

---

## 一、运行时本质

### 1. Node.js 到底是什么？它和"浏览器里的 JS"最根本的区别是什么？

Node 是一个**JS 运行时**：V8 引擎负责执行 JS + libuv 负责异步 I/O/线程池/事件循环 + 一套内置模块（fs/http/net/path…）。和浏览器最根本的区别是**宿主环境提供的 API 不同**：浏览器面向文档，提供 `window`/`document`/DOM/BOM/`localStorage`；Node 面向操作系统，提供 `process`/文件/网络/子进程，**没有 DOM**。同一份"纯语言"代码（ES 语法 + 标准库如 `Array`/`Promise`）两边都能跑，一旦用到某侧专有 API 就不行（呼应 ES 运行时无关语法、node-basics 第一节）。

**来源**：Node.js 官方 — "About Node.js"; libuv 文档 — "About libuv"

### 2. 为什么 Node 选择"单线程 + 事件循环"这个模型？它的取舍是什么？

因为 Web 服务端的典型负载是 **I/O 密集**（查库、读文件、等下游 HTTP），线程绝大部分时间在"等"。用"每请求一线程"模型（传统 Apache/Java Servlet）会因为大量线程阻塞在等待上、还要付出线程创建与上下文切换/内存开销。Node 反其道：**一根线程跑 JS，I/O 交给 libuv/内核异步处理，完成后再把回调排进事件循环**——等待期间这根线程去处理别的请求。取舍：并发 I/O 极高效，但**任何 CPU 密集的同步计算都会独占这根线程、卡住所有人**（呼应 node-basics 第五节、node-workers）。适合"大量连接、每连接少量计算"的场景。

**来源**：Node.js — "Event Loop, Timers, and process.nextTick"; 社区 — "why node is single threaded"

---

## 二、process 与全局对象

### 3. `globalThis`、`global`、`window` 三者在 Node 与浏览器里分别是什么关系？

浏览器：全局对象是 `window`（也是 `globalThis === window`）。Node：**没有 `window`**；全局对象是 `global`，而 `globalThis`（ES2020 标准化）在 Node 里 `=== global`。区别在于：给 `global`/`globalThis` 挂属性是**真正跨模块共享**（污染全局、难测试、易冲突），应当尽量避免——Node 的共享靠**模块导出**而非全局（呼应 node-modules）。例外：polyfill、诊断埋点、某些库要求的全局注册才用。（`global` 这个名字是 Node 历史遗留，标准推荐写 `globalThis` 以跨环境。）

**来源**：MDN — "globalThis"; TS Handbook — "globalThis"; Node — "Globals"

### 4. `process` 对象里你最常用哪些字段/方法？`process.exitCode` 和 `process.exit()` 有何区别？

高频：`process.argv`（参数）、`process.env`（环境变量）、`process.cwd()`、`process.stdout/stderr`（输出流）、`process.exit()`、`process.nextTick()`、`process.platform/arch`、`process.pid`。区别：`process.exit(code)` **立即终止**，可能截断还没 flush 的 stdout（异步写入没来得及落盘）；`process.exitCode = code` 只是**设置退出码**，让事件循环自然跑完再退出，输出不丢——更安全的做法。原则：除非确实要立刻中止，优先"设置 exitCode + 让进程自然结束"（呼应 node-basics 第三节、node-cli 退出码）。

**来源**：Node.js docs — "process / process.exit / exitCode"; 社区 — "why not call process.exit()"

---

## 三、argv 与命令行

### 5. 如何从命令行拿到用户传的参数？`--name tom` 和 `tom` 两种写法解析上有什么区别？

裸 `process.argv.slice(2)` 只能拿到**扁平字符串数组**（`['--name','tom']` 或 `['tom']`），要自己解析。位置参数（`tom`）和命名/flag 参数（`--name tom`、`-v`、`--no-color`）语义不同，手工处理边界多（`--name=tom`、短选项合并 `-ab`、布尔 flag）。所以真做 CLI 会用 **`util.parseArgs`（Node 内置）** 或 commander/yargs（呼应 node-cli）。`util.parseArgs({ options: { name: { type: 'string' } } })` 就能把 `--name tom` 解析成 `{ name:'tom' }`。理解 argv 结构是一切的基础。

**来源**：Node.js — "util.parseArgs"; Node — "process.argv"

### 6. 退出码（exit code）有什么用？为什么脚本/CLI 必须重视它？

`process.exitCode`/退出码是进程告诉外界"成功还是失败"的约定：**0 = 成功，非 0 = 某种失败**。shell 里 `echo $?`、CI 里判断步骤成败、npm script 里 `&&` 链、父进程 `spawn` 监听 `exit`——全都靠它。一个号称成功却实际失败的 CLI（因为没设非 0 退出码）会让 CI"假绿"、自动化链带着错误继续跑（呼应 Express L7 CI、node-deploy-perf）。良好实践：不同错误类型用不同非 0 码、失败路径显式设 `process.exitCode = 1`。

**来源**：Node.js — "Exit codes"; Linux — "exit status / $?"; General "Exit Status Codes"

---

## 四、事件循环与异步（初阶）

### 7. `setTimeout(fn, 0)`、`process.nextTick(fn)`、`setImmediate(fn)` 分别在什么时候执行？

粗略：`process.nextTick` 在**当前操作完成后、进入下一次事件循环阶段之前**触发，优先级最高（甚至高于 Promise 微任务）；`setImmediate` 在 **check 阶段**（I/O 回调之后）触发；`setTimeout(fn,0)` 在 **timers 阶段**、且受最小延时（≥1ms）影响。主线程同步代码永远最先跑完，然后是 nextTick 队列 + 微任务(Promise)队列，再进入事件循环各阶段（详见 node-event-loop）。面试题常考"三者在模块顶层 vs 在 I/O 回调里 的相对顺序不同"——核心是要理解 tick 与 immediate 的触发点相对 poll 阶段的位置。

**来源**：Node.js — "Event loop / process.nextTick vs setImmediate"; StackOverflow 经典问答

### 8. 一段 `while(true){}` 为什么会把整个 Node 服务"冻住"？如何避免？

因为事件循环与执行你 JS 的是**同一根线程**。`while(true)` 这种永不交还控制权的同步死循环，让线程**永远回不到事件循环**去处理下一个 I/O 回调/定时器——所有请求、心跳、GC 调度全停摆，进程看起来"假死"（呼应 node-basics 第五节）。避免：① 把大循环拆成异步分片（`setImmediate`/`await` 每轮让出）；② CPU 重活丢给 **worker_threads**（独立线程）或子进程；③ 用 cluster 多进程兜底。原则：**绝不让任何单个同步任务长时间霸占主线程**。

**来源**：Node.js — "Blocking the Event Loop"; 社区 — "CPU-bound work in Node"

---

## 五、模块作用域与路径

### 9. 为什么 Node 里在 a.js 顶层写 `var x = 1`，在 b.js（require 了 a）里访问不到 x？这和浏览器有什么不同？

因为 Node **每个文件是一个独立模块**，代码被包进一个函数作用域（`(function(exports, require, module, __filename, __dirname){ ... })`），顶层 `var` 只是这个函数内的局部变量，不外泄——这正是"模块隔离"的实现（详见 node-modules）。浏览器经典脚本里顶层 `var` 会挂到 `window` 全局可见。Node 要跨文件共享必须**显式 `module.exports` 导出、`require` 导入**（呼应 node-basics 第二节）。这也是为什么"污染 globalThis"是坏味道——绕过了模块系统的显式依赖。

**来源**：Node.js — "Modules / Module Wrapper"; Node — "module wrappers"

### 10. `__dirname` 和 `process.cwd()` 混用引发过什么典型 bug？正确姿势是什么？

典型 bug：服务里 `fs.readFile('data/config.json')` 用的是**相对 cwd 的路径**——本地从项目根启动正常，一旦用 PM2/systemd/Docker 从别的目录启动，cwd 变了就"文件找不到"。正确姿势：**资源相对脚本/包的位置定位**，用 `path.join(__dirname, 'data/config.json')`（CJS）或 `fileURLToPath(import.meta.url)` 派生（ESM），与"从哪运行"解耦（呼应 node-basics 第四节、node-path-url）。`process.cwd()` 留给"确实要相对用户运行目录"的场景（如读取用户传入的路径参数）。

**来源**：Node.js — "path / __dirname vs process.cwd"; 社区 — "ENOENT relative path node"

---

## 六、工程习惯与调试

### 11. 不用 `console.log` 调试时，Node 有哪些调试手段？

① `node inspect app.js` / `node --inspect app.js`：内置 V8 检查器，配合 Chrome DevTools 或 VS Code（`launch.json` type:"node"）打断点、看调用栈、监视表达式；② `--watch`（18+）改文件自动重启；③ `--trace-events`/`--prof` 做性能剖析（呼应 node-deploy-perf）；④ 结构化日志（winston/pino + `debug` 模块，呼应 node-config）。断点调试能在不污染代码的前提下检查闭包/异步状态，比满屏 log 高效，也是排查"事件循环卡住""未捕获 Promise"这类问题的利器。

**来源**：Node.js — "Debugging and Profiling / Inspector"; Chrome DevTools — "Node.js debugging"

### 12. `node --experimental-strip-types` 让 Node 能直接跑 .ts，这和"Node 运行 JS"是同一件事吗？说明你对"运行时 vs 类型层"的理解。

不是同一层。Node 运行时**只认 JS**；TS 的类型在编译期被擦除（呼应 ts-intro、ts-tooling）。`--experimental-strip-types`（Node 22.6+）做的是**把 `.ts` 里的类型注解"剥掉"得到 JS 再执行**——它**不做类型检查**（类型全错也能跑，检查要单独 `tsc --noEmit`）。所以"Node 跑 TS"本质仍是"Node 跑（被擦掉类型的）JS"，只是省去了你手动编译那一步。这也再次说明：转译 ≠ 类型检查（呼应 ts-tooling 第一节、ts-migration）。

**来源**：Node.js — "Type Stripping"; TS — "types are erased at compile time"
