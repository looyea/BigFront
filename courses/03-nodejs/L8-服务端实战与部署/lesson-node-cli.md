# 写命令行工具 CLI

> 目标：npm 的 `vite`、`esbuild`、`tsc`、`eslint` 都是 Node 写的 CLI。亲手做一个，你会同时打通 **argv 解析、`bin` 字段 + shebang、stdin/stdout/stderr 三大流、退出码、彩色/交互输出、`--help`/`--version`**，并理解"一个包如何变成一个可执行命令"（呼应 node-npm 的 `bin`、node-config 的命令行覆盖配置、10-vite/esbuild 的 CLI）。

---

## 一、`process.argv`：最朴素的解析

```js
// node cli.js build --watch src
// process.argv = ['/usr/bin/node', '/path/cli.js', 'build', '--watch', 'src']
const [node, script, ...args] = process.argv;
console.log(args);   // ['build', '--watch', 'src']
```

- 前两项是 node 与脚本路径，**用户参数从索引 2 起**（`argv.slice(2)`，呼应 node-config 第二节）；
- 手工解析 `--flag`/`-f`/`--key=value`/位置参数繁琐又易错——复杂 CLI 交给库（下节）。Node 20 内置 `util.parseArgs` 可作轻量选择。

---

## 二、`bin` + shebang：让脚本变成命令

```jsonc
// package.json
{ "name": "mycli", "bin": { "mycli": "./bin/cli.js" } }
```

```js
#!/usr/bin/env node            // ← 第一行 shebang：告诉 OS 用 node 执行本文件
import { run } from "../src/index.js";
run();
```

- **shebang**（`#!`）仅在 Unix 生效，Windows 靠 npm 生成的 `.cmd` 垫片；
- 本地开发 `npm link`（或 `npm i -g .`）把 `bin` 装进 PATH，就能全局敲 `mycli`（呼应 node-npm interview 第 3 题）；
- 发布后，别人 `npx mycli ...`（不必全局装）也是走这个 `bin`。

---

## 三、用库解析：commander / yargs / `util.parseArgs`

```js
import { program } from "commander";
program
  .name("mycli")
  .version("1.0.0")                       // 自动 --version
  .argument("<file>", "输入文件")            // 位置参数（必填）
  .option("-w, --watch", "监听模式")
  .option("-o, --out <dir>", "输出目录", "dist")   // 带值 + 默认
  .command("build")
  .description("构建项目")
  .action((opts) => { /* opts.watch / opts.out */ });
program.parse();                          // 自动生成 --help
```

- 库负责：`--flag`/`-f`/短横组合/子命令/校验/**自动生成 `--help`**；
- `util.parseArgs`（Node 18.3+ 内置）适合不想引依赖的小工具：给 `options` 映射即可解析 `--`/`-`/位置参数。

---

## 四、stdout / stderr / stdin：三条流

```js
process.stdout.write("普通输出\n");     // 正常结果 → stdout（可被管道 | 捕获）
process.stderr.write("出错了\n");       // 错误/日志 → stderr（不进管道数据流）
```

- **约定**：机器可读的**结果走 stdout**，**人类可读的诊断/报错走 stderr**（`console.log`→stdout，`console.error`→stderr）；这样 `mycli | grep` 只过滤结果不被日志污染（呼应 node-streams）；
- **读 stdin**：`process.stdin` 是可读流，可 `for await (const c of process.stdin)`（呼应 node-stream-pipeline），支持 `cat f | mycli` 管道输入；`isTTY` 判断是否交互终端（管道时非 TTY，可据此关彩色）；
- `fs.readSync(0, ...)` 可同步读 stdin（fd 0）。

---

## 五、退出码：给 shell/CI 的信号

```js
if (fatal) {
  console.error("失败原因");
  process.exit(1);          // 非 0 = 失败，CI/脚本据此中断（&& 链、set -e）
}
// 正常结束不必显式 exit，事件循环空了自然以 0 退出（呼应 node-event-loop）
```

- `0` 成功、`1` 通用错误；`126` 不可执行、`127` 命令未找到（呼应 node-child-process 第三节）；
- **别过早 `process.exit()`**——会截断还没 flush 的 stdout；应在 `'close'`/drain 后再退（呼应 node-child-process 'exit' vs 'close'）；
- 未捕获异常默认以**非 0** 退出，CI 会红（呼应 node-async-errors）。

---

## 六、体验增强：颜色、交互、进度

- **颜色**：`picocolors`/`chalk` 给输出上色；但**检测到非 TTY 或 `NO_COLOR`/`--no-color` 时自动去色**（避免管道/CI 里塞满 ANSI 乱码，呼应 node-buffer 的终端字节）；
- **交互**：内置 `node:readline`（`ask`/`createInterface`）、`prompts`/`enquirer` 做多选/确认；
- **进度**：`cli-progress`/`ora`（spinner）。清屏/光标控制用 ANSI 转义（`\x1b[..`）。
- **参数补全/错误提示**：友好地打印 `--help` 与建议，比抛栈更专业。

---

## 七、健壮性：错误处理与"管道友好"

```js
try {
  await run();
} catch (err) {
  console.error(err.message);        // 只给用户看得懂的；细节可 --verbose 才打
  process.exitCode = 1;              // 设 exitCode 而非硬 exit，让缓冲 flush 完
}
```

- 设 `process.exitCode` 而非 `process.exit()`，让进程自然结束（更不容易截断输出）；
- 处理 `EPIPE`：`mycli | head` 时下游先关，写 stdout 会 `EPIPE`——忽略它别崩（`stdout.on('error', e => e.code==='EPIPE' && process.exit())`，呼应 node-stream-pipeline 的 error）；
- `--help`/无参时打印用法而非报错。

---

## 八、发布一个 CLI

在 **node-publish** 流程基础上：`bin` 指到带 shebang 的入口、`files` 含该入口与其依赖、`engines.node` 声明版本、`prepublishOnly` 跑构建（很多 CLI 用 esbuild/tsup 打成单文件，呼应 10-vite/esbuild）。发布后用户 `npx mycli` 即用。

---

## 九、自检清单

- [ ] `process.argv` 前两项是什么？用户参数从哪开始？
- [ ] 一个包为什么能变成命令行？`bin` 与 shebang 各起什么作用？
- [ ] 结果、错误、输入分别走哪条流？为什么诊断要进 stderr？
- [ ] 退出码怎么定？为什么别过早 `process.exit()`？`process.exitCode` 有何优势？
- [ ] 非 TTY/`NO_COLOR` 时颜色怎么处理？`EPIPE` 为什么要忽略？
- [ ] 手写解析 vs `util.parseArgs` vs commander/yargs 的取舍？

---

## 🚀 部署预告

- `bin`+shebang 与 **node-npm**/`node-publish` 的打包发布闭环打通，才能把工具交到别人手里；
- CLI 里读配置/命令行覆盖，正是 **node-config** 分层的最上层（命令行 > env）；
- 把 CLI 打进容器/CI 跑批任务、`--watch` 起本地服务，其生产化收尾在最后一关 **node-deploy-perf**。

下一关进入 **node-deploy-perf**：Dockerfile、优雅退出、进程守护、性能剖析与生产就绪清单——为整个 03-nodejs 收官。
