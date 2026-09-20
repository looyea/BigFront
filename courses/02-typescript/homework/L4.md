# L4 课后作业 · 泛型、约束与条件类型

> 覆盖本阶段三关：`ts-generic` / `ts-generic-constraints` / `ts-conditional-infer`。
> 建议先通读三关讲义，再按顺序完成。所有 `.ts` 片段默认开启 `strict`。

---

## 一、读代码，写出标号处的类型/结果（10 小题）

**1.**
```ts
function identity<T>(x: T): T { return x; }
const a = identity(42);
const b = identity("hi");
```
`a`、`b` 的类型分别是什么？这里 `T` 是被"推断"还是"注解"出来的？

**2.**
```ts
type Pair<T> = { first: T; second: T };
const p: Pair<string> = { first: "a", second: "b" };
```
若把 `second` 改成 `5`，报错原因是什么？`Pair<T>` 是泛型**别名**，它和泛型函数共享什么机制？

**3.**
```ts
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}
const r = longest("abc", "ab");
```
`r` 的类型是 `T`、`string` 还是 `{ length: number }`？为什么约束不会把返回类型"降级"？

**4.**
```ts
function get<O extends object, K extends keyof O>(o: O, k: K): O[K] {
  return o[k];
}
const user = { name: "tom", age: 18 };
const x = get(user, "name");
```
`x` 的类型是什么？`keyof O` 在这里生成了什么联合？把 `"name"` 换成 `"nickname"` 会怎样？

**5.**
```ts
type Elem<T> = T extends (infer U)[] ? U : never;
type E1 = Elem<boolean[]>;
type E2 = Elem<[1, 2, 3]>;
```
`E1`、`E2` 各是什么？为什么 `E2` 是"联合"而不是元组？

**6.**
```ts
type ToArray<T> = T extends any ? T[] : never;
type R = ToArray<"a" | "b">;
```
`R` 是什么？这体现了条件类型的什么机制？把它改成 `[T] extends [any] ? T[] : never` 后 `R` 又变成什么？

**7.**
```ts
type MyNonNullable<T> = T extends null | undefined ? never : T;
type N = MyNonNullable<number | null | undefined>;
```
`N` 是什么？`never` 在这里为什么"看不见"了？

**8.**
```ts
type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;
type A = Awaited<Promise<Promise<string>>>;
```
`A` 是什么？若传入的不是 Promise（如 `Awaited<number>`）结果又是多少？

**9.**
```ts
class Box<T = unknown> { item!: T; }
const b = new Box();
```
`b.item` 的类型是什么？`<T = unknown>` 这个默认值在什么时候生效？如果写成 `<T>` 不给默认，`new Box()` 的 `T` 会推断成什么？

**10.**
```ts
type ReturnType2<T> = T extends (...a: any) => infer R ? R : never;
type Rt = ReturnType2<(n: number) => Promise<boolean>>;
```
`Rt` 是什么？它会自动"解开" Promise 吗？如果要解到底该用哪个工具类型？

---

## 二、手写实现（5 题）

**1.** 手写 `last<T extends readonly unknown[]>(arr: T)`，返回类型为"元组最后一个元素的类型"（提示：`T extends [...infer _, infer L] ? L : never`），并让传普通数组时退化为元素联合。

**2.** 手写类型安全的键值读写：
```ts
declare function setProp<T, K extends keyof T>(o: T, k: K, v: T[K]): void;
```
解释为什么 `setProp(user, "age", "x")` 会报错，并给出你自己的等价实现。

**3.** 用条件类型 + 分发复刻 `Extract<T, U>`（保留能赋给 `U` 的成员），再用它实现 `OnlyString<T> = Extract<T, string>`，验证 `OnlyString<string | number | "a">` 结果。

**4.** 实现 `DeepReadonly<T>`（递归版，预告 ts-advanced）：把对象每一层属性都加 `readonly`，数组元素也要处理。给出对 `{ a: { b: number } }` 的展开效果。

**5.** 实现"函数参数适配器"类型：给定 `F extends (...a: any) => any`，产出一个新的函数类型，其返回类型不变、但参数全部变为可选（提示：结合 `Parameters<F>`、映射类型与 `?`）。

---

## 三、场景题（1 题）

你司要封装一个请求库 `request<TResponse>(config)`，希望做到：

- 传入 `url` 能从一个"路由表"里自动推断响应类型；
- 路由表用 `as const` 定义：`const routes = { "/user": { id: number; name: string }, "/list": number[] } as const;`

请设计泛型签名 `function request<Path extends keyof typeof routes>(path: Path): Promise<typeof routes[Path]>`，并解释：① 为什么 `Path` 要约束到 `keyof typeof routes`；② `typeof routes[Path]` 这里 `typeof` 和索引访问各自的作用；③ 这个模式与 L2 挑战题"类型安全事件总线"的共通之处。

---

## 四、简答题（3 题）

1. 泛型擦除（呼应 ts-intro、ts-generic-constraints 第 7 题）意味着运行时拿不到 `T`。请说明 `function create<T>(ctor: new () => T): T` 这种"把类型信息当值传进来"的模式为什么能绕过擦除，并再举一个生态里的同类设计（如 zod 的 schema、Angular 的 InjectionToken）。

2. 分布式条件类型的"分发"是特性还是负担？请分别举一个"必须依赖分发才能实现"的工具类型，和一个"必须用 `[T] extends [U]` 关闭分发才正确"的检测场景。

3. 有人说"能用内置工具类型就别手写条件类型"。结合 ts-conditional-infer 第 12 题的风格约定，谈谈你在**可读性、出错面、版本兼容**三个维度上的取舍。

---

## 五、挑战题 🏆

实现类型体操经典题 **`UnionToIntersection<U>`**：把 `"a" | "b"` 变成交叉类型 `{...} & {...}` 形式（即 `UnionToIntersection<{a:1} | {b:2}>` = `{a:1} & {b:2}`）。

提示（逆映射 + 分发 + 参数逆变）：
```ts
type UnionToIntersection<U> =
  (U extends any ? (x: U) => void : never) extends (x: infer I) => void
    ? I : never;
```
请逐段解释：① 前半段 `(U extends any ? (x: U) => void : never)` 如何把联合"摊"成一组函数的联合；② 后半段 `extends (x: infer I) => void` 为什么能在逆变位置把多个 `U` "求交"；③ 为什么这里第一步**故意利用**分发、第二步**又依赖整体**匹配。完成后，用它把 `{a:1}`、`{b:2}`、`{c:3}` 三个类型合并成一个同时拥有 a/b/c 的类型并验证。
