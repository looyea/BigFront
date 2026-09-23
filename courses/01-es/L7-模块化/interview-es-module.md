# 面试题 · ES Module

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）ESM 与 CommonJS 的 5 大差别？**
- 参考要点：① **静态**结构 vs 运行时 require；② **live binding** vs 值拷贝；③ 顶层 `await` 支持 vs 不支持；④ 明确 `this` = undefined vs CJS 里 this=module.exports；⑤ `import.meta` vs `__dirname`/`__filename`；⑥ 加载策略异步（浏览器） vs 同步（Node）。
- 来源：Node.js 官方《ES modules: What's the difference》；MDN。

---

**2）什么是 live binding？写一段代码演示。**
- 参考要点：
  ```js
  // counter.js
  export let n = 0;
  export const inc = () => n++;
  // main.js
  import { n, inc } from './counter.js';
  inc(); inc(); console.log(n);   // 2 —— 而不是 0
  ```
  ESM 导出的是**绑定**（引用），不是值快照。CJS 拿到的是拷贝。
- 来源：2ality《The different kinds of ES6 imports》；MDN。

---

**3）`import c from './m'` 相当于哪一种具名导入？**
- 参考要点：`import { default as c } from './m'`。**default 就是一个名为 'default' 的具名导出**——所以：① 每个模块只能有一个；② 导入方变量名随便起，与源解耦；③ 也能 `export { x as default }`。
- 来源：ECMA-262；MDN；StackOverflow 高票。

---

**4）Node ESM 里 `import './utils'` 为什么报错？浏览器 `<script type="module">` 里同样问题？**
- 参考要点：ESM 规范要求 **specifiers 完整**——必须有扩展名、相对路径必须显式。CJS 那种「自动补 `.js` / `/index.js`」在 ESM 里被砍掉是为了**跨环境一致**（浏览器要精确 URL）。**修**：写 `./utils.js`；Node 里可以配 `exports` 字段做映射；或用工具（`tsup` / `esbuild`）在打包时补全。
- 来源：Node.js 官方文档；TC39 讨论；StackOverflow 高票。

---

**5）`import()` 动态导入的 3 个典型用途？**
- 参考要点：① **代码分割**——打包器把动态 import 目标切独立 chunk，首屏不加载；② **条件加载**——`if (featureFlag) await import('./heavy.js')`；③ **运行时决定路径**——`await import(\`./langs/${lang}.js\`)`（要打包器配合 glob）；④ 从 CJS 加载 ESM（唯一路径）；⑤ 单例失效场景下的重加载（HMR）。
- 来源：MDN `import()`；webpack / Rollup 官方文档 code-splitting。

---

**6）`package.json` 里 `type`、`main`、`module`、`exports` 分别是什么？**
- 参考要点：
  - `type`：`"module"` → 本包 `.js` 视为 ESM；`"commonjs"`（默认）→ 视为 CJS；
  - `main`：CJS 时代的入口，Node 老版本读；
  - `module`：**打包器约定**（Rollup/webpack 优先读它做 tree-shake），Node 不认；
  - `exports`：**现代入口**，条件式映射（import / require / types / browser / node / default）；一旦声明，未列子路径不可访问。
- 来源：Node.js 官方《Packages》；webpack 5 文档。

---

**7）ESM 里为什么不能用 `require`？CJS 里为什么不能 `import` ESM（静态）？**
- 参考要点：ESM 是**独立模块系统**——不共享 CJS 的 `require` 与 `module.exports`；反之 CJS 是**同步**语义，无法处理 ESM 的顶层 await 与 Promise 加载链——所以只能 `await import()`。Node 的 `createRequire(import.meta.url)` 可以在 ESM 里创建 require 函数（过渡用）。
- 来源：Node.js 官方 interop 文档。

---

**8）循环依赖在 ESM 里怎么表现？**
- 参考要点：ESM **允许**循环 import——因为导入是**绑定的引用**，运行时才解引用。但**初始化顺序**决定你读到的是「已 init 的值」还是「TDZ 中的空槽」。规避：① 只在函数体里读循环方；② 用 `import * as ns` 命名空间（live，运行时读）；③ 抽出公共依赖到第三个模块。
- 来源：Node.js 官方文档；StackOverflow 高票。

---

**9）ESM 中的 `this` 是什么？为什么？**
- 参考要点：**`this === undefined`**。ESM 隐式**严格模式**且模块顶层 `this` 规范定义为 undefined。CJS 里顶层 `this === module.exports`——老代码用 `this.foo = bar` 挂属性，改成 ESM 会崩。
- 来源：ECMA-262；MDN。

---

**10）如何在 ESM 里读取当前模块的路径（`__filename` / `__dirname` 的替代）？**
- 参考要点：`import.meta.url`（`file://...`）+ `url.fileURLToPath(import.meta.url)` 得 `__filename`；`path.dirname` 得 `__dirname`。
  ```js
  import { fileURLToPath } from 'node:url';
  import path from 'node:path';
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  ```
  或 `new URL('./asset.png', import.meta.url)`——直接用 URL 对象，跨平台更规范。
- 来源：Node.js 官方文档；MDN `import.meta`。

---

**11）tree-shaking 为什么依赖 ESM？**
- 参考要点：ESM 的 `import { x } from 'y'` 是**编译期静态**结构——Rollup 能算出 y 里没被 x 引用的部分全部可摇；CJS 的 `require('y')` 是**运行时值**，`m.x` 与 `m[y.key]` 打包器无法预测——只能整体保留。这是 webpack 2 加入 ESM 支持后才实现 tree-shaking 的原因。
- 来源：Rollup 官网《Tree-shaking》；webpack 官方文档。

---

**12）现场手写：一个 `importLazy(specifier)`，第一次调用时才动态加载并缓存，之后**同步**取用。**
- 参考要点：
  ```js
  const cache = new Map();
  function importLazy(specifier) {
    if (!cache.has(specifier)) {
      cache.set(specifier, import(specifier));
    }
    return cache.get(specifier);   // 同一 Promise，重复 await 也 OK
  }
  const mod = await importLazy('./heavy.js');   // 第一次 await 触发加载
  const same = await importLazy('./heavy.js');  // 立即 resolve 同一 Promise
  ```
  **追问**：Node 内置 `import()` 有自身缓存，同一 specifier 只会加载一次——本函数主要是**给动态 specifier 做去重**（不同调用点用相同变量）。
- 来源：MDN `import()`；Node.js 官方 ESM 缓存文档；StackOverflow 高票。

---

**13）为什么说「ESM 模块是单例」？这给单元测试的 mock 带来什么麻烦？**
- 参考要点：模块体**首次被 import 时执行一次**，之后所有导入方共享同一份内存（类似 require 缓存但按绑定粒度）——所以 store/注册表天然单例。麻烦：测试里「重新 import 一个假模块」不会生效，缓存里仍是原实例；必须 `jest.mock` / `vi.mock`（编译期改写 import 引用）或工厂函数依赖注入。另：浏览器里 URL 多一个 `?v=2` 就是**新实例**（按 resolved URL 缓存），缓存击穿/多版本共存都踩过这个坑。
- 来源：ECMA-262 模块记录（Module Map）；Vitest/Jest mocking 文档；HTML spec 模块缓存。

---

**14）`export default` 有哪些反直觉的坑？想把对象字面量设为 default 怎么写？**
- 参考要点：① 一个模块**最多一个** default，重复即 SyntaxError；② `export default { x: 1 }` 中 `{` 被当**块语句**起始 → 语法错，要 `export default ({ x: 1 })` 或先赋变量；③ default 本质是**名为 'default' 的具名导出**：`import c from './m'` ≡ `import { default as c } from './m'`，也可 `export { c as default }`——这意味着导入方名字随便改，不影响导出方；④ default 后可接匿名函数/类（具名 export 不行）。工程主张：库尽量具名导出（重命名可见、tree-shake 友好、TS 重构安全）。
- 来源：MDN `export`；2ality《ES6 modules: default exports considered harmful》辩论。

---

**15）import 声明会提升吗？多个相互依赖的模块整体执行顺序是什么？`export * as ns` 有何特别？**
- 参考要点：import 声明**提升**——无论写在模块哪里，都在模块体之前生效。整体系按**依赖图后序遍历**：先递归链接/求值被依赖模块（循环处按 TDZ 规则跳过），最后才跑本模块体。`export * from` 只转发不建本地绑定；`export * as ns from './m.js'` 把整模块打包成**命名空间对象**，且 ns 是 live 的——属性在**访问时**才解引用，所以循环依赖场景用 `ns.b` 比直接解构 `b` 安全（把读取推迟到初始化完成后）。
- 来源：ECMA-262 《Module Semantics》（Instantiate/Evaluate）；MDN `export * as ns`；Rollup 循环依赖告警文档。
