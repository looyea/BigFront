# ts-modules 面试题精选

> 共 15 题，覆盖 **模块基础 / 导出导入策略 / import type 与擦除 / barrel 与循环 / module 配置 / CJS-ESM 互操作 / 命名空间与模块增强** 七类。

---

## 一、模块基础

### 1. 一个 `.ts` 文件什么时候是"模块"、什么时候是"脚本"？为什么这很重要？

看有没有**顶层 `import`/`export`**：有则是模块——顶层声明只在本文件可见、有独立作用域；没有则是脚本——顶层声明进入**全局作用域**，多个脚本间会互相覆盖/冲突。重要性：① 忘了 `export`/`import` 的文件里定义的 `interface`、`type`、变量会"泄漏到全局"，和别的文件同名声明**意外发生声明合并**（呼应 ts-interface），产生极难排查的"类型被别处污染"bug；② 加一句 `export {}` 就能把纯脚本文件转成模块隔离作用域。判断"类型莫名冲突"时先查是不是某文件没有顶层 import/export。

**来源**：TypeScript Handbook — "Modules / Global execution scopes"; Effective TS — Item 31

---

## 二、导出导入策略

### 2. `export default` 和命名导出该用哪个？各自的坑？

优先**命名导出**：① 利于 tree-shaking（打包器能精确判断哪个导出被用）；② IDE 能自动导入、重命名、查找引用；③ 导入名固定，不会出现"同一个 default 各文件起不同名"。`export default` 的坑：导入时可任意命名（`import Foo from`、`import Bar from` 指同一物），聚合 `export * ` 又不含 default，重构追踪差。**何时用 default**：框架要求的约定入口（Vue/React 组件文件、Next.js `page`）、或"一个模块语义上就一个主体"时。经验：库/工具模块用命名导出，组件文件可 default（生态惯例）。

**来源**：Total TypeScript / 社区共识 — "avoid default exports"; React 文档

### 3. `import * as ns from "x"`、`import def, { named } from "x"`、`export * as ns from "x"` 各自语义是什么？

- `import * as ns`：把模块所有导出收成一个**命名空间对象** `ns`，`ns.foo` 访问；ESM 里它是 live 的、只读绑定。
- `import def, { named }`：同时取默认导出（`def`）和某个命名导出（`named`）。
- `export * as ns from "x"`：把 `"x"` 的全部命名导出**整体再导出**为一个叫 `ns` 的子命名空间（re-export 聚合，barrel 常用）。
注意 `import * as ns` 在**导入 CJS 模块**时行为受 `esModuleInterop` 影响很大（第 8 题），跨模块系统时是最易踩坑的形式。

**来源**：MDN — "import / export"; TypeScript Handbook — "Modules"

---

## 三、import type 与擦除

### 4. 为什么需要 `import type`？没有它，编译器"自动删未用 import"不行吗？

编译器**确实**会删"只用作类型"的 import（类型擦除，呼应 ts-intro）。但自动删除有隐患：① 副作用导入歧义——`import "./polyfill"` 必须保留，而"看着没用到值其实有副作用"难判断；② **单文件转译**（Babel/esbuild/SWC、Vite、`isolatedModules`）看不到跨文件信息，无法确定某 import 是不是纯类型，删错/留错都会运行时报错（呼应 ts-tooling、10-vite）。`import type` 显式声明"这是类型、必删"，`import { type X, fn }` 内联标注则允许同一语句混用。`verbatimModuleSyntax` 进一步要求你写啥就留啥、彻底把"删不删"的决定权交给开发者。

**来源**：TS 3.8 — "type-only imports"; TS 5.0 — "verbatimModuleSyntax"; isolatedModules

---

## 四、barrel 与循环导入

### 5. 用 index.ts 做 barrel 聚合导出很方便，为什么大项目会禁用/限制它？

三大代价：① **tree-shaking 变差**——`import { one } from "@/src"` 经 `export *` 链可能让打包器把整个子树都纳入模块图、初始化全部副作用；② **循环导入**——子模块 A 与 B 都从 barrel 引对方（A→index→B→index→A），ESM 的 live binding 在环里可能读到"尚未求值"的 `undefined`，运行到才崩；③ **类型解析变慢**、错误堆栈更难定位。缓解：把 barrel 只用在**包对外公共 API**；**内部**互相引用一律走真实文件路径；对性能敏感库用 `export type {}` 分离类型再导出、或提供按需子入口（`exports` 字段，呼应 ts-publish）。

**来源**：Angular/Team top-favor — "avoid barrel files for internal imports"; webpack — "barrels and tree shaking"

---

## 五、module 配置

### 6. `module` 和 `moduleResolution` 分别控制什么？为什么要配对？

`module` 决定 **emit 出的产物**用哪种模块格式（`commonjs` 生成 `require`、`esnext`/`nodenext` 保留 `import`、`preserve` 不改写）。`moduleResolution` 决定 **tsc 如何把 `from "pkg"` 解析到磁盘上的文件/类型**（`node10` 老算法、`node16`/`nodenext` 支持 `exports`/`imports` 字段与 ESM/CJS 区分、`bundler` 支持无扩展名等打包器约定）。二者要逻辑配对：比如 `module: nodenext` 应配 `moduleResolution: nodenext`，否则出现"产物是 ESM 但解析用老 CJS 规则"，导致 `exports` 子路径解析不到类型、`.js`/`.ts` 扩展名要求错乱（呼应 ts-project）。当下 Node 项目推荐 `nodenext`、纯打包器前端推荐 `bundler`。

**来源**：TypeScript Handbook — "moduleResolution"; TS — "nodenext"

### 7. `isolatedModules` 是什么、它并不产出隔离模块为何还要开？

`isolatedModules` 并**不改变 emit**，而是让 tsc **禁止**那些"单文件转译器（Babel/esbuild/SWC）无法正确处理"的跨文件构造——例如：重导出类型时不写 `export type`、非 const 的枚举成员、无默认导出的 `export =` 再 default 导入等，都会被判错。目的：确保你的代码能被 Vite/SWC 这类"逐文件、看不到全局类型图"的工具安全转译（呼应 10-vite、ts-tooling）。现代前端几乎必开它，也是"提前暴露将来构建会炸的写法"的护栏。配套 `verbatimModuleSyntax` 让 import 保留规则更明确。

**来源**：TypeScript Handbook — "isolatedModules"; Vite 文档 — "Why isolatedModules"

---

## 六、CJS ↔ ESM 互操作

### 8. 为什么 `import React from "react"` 能工作，需要哪个选项？不开会怎样？

`react` 是 CommonJS 包（`module.exports = {...}`），按纯 ESM 语义它没有 `default` 导出，只有"整个模块对象"。开启 **`esModuleInterop`**（连带 `allowSyntheticDefaultImports`）后，tsc ① 类型层允许你把 CJS 模块当"有 default"来 default 导入；② emit 出 `__importDefault` 帮助函数，运行时把 CJS 的 `module.exports` 包成 `{ default: module.exports }`，于是 `import React from "react"` 得到整包。**不开**则 `import React from "react"` 得到 `undefined`（没有 default），必须写 `import * as React from "react"`。这是 TS 项目"运行时 undefined / TS2613 报错"的经典来源（呼应 ts-project）。

**来源**：TypeScript Handbook — "esModuleInterop / Interop Constraints"; Node — "ESM & CJS"

### 9. 一个包同时想被 ESM 和 CJS 消费（dual package），类型层面要注意什么？

要点：① `package.json` 用 `exports` 字段为 `import`/`require` 分别指向不同产物与**对应类型的 `.d.ts`**（`types` 条件）；② 需 `moduleResolution: node16/nodenext` 才能识别 `exports` 里按条件分派的类型；③ 双份构建（如 `dist/esm/*.js` + `dist/cjs/*.js` + 各自 `.d.ts`），常见用 `tsc` 两遍或打包器（tsup，呼应 ts-tooling/ts-publish）；④ 当心"只有 ESM 类型、CJS 拿不到"或"require 一个纯 ESM 类型包"的错配。核心矛盾源于 Node 的 ESM/CJS 双标体系，类型必须跟着各自的运行时入口走。

**来源**：Node — "packages / dual package hazard"; TS — "declaration emit for node16"; tsup

---

## 七、命名空间与模块增强

### 10. `namespace` 还能用吗？为什么现代项目不鼓励 `namespace` 包代码？

`namespace` 是 TS 早于 ES 模块成熟前的组织手段，编译成 **IIFE + 运行时对象**（会产生真实 JS，不是纯类型）。现代项目不推荐用它包裹业务代码，因为 ES 模块（文件即命名空间）是标准、且被所有工具/打包器原生支持、能 tree-shake；`namespace` 反而制造运行时值、阻碍摇树、与 `module` 语义混淆。**仍有一席之地**的场景：① 给无模块的**全局 JS 库**声明形状（`declare namespace`，呼应 ts-declarations）；② 声明合并里给第三方全局类型补成员；③ 极少数需要"运行时枚举式对象 + 名义隔离"的地方。日常请"一个文件一个隐式命名空间"，用 `export`/`import`。

**来源**：TypeScript Handbook — "Namespaces（deprecated guidance）"; Effective TS — Item 31

### 11. `declare module "x"` 什么时候是"整体声明一个模块"、什么时候是"模块增强"？两者怎么写？

看**当前文件是不是模块**：① 在**全局脚本**（无顶层 import/export）里写 `declare module "x" { ... }` → **ambient 模块声明**，为"不存在类型的 JS 包"从零声明整个模块形状（给无 `.d.ts` 的库补类型，呼应 ts-declarations 第 1 题）。② 在**已经是模块**的文件里写 `declare module "x" { interface Foo {...} }` → **模块增强（module augmentation）**，向已存在的 `"x"` 里"追加"成员（给 `express.Request`、`vue` 的 `ComponentCustomProperties` 注入自有字段）。区别关键在"是否先 import 了该模块/文件是否为模块"。写错位置会得到"找不到名称"或"增强未生效"（呼应 ts-interface 声明合并、04-vue）。

**来源**：TypeScript Handbook — "Module Augmentation vs Ambient Modules"; @types 惯例

### 12. `declare global` 是干什么的？为什么在模块里给全局加类型必须包它？

模块增强只能碰"模块的导出"。要给**真正的全局作用域**加声明（如给 `Window`、`NodeJS.ProcessEnv`、`globalThis` 挂自定义字段），在模块文件里必须写：
```ts
export {};                       // 本文件是模块
declare global {
  interface Window { __APP__: Config }   // 给全局 Window 补成员（声明合并）
}
```
因为一旦文件是模块，其顶层声明默认**不**进全局（第 1 题），TS 要求显式 `declare global { ... }` 才允许修改全局类型，避免无意污染。典型用途：给 `import.meta.env`、`process.env`、浏览器注入的全局对象补类型（呼应 Express `req.user` 用模块增强、03-nodejs 的 `process`）。忘记包 `declare global` 会报"Augmentations for the global scope can only be directly nested in external modules"。

**来源**：TypeScript Handbook — "global augmentation / declare global"; @types/node 惯例

---

## 补充（新专题 13-15）

### 13. moduleResolution 的 node10 / node16 / bundler 三档各自按什么规则解析文件？怎么配？

node10（"node"）：老 Node require 的宽容版——目录自动 index、扩展名猜 `.ts/.tsx/.d.ts`、不看 exports；node16/nodenext：严格模拟 Node ESM——扩展名必填（相对导入带 .js）、package exports 条件（types/import/require）、type 字段裁决；bundler（TS5.0+）：打包器心智——无扩展名 OK、看 exports 但不强制 .js 后缀。配置联动：`module` 与 resolution 配对（esnext+bundler / node16+nodenext）；Vite/webpack 应用选 bundler，纯 Node ESM 库选 nodenext——「运行时怎么找文件，编译器就怎么找」。

**来源**：TS 5.0《moduleResolution bundler》release notes；Node 官方 ESM resolver 文档。

### 14. barrel 文件（index.ts 聚合导出）爽在哪、坑在哪？大仓怎么治理？

爽：消费方短路径、内部重构自由、公共 API 门面。坑：① **tree-shaking 反噬**——聚合文件让「引一个函数」拉整个模块图评估副作用，rollup/webpack 难删（需 sideEffects 标注）；② **循环依赖放大器**（A→barrel→B→A，运行时 TDZ 崩）；③ 冷启动/编译面扩大、HMR 爆炸半径大。治理：应用内部禁 barrel 互引（直接路径导入），跨包只留一层 barrel + sideEffects 精确 glob；Next 的 barrel optimization / 库用 exports 子路径替代。

**来源**：webpack《Tree Shaking 中 sideEffects 与 barrel》文档；Next.js 13.2 Barrel optimizer 公告。

### 15. namespace 在 2025 年的正当与不正当用途各列一下。

不正当：应用代码手工分包组织（`namespace Utils {}`）——ESM 的 import/export 是正解，且 namespace 产物有运行时对象、破坏 erasableSyntaxOnly/isolatedModules 兼容、Bundler 无法摇树。正当：① .d.ts 里表达「全局 UMD 库形状」（`declare namespace jQuery` 函数+命名空间合体）；② 老 JS 库类型声明的函数挂载建模；③ 类型命名空间的只读聚合（`namespace Api.Types {}` 纯 type 用法，TS 不会 emit）；④ module augmentation 内部结构（declare module 块里）。原则：**运行时分包用 ESM，类型组织可用 namespace 声明**，二义场景交给文件路径。

**来源**：TS Handbook《Namespaces and Modules》迁移指引；TS 5.0《erasableSyntaxOnly》动机篇。
