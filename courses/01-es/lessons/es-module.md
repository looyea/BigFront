# ES Module：静态模块系统的骨架

> 目标：**分清 ESM / CommonJS / AMD 三大模块系统**；掌握 `import` / `export` 的**全部形式**；理解「**live binding**」与「静态分析」这两大 ESM 独有特征；能看懂 package.json 的 `type`、`exports` 字段。

---

## 一、JS 模块系统的三代演化

| 时代 | 规范 | 语法 | 特点 |
| --- | --- | --- | --- |
| 服务端 | **CommonJS**（Node 起） | `require()` / `module.exports` | **动态**、**值拷贝**、同步加载 |
| 浏览器（过渡） | **AMD / UMD**（RequireJS、SystemJS） | `define(...)` | 异步加载、已淘汰 |
| 统一（现在） | **ESM**（ES2015） | `import` / `export` | **静态**、**live binding**、异步加载 |

**ESM 是**语言层标准**——浏览器、Node、Deno、Bun 全部原生支持。CJS 是**社区约定**，只在 Node 里跑。

---

## 二、`export` 的五种形式

```js
// 1. 单值具名
export const PI = 3.14;
export function foo() { }

// 2. 批量列表
const a = 1, b = 2;
export { a, b };

// 3. 重命名
export { a as x, b as y };

// 4. 默认（**每个模块最多一个**）
export default function () { }    // 匿名函数
export default class Foo { }
const c = 42; export { c as default };   // 等价

// 5. 再导出
export { readFile } from 'node:fs/promises';
export * from './other.js';
export * as ns from './other.js';   // 把整个模块打包成 ns
```

**⚠️ `export default` 三大坑**：
1. 只能一个——同一模块 `export default a; export default b;` SyntaxError。
2. `export default { x: 1 }` —— `{}` 被当块解析，要写 `export default ({ x: 1 })` 或先赋值给变量再 default。
3. **default 是**另一个具名**——`import c from './m.js'` 相当于 `import { default as c } from './m.js'`；改本地变量名不影响导入。

---

## 三、`import` 的六种形式

```js
// 1. 具名
import { readFile, writeFile as w } from 'node:fs/promises';

// 2. 默认
import React from 'react';

// 3. 命名空间
import * as _ from 'lodash-es';
_.debounce(fn);

// 4. 混合
import React, { useState, useEffect } from 'react';

// 5. 副作用（只求执行，不求导出）
import './polyfill.js';

// 6. **动态 import**（返回 Promise）
const { default: Chart } = await import('chart.js');
// 用于代码分割 / 按需加载 / 条件加载
```

**⚠️ `import` 是**静态**声明**：
- 必须**顶层**（模块作用域）——不能在 if / function 里；
- 路径必须是**字符串字面量**（可含 `/`，但**不能用变量**）；
- 会**提升**——所有 import 在最开始执行，不受位置影响。

**⚠️ 唯一能动态的是** `import()` 函数形式——它是表达式，可以带变量参数与条件。

---

## 四、ESM 的两大**独有特征**

### 特征 1：**静态分析**（tree-shaking 的前提）

打包器（Rollup / Vite / webpack 2+）**编译时**就能知道哪些导出被用：
```js
import { sum } from './math.js';   // 只用了 sum
// math.js 里其它导出 mul / div 可被摇掉
```

CJS 做不到：`const m = require('./math.js')` 是**运行时值**，无法预知用了哪些字段。

### 特征 2：**live binding**（**不是拷贝**）

ESM 导出的是**「绑定」**（引用），不是「值快照」。导出方改了，导入方看到的就是新值。

```js
// counter.js
export let count = 0;
export function inc() { count++; }

// main.js
import { count, inc } from './counter.js';
console.log(count);   // 0
inc();
console.log(count);   // 1 —— 不是 0！

count = 99;            // ❌ TypeError：count 是只读绑定（导入方不能改）
```

**对比 CJS**：`let { count } = require('./counter.js')` 拿到的是**值快照**——counter 里改了 count，你这边不变。

**为什么 live binding 有用**：**单例状态**天然工作——Redux store、模块级配置、循环依赖下的类引用都能"活"起来。

---

## 五、模块作用域与「单例」

**每个模块都是一份单例**——第一次 import 时才执行，之后所有 import 共享同一份内存。

```js
// singleton.js
export const obj = { n: 0 };
obj.n++;
console.log('singleton ran');   // 只打印一次

// a.js
import { obj } from './singleton.js';   // 'singleton ran'，n=1
obj.n++;                                 // 2

// b.js
import { obj } from './singleton.js';   // 不再打印，同一份 obj，n=3
```

**用途**：跨模块共享状态、缓存、注册表；**⚠️ 陷阱**：写单元测试时 mock 一个模块**不能通过重新 import 生效**——得用 jest.mock / vitest mock 或工厂函数。

---

## 六、路径规则与**扩展名**

```js
import x from './file.js';     // ✅ Node ESM 必须写扩展名
import y from 'pkg';           // 从 node_modules 或 exports 字段解析
import z from 'pkg/sub';        // 子路径需在 package.json exports 声明
import w from './dir/index.js'; // 不能省略 index.js（Node ESM 严格）
```

**⚠️ Node ESM vs CJS 的路径差别**：
- CJS 允许 `require('./file')` 自动补 `.js` / `.json` / `/index.js`；
- **ESM 必须写全**（`./file.js`）——**浏览器**也严格要求扩展名。
- Node 里想省：加 `--experimental-specifier-resolution=node`（不推荐）或用 `exports` 字段。

---

## 七、`package.json` 的 `type` 与 `exports`

```json
{
  "name": "my-pkg",
  "type": "module",             // 让 .js 被当 ESM 处理（否则是 CJS）
  "main": "./dist/index.cjs",   // CJS 入口（给老 Node）
  "module": "./dist/index.mjs", // 打包器约定的 ESM 入口（webpack/rollup 读）
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",   // ESM 消费者
      "require": "./dist/index.cjs",  // CJS 消费者
      "default": "./dist/index.mjs"
    },
    "./utils": "./dist/utils.mjs",    // 子路径导出
    "./package.json": "./package.json"
  }
}
```

**⚠️ `exports` 一旦声明，未列的路径**不能**被 import**（防止消费者碰内部文件）。这是「**双打包**」时代（同时支持 ESM 与 CJS）的标配。

---

## 八、CJS 与 ESM 的**混用**规则

| 方向 | 能不能 | 怎么弄 |
| --- | --- | --- |
| **CJS → ESM**（`require('./mjs-file.mjs')`） | ❌ 直接不行 | 只能 `await import()` 或改成 .cjs / 让上游包提供 CJS 出口 |
| **ESM → CJS**（`import x from './cjs-file.js'`） | ✅ 可以 | **default 导入** = `module.exports`；具名导入靠 Node 静态分析 `cjs-module-lexer`，识别 `exports.foo = ...` |
| `import.meta.url` 在 CJS 里 | ❌ | CJS 用 `__dirname` / `__filename` |
| `import.meta.url` 在 ESM 里的** dirname 等价** | | `path.dirname(fileURLToPath(import.meta.url))` |

**⚠️ 过渡期最痛的坑**：ESM 里没 `__dirname`——所有老的 `path.join(__dirname, 'config.json')` 都要重写。

---

## 九、`import.meta`

ESM 独有的元信息对象：
- `import.meta.url`：当前模块的 `file://` URL（Node）或 https URL（浏览器）
- `import.meta.resolve(spec)`：解析 specifier → URL（Node 20+）
- `import.env`（自定义字段，Vite 塞了 `import.meta.env.DEV` 之类）

**常用套路**（Node ESM 版 `__dirname`）：
```js
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

---

## 十、循环依赖：live binding 帮你一半，另一半还是要小心

**ESM 允许循环 import**——但**执行顺序**决定你拿到的是「已初始化的绑定」还是「TDZ 中的空绑定」。

```js
// a.js
import { b } from './b.js';
export const a = 1;
console.log('a', b);   // b 可能 undefined（B 还没跑）

// b.js
import { a } from './a.js';
export const b = 2;
console.log('b', a);   // a 已初始化 → 1

// main.js
import './a.js';
```

**规避**：① 只在函数里读循环依赖；② 把共享部分抽到第三个模块；③ `import * as ns` 拿命名空间对象，**运行时**读 `ns.b`（因为 ns 是 live 的）。

---

## 十一、自检清单

- [ ] 说出 ESM 与 CJS 的 5 个关键差别。
- [ ] `export default` 为什么「一个模块只能有一个」？它其实是**具名** default——怎么理解？
- [ ] 什么是 live binding？写一段代码演示。
- [ ] `import()` 与 `import` 语句的差别？给一个代码分割场景。
- [ ] Node ESM 里 `import './file'` 为什么报错？怎么修？
- [ ] 如何在 ESM 中读 `__dirname` 等价物？

---

## 🚀 部署预告（本关点到，细节在 L10）

**ESM 在构建/部署阶段的关键影响：**

1. **tree-shaking 依赖静态 import**：`import { x } from 'lib'` 让 Rollup 能摇掉 lib 里未使用的部分；`require('lib')` 不行——这是**「webpack 用 ESM 才 tree-shake」**的根本原因。Vite 从 dev 到 build 全走 ESM 生态。
2. **exports 字段是发布协议**：npm 包要同时给 `import` / `require` / `types` 三份出口——**双打包**（`unbuild`、`tsup`、`vite build --lib`）产物结构。细节见 L10 `es-publish`。
3. **动态 import 与代码分割**：`await import('./heavy.js')` 让 Rollup 自动切**独立 chunk**——首屏不加载，需要时异步拉。是**性能优化**里最有效的一招。
4. **ESM 与 sourcemap**：`import.meta.url` 在生产是**产物 URL**——如果 chunk 拆得碎，栈里 module 名对应到 `.map` 需要**准确相对路径**；上传 `.map` 时目录结构要对齐。
5. **Node 里 `type: module` 的连锁反应**：所有 `.js` 文件变 ESM，`__dirname` / `require` 失效；迁移常配合 `cjs` 后缀或 `tsup` 打包成双份。

细节 L10 `es-build` 展开。**你现在只需要记住**：**ESM 的静态性 = tree-shaking 的前提 = 现代前端构建的地基。**
