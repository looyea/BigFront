# L6 课后作业 · 类、模块、声明文件与装饰器

> 覆盖本阶段四关：`ts-classes` / `ts-modules` / `ts-declarations` / `ts-decorators`。
> 建议边翻各关讲义边做；装饰器题需临时在 `tsconfig` 打开 `experimentalDecorators` + `emitDecoratorMetadata`（呼应 ts-decorators 第二节）。

---

## 一、读代码，判断对错/写出结果（10 小题）

**1.**
```ts
class A { private secret = 1; x = 2; }
class B { x = 2; }
declare const b: B;
const a: A = b;      // ?
```
这行赋值报错吗？为什么？换成把 `A.secret` 改成 `public` 呢？

**2.**
```ts
class Box<T> {
  static empty = 0;
  // static make(): Box<T> { return new Box(); }   // 若取消注释会怎样？
  constructor(private items: T[] = []) {}
}
```
静态成员里能否引用类型参数 `T`？被注释的 `make` 会报什么？

**3.**
```ts
abstract class Shape { abstract area(): number; name = "shape"; }
class Sq extends Shape {
  constructor(private s: number) { super(); }
  area() { return this.s ** 2; }
}
```
去掉 `area()` 实现会怎样？能 `new Shape()` 吗？

**4.**
```ts
export {};
interface Window { __APP__: { ver: string } }
declare global { interface Window { __META__: string } }
```
哪一行真正给全局 `Window` 加了成员？另一行为什么不行（或效果不同）？

**5.**
```ts
import { readFileSync } from "fs";        // (a)
import type { PathLike } from "fs";       // (b)
```
编译后 (a)、(b) 哪条会留在 JS 产物里？(b) 换成 `import { PathLike }` 且开了 `verbatimModuleSyntax` 会怎样？

**6.**
```ts
// 老项目未开 esModuleInterop
import React from "react";     // 运行时得到什么？
import * as React2 from "react";
```
哪句可能 `undefined`？开 `esModuleInterop` 后为什么就对了？

**7.**
```ts
// left.d.ts
declare module "untyped-lib" {
  export function go(n: number): string;
}
```
这个 `.d.ts` 是"ambient 模块声明"还是"模块增强"？判据是什么？

**8.**
```ts
@Injectable()
class Svc2 {
  constructor(private repo: Repo) {}   // 开了 emitDecoratorMetadata
}
```
运行时靠哪份元数据知道要注入 `Repo`？元数据的 key 叫什么？

**9.**
```ts
function deco(t:any,k:string,d:PropertyDescriptor){ d.value = ()=> "patched"; }
class C { @deco m(){ return 1; } }
```
`new C().m()` 返回什么？若装饰器**改成返回新 descriptor**而非原地改 `d.value`，老版语义下要注意什么？

**10.**
```jsonc
{ "compilerOptions": { "skipLibCheck": true } }
```
它会不会跳过对你自己 `.ts` 文件的类型检查？它主要提速/规避的是什么？

---

## 二、手写实现（5 题）

**1.** 用**构造签名**写一个泛型工厂 `function createOnce<T>(Ctor: new (...args:any[]) => T, ...args): T`，并写一个 `@register(name)` 类装饰器把类登记进一个 `Map`（呼应 ts-classes 第 8 题、ts-decorators 第三节）。

**2.** 给一个只有 JS 的库 `money.js`（有全局函数 `formatMoney(cents:number):string` 和一个对象 `MONEY.rates`）写一份 `.d.ts`：分别用 ① ambient 全局声明；② `declare module "money"` 两种方式各写一版。

**3.** 写一个模块增强：给 `express` 的 `Request` 加上 `user?: { id: number; role: "admin"|"guest" }`（呼应 Express L5 认证、ts-modules 第七节），并确保它生效所需的文件形态。

**4.** 用映射类型 + 泛型约束实现一个 `interface Draggable` 的"编译期校验"：写 `class Box implements Draggable`，再故意漏一个方法，记录 `tsc` 报错信息，说明 `implements` 到底检查了什么、没检查什么。

**5.** 写一个"标准版（TS 5.0）"方法装饰器 `@logged`，使用 `(value, context)` 签名并在调用前打印 `context.name`；再写等价的"老版"签名版本，对比两者参数差异。

---

## 三、场景题（1 题）

你要把一套**存量 JS 后端**（Express + 一堆无类型工具模块）逐步迁到 TS，并新写一个 NestJS 风格的 DI 服务层。请给出你的**模块与类型组织方案**：

- `.d.ts` 放在哪、如何声明无类型旧模块（`declare module` 覆盖用到的部分、先 `any` 兜底）；
- `tsconfig` 关键开关（`experimentalDecorators`/`emitDecoratorMetadata`/`esModuleInterop`/`skipLibCheck`/`verbatimModuleSyntax`）各为何设成什么；
- 如何用 `declare global` 给 `process.env` 补自定义字段并强制非空（呼应 ts-strict）；
- 装饰器 DI 与"显式 token"两条路线你会选哪条，为什么（呼应 ts-decorators 第 7、12 题）。

---

## 四、简答题（3 题）

1. 老版 `experimentalDecorators` 与 TS 5.0 标准装饰器在**签名**与**能力**（参数装饰器、类型反射）上差在哪？为何 NestJS/Angular 暂时迁不动？

2. `import type` 到底解决了什么、和 `verbatimModuleSyntax` + `isolatedModules`（Vite/SWC 单文件转译）如何配合？不用它可能在构建期出什么问题（呼应 10-vite）？

3. 为什么"含 `private` 成员的类"会让结构化类型退化成名义类型？这在**写单测 mock** 时会带来什么麻烦，如何规避（面向接口？`as unknown as`？）？

---

## 五、挑战题 🏆

实现一个**极简 DI 容器**（老版装饰器 + 手写元数据，不依赖 reflect-metadata）：

- `@Injectable()` 类装饰器：把类注册进全局 `container`；
- `@Inject(token)` 参数装饰器：把"第 index 位依赖 token"记录到类的元数据数组；
- `resolve<T>(Ctor: new (...a:any[])=>T): T`：读取参数元数据，递归 `resolve` 出依赖实例并按 index 顺序 `new` 出目标。

要求支持至少两层嵌套依赖、并给出 `Expect` 风格的运行时断言（用 `instanceof` 校验注入正确）。完成后思考：如果去掉 `@Inject`、改成像 NestJS 那样"按类型自动注入"，你需要额外开启哪个编译选项、它把类型写进了哪个元数据 key、为什么这在标准装饰器下拿不到（呼应 ts-decorators 第 6 题）。
