# node-cli 面试题精选

> 共 12 题，覆盖 argv 与 bin / 三流与退出码 / 解析库 / 健壮性与发布 五类。

---

## 一、argv 与 bin

### 1. 一个 npm 包安装后为什么能变成命令行程序（如 `vite`、`tsc`）？

`package.json` 的 **`bin`** 字段把某个文件登记为命令名。安装（局部或全局）时，包管理器在 `node_modules/.bin`（或全局 bin 目录）创建软链，并把该目录加入 PATH；脚本首行 **shebang** `#!/usr/bin/env node` 告诉 OS 用 node 解释执行。于是敲 `vite` = 运行那个入口（呼应 node-cli 第二节、node-npm interview 第 3 题）。

**来源**：npm docs — "package.json bin"、Wikipedia — "Shebang (Unix)"

### 2. `process.argv` 的结构是什么？`process.execArgv` 与它有何不同？

`argv = [node可执行路径, 脚本路径, ...用户参数]`，用户参数从索引 2 开始。`process.execArgv` 是**给 node 本身**的标志（如 `node --inspect app.js --port 3000` 里的 `--inspect`），`argv` 里则是给**脚本**的 `--port 3000`。`npx`/npm scripts 传参要加 `--` 分隔（呼应 node-cli 第一节、node-npm 第二节）。

**来源**：Node.js — "process.argv / process.execArgv"

### 3. shebang 在 Windows 上生效吗？跨平台 CLI 要注意什么？

shebang 是 Unix 约定，**Windows 不认**；npm 在 Windows 下会为 `bin` 生成 `.cmd` 垫片来用 `node` 跑该 js。跨平台注意：**别用 bash-only 语法**（`&&`、`rm -rf`、`export`）、路径用 `path` 模块、换行用 `os.EOL`（呼应 node-path-url、node-child-process）。

**来源**：npm — "Windows bin shims"、社区 — "Writing cross-platform Node CLIs"

---

## 二、三流与退出码

### 4. stdout 与 stderr 的分工？为什么诊断信息要进 stderr？

**结果进 stdout、诊断/错误进 stderr**。这样 `mycli | grep`/`> file` 只拿到干净结果，不被进度/报错污染；错误也能单独重定向/被终端标红。`console.log`→stdout、`console.error`→stderr（呼应 node-cli 第四节）。

**来源**：Linux/Unix — "Standard streams (stdout/stderr/stdin)"、Node.js — "process.stdout/stderr"

### 5. 如何读取管道输入（`echo hi | mycli`）？怎么判断是否交互终端？

`process.stdin` 是可读流：`for await (const chunk of process.stdin)` 或 `readline.createInterface({input: process.stdin})`。`process.stdin.isTTY === true` 表示连的是终端（可交互/上色）；被管道/重定向时为 `false`，应据此关颜色、改读 stdin（呼应 node-cli 第四、六节）。

**来源**：Node.js — "process.stdin / isTTY"、node:readline

### 6. `process.exit(code)` 有什么坑？为什么推荐 `process.exitCode`？

`process.exit` **立即终止**，可能截断还没写完（缓冲中）的 stdout/stderr，丢掉输出。推荐设 `process.exitCode = 1` 并让事件循环自然结束（无活跃句柄时以该码退出，呼应 node-event-loop），保证输出 flush 完（呼应 node-cli 第五、七节）。

**来源**：Node.js — "process.exit() warning"、Node.js — "process.exitCode"

---

## 三、解析库

### 7. 手写 argv 解析、`util.parseArgs`、commander/yargs 怎么选？

一次性/极少选项→手解析 `argv.slice(2)` 也行；不想引依赖又要规范 `--flag`/`-f`/`--`/位置参数/校验→内置 **`util.parseArgs`**；有子命令、丰富选项、自动 `--help`/补全→**commander/yargs**（开发效率高）（呼应 node-cli 第三节）。

**来源**：Node.js — "util.parseArgs"、commander / yargs — README

---

## 四、健壮性与体验

### 8. 输出被重定向或下游提前关闭（`mycli | head`）时，写 stdout 抛 `EPIPE` 会怎样？怎么处理？

未处理的 `EPIPE` 会让进程崩溃并打印难看堆栈。应监听 `process.stdout.on('error', …)`，对 `code==='EPIPE'` **静默退出**（表示消费端已走）。这是"管道友好"的必备细节（呼应 node-cli 第七节、node-stream-pipeline 的 error 传播）。

**来源**：Node.js — "EPIPE on stdout"、社区 — "Handle EPIPE in Node CLIs"

### 9. CLI 里颜色/emoji 该怎么得体地处理？

用 picocolors/chalk 上色，但要：检测到**非 TTY** 或存在 **`NO_COLOR`**/`FORCE_COLOR` 环境变量或 `--no-color` 时自动去色（这些库已内置检测）。否则 CI 日志/管道里会充满 `\x1b[32m` 乱码（呼应 node-cli 第六节）。

**来源**：NO_COLOR — "standard"、chalk — "color detection"

### 10. CLI 报错时怎样才算"专业"？

区分**用户错误**（用法不对→打印简短说明 + `--help` 提示 + 非 0 退出）与**程序 bug**（可选 `--verbose` 才显示堆栈）；错误进 stderr；退出码有意义（0 成功、1 通用、可细分）；别把内部栈直接甩给普通用户（呼应 node-cli 第六、七节、node-async-errors）。

**来源**：社区 — "Command line interface guidelines / UX"、12-factor — "Graceful shutdown / exit codes"

---

## 五、发布

### 11. 发布一个供他人 `npx` 使用的 CLI，package.json 要点有哪些？

`bin` 指向**带 shebang 的入口文件**；`files` 白名单含该入口及其依赖产物（常先用 tsup/esbuild 打成单文件）；`engines.node` 声明最低版本；`prepublishOnly` 跑构建+测试；`name`/`version` 规范（呼应 node-cli 第八节、node-publish 第一、六节）。发布后 `npx your-cli` 免装即用。

**来源**：npm docs — "npx"、Node.js — "Publishing packages"

### 12. `--watch`、起本地服务器这类 CLI，进程"关不掉"通常是什么原因？

有**未关闭的活跃句柄**：watcher（`fs.watch`）、keep-alive 服务器、子进程、`setInterval` 定时器都让事件循环不空（呼应 node-event-loop、node-fs watcher 泄漏）。要么收到 SIGINT 时优雅 `close`/`destroy` 它们（呼应 node-deploy-perf），要么对不需要阻止退出的句柄 `unref()`（呼应 node-child-process interview 第 10 题）。

**来源**：Node.js — "Why won't my process exit / active handles"
