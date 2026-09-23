# node-esm-cjs 面试题精选

> 共 15 题，覆盖 **身份判定 / 静态结构与动态 import / live binding / 互操作与混用 / 顶层 await / 选型与迁移** 六类。

---

## 一、身份判定

### 1. `.mjs`、`.cjs`、`.js` 与 `package.json` 的 `"type"` 是怎么配合决定模块系统的？

优先级：① **`.mjs` 恒为 ESM、`.cjs` 恒为 CJS**（无视 type，用来在一种制式里"逃逸"出另一种）；② `.js` 的制式由**最近的 `package.json` 的 `type` 字段**决定——`"module"`→ESM，`"commonjs"` 或**缺省**→CJS（呼应 node-esm-cjs 第一节）。要点：`type` 只决定"这个 `.js` 用哪套解析规则"，不改变语法能力（`.mjs` 里写 `require` 仍报未定义）。混用范式：项目 `"type":"module"`，个别必须 CJS 的文件改叫 `.cjs`。很多工具配置（`rollup.config.js`/`postcss`）在 ESM 项目里要改成 `.mjs`/`.cjs` 正是栽在这条规则上。

**来源**：Node.js — "Packages / module system determination"; Node — "dual package / .mjs .cjs"

### 2. 为什么把项目设成 `"type":"module"` 后，`rollup.config.js`、`.eslintrc.cjs` 这类配置文件要改名？

因为 `type:module` 会作用于该 `package.json` 所在目录树下**所有 `.js`**——包括被工具当作 CJS 加载的配置。工具若用 `require('./xxx.config.js')` 读一个现在是 ESM 的文件，就会 `ERR_REQUIRE_ESM`。解决办法就是把那个配置显式改后缀：需要 CJS 的用 `.cjs`（如 `.eslintrc.cjs`、`postcss.config.cjs`），或改写成 ESM 并用支持 ESM 配置的工具。这是 `type:module` 迁移里极常见的"连锁改名"（呼应 ts-modules、node-esm-cjs 第一节）。

**来源**：社区 — "type module breaks config files / .cjs"; ESLint/Vite — "config in ESM projects"

---

## 二、静态结构与动态 import

### 3. ESM 的 `import` 为什么被设计成"只能顶层、静态可分析"？这带来什么收益、又限制了什么？

ESM 的 `import`/`export` 是**声明**（像 `const` 提升那样在模块求值前就被引擎登记），依赖图在**编译期**即可完整确定。收益：① 工具能**静态**做 tree-shaking（删未用导出，呼应 10-vite、node-modules 第 9 题）；② 引擎能**并行预解析/预取**整个依赖图再执行；③ 循环依赖可通过 live binding 更好处理。限制：不能把 `import` 放进 `if`/函数里、不能拼路径。需要动态时用**函数式的 `import()`**（返回 Promise，可在任意处、任意条件调用，且 CJS/ESM 通用，呼应 node-esm-cjs 第三节）。

**来源**：TC39 — "ES Modules / static analysis"; Node.js — "import() dynamic"

### 4. `import('...')`（动态）和 `import x from '...'`（静态）在返回类型、时机、可用性上有什么不同？

- **静态** `import`：编译期解析、顶层、同步语义（值绑定）；只能 ESM 用。
- **动态** `import()`：运行时调用、返回 **Promise<Module>**（需 `await`/.then 取命名空间对象）；可在任意位置、任意条件；**ESM 和 CJS 都能用**——是唯一跨两套系统的加载桥。典型用途：按条件加载不同实现、按需/懒加载重依赖优化冷启动、代码分割、polyfill 门控（`if (!globalThis.fetch) await import('whatwg-fetch')`）。代价：动态路径会让打包器无法静态确定分包点（呼应 node-esm-cjs 第三节、node-modules 第 8 题）。

**来源**：MDN — "import() dynamic import"; Node.js — "import expressions"

---

## 三、live binding 与导出语义

### 5. 什么是 ESM 的 live binding？和 CJS 的"导出拷贝"对比，给一个能观察出差异的例子。

ESM 导入的是对**导出绑定的只读实时引用**——源模块里那个变量变了，导入方读到的也跟着变。CJS 是"把 `module.exports` 那个值在加载时给出去"，更像快照：

```js
// counter.mjs (ESM)
export let n = 0;
export function inc(){ n++; }
// main.mjs
import { n, inc } from './counter.mjs';
inc(); console.log(n);   // 1 —— live binding 反映源里 n 的变化

// counter.cjs: let n=0; exports.n=n; exports.inc=()=>{n++; exports.n=n;}
// 若在别处 const {n}=require('./counter.cjs')，之后 inc()，本地 n 仍是旧值（拿到的是拷贝）
```

（CJS 要读到最新值得 `counter.n` 整体引用着取，而非解构拷贝。）live binding 也是 ESM 循环依赖常"能跑通"、而 CJS 易拿 undefined 的原因（呼应 node-esm-cjs 第五节、node-modules 第 7 题）。

**来源**：2ality — "ES module live bindings"; Node.js — "ES module exports vs CJS"

---

## 四、互操作与混用

### 6. `ERR_REQUIRE_ESM` 是什么？给出至少三种实际解法及各自适用场景。

发生在用**同步 `require()` 加载一个纯 ESM 包**时——CJS 无法同步取得异步/可能有顶层 await 的 ESM 结果。解法：① **把调用方也转成 ESM**（项目 `type:module`，用 `import`）——治本，适合可控的自有代码；② 在 CJS 里改用 **`await import('pkg')`**（动态导入）——适合只是个别地方要 ESM 包、且能在 async 上下文里等；③ **换一个仍提供 CJS 的依赖**或用其 CJS 入口；④ 过渡期在 ESM 侧反向用 `createRequire` 处理 CJS-only 依赖（对称问题）。近两年大量老包宣布"下个大版本 ESM-only"，让此报错成为 Node 社区头号迁移痛点（呼应 node-esm-cjs 第六节、ts-publish 第 6 题）。

**来源**：Node.js — "require(esm) / ERR_REQUIRE_ESM"; 社区 — "got ESM-only, my require broke"

### 7. ESM `import` 一个 CJS 包时，default 导入和具名导入分别拿到什么？为什么具名有时拿不到？

Node 把 CJS 的整个 `module.exports` 当作该模块的 **default 导出**。所以 `import _default from 'cjs'` 稳拿 `module.exports`。而具名导入 `import { readFile } from 'cjs'`：Node 用 **cjs-module-lexer** 在加载前**静态扫描** CJS 源码，识别出 `exports.foo = ...` 之类的显式具名赋值，才生成对应具名绑定；如果 CJS 用动态方式导出（循环里 `exports[k]=...`、`Object.assign(exports,...)`、`module.exports = require('./other')` 透传），扫描识别不出，**具名导入就会失败/为 undefined**（但 default 仍完整）。稳妥习惯：对 CJS 包优先用 default 导入再取属性（呼应 node-modules 第 10 题）。

**来源**：Node.js — "Named exports from CJS / cjs-module-lexer"; 社区 — "import { x } from cjs is undefined"

### 8. 反过来，在 CJS 里怎么加载一个 ESM 模块？为什么不能 require？

不能 `require`（第 6 题）。可在 async 函数里用 **`await import('esm')`**：

```js
async function main() {
  const mod = await import('./greet.mjs');   // { default, named... }
  mod.default("hi");
}
main();
```

因为 `import()` 是异步的、返回 Promise，把结果模块命名空间交给你。注意结果上取 default 要用 `mod.default`。这体现了 CJS→ESM 只能"异步跨界"。反过来 ESM→CJS 因同步语义兼容而顺畅得多——这种**不对称**是很多人踩坑的根源（呼应 node-esm-cjs 第六节）。

**来源**：Node.js — "Interoperability / requiring ESM from CJS"; MDN — "import()"

---

## 五、顶层 await

### 9. 顶层 await 有什么好用之处，又有什么"传染性"和风险？

好用：模块顶层直接 `await` 异步初始化（连库、读配置、feature detect），免写 `(async()=>{})()`，配合 live binding 让"异步初始化的导出"在依赖方眼里最终就绪（呼应 ts-modules 顶层 await）。风险/传染：① 含顶层 await 的模块，其**所有导入方都会被异步化**（依赖图要等它 resolve），**可能拖慢/串行化启动**、破坏"预解析并行"优势；② **CJS 里不能用**（`require` 一个含顶层 await 的 ESM 会失败，呼应第 6 题）；③ 出错时错误栈与"哪个模块 await 挂了"更难定位。建议：只在**应用入口/确需异步初始化**处使用，别在库的深处模块随意引入。

**来源**：V8 — "Top-level await"; Node.js — "top-level await in ESM"; TC39 proposal-tla

---

## 六、选型与迁移

### 10. 你要发一个 npm 库，消费者既有 `import` 也有 `require` 的，你会怎么配 `package.json`？

配 **`exports` 条件导出双格式**：构建出 ESM(`.js`/`.mjs`) 与 CJS(`.cjs`) 两套产物 + 各自 `.d.ts`，`exports` 里按 `import`/`require` 分别指向，`types` 条件放最前（呼应 ts-publish 第二、三节、node-publish）：

```jsonc
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.mjs",
    "require": "./dist/index.cjs"
  }
}
```

用 tsup/rollup 一键出双格式（呼应 ts-tooling 第二节）。必须处理 **dual package hazard**（若库有共享单例，`import` 与 `require` 会各加载一份，呼应 node-modules 第 6 题），并用 `are-the-types-wrong` 验收（呼应 ts-publish 第四节）。

**来源**：Node.js — "Supporting both ESM & CJS / conditional exports"; tsup/attw 文档

### 11. 把一个中型 CJS 项目渐进迁到 ESM，你会怎么规划、先做什么、注意哪些连锁问题？

① **摸清依赖方向**，从叶子往入口迁（单文件改 `.mjs`/加 `type:module` 需谨慎，它作用于整个包）；② 先解决**会被连锁影响的点**：所有相对 `import` 要**补全 `.js` 扩展名**（第 2 题、node-esm-cjs 第五节，TS 端配合 `moduleResolution`）、`__dirname`/`require` 改 `import.meta.url`/`createRequire`、配置文件改后缀；③ 排查**是否 require 了纯 ESM 包**（会 `ERR_REQUIRE_ESM`，提前 `await import` 或换包）；④ **顶层副作用与循环依赖**行为可能变（live binding）；⑤ 分阶段可 CJS/ESM 混跑（`.cjs`/`.mjs` 并存）直到完成；⑥ 每步保持测试绿（呼应 ts-migration 棘轮、node-testing）。核心：迁移不是换语法，是处理"静态结构 + 扩展名 + 互操作"三件套的连锁。

**来源**：Node.js — "Migrating to ESM (sindresorhus guide)"; 社区 — "ESM migration gotchas"

### 12. 有人说"Node 的模块系统是一片混乱、浏览器和 Node 各一套"。ESM 的统一叙事是什么？为什么 Node 还留着 CJS？

统一叙事是 **ESM 是语言级标准**（TC39 定义），浏览器 `<script type=module>` 与 Node 用**同一套 import/export 语义**——这是方向，长期一切收敛到 ESM。CJS 被保留不是"设计混乱"，而是**兼容性现实**：十几年积累的 `require` 代码与 `module.exports` 生态是 Node 繁荣的根基，Node 奉行的铁律是"**永不让现有代码失效**"（backwards compatibility），所以 CJS 会长期存在、且与 ESM 互操作。理性心态：**新写走 ESM，存量按成本渐进，混用吃透互操作矩阵**（呼应 node-esm-cjs 第七节、node-modules 第 12 题、ts-modules）。

**来源**：Node.js — "Modules: ESM and CommonJS"; TC39 — "ES Modules"; 社区 — "modules without chaos"

---

## 补充（新专题 13-15）

### 13. ERR_REQUIRE_ESM 的成因与至少三种实战解法？

成因：require 是同步 API，ESM 求值可能含顶层 await/异步链接阶段——同步语义无法安全嵌入，Node 直接拒绝。解法分级：① 升级依赖等其提供 CJS 出口（多数「纯 ESM 化」包如 chalk@5/got@12 是主动断的，选版本前先查）；② createRequire(import.meta.url) 把 require 带回 ESM 侧（只救「我是 ESM 需要吃 CJS」方向）；③ 动态 import() + await（顶层或懒加载），把同步调用改异步链——框架钩子不允许 async 时用「启动期预 import、运行期同步取」缓存法；④ Node 22.12+/23 实验性 require(esm)（无 TLA 的 ESM 可被 require，最终终局，看版本铺开）。预防：发布方双格式（tsup/双 exports），纯 ESM 是激进选项不是默认选项。

**来源**：Node 官方《CommonJS and ECMAScript modules》互操作指南；Node 22.12 require(esm) changelog（Geoffrey Booth 系列 PR）。

### 14. 顶层 await 的「传染性」与死锁风险具体指什么？怎么约束使用？

传染：模块含 TLA → 该模块的**父导入链全部要 async 化**才能等它（require 彻底无法消费 ESM 主因之一）。死锁：循环依赖 A↔B 且任一含 TLA → 链接阶段直接报 "Detected cycle while resolving ... async dependency"（CJS 循环只拿半成品，ESM 是硬错）。风险还在于「隐式阻塞」：入口模块 await DB 连接前，其副作用对所有下游就绪时刻都未定义（框架按 import 顺序初始化时尤其阴间）。纪律：① 只允许**入口/脚本级**用 TLA（构建工具靠它做异步配置，vite.config.ts 即标准案例）；② 库代码禁用（ts/ESLint no-async-top-level 类规则或文档规约）；③ 库初始化用显式 `await init()` 幂等函数，把就绪语义交给调用方。

**来源**：Node 官方 ESM 文档「Top-level await & cycles」；TC39 TLA 规范动机段（Vite 配置案例）

### 15. 把大型 CJS 项目渐进迁到 ESM，给出规划与先动哪些文件？

路线：① 盘点：`node --experimental-detect-module`/madge 看依赖图与动态 require 热区（变量拼路径、mock 依赖解析的点位=迁移成本表）；② 从**叶子**（无被依赖的工具层）改名 .mjs/加 type:module，保持旧文件走 .cjs——两制共存靠扩展名裁决而非 package 字段一刀切；③ 消灭 require 热区：动态 require 换 import()（接受 async 扩散）、require.resolve 换 import.meta.resolve；④ 依赖面：纯 ESM 依赖倒逼入口先迁；测试/构建链（jest ESM 支持、ts config module 组合）先验证再放量；⑤ 出口：全部落地后统一 type:module、回滚 .cjs 白名单。里程碑：每 PR 可双向运行（coexist），回滚=改回扩展名；「迁完」定义：.cjs 与 require 清零。反模式：第一天全仓 rename——动态 require 全断、CI 雪崩。

**来源**：Node 官方《Packaging: ESM》迁移指南；sindresorhus「ESM only packages」立场与 Counterpoint 争论合集。
