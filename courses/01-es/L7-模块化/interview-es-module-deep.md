# 面试题 · 模块系统深入

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）ESM 模块加载的三阶段是什么？为什么 import 会「提升」？**
- 参考要点：**Parsing（解析）→ Linking（链接）→ Evaluation（求值）**。Parsing 建 AST 与所有 import/export 声明；Linking 沿依赖图递归加载并把 export 与 import 的槽位绑定；Evaluation 按 DFS 后序执行顶层代码。**提升**是因为「链接」在「求值」之前——顶层代码执行时所有 import 已经有绑定（可能仍在 TDZ）。
- 来源：ECMA-262 §16.2；Node.js 官方《ES module lifecycle》；2ality。

---

**2）ESM 与 CJS 的循环依赖行为有什么本质不同？**
- 参考要点：CJS 是**运行时**加载——`require` 遇到循环时返回**已初始化的部分快照**（可能是空对象）；ESM 是**编译时链接 + 运行时求值**——绑定提前建好，读到 TDZ 就抛 ReferenceError，读到已求值就是正确值。**共同经验**：只在函数体内读循环方，或抽公共依赖到第三模块。
- 来源：Node.js 官方循环依赖文档；StackOverflow 高票。

---

**3）`package.json` 里 `exports` 字段解决了什么问题？**
- 参考要点：① 明确**公共 API**（未列的子路径不能 import，防消费者乱碰内部）；② **条件式解析**：同一份代码给 Node / 浏览器 / TS / ESM / CJS 分别指向不同产物；③ 支持**子路径导出**（`"./utils": "./dist/utils.js"`）。是**双打包时代**（同时发 ESM/CJS）的关键机制。
- 来源：Node.js 官方《Packages》；webpack 5 文档。

---

**4）什么是 dual-package hazard？怎么避免？**
- 参考要点：包同时发 ESM 与 CJS 两个入口——Node 会**分别**加载，导致两个**不同实例**，共享状态（单例 store / 事件总线 / instanceof）分裂。避免：① 只发 ESM 或 CJS 之一；② CJS 版本 `require` ESM 版本（不行，反过来）；③ 内部维持**独立 registry**（`globalThis.__MY_LIB__` 做单例）；④ 用 `sideEffects: false` 让消费者打包器只保留一份。
- 来源：Node.js 官方文档；sindresorhus 关于 ESM-only 的讨论。

---

**5）`sideEffects` 字段的两个用途分别是什么？**
- 参考要点：① `false`：告诉打包器**所有文件无副作用**，可放心整块摇掉未使用文件；② 数组 `["*.css", "./polyfill.js"]`：告诉打包器**这些文件有副作用**，即使用没显式 import 也不能摇。**⚠️** 错标 false → CSS 被删。
- 来源：webpack 官方 tree-shaking 指南；Rollup 文档。

---

**6）`cjs-module-lexer` 是干什么的？为什么需要它？**
- 参考要点：Node ESM 里 `import { readFile } from 'fs'` 时——fs 是 CJS，没有静态导出声明。Node 用 **cjs-module-lexer** 静态扫描 fs.js 源码，识别 `exports.foo = ...` / `module.exports = { foo }` 等**已知模式**，生成具名导出清单给 ESM 层。**局限**：动态模式（`Object.assign(exports, obj)`、循环 for 里赋值）识别不到。
- 来源：Node.js GitHub `cjs-module-lexer`；nodejs.org 官方 interop 文档。

---

**7）顶层 `await` 的适用与不适用场景？**
- 参考要点：**适用**：polyfill 加载、特性探测、单例配置、WASM 初始化、动态 feature flag——**必须在使用前完成**的一次性异步工作。**不适用**：业务数据加载（阻塞依赖链）、循环依赖里（可能死锁）、频繁热重载的库。**兼容性**：Node 14.8+、Safari 15+；打包要 target esnext。
- 来源：TC39 top-level-await 提案；MDN；v8.dev。

---

**8）如何在 Node ESM 中读取当前文件所在目录？**
- 参考要点：
  ```js
  import { fileURLToPath } from 'node:url';
  import path from 'node:path';
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  ```
  或直接：**`new URL('./asset.png', import.meta.url)`**——URL 对象跨平台且能被 fs / fetch 直接消费。
- 来源：Node.js 官方 `import.meta` 文档。

---

**9）Import Maps 解决了什么问题？现在支持度如何？**
- 参考要点：**浏览器里的裸导入**（`import 'react'`）——传统需要打包器解析 `node_modules`；Import Maps 让你在 HTML 里声明映射（`"react": "https://esm.sh/react@18"`），**浏览器原生**跑 ESM 而**不用打包**。**支持**：Chrome 89+、Safari 16.4+、Firefox 108+、Node 18.19+（`--experimental-import-meta-resolve`）。
- 来源：WICG import-maps 提案；MDN；caniuse。

---

**10）写一个 tree-shakable 的库要注意什么？列 5 条。**
- 参考要点：① **具名导出**不用 default 打包；② **顶层无副作用**；③ `sideEffects: false`；④ `exports` 字段完整；⑤ 每个 API 独立文件（lodash-es 风格）；⑥ **别用 `export *` 通配**（部分打包器摇不动）；⑦ 类静态方法、装饰器要**留意**是否被视作有副作用。
- 来源：Rollup 官方《Tree-shaking》；webpack 官方指南；sindresorhus 关于 ESM 生态的文章。

---

**11）`import x from './m.json'` 在 Node ESM 里为什么不合法？怎么修？**
- 参考要点：ESM 规范只加载**符合模块语法**的资源——JSON 不是模块。Node 20.10+ 用 **Import Attributes**：`import x from './m.json' with { type: 'json' }`；早期叫 Import Assertions（`assert { type: 'json' }`）已废弃。**替代方案**：`fs.readFileSync + JSON.parse`；`createRequire(import.meta.url)('./m.json')`。
- 来源：TC39 import-attributes 提案；Node.js 官方文档。

---

**12）现场手写：一个「无构建」的 HTML 页面，用 Import Maps + CDN 加载 Vue 3。**
- 参考要点：
  ```html
  <script type="importmap">
  {
    "imports": {
      "vue": "https://unpkg.com/vue@3/dist/vue.runtime.esm-browser.prod.js"
    }
  }
  </script>
  <script type="module">
    import { createApp, ref } from 'vue';
    createApp({
      setup() { const n = ref(0); return { n }; },
      template: `<button @click="n++">{{ n }}</button>`,
    }).mount('#app');
  </script>
  ```
  **追问**：浏览器**如何**在没有 Node 的情况下解析 `import { x } from 'vue'`？→ 通过 importmap 把 specifier 映射成 URL，其余走浏览器原生 URL 加载。
- 来源：MDN `<script type="importmap">`；Vue 官方 playground；caniuse。

---

**13）`createRequire` 是给谁用的？与 Import Attributes 怎么选？**
- 参考要点：`createRequire(import.meta.url)` 在 ESM 里造一个**同步** require——适用于过渡期依赖只有 CJS 且必须同步拿（老配置加载器、.node 二进制）、历史 JSON 读取（Node 17.5 前无稳定替代）。取舍：新代码优先 `import json with { type: 'json' }`（静态可分析、打包器友好）；createRequire 是**运行时旁路**，打包器看不到这笔依赖，滥用会让产物漏包。两者都解决不了「ESM 必须同步」的根本矛盾——能改异步就改异步。
- 来源：Node.js 文档《module.createRequire》；TC39 import-attributes 提案 README。

---

**14）`exports` 条件（conditions）匹配规则是什么？把 `types` 放错位置会怎样？**
- 参考要点：条件对象**自上而下第一个命中**，不在条件集里的跳过；Node 运行时默认带 `node`/`import`/`require`，打包器额外注入 `browser`/`module` 等（约定非标准）。`types` 必须置顶：TS 的 `node16/nodenext` 解析也读 exports，若 `import` 在前会先命中 JS 文件导致**类型丢失/报错**。兼容老工具链需同时留 `main`/`module` 字段（只读不到 exports 的老 Node/打包器用）。子路径模式：`"./utils/*": "./dist/utils/*.mjs"` 做包内别名。
- 来源：Node.js ESM 文档《Conditional exports》；TypeScript 4.7《moduleResolution node16/bundler》发布说明。

---

**15）线上怀疑中了 dual-package hazard，怎么实锤？给出排查与修复路径。**
- 参考要点：**症状**：`instanceof` 无故失败、单例事件双触发、`Symbol.for` 注册表能共享但模块级 Map/数组不共享。**实锤**：打印两边的 `import.meta.url` / `require.cache` 路径看是否一 `.mjs` 一 `.cjs`；打包器侧看 stats/bundle 里同包两份；`npm ls 包名` 查版本分裂。修复：① 升级依赖到统一入口版本；② 用 `exports` 让 import/require 都指向同一真身（内部 CJS 壳再 require 过去）；③ 消费者用 bundler `alias`/`resolve.dedupe` 强制单例；④ 长期：推动上游纯 ESM。
- 来源：Node.js 官方 ESM 文档《Dual package hazard》节；webpack Issue 社区排查案例。
