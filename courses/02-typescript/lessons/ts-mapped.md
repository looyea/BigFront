# 映射类型与键重映射

> 目标：吃透 `{ [K in keyof T]: ... }` 这一 TS 里最强大的"类型循环"——**映射类型（Mapped Types）**。理解它如何遍历键、变换值、增删修饰符，掌握 TS 4.1 的**键重映射 `as` 子句**，就能亲手造出 `Partial`/`Pick`/`Record` 乃至 `snakeCase` 键转换等一切"结构变换"工具。

---

## 一、映射类型 = 类型的 for 循环

上一关每个工具类型里都出现了 `[K in keyof T]`，这就是映射类型。它像"对类型做一次遍历"：

```ts
type Clone<T> = { [K in keyof T]: T[K] };   // 逐键复制（等价 T 本身）
type ValuesToString<T> = { [K in keyof T]: string };  // 所有值强设成 string
```

`K in keyof T` 读作"对 T 的每个键 K"。方括号里是**计算属性名**（呼应 ES 计算属性），值位可任意引用 `K`、`T[K]`。它把"一个已知键联合"展开成一整套对象类型的每个属性——这就是 TS 里唯一的"对类型做迭代"的机制。

---

## 二、遍历的不只是对象键：联合、数字元组

```ts
type ToOptional<T> = { [K in keyof T]?: T[K] };

// 遍历任意键联合（不只 keyof）
type Flags<K extends string> = { [P in K]: boolean };
type Perm = Flags<"read" | "write" | "exec">;   // { read:boolean; write:boolean; exec:boolean }

// 遍历字面量联合生成键（键重映射的雏形）
type Status = "ok" | "err";
type Handlers = { [P in Status]: () => void };  // { ok:()=>void; err:()=>void }
```

`in` 右侧只要是 `string | number | symbol` 的联合即可（`keyof T` 恰好是这种联合）。对元组/数组也有专门的映射行为（`{ [K in keyof T]: ... }` 会保留数组/元组结构，见第五节）。

---

## 三、修饰符增删：`?` 与 `readonly`

映射类型可统一给所有属性加/减修饰符，用 `+?`/`-?`/`+readonly`/`-readonly`（`+` 可省略）：

```ts
type Partial<T>  = { [K in keyof T]+?: T[K] };        // 全可选
type Required<T> = { [K in keyof T]-?: T[K] };        // 去可选
type Readonly<T> = { readonly [K in keyof T]: T[K] }; // 全只读
type Mutable<T>  = { -readonly [K in keyof T]: T[K] };// 去只读
```

TS 4.1 起还能**按 K 条件决定修饰符**（配合模板/条件类型）：

```ts
type PartialExcept<T, K extends keyof T> =
  { [P in keyof T as P extends K ? P : P]?: P extends K ? T[P] : T[P] | undefined };
// 更常见的"部分字段保持必选"用交叉： Partial<Omit<T,K>> & Pick<T,K>（呼应 ts-utility 第六节）
```

---

## 四、键重映射：`as` 子句（TS 4.1）

映射类型能在生成键时用 `as` **改写键名**，甚至把键映射成 `never` 来**删除**该属性：

```ts
type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] };
type G = Getters<{ name: string; age: number }>;
// { getName: () => string; getAge: () => number }

// 用 as never 过滤掉某些键
type PickByType<T, V> = { [K in keyof T as T[K] extends V ? K : never]: T[K] };
type OnlyStrings = PickByType<{ a:string; b:number; c:string }, string>; // { a:string; c:string }
```

模板字面量类型（`` `get${...}` ``）+ `as` 是键重映射的黄金搭档。`as never` 删除键这一手，正是本关开头 `PickByType`、以及上一关 ts-utility 第 10 题的实现核心。

---

## 五、模板字面量类型：字符串也能运算

映射类型常配**模板字面量类型**做字符串级变换：

```ts
type EventName<T extends string> = `on${Capitalize<T>}`;
type Click = EventName<"click">;               // "onClick"

type Channel<T extends string> = `${T}:${string}`;
type Ch = Channel<"ws">;                        // "ws:${string}"（模式而非单值）

// 反解析：从字符串类型里 infer 出片段
type ExtractRoute<T> = T extends `/api/${infer Id}` ? Id : never;
type R = ExtractRoute<"/api/42">;               // "42"
```

内置字符串工具：`Uppercase`/`Lowercase`/`Capitalize`/`Uncapitalize`。用 `infer` 从模板字符串里"反向解构"，可实现路由参数解析、事件名派生、i18n key 校验等高级玩法。

---

## 六、对数组 / 元组的映射

当 `in` 的右侧来自数组/元组的 `keyof`（含数字索引与 `length` 等），映射会**保留同态结构**（数组仍是数组、元组仍是元组、`readonly` 保留）：

```ts
type ToArray<T> = { [K in keyof T]: T[K] extends number ? string : T[K] };
type A = ToArray<[number, boolean]>;    // [string, boolean]（元组逐位变换）
type B = ToArray<number[]>;             // string[]
type C = ToArray<readonly number[]>;    // readonly string[]（readonly 保留）
```

这叫 **homoformed mapped type（同态映射）**——只作用于元素类型、不动 tuple/数组的"骨架"。据此可实现 `MapTuple`、`Awaited<tuple>`（对 Promise 元组逐个解包，呼应 `Promise.all` 类型）等。

---

## 七、把整套工具串起来：造一个 `RouteParams`

```ts
// 从 "/user/:id/post/:pid" 提取出 { id: string; pid: string }
type Params<S extends string> =
  S extends `${infer _Head}/:${infer Key}/${infer Rest}`
    ? { [K in Key | keyof Params<`${Rest}`>>]: string }
  : S extends `${infer _}/:${infer Key}`
    ? { [K in Key]: string }
  : {};

type P = Params<"/user/:id/post/:pid">;   // { id: string; pid: string }
```

递归条件类型负责"解析字符串"、映射类型负责"把解析出的键名联合铺成对象"。这类"字符串 → 结构化类型"的能力，正是 tRPC、类型化路由（Vue Router typed routes）、i18n 强校验的底层（呼应 ts-frameworks）。

---

## 八、自检清单

- [ ] 映射类型的语法骨架是什么？`in` 右侧可以是哪些东西？
- [ ] `?`、`-?`、`readonly`、`-readonly` 在映射里各自作用？
- [ ] `as` 子句能干什么？`as never` 为什么能删键？
- [ ] 模板字面量类型 + `infer` 如何"反解"字符串？
- [ ] 同态映射对数组/元组会保留什么？
- [ ] 用映射类型实现"给每个键加 get 前缀的取值函数类型"。

---

## 🚀 部署预告

- 映射类型 + 条件类型 + `infer` + 模板字面量，是**类型体操**的全部零件；下一关 **ts-advanced** 会把它们组装成 `DeepReadonly`、`Getters/Setters`、`Expect<Equal>` 断言、递归路径类型等"高级货"；
- 键重映射与 `RouteParams` 这类"字符串驱动类型"是 tRPC / 类型化路由 / i18n 的心脏（呼应 ts-frameworks）；
- 注意深递归与循环引用的性能坑，ts-advanced 会讲如何给类型体操"上保险"。

下一关进入 **ts-advanced**：深变换、类型断言测试与递归类型工程化。
