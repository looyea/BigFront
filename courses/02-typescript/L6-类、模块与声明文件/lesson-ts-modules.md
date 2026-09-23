# 模块化：导入导出与互操作

> 目标：掌握 TS 的模块系统全貌——ES 模块（`import`/`export`）与遗留的命名空间/`commonjs`、`import type` 纯类型导入、桶文件（barrel）、`module`/`moduleResolution` 组合、`esModuleInterop`/`allowSyntheticDefaultImports` 互操作坑，以及"模块 vs 脚本"、`declare module` 模块增强（呼应 ts-interface 声明合并、ts-declarations）。这是把前面所有类型"组织进真实工程"的关键一环。

---

## 一、模块 vs 脚本：有没有 top-level import/export

一个文件**只要有一个顶层 `import`/`export`** 就是"模块"——其顶层变量有独立作用域、不外泄；否则是"脚本"，顶层变量进全局（易冲突）。老代码里满屏全局函数互相覆盖，常因忘记加 `export {}`。

```ts
export {};   // 加这一行让本文件成为模块，隔离顶层作用域
```

TS 的模块语法就是 ES 模块语法，但编译产物可以是 CommonJS / ESM 等，取决于 `module` 选项（见第五节）。

---

## 二、导出与导入的形式

```ts
// 命名导出
export const VERSION = "1.0";
export function parse() {}
export class Widget {}
export type Config = { a: number };   // 类型也能导出

// 重命名 / 聚合
export { parse as parseConfig };
export * from "./other";              // 转导出（re-export）
export * as ns from "./other";        // 命名空间式整体导出

// 默认导出
export default class Main {}          // 一个模块至多一个 default
import M from "./main";               // 导入 default
import { VERSION } from "./version";  // 导入命名
import def, { named } from "./mod";   // 混用
import * as all from "./mod";         // 整体作为对象
```

命名导出便于 tree-shaking 与重构（IDE 能追引用、改名），default 导出易造成"同名不同物"的导入歧义。**优先命名导出**是社区共识。

---

## 三、`import type`：纯类型导入

```ts
import type { Config } from "./config";   // 只导入类型，编译后被完全擦除
import { type Config, parse } from "./x"; // 内联 type 修饰符，混导时逐个标注
```

`import type` 明确"我只要类型、不要运行时值"，好处：① 避免把仅类型依赖误打进运行时、防循环引用；② 配合 `verbatimModuleSyntax`（新）/ `importsNotUsedAsValues` 让"哪些 import 会被删"规则清晰；③ 打包器/babel 单文件转译时不会猜错（呼应 ts-intro 的"esbuild 只删类型"）。**约定**：只要不是值，就用 `import type`。

---

## 四、桶文件 barrel 与循环引用

```ts
// src/index.ts —— 把子模块统一对外
export * from "./user";
export * from "./order";
export type { Config } from "./config";
```
`import { User, Order } from "@/src"` 一个入口搞定，API 面整洁。代价：① 可能**破坏 tree-shaking**（拉一个全初始化）、② 更易制造**循环导入**（A→index→B→A）导致运行时 `undefined`（ESM 的 live binding 在环里取到未初始化值）。缓解：对外的公共入口用 barrel，内部互相引用走**具体文件路径**；大项目慎用 barrel 做内部聚合。

---

## 五、`module` / `moduleResolution`：产物与找包策略

```jsonc
{
  "compilerOptions": {
    "module": "esnext",            // 产物模块格式：commonjs | esnext | nodenext | preserve
    "target": "es2022",
    "moduleResolution": "bundler", // 找模块策略：node10/node16/nodenext/bundler
    "verbatimModuleSyntax": true   // 保留你写的 import 形式，不自动改写/删除
  }
}
```

- `module` 决定"输出成什么模块系统"；`moduleResolution` 决定"如何解析 `from '...'` 到磁盘文件"，两者要配对（`nodenext`/`preserve` 是当下 Node/打包器项目推荐）。
- `verbatimModuleSyntax`：让"是类型还是值"由你写的 `import type` 显式决定，编译器不再自作主张删 import——配合 `isolatedModules`（ts-tooling、Vite 单文件转译要求，呼应 10-vite）杜绝"跨文件类型导入被误删/误留"。

---

## 六、CommonJS ↔ ESM 互操作坑

历史遗留的 CJS 模块（`module.exports = {...}`）没有 `default`，但 ESM 侧 `import React from "react"`（CJS 包）却能用——靠 `esModuleInterop`：

```jsonc
{ "esModuleInterop": true, "allowSyntheticDefaultImports": true }
```

- `esModuleInterop`：生成 `__importDefault`/`__importStar` 辅助，给 CJS 合成一个 `default`，让 `import fs from "fs"` 可用；同时改变 `import * as ns` 语义。
- `allowSyntheticDefaultImports`：只做类型层"允许 default 导入"检查，不生成运行时代码。
- 不开 `esModuleInterop` 时，`import * as React from "react"` 才安全，`import React from` 会 `undefined`。这是"本地能跑、CI 挂"或"运行时 undefined"的高频元凶（呼应 ts-project、ts-migration）。

---

## 七、命名空间与模块增强

```ts
// 遗留：内联命名空间（新库改用文件 + export）
namespace Geo { export interface Point { x:number; y:number } }
const p: Geo.Point = { x:1, y:1 };

// 模块增强：给已声明的模块"补"导出（呼应 ts-interface 声明合并、ts-declarations）
declare module "express" {
  interface Request { user?: { id: number } }   // 给第三方 Request 加字段
}
```

`namespace` 编译成 IIFE 对象、会产生运行时值，现代项目除"给无类型的全局库做形状声明"外基本弃用。真正的强项是 `declare module` **模块增强**——给 `express.Request`、`process`、Vue 组件类型等注入自有字段（呼应 Express L5 `req.user`、04-vue 的 `ComponentCustomProperties`）。

---

## 八、自检清单

- [ ] 文件被当作"模块"还是"脚本"的判据是什么？`export {}` 有何用？
- [ ] 为什么优先命名导出而非 default？
- [ ] `import type` 解决什么问题？和 `verbatimModuleSyntax` 怎么配合？
- [ ] barrel 的两大副作用是什么？如何缓解？
- [ ] `esModuleInterop` 和 `allowSyntheticDefaultImports` 区别？不开会怎样？
- [ ] 如何给第三方库的类型"加字段"？用哪个语法？

---

## 🚀 部署预告

- 模块增强的 `declare module`、`declare global`、以及给"无类型的 JS 库"补形状，正是下一关 **ts-declarations**（`.d.ts` 声明文件）的核心；
- `module`/`moduleResolution`/`verbatimModuleSyntax`/`isolatedModules` 这些选项的完整取舍放在 **L7 ts-project**（`tsconfig.json` 全解）；
- ESM/CJS 互操作、`type: module`、`exports` 字段是 Node 侧痛点，与 03-nodejs 的模块系统关、ts-publish 的发布配置呼应。

下一关进入 **ts-declarations**：`.d.ts` 声明文件与给 JS 库补类型。
