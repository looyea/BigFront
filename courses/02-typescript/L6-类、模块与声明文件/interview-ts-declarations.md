# ts-declarations 面试题精选

> 共 12 题，覆盖 **`.d.ts` 本质 / 类型查找与 @types / declare 与 ambient / 生成声明 / skipLibCheck 与漂移 / 实战写声明** 六类。

---

## 一、`.d.ts` 本质

### 1. `.d.ts` 是什么？为什么函数在 `.d.ts` 里只能写签名不能写函数体？

`.d.ts`（declaration file）是 TS 的"纯类型契约"：只描述值/类型"长什么样"（签名、属性、泛型约束），供编译器和 IDE 做类型检查与补全。它**不含实现**——函数写成 `declare function f(x:number):void;`（分号结尾、无花括号体）。因为实现本来就该在对应的 `.js`（或库的运行时代码）里，`.d.ts` 只负责"静态那一半"，运行时它完全不存在（类型擦除，呼应 ts-intro）。写实现体既无意义也违反其"声明"定位，编译器会报"Do not use declaration-syntax in .ts files"类错误（`.d.ts` 里出现实现语句）。

**来源**：TypeScript Handbook — "Declaration Files / .d.ts"; Effective TS — Item 32

---

## 二、类型查找与 @types

### 2. 当我 `import _ from "lodash"`，TypeScript 按什么顺序找它的类型？

大致（取决于 `moduleResolution`）：① 包 `package.json` 的 `types`/`typings` 字段指向的 `.d.ts`；② 若用 `exports`，其 `"types"` 条件（需 node16/nodenext，呼应 ts-modules 第 9 题）；③ 约定文件 `index.d.ts`；④ 以上都没有 → 查社区类型 `node_modules/@types/lodash`；⑤ 仍找不到则报 TS7016"Could not find a declaration file"，`noImplicitAny`（strict）下尤其明显。所以"某个包突然没类型了"往往是对应 `@types` 没装、或包升级后 `types` 字段变了、或 `moduleResolution` 不认它的 `exports`。

**来源**：TypeScript Handbook — "Module Resolution / Typings lookup"; DefinitelyTyped 文档

### 3. 库自带类型和 `@types/xxx` 有什么区别？为什么会"类型漂移"？

库自带类型（`types` 字段）由**库作者**随包发布，通常与实现同步、更权威。`@types/xxx` 是 **DefinitelyTyped 社区**为"没自带类型的库"维护的独立包（`@types/lodash` 对应 `lodash`）。漂移原因：① 社区类型由第三方更新，可能**落后**于库新版本（新 API 报"不存在"）或**超前**（类型里有、实现还没）；② 版本无锁定，装了不匹配.major 的 `@types` 会牛头不对马嘴；③ 库从"无类型 + `@types`"迁移到"自带类型"后，若仍装着 `@types` 会**双份冲突**。对策：优先用自带类型、卸掉多余 `@types`，锁 `@types` 版本与主库对齐，`skipLibCheck` 兜底（呼应第 8 题）。

**来源**：TypeScript Handbook — "Declaration Files / @types"; DefinitelyTyped — "when a library ships its own types"

---

## 三、declare 与 ambient

### 4. `declare const`、`declare module`、`declare global`、`declare namespace` 各自用途？

- `declare const x: T`：**ambient 变量**——声明一个"运行时在别处已存在"的全局值类型（如宿主/打包注入的 `__DEV__`）。
- `declare module "pkg" { ... }`：在**全局脚本**里为某个模块/包整体声明形状（ambient 模块，给无类型 JS 包补类型）；在**模块**里则变成"模块增强"（呼应 ts-modules 第 11 题）。
- `declare global { ... }`：在模块文件里向**真正的全局作用域**追加类型（给 `Window`、`NodeJS.ProcessEnv` 补成员）。
- `declare namespace N { ... }`：声明一个"运行时已存在的全局命名空间"的形状（老式全局库如 `$`、`jQuery`）。
共同点：`declare` 都"只声明不 emit 实现"，是 `.d.ts` 的核心关键字。

**来源**：TypeScript Handbook — "Declaring / ambient"; Effective TS — Item 32

### 5. 三斜线指令 `/// <reference types="..." />` 和 `/// <reference path="..." />` 是干什么的？现在还常用吗？

它们是"文件级"的显式依赖引入指令：`reference types="node"` 等价于把 `@types/node` 拉进本次编译（老项目/无 `package.json` 场景）；`reference path="./x.d.ts"` 手工把某个声明文件并入程序（多用于全局脚本聚合）。随着 `package.json`、`tsconfig` 的 `include`/`types`、模块化成为主流，绝大多数场景已**不需要**手写三斜线指令——`import` 与 `tsconfig` 的 `types`/`typeRoots` 更清晰、可移植。如今主要见于 `.d.ts` 自动生成产物、老代码、以及个别"引用某 `@types`"的兜底。看到它们先想"能否用 `tsconfig.types` 或 import 替代"。

**来源**：TypeScript Handbook — "Tri-slash directives (reference)"; 社区 — "you probably don't need /// references"

---

## 四、生成 `.d.ts`

### 6. `tsc --declaration` 生成的 `.d.ts` 有哪些"不优雅"之处？如何产出干净的库类型？

常见问题：① **私有/未导出类型被自动展开命名**成 `import("./types").Foo`、`__declaration` 之类的"路径型"名字，可读性差；② 结构类型被"就地铺平"，丢失原本具名别语的语义；③ 每个源文件一个 `.d.ts`，散成一堆、无法聚成单入口；④ `declare` 与实现混写约束。产出干净类型的手段：用 `rollup-plugin-dts` / `api-extractor` / `dts-bundle` 把多文件声明**打包合并**成单个 `index.d.ts`；显式 `export type` 你想暴露的名字、`@internal` + strip 掉内部；JS 交给 tsup/rollup、类型走 `emitDeclarationOnly`（`declaration: true` + `declarationMap: true` 便于跳转回源码，呼应 ts-publish）。

**来源**：Microsoft — "api-extractor"; rollup-plugin-dts; tsup — "dts"

### 7. 从 `.ts` 生成 `.d.ts` 时为什么会报"has or is using private name"？怎么解决？

当你导出的函数/类**间接引用**了一个没被 `export` 的类型（参数类型、返回类型、继承的基类、属性类型用了内部 `interface`），`.d.ts` 需要把该名字写进声明里，但它不在导出作用域、无法被外部引用 → TS 报"cannot be named / uses private name 'X'"。解决：① 把那个内部 `interface`/`type` 也 `export` 出去；② 或改成具名导出类型再引用；③ 或内联其定义。这本质是"公共 API 的类型可见性必须自洽"——所有出现在导出签名里的类型都得能被消费者命名到（呼应 ts-modules 导出、ts-publish）。

**来源**：TypeScript — "TS4020/TS4023 has or is using private name"; StackOverflow — "exported variable has or is using name from private module"

---

## 五、skipLibCheck 与版本

### 8. `skipLibCheck: true` 到底跳过什么？它为什么能"救"一堆 `@types` 冲突，又有什么风险？

它跳过对**声明文件（`.d.ts`）内部**的类型检查——不再去逐个校验第三方 `@types` 自身代码是否自洽，但仍然**使用**这些 `.d.ts` 导出的类型来检查你的 `.ts`。为何能救冲突：不同 `@types` 包常各自 `declare global` 扩展同名全局接口（DOM、`NodeJS.*`、`Express.*`），彼此可能矛盾，产生一屏"和我也没关系的报错"，`skipLibCheck` 直接不看这些文件内部就绕过了；同时**大幅提速** `tsc`（少检查成千上万行三方声明）。风险：若两个 `.d.ts` 之间存在**真实**的不兼容（版本错配），错误会被推迟到"用到时才炸"甚至悄悄放过。库作者发布前应临时 `--no-skipLibCheck` 或关掉，确保对外类型自洽（呼应 ts-advanced 第 9 题性能）。

**来源**：TypeScript Handbook — "skipLibCheck"; TS — "why skipLibCheck speeds up builds"

---

## 六、实战写声明

### 9. 让你给一个只有 JS、毫无类型的老库写第一份 `.d.ts`，你的流程和优先级是什么？

① **先覆盖用到的 API**而非全量：从自己项目里对该库的真实调用点出发，写最小 `declare module "old-lib"`；② 拿不准的地方先 `any` 占位 + `// TODO`，保证"能编译、有自动补全骨架"（渐进，呼应 ts-migration、ts-any-unknown）；③ 用 `interface` 描述对象形状、函数重载/可选参数刻画多变签名；④ 有全局挂载的（`window.X`）用 `declare global`；⑤ 类型稳定后，把公共入口 `export`、逐步把 `any` 收紧为精确类型，并用 `Expect<Equal>` 断言关键签名（呼应 ts-advanced 第 1 题）；⑥ 尽量回馈到 DefinitelyTyped 或库仓库。先能用、再精确。

**来源**：TypeScript Handbook —"Creating .d.ts files"; DefinitelyTyped 贡献指南

### 10. `.d.ts` 里描述"既可调用、又带属性"的 API（如 `fn.version`、`fn()`）怎么写？还能描述带泛型的可调用吗？

用 interface 同时给**调用签名**和**属性**：
```ts
interface Plugin {
  (name: string): void;      // 可调用
  version: string;
  enabled: boolean;
}
```
要泛型可调用就加类型参数：
```ts
interface Parse {
  <T>(input: string): T;     // 泛型调用签名
  strict: boolean;
}
```
同理可写**构造签名** `new (): Instance`（呼应 ts-classes 第 8 题）、索引用 `[key: string]: T`（呼应 ts-object-types 索引签名）。这套"调用签名 / 构造签名 / 索引签名"是刻画 JS"函数即对象"惯用法的标准工具（很多库 API 就是带静态方法/属性的函数，如 `Object.assign`、带 `.jsx` 的函数）。

**来源**：TypeScript Handbook — "Call/Construct Signatures"; @types 常见写法

### 11. 什么是 `declare module "*.css"` 这类"通配模块声明"？什么场景会用到？

给"非 JS 资源导入"补类型的写法：
```ts
declare module "*.css" { const cls: Record<string,string>; export default cls; }
declare module "*.svg" { const src: string; export default src; }
declare module "*.worker.ts" { const W: new () => Worker; export default W; }
```
用于：CSS Modules（导入返回类名映射）、图片/字体（导入得到 URL）、Web Worker、`?raw`/`?url` 查询串导入等——这些是**打包器（Vite/webpack）的 loader 约定**，TS 本身不认识。Vite 官方就提供 `vite/client` 里的一堆 `*.png`/`*.svg`/`*.module.css` 声明（`/// <reference types="vite/client" />`，呼应 10-vite、ts-tooling）。不写它们，`import logo from "./a.svg"` 会报"找不到模块声明"。

**来源**：Vite — "assets / type of imports (vite/client)"; webpack — "file-loader typings"

### 12. `.d.ts` 能否包含运行时逻辑？如果想让"类型"随配置动态变化该怎么办？

纯 `.d.ts` **不能**含运行时代码——它只是类型契约（函数体都不许有，见第 1 题）。若想让类型随"真实配置/数据"变化，有两条正路：① **代码生成**——用一个脚本读取 `openapi.json`/`prisma.schema`/i18n 资源，**生成** `.d.ts`（如 `openapi-typescript`、Prisma 生成类型、`vue-i18n` 的 `@intlify`），把"数据"编译成"类型"，纳入构建/CI（呼应 Express L7、07/08 的 typed API）；② **类型推断 + 泛型**——让类型从"作为值传入的模式对象"里 `infer` 出来（zod `z.infer`、tRPC、本关 `import type`），运行时校验 + 静态类型同源（呼应 ts-conditional-infer 第 7 题、ts-frameworks）。核心：动态性来自"生成"或"从值推断"，而非 `.d.ts` 自身执行逻辑。

**来源**：openapi-typescript; Prisma — "generated types"; zod — "type inference from schema"
