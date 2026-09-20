# L5 课后作业 · 工具类型、映射类型与类型体操

> 覆盖本阶段三关：`ts-utility` / `ts-mapped` / `ts-advanced`。
> 允许查阅各工具类型的官方定义；鼓励用 `Expect<Equal<...>>` 自测。所有片段默认 `strict`。

---

## 一、读代码，写出标号处的类型/结果（10 小题）

**1.**
```ts
type User = { id: number; name: string; email: string };
type A = Partial<User>;
type B = Required<Pick<User, "id" | "name">>;
type C = Omit<User, "id">;
```
写出 A / B / C 的展开结构（含每个属性是否可选）。

**2.**
```ts
type MyOmit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;
type R = MyOmit<{ a: 1; b: 2; c: 3 }, "a" | "c">;
```
`R` 是什么？若把 `"a" | "c"` 写成 `"a" | "z"`（z 不存在），`R` 又会怎样？这体现了 `Omit` 的什么"坑"？

**3.**
```ts
type Flags<K extends string> = { [P in K]: boolean };
type F = Flags<"read" | "write">;
```
`F` 是什么？`in` 右侧不是 `keyof T` 为什么也合法？

**4.**
```ts
type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] };
type G = Getters<{ name: string; age: number }>;
```
`G` 的键和值分别是什么？为什么要 `string & K`？

**5.**
```ts
type PickByType<T, V> = { [K in keyof T as T[K] extends V ? K : never]: T[K] };
type OnlyNum = PickByType<{ a: string; b: number; c: number }, number>;
```
`OnlyNum` 是什么？`as never` 在这里起了什么作用？

**6.**
```ts
type ExtractRoute<T> = T extends `/api/${infer Id}` ? Id : never;
type R1 = ExtractRoute<"/api/42">;
type R2 = ExtractRoute<"/users/1">;
```
`R1`、`R2` 各是什么？

**7.**
```ts
type AwaitAll<T extends readonly unknown[]> = { [K in keyof T]: Awaited<T[K]> };
type R = AwaitAll<[Promise<number>, Promise<string>, boolean]>;
```
`R` 是什么？为什么它能保持"元组"而不是退化成数组/对象？

**8.**
```ts
type Paths<T> = T extends object
  ? { [K in keyof T]-?: K extends string | number ? `${K}` | `${K}.${Paths<T[K]>}` : never }[keyof T]
  : never;
type P = Paths<{ a: number; b: { c: string } }>;
```
`P` 是哪个联合？末尾 `[keyof T]` 起了什么作用？

**9.**
```ts
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type X = Equal<any, number>;
type Y = (any extends number ? (number extends any ? true : false) : false);
```
`X` 和 `Y` 分别是什么？为什么不同？

**10.**
```ts
type UserId = string & { readonly __brand: "UserId" };
declare function getUser(id: UserId): void;
const s = "abc";
// getUser(s);
const u = "abc" as UserId;
getUser(u);
```
为什么 `getUser(s)` 报错而 `getUser(u)` 可以？`__brand` 字段在运行时真的存在吗？

---

## 二、手写实现（5 题）

**1.** 手写 `Nullable<T> = T | null`、`Optional<T> = T | undefined`、`NonNull<T> = NonNullable<T>`（不直接用内置名），并用 `Expect<Equal<...>>` 各写一条断言验证。

**2.** 用**映射类型**实现 `Snakeify<T>`：把所有键从 camelCase 原样保留即可（进阶：用 `as` + 模板字面量把键转成 `` `x_${K}` `` 前缀形式）。给出对 `{ userId: number }` 的结果。

**3.** 手写"工程版"`DeepPartial<T>`：把嵌套对象每一层键都变可选，但**函数、Date、数组**要短路不被拆坏（参考 ts-advanced 第二节分流写法）。

**4.** 用 `ReturnType`/`Parameters`/`Awaited` 组合，从一个异步函数
`declare function fetchUser(id: number): Promise<{ name: string }>` 中，分别取出：① 参数元组；② `await` 后的返回值类型。

**5.** 实现 `Record<Keys, V>` 的等价 `MyRecord<K extends keyof any, V>`，再实现 `Mutable<T>`（去 readonly）与 `Readonly2<T>`（仅对指定键加 readonly：`Readonly2<T, K extends keyof T>`）。

---

## 三、场景题（1 题）

你在写一个**类型化配置读取器** `cfg("server.port")`，配置源是深层对象：
```ts
const config = {
  server: { host: "localhost", port: 8080 },
  db: { url: "pg://...", pool: { min: 1, max: 10 } },
} as const;
```
要求：① 用 `Paths<typeof config>` 生成所有合法路径字符串联合；② 用 `Get<...>` 让 `cfg("db.pool.max")` 的返回类型精确到 `10`（字面量），而非 `number`；③ 非法路径编译期报错。请给出关键类型与函数签名，并说明 `as const` 在这里为何必不可少（呼应 ts-object-types 字面量保留、ts-advanced 第 12 题数组/深度坑）。

---

## 四、简答题（3 题）

1. `Pick` 与 `Omit` 的键参数约束分别是什么？为什么"删字段"的 `Omit` 反而不校验键是否存在？给出一个因此踩坑的例子与规避写法。

2. 同态映射 `{ [K in keyof T]: X }` 与非同态 `{ [K in Keys]: X }` 行为差异体现在哪？这对实现"元组逐位变换"（如 `AwaitAll`）为何关键？

3. 结合 ts-utility 第 12 题、ts-advanced 第 11 题，谈谈你在**业务代码**里对"用内置 / 用 type-fest / 自己写体操"的取舍标准，以及你会如何用 `Expect<Equal>` 给自己的类型上"回归测试"。

---

## 五、挑战题 🏆

实现 **`CamelCase<S>`**（把 `"foo-bar-baz"` / `"foo_bar"` 转成 `"fooBarBaz"` 的类型版本），需要用到**模板字面量 + infer 递归 + `Capitalize`/`Lowercase`**。

提示骨架：
```ts
type CamelCase<S extends string> =
  S extends `${infer H}${'-' | '_'}${infer R}`
    ? `${H}${CamelCase<Capitalize<R>>}`
    : Uncapitalize<S>;
```
请补全并修正边界（连续分隔符、首字符大小写、无分隔符直通），然后用：
```ts
type _t = Expect<Equal<CamelCase<"get-user_name">, "getUserName">>;
```
验证。完成后思考：把它和 `Getters<T>` 结合，能否造出"把 kebab 键自动转 camel 的 props 类型"？这在 Vue/React 组件封装里有什么用（呼应 ts-frameworks）？
