# L7 作业：模块化

> 覆盖本阶段 2 关：`es-module`、`es-module-deep`。
> 提交方式：读代码题直接答；手写实现放 `homework/L7.answers.js`；`package.json` 修改放 `homework/L7.pkg.json`。

---

## 一、读代码写结果（每题 2 分，共 20 分）

**A1.**
```js
// m.js
export let n = 0;
export function inc() { n++; }

// main.js
import { n, inc } from './m.js';
inc(); inc();
console.log(n);
```

**A2.**
```js
// a.js
const obj = { x: 1 };
export default obj;
export const y = 2;

// b.js
import A, { y } from './a.js';
console.log(A, y);
```

**A3.**
```js
// util.js
export function foo() { return 'foo'; }
module.exports = { foo };   // 同一份文件既有 export 又有 module.exports
```
—— 这段代码会怎样？为什么？

**A4.**
```js
// main.js
import * as ns from './mod.js';   // mod.js 里 export default 42; export const a = 1;
console.log(Object.keys(ns), ns.default, ns.a);
```

**A5.**
```js
// config.js
export const ready = await fetch('/c.json').then(r => r.json());

// main.js
import { ready } from './config.js';
console.log(ready);   // 需要 Node 版本？会发生什么？
```

**A6.**
```js
// a.js
import { b } from './b.js';
export const a = 'A';
console.log('a sees b =', b);

// b.js
import { a } from './a.js';
export const b = 'B';
console.log('b sees a =', a);

// main.js: import './a.js';
```
写出两行 console 的输出与可能的错误。

**A7.**
```js
// main.js
import x from './m';   // 目录里存在 m.js
```
Node ESM 下结果？如何修复？

**A8.**
```json
// package.json
{ "name": "p", "type": "module", "exports": { "./utils": "./src/utils.js" } }
```
```js
import u from 'p/utils';      // ✅ ?
import v from 'p/src/v8.js';   // ❌ ?
```
分别能不能？为什么？

**A9.**
```js
const mod = await import(`./langs/${lang}.js`);
```
这种动态 import 在打包时会有什么后果？如何让 Rollup 摇得动？

**A10.**
```js
// lib.js
export const a = 1;
console.log('lib ran');    // 顶层副作用

// main.js（用户没 import lib）
```
`sideEffects: false` 与 `sideEffects: true` 时，打包 lib 后 main.js 的产物差别？

---

## 二、手写实现（每题 6 分，共 30 分）

**B1 · 一个 ESM 模块 `str.js`** 导出：`capitalize` / `kebab` / `camel` / `snake` 四个纯函数（无顶层副作用）。写完后：给出 `package.json` 的 `exports` / `sideEffects` 配置，让消费者能 `import { camel } from 'str-utils'`。

**B2 · 双包发布配置**：为一个既有 ESM 用户又有 CJS 用户的包写 `package.json` 骨架——包含 `type` / `main` / `module` / `exports`（types / import / require / default）；说明为什么 `types` 要放最上。

**B3 · 动态加载器**：写 `loadLocale(code)`——按 `'zh-CN' | 'en-US' | 'fr-FR'` 动态 `import` 对应文件，带**缓存**：同一 code 第二次调用不再 import。

**B4 · ESM 里的 `__dirname`**：写一个 `resolve(rel)` 函数，接受相对当前模块的路径，返回**绝对 file URL**（Node ESM 推荐姿势）。

**B5 · 打破循环**：给下面这段循环依赖代码做**最小改动**让它跑通，并说明改了什么：
```js
// user.js
import { format } from './format.js';
export const user = { name: 'Ann' };
console.log(format(user));

// format.js
import { user } from './user.js';
export function format(u) { return `${u.name}`; }
```

---

## 三、场景改造（20 分）

**给一个 Vue 3 + Vite 的项目**做**打包优化 checklist**——列出**你今天要做的**所有事情：
1. 把 `import Vue from 'vue'` 改为具名 `import { createApp, ref } from 'vue'`；
2. 路由页改成 `component: () => import('./views/Home.vue')`；
3. 加 `unplugin-vue-components` 自动按需导入 Element Plus；
4. `vite.config.js` 配 `rollupOptions.output.manualChunks` 拆 vendor；
5. 发布前跑 `npx publint`。

请**说明**每一条**为什么**能减小产物 / 提升首屏。

---

## 四、面试简答（每题 6 分，共 18 分）

**Q1**：什么是 **dual-package hazard**？给出复现方式与两种修复策略。

**Q2**：为什么 `sideEffects: false` **不能随手加**？给一个 CSS 被摇没的事故场景。

**Q3**：`import` 与 `await import()` 各自的**使用时机**？动态 import 是**表达式**这一点在工程上意味着什么？

---

## 五、拓展挑战（12 分，选做）

写一个**无构建**的静态页面：
- 只用一个 `index.html` + `<script type="importmap">` + `<script type="module">`；
- import map 把 `vue` 指向 `https://unpkg.com/vue@3/dist/vue.runtime.esm-browser.prod.js`；
- 页面里有一个 counter 组件，直接跑 ESM；
- 不能用任何打包器。

**追问**：这种「build-less」的模式在什么场景下真的可用？（个人主页、demo、内部工具）；什么时候**必须**打包？（性能、兼容、静态分析）。

---

## 我的答案（作答区）

（待补）
