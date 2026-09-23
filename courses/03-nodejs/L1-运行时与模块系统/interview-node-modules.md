# node-modules 面试题精选

> 共 15 题，覆盖 **模块包装与导出 / require 解析 / 缓存与单例 / 循环依赖 / CJS 特性 / 与 ESM 交界** 六类。

---

## 一、模块包装与导出

### 1. `require`、`module`、`exports`、`__dirname` 是全局变量吗？它们从哪来？

都不是真全局。Node 执行每个 CJS 文件前，会把整份源码包进一个**函数外壳**（module wrapper）：

```js
(function (exports, require, module, __filename, __dirname) {
  /* 你的代码 */
})(...)
```

这些标识符是**该函数的形参**，由 Node 在调用时注入。所以：① 它们只在当前模块可见，不污染 `globalThis`；② 文件顶层的 `var/const` 也是这个函数的局部变量，模块间天然隔离（呼应 node-basics 第九题、node-modules 第一节）。这也是"给 exports 重新赋值无效"的根因——它只是个局部参数。

**来源**：Node.js — "Modules / The Module Wrapper"; StackOverflow — "what is module.exports vs exports"

### 2. `exports` 和 `module.exports` 到底什么关系？为什么 `exports = {...}` 不生效而 `module.exports = {...}` 生效？

`require` 最终返回的是 **`module.exports`**。Node 在模块开头做了 `var exports = module.exports;`——`exports` 只是指向同一对象的**别名**。于是：

```js
exports.a = 1;              // 往 module.exports 那个对象加属性 → 生效
module.exports = { a: 1 };  // 让 module.exports 指向新对象 → 生效（返回值变了）
exports = { a: 1 };         // 只让局部别名 exports 指向新对象，module.exports 没动 → 返回空对象
```

关键：一旦你 `module.exports = 新对象`，`exports` 别名还指着**旧对象**，此时再写 `exports.x=...` 也丢了（要跟着改回 `module.exports.x`）。所以"整体替换永远用 module.exports"（呼应 node-modules 第二节、下一题）。

**来源**：Node.js — "module.exports explained"; 社区经典 — "exports vs module.exports"

---

## 二、require 解析

### 3. `require('lodash')`（裸包名）时 Node 是怎么找到它的？这套规则带来了什么著名的"坑"？

对非相对、非内置的裸标识符，Node 从当前目录的 `node_modules` 开始，**逐级向上**查找：`./node_modules`、`../node_modules`、`../../node_modules`……直到文件系统根。找到包目录后读其 `package.json` 的 `main`（或 `index.js`）。这个"向上冒泡"机制带来两个后果：① **依赖提升**——子依赖可能被装到上层 node_modules；② **幽灵依赖（phantom dependency）**——你能 `require` 到一个**没写进自己 package.json** 的包（因为它被别的依赖提升到顶层），一旦那个依赖消失/结构变化就崩。pnpm 的非扁平 node_modules 正是为杜绝幽灵依赖（呼应 node-npm）。

**来源**：Node.js — "Modules / Loading from node_modules"; 社区 — "phantom dependencies / pnpm"

### 4. `require('./config')` 没写扩展名却能加载 `config.json`，还能 `require('./data.json')` 直接用，为什么？JSON 有什么特别？

因为 require 的文件解析按 `.js → .json → .node` 顺序尝试候选，`./config` 会命中 `config.json`。而**显式** `require('./data.json')`：Node 对 `.json` 后缀会**自动 `JSON.parse` 并把结果作为 `module.exports`** 返回，无需自己读文件再解析（`.node` 则是加载编译好的原生插件）。注意：这是 CJS 便利；ESM `import` JSON 要用 `with { type: 'json' }` 断言（呼应 node-esm-cjs）。

**来源**：Node.js — "Modules / Loading JSON files"; Node — "require extensions"

---

## 三、缓存与单例

### 5. CommonJS 的模块缓存机制能用来做什么、又会造成什么意外？

**能做**：① 天然**单例**——模块顶层 `const db = new Pool()` 只执行一次，全项目 `require` 拿到同一实例，无需额外单例模式；② 性能——避免重复解析/执行。**意外**：① 测试里改了一个模块的状态，下一个用例 `require` 到的还是**同一份被污染的状态**（要用 `delete require.cache[...]` 清缓存，呼应 node-testing）；② "模块顶层副作用只跑一次"——你以为每次 require 会重新初始化其实不会；③ 循环依赖拿到半成品（第 8 题）。缓存的 key 是**解析后的绝对路径**，大小写/符号链接不同可能算不同模块。

**来源**：Node.js — "require.cache"; 社区 — "clearing require cache in tests"

### 6. 为什么说"在 CJS 里用模块做单例"和"ESM/双包环境下"可能不成立？

CJS 单例依赖"同一绝对路径 → 同一缓存条目"。但：① **dual package hazard**——同一库的 ESM 版与 CJS 版是**两份不同产物、两份缓存**，`import` 和 `require` 各拿一份，单例被复制（呼应 ts-publish 第 5 题、ts-modules）；② 路径经 symlink/不同 resolve 结果可能算两个 key；③ 打包器 bundle 后作用域又变。所以"模块即单例"是**同环境同格式**下的近似，不是语言保证。要真正全局唯一可用 `globalThis` 上挂号（脏）或 `Symbol.for` 注册表（跨 realm 稳定）。

**来源**：Node.js — "Dual package hazard"; 社区 — "module singleton pitfalls"

---

## 四、循环依赖

### 7. 出现循环 require 时 Node 会怎样？为什么会拿到 `undefined` 的导出？

不会报错也不会死锁。A 加载到一半去 require B，B 又 require A——此时 A 还在"加载中"，Node 把 A **当前的 `module.exports` 快照**（往往还是初始 `{}` 或只赋值了一部分）返回给 B。若 B 在顶层就解构 `const { foo } = require('./a')`，而 `a` 的 `foo` 是在 `require('./b')` **之后**才赋值的，B 拿到的 `foo` 就是 `undefined`（呼应 node-modules 第五节）。规避：① 打破环（抽公共模块）；② 别在顶层立即解构，改成 `const a = require('./a')` 后在函数里用 `a.foo()`（调用时 A 已加载完）；③ 调整赋值顺序，把被依赖的导出放在 require 之前。

**来源**：Node.js — "Cycles"; StackOverflow — "circular dependency undefined"

---

## 五、CJS 特性与权衡

### 8. `require` 是同步的，这既是优点也是问题。分别说说，并给出"必须异步 import"的场景。

**优点**：同步、简单、能直接拿返回值放条件/循环里（`if (env==='prod') require('./prod')`），代码直观。**问题**：① 阻塞事件循环——大依赖树启动慢（冷启动卡顿，呼应 Express L8 性能）；② 无法"运行时按需异步加载"以优化启动。必须异步的场景：想**延迟/条件加载重型或可选依赖**以缩短冷启动、或加载**只能用 ESM 的包**（无 `require` 钩子）时，用 `await import('...')`（动态 import 即使在 CJS 里也可用，返回 Promise，呼应 node-esm-cjs）。

**来源**：Node.js — "import() / dynamic import"; 社区 — "faster startup lazy require"

### 9. 为什么"全用 `export * from './x'` 的 barrel 文件"和 CJS 的动态 require 都会伤害 tree-shaking？

tree-shaking 要求打包器**静态**知道"导入了什么、用了什么"。CJS 的 `require(变量)`、条件 require、`module.exports = 动态对象` 让依赖图在编译期不可确定，无法安全删unused（呼应 node-modules 第四节、10-vite）。ESM 的 barrel（`index.ts` 里 `export * from ...`）虽是静态的，但**再导出把整棵子树连成强依赖**，一个副作用就可能把整包拉进来、还可能引入循环（呼应 ts-modules barrel 破坏摇树）。所以大型库常**避免 barrel、直接指向具体入口 + 配 `sideEffects`**（呼应 ts-publish 第二节）。

**来源**：webpack/Rollup — "tree shaking / sideEffects"; ts_modules barrel pitfalls

---

## 六、与 ESM 的交界

### 10. `import fs from 'fs'` 能 work，是因为 fs 本来就是 ESM 吗？CJS 模块被 ESM `import` 时发生了什么？

不是。`fs` 是 CJS 内置模块。当一个 ESM `import` 一个 CJS 模块时，Node 把整个 `module.exports` **当成 default 导出**打包，于是 `import fs from 'fs'` 拿到的是 `module.exports` 那个对象。具名导入（`import { readFile } from 'fs'`）能否成功取决于 Node 的 **cjs-module-lexer 静态检测**——能识别就生成具名绑定，识别不了就只能走 default。所以第三方 CJS 包偶尔要写成 `const pkg = require('pkg')` 或 `import pkg from 'pkg'; pkg.named`。理解"谁 import 谁、怎么映射"是混用排错的关键（呼应 node-esm-cjs、ts-modules esModuleInterop）。

**来源**：Node.js — "Interoperability with CommonJS"; nodejs — "cjs-module-lexer"

### 11. `__dirname`/`__filename` 为什么"只在 CJS 有"？ESM 怎么等价实现？这反映了两者什么差异？

`__dirname`/`__filename` 是 CJS **模块包装函数注入的参数**（第 1 题），ESM 没有这层包装，故不存在。ESM 用 `import.meta.url`（当前模块的 `file://` URL）自己算：

```js
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

差异本质：CJS 有"被函数包裹、参数注入"的历史设计，ESM 是语言级标准、通过 `import.meta` 暴露元信息。也提醒：跨 CJS/ESM 的代码不能假设 `__dirname` 存在（呼应 node-basics 第四节、node-path-url）。

**来源**：Node.js — "import.meta.url / __dirname in ESM"; MDN — "import.meta"

### 12. 有人主张"Node 项目一律 CJS 就好，ESM 是折腾"。你怎么客观评价 CJS 的现状与局限？

CJS 依然**完全可用、生态最广、心智简单**（同步、动态 require、`__dirname` 齐全），老项目/纯内部脚本继续用它毫无问题，没必要为赶时髦强迁。但要知道它的局限：① **非官方标准**（ESM 才是 TC39/语言级标准，浏览器与 Node 统一）；② **静态结构缺失**→ tree-shaking、并行预解析、跨工具优化受限；③ 新库越来越多**ESM-only**（不用 CJS 就 require 不到，呼应 ts-publish 第 6 题）；④ 顶层 await、live binding、`import()` 异步加载等能力 CJS 没有。理性结论：**存量 CJS 别动、新公共库优先 ESM（或双发）**，并清楚两者互操作规则（呼应 node-esm-cjs）。

**来源**：Node.js — "Modules: ESM vs CommonJS"; sindresorhus — "Sindre's strict ESM stance"; 社区 "Node.js modules today"

---

## 补充（新专题 13-15）

### 13. 讲讲 require 的完整算法：从裸包名到拿到 exports，中间经过哪些判定？

① 解析：非相对/绝对路径先查 node_modules 逐级上溯（含全局与 NODE_PATH 遗留）；② 目录按 package.json 的 main（无则 index.js/json/node）——注意裸 require 不看 exports 字段（exports 只约束 ESM 与新版自引用）；③ 扩展名尝试顺序 .js→.json→.node；④ 缓存命中（require.cache 按解析后的绝对路径）直接返回 exports；⑤ 未命中才新建 Module、编译执行（包装函数注入 exports/require/__dirname/__filename）、写入缓存。细节：执行**中途**就把模块放进缓存——这是循环依赖拿到「半成品」的原因；json 有独立 loader；改 loader 用 require.extensions（废弃）/module.register 时代终结。

**来源**：Node 官方《CommonJS modules: All together... the summary》七步算法原文。

### 14. exports 与 module.exports 的关系，初学最容易犯的三个错？

关系：包装函数头部 `const exports = module.exports`，默认导出集是 module.exports 这个对象——给 exports 加属性=改导出对象；`exports = {...}`=只改局部变量，导出为空。三错：① 直接给 exports 赋新对象（应 module.exports= 或逐属性挂）；② 混用两写法（module.exports={...} 后又 exports.foo=1，后者丢失——经典 copy-paste 事故）；③ 依赖「先 require 后改」的时序做配置注入（可被缓存顺序打破，应显式 factory/setter）。识别口诀：一个模块只应有一个导出出口；TS 的 esModuleInterop 讨论（__esModule 标记）也是这条边界的现代回响。

**来源**：Node 官方 modules 文档 exports vs module.exports 警告框；TS 深潜对 CJS 导出互操作的分析。

### 15. 模块缓存在工程上能做什么、会造成什么坑？各给两个实例。

能做：① 天然单例（连接池/配置对象放模块导出，全进程共享一份）；② 启动加速（重复 require 零成本）。坑：① 状态滞留——测试间互相污染（前一用例改了缓存里的 config），解法是 jest.resetModules/require.cache 删除重 require（本关题干考过）；②「半成品导出」放大循环依赖（缓存里放的是执行到一半的 exports）；③ 双实例：同一包两个物理路径（monorepo 嵌套 node_modules、软链）→ 缓存键不同 → instanceof/单例全失效（dual package hazard 的 CJS 面）。进阶纪律：库对「配置单例」用 Symbol.for 全局注册表兜底（lodash 的 __lodash_global），应用侧靠包管理器 dedupe。

**来源**：Jest 文档 `jest.resetModules` / module registry；Node 官方《Modules: Caveats》软链双实例说明。
