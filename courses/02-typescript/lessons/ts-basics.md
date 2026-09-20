# 基础类型、注解与类型推断

> 目标：**掌握 TS 最常用的基础类型写法**——原始类型、数组/元组、枚举、对象字面量；理解**类型注解 vs 类型推断**，知道什么时候该写、什么时候不该写；建立"能推断就别标注"的工程直觉。

---

## 一、原始类型（primitive）

TS 的原始类型基本对应 JS 的 `typeof` 结果，注意**大小写**：

```ts
let isDone: boolean = false;
let count: number = 42;          // number 涵盖整数/浮点/NaN/Infinity
let msg: string = "hi";
let empty: null = null;
let notSet: undefined = undefined;
let id: symbol = Symbol("id");
let big: bigint = 10n;           // ES2020 大整数（target 需够新）
```

坑：
- **`Number`/`String`/`Boolean`（大写）是包装对象类型，几乎永远别用**——用小写原始类型。
- `let x`（无初值、无注解）会隐式 `any`（`noImplicitAny` 关时）；`let x: number` 不赋值则是 `undefined` 但类型是 `number`（strictNullChecks 下 `number` 不含 `undefined`，见 ts-strict）。

---

## 二、类型注解 vs 类型推断

TS 有强大的**上下文推断**——很多地方不写类型它也能算出来。原则：**能从初值/上下文推断的，就别重复标注**（啰嗦且易过时）。

```ts
let n = 10;                 // 推断为 number，无需 : number
const s = "hello";          // const 字面量推断为字面量类型 "hello"
function double(x: number) { return x * 2; }   // 返回类型可推断为 number
const arr = [1, 2, 3];      // number[]
```

**何时该显式标注**：
- 函数**导出的公共 API 边界**（参数与返回类型）——固化契约、防止实现改动悄悄改变对外类型、报错定位更准；
- 变量无初值、或初值推断过窄/过宽不符合意图（如想 `let x: string | null = null` 而非被推成 `null`）；
- 空数组/空对象（`const list: string[] = []`，否则推成 `never[]` 或过宽）。

```ts
// 内部小工具：信任推断
function add(a: number, b: number) { return a + b; }

// 对外函数：显式签名即文档 + 契约
export function fetchUser(id: string): Promise<User | null> { /* ... */ }
```

> `const` vs `let` 对推断的影响很关键：`const s = "hi"` 推成字面量类型 `"hi"`；`let s = "hi"` 推成宽类型 `string`（因为还能改）。这个差别在做联合/映射时会用到（呼应 ts-literal / ts-mapped）。

---

## 三、数组与元组

```ts
let list1: number[] = [1, 2, 3];
let list2: Array<number> = [1, 2, 3];   // 泛型写法，等价

// 元组：定长、每位类型可不同
let pair: [string, number] = ["age", 30];
pair = ["x", 1];          // ✓
// pair = [1, "x"];       // ✗ 顺序/类型不符
// pair.push(...) 会绕过元组定长语义，注意

// 只读数组/元组（防意外修改，配合函数式）
const ro: readonly number[] = [1, 2, 3];
const tup: readonly [number, string] = [1, "a"];
```

数组越界：默认 `arr[99]` 不报错（`noUncheckedIndexedAccess` 打开后会给你 `T | undefined`，见 ts-strict）。

---

## 四、对象字面量类型

```ts
const point: { x: number; y: number } = { x: 1, y: 2 };

// 可选属性 ?
const cfg: { host: string; port?: number } = { host: "localhost" };

// 只读属性
const c: { readonly id: string } = { id: "a" };
```

注意"对象字面量"会触发**过剩属性检查**（excess property check）——多写一个没声明的 key 会报错（详见 ts-object-types）。

---

## 五、枚举 enum（及何时改用联合）

```ts
enum Direction { Up, Down, Left, Right }        // 数字枚举：0,1,2,3
const d: Direction = Direction.Up;

enum Color { Red = "r", Green = "g" }            // 字符串枚举
const status: "idle" | "loading" | "error" = "loading";   // ← 更推荐的"字面量联合"
```

**枚举的代价**：
- 数字枚举会**产生运行时对象**（唯一会生成代码的 TS 结构之一，与"类型擦除"相对！），有体积与 `ReverseMap` 困惑；
- `const enum` 会内联消除运行时，但在 `isolatedModules`（esbuild/swc/Vite 单文件转译）下**被禁用/行为受限**（呼应 ts-tooling）；
- 现代风格更倾向 **字面量联合 + `as const` 对象**，纯类型无运行时负担：

```ts
const Directions = { Up: 0, Down: 1 } as const;
type Direction = typeof Directions[keyof typeof Directions];
```

---

## 六、其它常用类型

```ts
let x: any;            // 关闭检查，逃生舱（尽量少用，见 ts-any-unknown）
let u: unknown;        // 类型安全的顶层类型，用前必须收窄
let n: never;          // 永不存在的值（穷尽/不可达）
function log(): void { console.log("hi"); }

type ID = string;      // 类型别名（复用/命名），见 ts-interface
type NumOrStr = number | string;   // 联合

let notSure: unknown = 4;
// notSure.toFixed();  // ✗ unknown 用属性前必须收窄
```

`void`（函数无返回值）与 `never`（函数永不正常返回，如抛错/死循环/穷尽兜底）区别：`() => void` 能返回但被忽略；`() => never` 绝不返回。

---

## 七、类型别名 type

给任意类型起名字，可复用：

```ts
type Point = { x: number; y: number };
type Handler = (e: Event) => void;
type ID = string | number;
type Matrix = number[][];
```

`interface` vs `type` 的取舍见 ts-interface。基础阶段记住：`type` 更通用（能表达联合/交叉/映射），`interface` 擅长对象形状与可被实现/合并。

---

## 八、函数基础签名

```ts
function sum(a: number, b: number): number { return a + b; }
const mul = (a: number, b: number): number => a * b;

// 返回类型通常可省略让推断算，除非要固化对外契约
function divide(a: number, b: number) { return a / b; }   // 推断 number
```

参数逐个标注（TS 不写 `a, b: number` 那种共享标注）。深入见 ts-functions。

---

## 九、自检清单

- [ ] `number` 和 `Number` 有啥区别？为什么用小写？
- [ ] 什么时候该写类型注解、什么时候该信任推断？导出函数为什么要显式返回类型？
- [ ] `const s = "a"` 和 `let s = "a"` 推断出的类型有什么不同？
- [ ] 元组和数组的区别？`readonly` 数组干嘛用？
- [ ] 为什么现代项目常把 `enum` 换成字面量联合？`const enum` 在 Vite 下有什么问题？
- [ ] `void` 和 `never` 的区别？

---

## 🚀 部署预告

- **字面量类型与 `as const`** 是配置对象、路由表、状态机的常用手段（贯穿 ts-union、ts-mapped）；
- **枚举的运行时性**在打包/摇树时是特殊存在（呼应 10-vite tree-shaking、ts-tooling 的 isolatedModules）；
- 公共 API 的显式签名在**发布库**时更是刚需（要产出准确 `.d.ts`，见 ts-publish）。

下一关 **ts-any-unknown**——把 TS 里最容易被滥用的 `any` 讲透，并理解 `unknown`/`never`/`void` 各自的正确用途。
