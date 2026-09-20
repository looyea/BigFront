# 深变换、类型断言测试与递归类型工程化

> 目标：把前三关的零件（泛型 / 约束 / 条件 / infer / 映射 / 模板字面量）组装成"高级货"——**深只读 / 深可选 / 命名前缀对象 / 精确相等断言 / 递归路径类型**，并学会给类型体操"上保险"（`Expect<Equal<...>>` 类型单测、深度限制、循环引用防御）。这是从"会写类型"到"能造库级类型"的分水岭。

---

## 一、类型单测：`Expect` + `Equal`

类型体操最容易"看着对、其实错"，所以需要**编译期断言**。社区标准是 `Equal<A,B>`（基于条件类型对函数签名的不变性技巧）：

```ts
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;   // 不满足 true 就编译报错

// 用法：像写测试一样验证工具类型
type _t1 = Expect<Equal<PickByType<{a:string;b:number}, string>, {a:string}>>;
type _t2 = Expect<Equal<Awaited<Promise<Promise<number>>>, number>>;
```

`Equal` 利用"两个条件类型签名可赋值 ⟺ A、B 完全同一类型"这一内部一致性判断，比 `A extends B && B extends A` 更严格（后者会把 `any`、可选 `undefined` 误判相等）。把 `_tN` 提交进仓库，改坏类型立刻编译失败——类型也有回归测试（呼应 CI 门禁、ts-mapped 第 12 题）。

---

## 二、深只读 / 深可选：递归映射

```ts
type DeepReadonly<T> =
  T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

type DeepPartial<T> =
  T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;
```

朴素版会把数组/函数也"对象化"，工程版要分流：

```ts
type DeepReadonly2<T> =
  T extends readonly (infer E)[] ? readonly DeepReadonly2<E>[]
  : T extends (...a: any[]) => any ? T                 // 函数原样
  : T extends Date | RegExp ? T                          // 内置对象原样
  : T extends object ? { readonly [K in keyof T]: DeepReadonly2<T[K]> }
  : T;
```

条件类型负责"识别结构并分流"、映射类型负责"逐键递归"——这就是类型体操的通用范式（呼应 ts-conditional-infer、ts-mapped）。

---

## 三、递归路径类型：把对象"打平"成 key 联合

```ts
type Paths<T> =
  T extends object
    ? { [K in keyof T]-?: K extends string | number
        ? `${K}` | `${K}.${Paths<T[K]>}`   // 递归拼出嵌套路径
        : never }[keyof T]
  : never;

type Obj = { a: number; b: { c: string; d: { e: boolean } } };
type P = Paths<Obj>;
// "a" | "b" | "b.c" | "b.d" | "b.d.e"
```

配合索引路径取值 `GetByPath`，即可实现"按 `'b.d.e'` 字符串字面量安全读取嵌套值"——表单库、i18n、配置系统刚需。取末尾 `[keyof T]` 把映射出的各值联合成总联合，是"把映射类型当联合用"的惯用收尾（呼应 ts-object-types 索引签名、ts-guards 的 `in`）。

---

## 四、精确取值：`GetByPath`（用 infer 拆路径）

```ts
type GetByPath<T, P extends string> =
  P extends `${infer K}.${infer Rest}`
    ? K extends keyof T ? GetByPath<T[K], Rest> : never
    : P extends keyof T ? T[P] : never;

type V = GetByPath<Obj, "b.d.e">;   // boolean
type V2 = GetByPath<Obj, "b.x">;    // never（路径不存在）
```

模板字面量 `infer` 拆出首段 `K` 与剩余 `Rest`，递归下降——`Paths`（生成）+ `GetByPath`（消费）成对出现，就是类型化的"lodash.get"（呼应 ts-mapped 第 8 题反解字符串）。

---

## 五、品牌类型 & 精确函数包装

```ts
// 品牌类型：结构相同但语义不同的"名义化"（呼应 ts-object-types 品牌类型）
type UserId = string & { readonly __brand: "UserId" };
type OrderId = string & { readonly __brand: "OrderId" };
declare function getUser(id: UserId): void;
// getUser(orderId);  // ✗ 品牌不同，编译期防串号

// 保留任意函数签名的装饰器类型（once / memoize / 缓存）
type Fn = (...args: any[]) => any;
declare function once<F extends Fn>(fn: F): F;         // 返回类型完全等价于入参
declare function withMeta<F extends Fn>(fn: F): F & { __once: true };  // 交叉附加元信息
```

`once<F extends Fn>(fn: F): F` 用泛型"原样透传"整个函数类型（参数、返回、this 全保留），比 `(...a:any[])=>any` 精确得多（呼应 ts-functions、ts-generic-constraints 第 8 题避免 any 泄漏）。

---

## 六、类型体操的性能与坑

- **excessively deep**：递归无终止或对超深结构会触发；用具体类型、加深度上限或拆分。
- **循环引用**：自引用类型让 `DeepReadonly` 无限展开；常见做法是"遇到已访问类型即停"或用 `interface` 的惰性（呼应 ts-interface 开放递归）。
- **组合爆炸**：`` `${A}-${B}` `` 对大联合做笛卡尔积会瞬间膨胀到上千成员拖慢 tsc；先收窄输入。
- **`any` 污染**：约束里 `(...a:any[])=>any` 会把提取结果变 `any`，用 `never[]`/`unknown` 更严（呼应 ts-any-unknown、ts-mapped 第 12 题）。
- 大工程里在 CI 监控 `tsc --diagnostics` 的编译耗时，重类型是常见瓶颈（呼应 ts-project、Express L7）。

---

## 七、自检清单

- [ ] 为什么用 `Equal<A,B>` 而不是 `A extends B && B extends A` 做类型断言？
- [ ] `DeepReadonly` 如何避免把函数/Date/数组错误地"对象化"？
- [ ] `Paths<T>` 生成嵌套路径联合的关键三步是什么？末尾 `[keyof T]` 干什么？
- [ ] `once<F extends Fn>(fn:F):F` 为什么比写成 `(…a:any[])=>any` 好？
- [ ] 类型体操有哪些典型的性能/正确性陷阱？如何各给一条防御？

---

## 🚀 部署预告

- 本关是 L4-L5 "类型体操"的收官：`Expect<Equal>` 断言会贯穿后面所有"给库写类型"的实战（ts-frameworks）；
- 下一站 **L6** 从"类型运算"回到"代码组织"——**ts-classes**（类与面向对象的类型）、**ts-modules**（模块与命名空间）、**ts-declarations**（`.d.ts` 声明文件）、**ts-decorators**（装饰器）；
- 深递归/性能意识会延续到 ts-strict 与 ts-project 的编译器选项权衡（`noUncheckedIndexedAccess`、增量编译、`skipLibCheck`）。

下一关进入 **L6 面向对象的类型**——**ts-classes**：类、继承、抽象类与成员可见性的类型语义。
