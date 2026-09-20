# 条件类型与 infer

> 目标：**让类型能"计算"**——条件类型 `T extends U ? X : Y` 表达"如果…则…"，`infer` 从结构里"挖出"未知类型，理解**分布式条件类型**，并据此真正看懂 `Exclude`/`Extract`/`NonNullable`/`ReturnType` 等工具类型的原理。

---

## 一、条件类型：类型层面的 if

```ts
type IsString<T> = T extends string ? true : false;

type A = IsString<"hi">;     // true
type B = IsString<42>;       // false
```

语法 `T extends U ? X : Y`：若 `T` 可赋给 `U` 取 `X`，否则取 `Y`。可嵌套、可用外部类型参数。它让"输出类型依赖输入类型形状"成为可能——这是 `extends` 约束做不到的（约束只能限定，不能"分叉生成"）。

```ts
// 根据入参决定返回类型
type ToBool<T> = T extends number ? "是数字" : "不是数字";
function tag<T>(x: T): ToBool<T> { return null as any; }
tag(1);    // "是数字"
tag("a");  // "不是数字"
```

---

## 二、infer：从结构中"提取"类型

`infer` 只在条件类型的 `extends` 子句里出现，声明一个"待推断"的类型占位，让 TS 反推出它：

```ts
// 取数组元素类型
type Elem<T> = T extends (infer U)[] ? U : never;
type E1 = Elem<string[]>;      // string
type E2 = Elem<[1, 2]>;        // 1 | 2

// 取函数返回类型
type MyReturn<T> = T extends (...args: any[]) => infer R ? R : never;
type R1 = MyReturn<() => number>;          // number
type R2 = MyReturn<(a: string) => Promise<boolean>>;  // Promise<boolean>

// 取 Promise 内部类型
type Unwrap<T> = T extends Promise<infer U> ? U : T;
type U1 = Unwrap<Promise<string>>;   // string
type U2 = Unwrap<number>;            // number
```

`infer U` 就像"解构赋值里的变量名"——你把结构写成模式，TS 把匹配到的类型填进 `U`。多个 `infer` 可同时提取多处（`T extends [infer A, infer B] ? ... : never`）。

---

## 三、分布式条件类型

当 `extends` 左侧是**裸类型参数**且实参是**联合**时，条件类型会**分发**到联合的每个成员分别计算，再取结果联合：

```ts
type ToArray<T> = T extends any ? T[] : never;
type R = ToArray<string | number>;   // string[] | number[]
// 分发：ToArray<string> | ToArray<number>
```

用 `[T] extends [U]` 加元组可**关闭分发**（把 T 包成非裸参数）：

```ts
type IsUnionLess<T> = [T] extends [string] ? "yes" : "no";
type X = IsUnionLess<"a" | "b">;   // "no"（整体 'a'|'b' 不 extends string 的分支判断被抑制）
```

理解分发是读懂内置工具类型的钥匙——`Exclude`/`Extract`/`NonNullable` 全靠它。

---

## 四、用条件 + infer 复刻内置工具类型

```ts
// Exclude：从联合里剔除能赋给 U 的成员（依赖分发）
type MyExclude<T, U> = T extends U ? never : T;
type E = MyExclude<"a" | "b" | "c", "a" | "b">;   // "c"

// Extract：保留能赋给 U 的成员
type MyExtract<T, U> = T extends U ? T : never;
type X = MyExtract<"a" | "b" | "c", "a" | "b">;   // "a" | "b"

// NonNullable：剔除 null | undefined
type MyNonNullable<T> = T extends null | undefined ? never : T;
type N = MyNonNullable<string | null | undefined>;  // string

// ReturnType：提取函数返回类型
type MyReturnType<T extends (...a: any) => any> = T extends (...a: any) => infer R ? R : never;
```

分发时"匹配到的成员被替换为 `never`"，`never` 在联合里等于"消失"，于是 `Exclude` 实现"减法"、`Extract` 实现"交集"。这就是联合类型运算的本质（呼应 ts-union 第 10 题）。

---

## 五、条件类型 + 约束组合出精确 API

```ts
// 依事件名推断回调参数（类型安全事件总线，兑现 L2 挑战题）
type Events = {
  click: { x: number; y: number };
  key: { key: string };
};
type Handler<K extends keyof Events> = (e: Events[K]) => void;

function on<K extends keyof Events>(name: K, cb: Handler<K>) { /* ... */ }
on("click", e => { e.x; });     // e 收窄为 {x,y}
on("key",   e => { e.key; });   // e 收窄为 {key}
// on("click", e => e.key);     // ✗
```

这里 `Events[K]` 是索引访问，`K` 被约束在 `keyof Events`——配合泛型实现"输入决定输出结构"的精确 API，是现代库（Redux Toolkit、tRPC、Vue 事件）类型的核心（呼应 ts-frameworks）。

---

## 六、递归条件类型（预告深拷贝/深只读）

条件类型可自我引用，实现按结构递归处理：

```ts
type Awaited<T> =
  T extends Promise<infer U> ? Awaited<U>   // 递归剥一层 Promise
  : T;                                       // 非 Promise 则到顶
type A = Awaited<Promise<Promise<number>>>;  // number
```

`Promise.all` 结果的类型、`DeepReadonly`、扁平化数组类型都靠递归条件类型（更多见 ts-utility / ts-advanced）。注意深度过大触发"excessively deep"（呼应 ts-generic-constraints 第 12 题）。

---

## 七、自检清单

- [ ] 条件类型和 `extends` 约束的本质区别（限定 vs 计算）？
- [ ] `infer` 用在哪、干什么？举三个提取例子（数组元素/函数返回/Promise 内部）。
- [ ] 什么是分布式条件类型？怎么关闭分发？为什么会分发？
- [ ] `Exclude<T,U>` 为什么用 `T extends U ? never : T` 就能"做减法"？
- [ ] `never` 在联合分发里扮演什么角色？
- [ ] 递归条件类型怎么用？有什么深度风险？

---

## 🚀 部署预告

- 条件类型 + `infer` 是**内置工具类型的源码基础**，下一关 ts-utility 会带你逐个手写（Partial/Pick/Omit/Awaited/Parameters/ReturnType）；
- "输入决定输出"的精确 API（事件总线、请求封装、`useReducer` action）都靠它，也是 tRPC/Redux Toolkit 等"类型魔法"的真相（呼应 ts-frameworks）；
- 结合映射类型（下下关 ts-mapped）就能表达"遍历一个类型的所有键并逐一变换"这类高级操作。

下一关进入 **L5 类型体操**——**ts-utility**：内置工具类型全解与手写实现。
