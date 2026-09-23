# L1 作业：运行时与模块系统

> 覆盖本阶段三关：**node-basics**（运行时/全局/process）· **node-modules**（CommonJS）· **node-esm-cjs**（两套模块系统）。读懂 + 手写 + 场景 + 简答 + 挑战，把"Node 到底怎么组织一个程序"彻底吃透。

---

## 一、读代码（10 小题：写出输出/结论并解释为什么）

**1.** `node run.js alpha beta`，脚本里 `console.log(process.argv.length)` 和 `console.log(process.argv.slice(2))` 分别输出什么？

**2.** 下面 CJS 模块被 `require` 后，调用方拿到的导出是什么？

```js
// m.js
exports.a = 1;
exports = { a: 1, b: 2 };
```

**3.** 同一进程内：

```js
const x = require('./counter');
const y = require('./counter');
x.count = 99;
console.log(y.count);
```

输出什么？这体现了 require 的什么机制？

**4.** 在 `"type":"module"` 项目里，下面两行哪行会报错、报什么？

```js
import fs from "fs";
import utils from "./utils";
```

**5.** `console.log(typeof window, typeof globalThis, typeof process)` 在 Node 里输出什么？

**6.** `require` 一个目录 `./pkg`（该目录有 `package.json` 写着 `"main": "lib/entry.js"`），Node 最终加载哪个文件？

**7.** 在 CJS 里 `require('./legacy-esm-only-pkg')` 抛 `ERR_REQUIRE_ESM`，给出两种不改整项目为 ESM 的解法。

**8.** 读 ESM 循环：

```js
// a.mjs: export let n=0; import {inc} from './b.mjs'; inc(); console.log(n);
// b.mjs: import {n} from './a.mjs'; export function inc(){ n... }  // 假设法可行
```

为什么 ESM 的 live binding 让"导入方能看到源里后续的修改"，而 CJS 解构常拿 undefined？

**9.** `console.log(this === module.exports)` 在 CJS 文件顶层、`console.log(this)` 在 ESM 文件顶层，分别是什么？

**10.** `process.exitCode = 1; console.log("bye");` 与 `console.log("bye"); process.exit(1);` 哪个更可能丢 "bye" 输出？为什么？

---

## 二、手写（5 题）

**1.** 写一个 CJS 模块 `mathx.js`，**同时**演示 `exports.add` 与 `module.exports = {...}` 两种导出，并各配一个 `require` 它的正确调用示例；再写一段注释说明"为什么 `exports = {...}` 是错的"。

**2.** 用 `process.argv.slice(2)` 手写一个最小 CLI：`node sum.js 1 2 3` 打印 `6`；无参数或含非数字时设 `process.exitCode = 1` 并向 **stderr** 打印用法。

**3.** 在 ESM 文件里写出等价于 CJS `__dirname` 的三行代码（用 `import.meta.url` + `fileURLToPath` + `path.dirname`）。

**4.** 写一段"条件加载"：用**动态 `import()`** 根据 `process.env.NODE_ENV` 异步加载 `./dev.js` 或 `./prod.js` 并调用其默认导出。说明为什么这里不能用静态 `import`。

**5.** 给一个 `"type":"module"` 的包补 `package.json` 的关键片段，使其**同时**支持 `import 'pkg'`（ESM）与 `require('pkg')`（CJS）两种消费方式（`exports` 条件导出，types 放最前）。

---

## 三、场景题（1 题）

你把一个老 CJS 项目升级依赖后，CI 突然报 `ERR_REQUIRE_ESM`（某个新依赖变成了 ESM-only），而项目主体仍是 `"type":"commonjs"`、且有大量 `require`。请给出一份**务实处置方案**，比较以下三条路线的成本/风险并说明你选哪条、为什么：

- 全项目迁移到 ESM；
- 保留 CJS，改造"用到该 ESM 包"的少数点为 `await import()`；
- 换用/锁版本到仍提供 CJS 的替代实现。

（300 字以内，需提到顶层 await、扩展名、配置文件改名等连锁风险点。）

---

## 四、简答题（3 题）

**1.** `process.cwd()` 与 `__dirname` 有何不同？为什么"用 PM2/Docker 从别处启动导致找不到文件"的 bug 常与此有关？

**2.** 解释 `module.exports` 与 `exports` 的关系，并说明"exports = {...} 为什么导出为空"。

**3.** 为什么 ESM 要设计成静态结构？它换来了什么（至少 2 点）、又必须用什么机制来弥补"不能条件 import"？

---

## 五、挑战题 🏆

设计一个"**同一个小工具库，既能被 `require` 也能被 `import`**"的最小工程：

- 用哪套构建（tsup/裸 tsc/rollup 任一）产出 ESM + CJS 双产物 + 类型（若用 TS，呼应 ts-publish）；
- 给出 `package.json` 的 `type` / `main` / `module` / `types` / `exports`（含 `types→import→require→default` 顺序）完整片段；
- 若库里有一个模块级单例（如缓存 Map），说明 **dual package hazard** 会让 `import` 方和 `require` 方各拿到几份、如何验证、如何规避；
- 列出发布前你会跑的验收命令（`npm pack --dry-run` / `publint` / `attw`）各查什么。

给出目录结构 + 关键配置 + 一段"如何验证双消费"的测试代码。
