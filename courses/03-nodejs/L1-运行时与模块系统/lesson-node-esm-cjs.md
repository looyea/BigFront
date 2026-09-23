# ESM 与 CJS：两套模块系统并存

> 目标：讲清 Node 里**同时存在的两套模块系统**——ESM（语言标准）与 CJS（Node 历史默认）——各自的启用方式（`.mjs`/`.cjs`/`package.json type`）、ESM 的静态结构与顶层 await，以及最折磨人的**互操作与混用坑**（`import` CJS、`require` ESM、条件导入、扩展名强制）。这是 ts-modules 讲过的原理在**纯 Node 运行时**里的落地版（呼应 ts-modules、node-modules、node-publish）。

---

## 一、Node 怎么判断一个文件是 ESM 还是 CJS？

三条规则，按优先级：

1. **扩展名**：`.mjs` 永远是 ESM，`.cjs` 永远是 CJS；
2. **`package.json` 的 `"type"`**：`.js` 文件看最近的 `package.json`——`"type": "module"` → 这些 `.js` 是 ESM；`"type": "commonjs"`（或省略）→ CJS；
3. **默认**：什么都没写 = CJS（Node 世界至今默认仍是 CJS）。

```jsonc
// package.json
{ "type": "module" }   // 本项目所有 .js 按 ESM 解析
```

一个项目**混用**时常见：主体 `"type":"module"`（`.js`=ESM），个别要当 CJS 的文件改名 `.cjs`。`"type"` 只改**解析身份**，不改语法能力——`.mjs` 里写 `require` 会直接报 `require is not defined`。

---

## 二、语法与"身份"的硬差异

```js
// ESM
import fs from "node:fs";              // 默认导入
import { readFile } from "node:fs/promises";
import data from "./config.json" with { type: "json" };   // ★ JSON 要 import attributes
export const x = 1;
export default function main() {}

// CJS（.cjs 或 type:commonjs）
const fs = require("node:fs");
module.exports = { x: 1 };
```

关键差异（每条都是一个坑源）：

| 维度 | ESM | CJS |
|---|---|---|
| 结构 | **静态**（import/export 在顶层、不可放 if 里） | 动态（`require` 可条件/可拼路径） |
| 时机 | 编译期解析依赖、异步加载 | 运行期同步加载 |
| `this` | 顶层 `this` 是 `undefined` | 顶层 `this === module.exports` |
| `__dirname` | ✗（自己用 `import.meta.url` 造，见 node-modules 第 11 题） | ✓ |
| 导出绑定 | **live binding**（引用，值会变） | **快照拷贝**（拿到的是那一刻的值） |
| 顶层 await | ✓ | ✗ |
| 循环依赖 | 通过 live binding 多半能"跑通" | 易拿到半成品 undefined |

---

## 三、静态结构：为什么 `import` 不能放进 if

ESM 的 `import`/`export` 是**声明**、必须在**顶层**、必须**静态可分析**。好处正是 tree-shaking 与并行预解析（呼应 node-modules 第 9 题、10-vite）。需要"条件加载"时，用**动态 `import()`**（它返回 Promise、可在任意处调用）：

```js
// ✗ 语法错误
// if (dev) import { logger } from './dev-logger';

// ✓ 用动态 import（ESM 与 CJS 里都可用！）
const { logger } = await import(dev ? "./dev-logger" : "./prod-logger");
```

动态 `import()` 是**两套系统唯一都支持**的异步加载入口，也是"延迟加载重依赖优化冷启动"的正解（呼应 node-modules 第 8 题）。

---

## 四、顶层 await：只在 ESM 有

```js
// ESM 模块顶层，直接 await，无需包 async 函数
const db = await createPool(process.env.DSN);   // ✓
export default db;
```

意义：初始化依赖异步资源（读配置、连库）时不必再造 `(async()=>{})()`。代价：含顶层 await 的模块会让其**导入方也变异步**（阻塞依赖图解析），且**不能**在 CJS 里用（CJS 同步加载，`require` 一个含顶层 await 的 ESM 会报错）。

---

## 五、最折磨人：ESM 里 import 相对路径必须带扩展名

在 `"type":"module"` 下：

```js
import utils from "./utils";       // ✗ ERR_MODULE_NOT_FOUND —— 不会自动补 .js！
import utils from "./utils.js";    // ✓ 必须写全（指向源码文件名，不是编译产物）
```

CJS 的 `require` 会自动尝试 `.js/.json/.node`（呼应 node-modules 第 4 题），ESM **不做扩展名猜测**，路径必须精确。这是"项目一切换 `type:module`，几十个 import 全红"的元凶。TS 端开了 `moduleResolution: nodenext/bundler` 时同样有"import 该写 `.js` 还是源文件"的讲究（呼应 ts-modules 第五节、ts-migration 第 5 题）。

---

## 六、互操作矩阵（谁 require/import 谁）

| 方向 | 支持度 | 说明 |
|---|---|---|
| ESM → ESM | ✓ | 原生 |
| CJS → CJS | ✓ | 原生 |
| **ESM → CJS** | ✓（较顺） | `import pkg from 'cjs包'` 拿到 `module.exports`（当 default）；具名能否导入看 cjs-module-lexer（node-modules 第 10 题） |
| **CJS → ESM** | ⚠️ 受限 | **不能 `require` 一个纯 ESM 包**（ESM 无同步 require 钩子、可能含顶层 await）；只能在 CJS 里用 `await import('esm包')`（且需异步环境） |
| 动态 `import()` | ✓ 两边都行 | 唯一跨系统的异步加载桥 |

所以"`require('纯ESM包')` 报 `ERR_REQUIRE_ESM`"是近两年最高频的迁移报错，解法基本是：① 改整个项目为 ESM；或 ② 在 CJS 里 `await import()`；或 ③ 选一个仍提供 CJS 的替代包。

---

## 七、选型：新项目怎么选

- **纯应用/脚本（自己要跑）**：`"type":"module"` 全 ESM，享受顶层 await、静态分析、与未来一致；
- **要发布的库**：优先**双格式**（ESM+CJS）配 `exports` 条件导出，照顾还在 `require` 的 CJS 消费者（详见 node-publish、呼应 ts-publish）；
- **混栈过渡期**：主 ESM、把需要 `require` 的胶水写成 `.cjs`，或用 `createRequire(import.meta.url)` 在 ESM 里造一个 `require`：

```js
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);   // 在 ESM 里获得同步 require 能力（给少数 CJS-only 依赖用）
```

---

## 八、自检清单

- [ ] Node 靠什么判定 `.js` 是 ESM 还是 CJS？`.mjs`/`.cjs` 各代表什么？
- [ ] 为什么 `import` 不能放 `if` 里？需要条件加载怎么办？
- [ ] ESM 相对 import 为什么必须写 `.js` 扩展名？CJS 呢？
- [ ] live binding 与 CJS 快照导出的区别会导致什么行为差异？
- [ ] 为什么 `require()` 一个纯 ESM 包会失败？给出三种解法。
- [ ] `createRequire` 解决什么场景？

---

## 🚀 部署预告

- 模块系统讲完，进入"Node 怎么把活干起来"：下一关 **node-event-loop** 钻进这套异步运行时的发动机——libuv 六阶段与 `nextTick`/`setImmediate`/微任务的先后（node-basics 第七题的完整版）；
- ESM 静态结构/treeshake 与 **10-vite**、**ts-modules** 三方互相印证；
- "发布时双格式 + exports 条件"将在 **node-publish** 展开（呼应 ts-publish）；`require('纯ESM')` 报错是 **ts-migration/node_modules 排错**常客。

下一关进入 **node-event-loop**：事件循环与 libuv 的六个阶段。
