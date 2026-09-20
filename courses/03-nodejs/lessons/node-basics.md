# 第一个 Node 程序：运行时、全局与 process

> 目标：把 Node 的"身份"讲清楚——它不是"浏览器里的 JS 换了个壳"，而是一个**为服务端/脚本/工具链设计的 JS 运行时**，没有 `window`/`document`，取而代之的是 `process`、模块系统与一堆内置能力。跑通第一个脚本、看懂 `process` 这个"进程说明书"、理解**单线程 + 事件驱动**为什么适合 I/O（呼应 node-event-loop、ts-intro "Node 如何真正跑 TS"）。

---

## 一、Node 是什么：JS 运行时，不是浏览器

浏览器 = 渲染引擎（V8）+ DOM/BOM/Web API。Node = **V8 + libuv + 内置模块**，专攻"在浏览器之外跑 JS"：

```
   V8（执行 JS）  +  libuv（异步 I/O、线程池、事件循环）  +  内置模块(fs/http/net/path...)
   ────────────────────────────────────────────────────────────  = Node.js 运行时
```

所以 Node 里：**没有 `window`、`document`、`localStorage`、`fetch` 的全局 DOM 语境**；但有 `globalThis`、`process`、`console`、`Buffer`，以及 18+ 起内置的 `fetch`。判断一段代码能否在 Node 跑，看它依赖的是不是**纯语言 + Node 提供的能力**（呼应 ES 的"运行时无关语法"）。

```bash
node app.js          # 运行脚本
node -e "console.log(1+1)"   # 直接执行表达式
node                 # 进入 REPL（交互式试验台）
node --watch app.js  # 文件改动自动重启（18+，开发利器）
```

---

## 二、全局对象与"每个模块自己的作用域"

浏览器顶层 `var` 挂到 `window`；Node 里**每个文件都是一个独立模块**，顶层 `var`/`const` 不污染全局（呼应 node-modules）。真正的全局挂在 `globalThis`：

```js
console.log(typeof window);       // undefined —— Node 没有 window
console.log(process.platform);    // 'win32' | 'linux' | 'darwin'
globalThis.myShared = 42;         // 真要跨模块共享才挂全局（少用）
```

`console.log / error / warn / table / time` 都在，但输出到的是**进程的 stdout/stderr**，不是浏览器控制台（下一节）。

---

## 三、process：你与操作系统之间的那道门

`process` 是 Node 暴露的"当前进程"对象，脚本/服务的一切外部交互都经它：

```js
process.argv        // 命令行参数数组：[node路径, 脚本路径, ...用户参数]
process.env         // 环境变量对象（NODE_ENV、PATH、自定义 PORT...）
process.exit(code)  // 立即结束进程，code!==0 表示失败（CI/脚本靠它判断成败）
process.cwd()       // 当前工作目录（你"在哪敲的命令"，不是脚本所在目录！）
process.stdout      // 标准输出流（console.log 底下就是它）
process.pid         // 进程号
```

**argv 的两个高频坑**：

```js
// node cli.js --name tom
process.argv;  // ['C:\\...\\node', 'E:\\...\\cli.js', '--name', 'tom']
const args = process.argv.slice(2);   // ★ 跳过前两个，才是"用户参数"
```

`process.exit()` 会**截断尚未 flush 的 stdout**——`console.log` 后立刻 `exit` 可能丢输出。正确姿势是让事件循环自然结束（不活跃任务时进程自动退出），或先写完再退（呼应 node-cli 的 exit code）。

---

## 四、模块里的"伪全局"：__dirname、__filename、module

CommonJS 文件里能直接用 `__dirname`/`__filename`，它们**不是真全局**，而是 Node 把每个文件包进一个函数时注入的参数（呼应 node-modules 的模块包装）：

```js
// 文件 E:/Projects/demo/src/app.js
__dirname    // 'E:/Projects/demo/src'   —— 本文件所在目录
__filename   // 'E:/Projects/demo/src/app.js'
```

⚠️ 在 **ESM（`.mjs` 或 `type:module`）里没有 `__dirname`**，要自己造：

```js
import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);   // import.meta.url 是当前模块的 file:// URL
const __dirname = path.dirname(__filename);
```

`process.cwd()`（你在哪运行）和 `__dirname`（脚本在哪）**经常不同**——读写项目内文件几乎总该基于 `__dirname` 拼路径，否则"换个目录运行就找不到文件"（呼应 node-path-url）。

---

## 五、单线程 + 事件驱动：为什么 Node 适合 I/O

Node 的 JS 执行是**单线程**的，但它靠**事件循环 + libuv 异步 I/O** 用一根线程扛住大量并发：

```
你的代码（单线程）  ──调用 fs.readFile──▶  libuv 把它丢给内核/线程池
       ▲                                          │
       └────────── 完成后回调/resolve 回到事件循环 ◀─┘
```

关键心智：**"单线程"指的是你的 JS 一次只跑一个函数，不代表 Node 只处理一个请求**。CPU 不阻塞、把 I/O 交给底层，回调排队等事件循环调度（详见 node-event-loop）。因此：

- ✅ 擅长：**I/O 密集**（API 网关、实时协作、爬虫、BFF）——线程大部分时间在"等"，等的时候处理别的请求；
- ❌ 不擅长：**CPU 密集**（图像/加密/大计算）——一个同步长任务会**卡住整个事件循环**，所有请求一起卡（解法：worker_threads/cluster，呼应 node-workers）。

这就是为什么"不要在 Node 主线程跑 `while(true)` 或同步大循环"。

---

## 六、跑通并调试第一个脚本

```js
// hello.js
const name = process.argv[2] ?? "world";
console.log(`hello, ${name}`);
```

```bash
node hello.js 大前端      # 输出：hello, 大前端
```

调试不必只靠 `console.log`：

```bash
node inspect hello.js     # 命令行调试器（breakpoints/next）
# 或 VS Code：launch.json 里 type:"node", request:"launch", program:"${file}" 直接断点
```

TS 文件怎么在 Node 跑（`tsx`/`--experimental-strip-types`）在 02-typescript 的 ts-tooling 已详述，本包默认用 `.js`（呼应 ts-tooling 第五节）。

---

## 七、自检清单

- [ ] Node 和浏览器提供的"环境能力"有何根本不同？哪些全局在 Node 里不存在？
- [ ] `process.argv` 前两项是什么？取用户参数为什么要 `slice(2)`？
- [ ] `process.cwd()` 和 `__dirname` 区别？读项目内文件该用哪个？
- [ ] ESM 里为什么没有 `__dirname`？怎么补回来？
- [ ] "单线程"为什么不妨碍 Node 高并发？它擅长/不擅长什么类型任务？
- [ ] 为什么不该在 `console.log` 后立刻 `process.exit()`？

---

## 🚀 部署预告

- 本关建立"Node 是一个运行时"的地基；下一关 **node-modules** 钻进 Node 最核心的组织单元——**CommonJS 模块**（`require` 到底做了什么、为何顶层变量不污染全局，正是本关第四节"模块包装"的展开）；
- `__dirname`/`import.meta.url`/路径问题在 **node-path-url** 系统解决；
- 事件循环只给了"心智模型"，六阶段与 `nextTick`/`setImmediate` 的顺序之争留给 **node-event-loop**；
- `process.env`/退出码/`stdout` 会在 node-config、node-cli、node-deploy-perf 里长成完整的"服务端工程习惯"（呼应 Express L8 部署）。

下一关进入 **node-modules**：CommonJS 的 require、导出与加载缓存。
