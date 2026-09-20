# 声明文件 .d.ts 与给 JS 补类型

> 目标：理解 `.d.ts` 是"类型世界的 API 契约"——它只描述形状、不含实现。掌握如何**消费**别人的类型（`@types`、`types` 字段、三斜线指令）、如何**手写**声明给无类型的 JS 库/全局变量/GAF 补类型（`declare`、ambient）、如何用 `tsc --declaration` 从自己的代码**生成** `.d.ts`，以及 `.d.ts` 与 `skipLibCheck`、版本漂移的关系（呼应 ts-modules 模块增强、ts-publish、10-vite）。

---

## 一、`.d.ts` 是什么

`.d.ts`（declaration file）只含**类型信息**：声明变量/函数/类/接口/模块/枚举"长什么样"，没有任何实现体（函数体写成 `;`）。它是编译器与 IDE 判断类型的唯一依据，运行时不存在（呼应 ts-intro 类型擦除）。

```ts
// left-pad.d.ts —— 给无类型的 npm 包补一份形状
declare module "left-pad" {
  function leftPad(str: string, len: number, pad?: string): string;
  export default leftPad;
}
```

来源有三：① 社区 `@types/xxx`（DefinitelyTyped）；② 库自带（`package.json` 的 `types`/`typings` 或 `exports` 里的 types 条件）；③ 自己手写或用 `tsc --declaration` 生成（第四节）。

---

## 二、消费：类型从哪来

TS 按一套规则为 `import ... from "pkg"` 找类型：
1. `pkg/package.json` 的 `types`/`typings` 字段 → 指向的 `.d.ts`；
2. `exports` 字段的 `"types"` 条件（需 `moduleResolution: node16+`，呼应 ts-modules 第 9 题）；
3. 约定 `index.d.ts`；
4. 找不到就查 `@types/pkg`（`node_modules/@types`）。

```jsonc
// DefinitelyTyped：装社区类型
{ "devDependencies": { "@types/lodash": "^4" } }
```
`@types/*` 由社区维护，可能与库实际版本**漂移**（类型比实现新/旧）。用 `typesVersions`、锁版本、或 `skipLibCheck` 缓解（见第五节）。

---

## 三、`declare` 家族：ambient 声明

`declare` 告诉编译器"这个东西**在别处**（运行时）真实存在，这里只声明其类型、别生成代码"：

```ts
declare const VERSION: string;                 // 全局变量（如注入的）
declare function greet(name: string): void;    // 全局函数
declare class Logger { log(m: string): void }  // 全局类

// 给全局对象补成员（模块文件里要包 declare global，呼应 ts-modules 第 12 题）
declare global {
  interface Window { Analytics?: (…a:any[])=>void }
  namespace NodeJS { interface ProcessEnv { API_URL: string } }
}
export {};
```

模块文件里的 `declare` 只是"引入已有值的类型"，不会真的创建全局；要让 TS 认可"运行时确实存在"，往往配合 webpack `DefinePlugin`、`dotenv`、宿主注入等（呼应 ts-project）。

---

## 四、从代码生成 `.d.ts`

发布库时不必手写声明，让编译器从 `.ts` 源码生成：

```jsonc
{ "compilerOptions": { "declaration": true, "declarationDir": "dist/types", "declarationMap": true } }
```
- `declaration`：为每个 `.ts` 产出 `.d.ts`；
- `declarationMap`：让"跳转到定义"能跳回 `.ts` 源码而非编译产物；
- 若用打包器出单文件，配合 `emitDeclarationOnly` 只出类型、JS 交给 tsup/rollup（呼应 ts-tooling、ts-publish）。

坑：内部/未导出类型被自动命名（`import("./x").Foo`）、`declare` 与实现不能混在同一 `.d.ts`、re-export 的类型要 `export type`（`isolatedModules`，呼应 ts-modules 第 7 题）。复杂泛型可能生成"无法书写的名字"，用 `dts-bundle`/`api-extractor` 整理。

---

## 五、`skipLibCheck`、`typeRoots` 与版本漂移

```jsonc
{
  "compilerOptions": {
    "skipLibCheck": true,      // 不深入检查 node_modules 里 .d.ts 的内部一致性（大幅提速）
    "types": ["node"],         // 只自动引入列出的 @types 包
    "typeRoots": ["./types", "./node_modules/@types"]
  }
}
```
`skipLibCheck: true` 跳过对**声明文件内部**的类型检查（仍用其导出的类型），能避免"两个第三方 `@types` 里同名全局接口打架"（如都扩了 `Express.Request`/DOM）导致的一堆无解报错，并显著加快 `tsc`（呼应 ts-advanced 第 9 题性能）。代价：可能掩盖 `.d.ts` 之间真实的类型冲突，库作者发布前应临时关掉自查。`@types` 与依赖版本不匹配是"本地 OK、别人拉下来报错"的常见根因，锁版本 + CI 校验（呼应 Express L7）。

---

## 六、写声明的实战模式

```ts
// 1. 函数重载 + 可选参数
declare function on(ev: "click", cb: (x:number)=>void): void;
declare function on(ev: string, cb: (…a:any[])=>void): void;

// 2. 声明合并：同名 interface 分处声明会自动合并（呼应 ts-interface、ts-modules 模块增强）
interface Config { host: string }
interface Config { port: number }   // 合并成 { host; port }

// 3. 描述带索引的对象 / 可调用又带属性
interface Plugin {
  (name: string): void;             // 可调用
  version: string;                  // 又有属性
}
```

给真实 JS 库写声明的方法：从**运行时行为/文档/`README` 示例**反推形状，先 `declare module "pkg"` 覆盖用到的部分（哪怕 `any` 兜底占位），再逐步收紧。宁可"先能编译、局部 any + TODO"，也别一上来追求 100% 精确（呼应 ts-migration 渐进策略、ts-any-unknown）。

---

## 七、自检清单

- [ ] `.d.ts` 里为什么不能有函数体？它运行时存在吗？
- [ ] TS 为一个裸 `import "pkg"` 按什么顺序找类型？`@types` 何时被用到？
- [ ] `declare global` 与 `declare module`（增强）分别改什么作用域？
- [ ] `declaration` + `declarationMap` + `emitDeclarationOnly` 各干什么？
- [ ] `skipLibCheck` 解决了什么、又可能掩盖什么？
- [ ] 给一个完全无类型的 JS 库补类型，你的第一步策略是什么？

---

## 🚀 部署预告

- `.d.ts` 的"只声明形状"思想，和下一关 **ts-decorators** 用 `experimentalDecorators`/`emitDecoratorMetadata` 时依赖的 `reflect-metadata` 类型、以及设计期类型元数据一脉相承；
- 生成的 `.d.ts` 最终要随包发布——`types`/`exports`/`files` 字段与"类型入口"配置放在 **ts-publish**；
- `skipLibCheck`、`typeRoots`、`@types` 漂移属于 `tsconfig.json` 全解范畴，见 **L7 ts-project**；给 JS 项目渐进补类型则是 **ts-migration**。

下一关进入 **L6 收官**——**ts-decorators**：装饰器语法、`emitDecoratorMetadata` 与 NestJS/ Angular 实战。
