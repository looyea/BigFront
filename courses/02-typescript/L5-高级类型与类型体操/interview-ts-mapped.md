# ts-mapped 面试题精选

> 共 12 题，覆盖 **映射类型本质 / 修饰符控制 / 键重映射 as / 模板字面量类型 / 同态与数组元组 / 工程实战** 六类。

---

## 一、映射类型本质

### 1. 什么是映射类型？它和"用代码遍历对象"有什么相似与不同？

映射类型 `{ [K in keyof T]: X }` 是**在类型层对一个键联合做遍历并逐键生成新属性**，可类比 `Object.fromEntries(keys.map(k => [k, ...]))`。相似：都是"对每个键施加变换产出新结构"。不同：它发生在**编译期**、产物是类型不是值、擦除后无痕迹（呼应 ts-intro）；且它是 TS 里**唯一**能"迭代一个类型的全部键"的机制——没有它就无法用通用方式表达 `Partial`/`Pick`/`Record` 这类"结构变换"。`in` 右侧必须是 `string|number|symbol` 的键联合。

**来源**：TypeScript Handbook — "Mapped Types"; Effective TS — Item 21

### 2. `Flags<K extends string> = { [P in K]: boolean }` 里 `in` 右侧不是 `keyof T` 也合法，为什么？

合法，因为 `in` 右侧只要求是"键类型联合"，不必非得来自 `keyof`。`K extends string` 保证 K 是字符串（子）类型，`"a"|"b"` 这类字面量联合正是合法键联合，于是展开成 `{a:boolean; b:boolean}`。这也解释了 `Record<K,V>`（`K extends keyof any`）为何能接受任意字符串联合做键。`keyof T` 只是"最常见的一种键联合来源"而已。

**来源**：TypeScript — "mapped type constraint string|number|symbol"; lib — Record

---

## 二、修饰符控制

### 3. 用映射类型加/减 `?` 和 `readonly` 的语法是什么？举四个内置工具。

在 `[K in keyof T]` 前/后加修饰符：`?`（=`+?`）加可选、`-?` 去可选；`readonly`（=`+readonly`）加只读、`-readonly` 去只读。四个内置：
```ts
type Partial<T>  = { [K in keyof T]?: T[K] };
type Required<T> = { [K in keyof T]-?: T[K] };
type Readonly<T> = { readonly [K in keyof T]: T[K] };
type Mutable<T>  = { -readonly [K in keyof T]: T[K] };
```
`-?`/`-readonly` 是 TS 2.8 引入的"修饰符移除"语法，让 `Required`/`Mutable` 这类"反向工具"成为可能。

**来源**：TypeScript 2.8 — "optional property modifiers in mapped types"; lib.es5.d.ts

### 4. 为什么 `Required<T>` 只是"类型上去掉可选"，运行时并不会真的校验字段存在？

因为映射类型全部工作在**类型层**，编译后类型擦除、不留任何运行时检查（呼应 ts-intro、ts-any-unknown）。`Required<T>` 让"缺字段"在编译期报错，但如果你 `as` 绕过、或数据来自 `JSON.parse`（返回 any，呼应 ts-guards 的运行时校验缺口），运行时照样能缺字段。要在运行时真正保证"字段齐全"，必须配 zod/`in` 判断等**运行时校验**（呼应 ts-guards、Express L5 校验关），类型工具只负责编译期契约。

**来源**：TypeScript — "type erasure"; Effective TS — Item 2 / Item 3

---

## 三、键重映射 as

### 5. TS 4.1 的 `as` 子句给映射类型新增了什么能力？`as never` 为什么能"删键"？

`as` 允许在生成属性时**重map键名**：`[K in keyof T as NewKey(K)]`。两大用途：① 改名——`` [K in keyof T as `get${Capitalize<string&K>}`]: () => T[K] `` 生成 `getName` 等取值方法类型；② 过滤——当 `as` 后算出的键是 `never`，该属性直接**不出现**（`never` 不是合法键，被丢弃），于是 `PickByType<T,V> = {[K in keyof T as T[K] extends V ? K : never]: T[K]}` 实现"按值类型保留键"。这是第一个能"减少/改名属性"的映射能力（此前映射只能改值、不能动键）。

**来源**：TypeScript 4.1 — "Key Remapping via as"; type-fest — PickByType

### 6. `Getters<T>` 里为什么要写 `Capitalize<string & K>` 而不是直接 `Capitalize<K>`？

`K` 的类型是 `keyof T`，可能是 `string | number | symbol` 的联合，而内置字符串工具 `Capitalize<S extends string>` 只接受 `string`。`string & K` 把 K 收窄到 string 部分（交叉），或用 `K extends string ? ... : never` 先过滤，才能安全喂给 `Capitalize`。直接 `Capitalize<K>` 会因"K 未必是 string"报约束不满足。这是键重映射里处理"键可能非字符串"的常见技巧（呼应 ts-generic-constraints）。

**来源**：TypeScript — " intrinsic string types constraint"; StackOverflow — "Capitalize keyof"

---

## 四、模板字面量类型

### 7. 什么是模板字面量类型？它能把类型用在什么新地方？

模板字面量类型 `` `pre${T}suf` ``（TS 4.1）把 JS 模板字符串语法搬进类型层，`T` 是字符串类型时产出对应的字面量字符串类型，且对联合自动"笛卡尔展开"：`` `${"a"|"b"}-${"1"|"2"}` `` = `"a-1"|"a-2"|"b-1"|"b-2"`。它让"字符串的形状/前后缀/分隔"成为可表达、可推断的类型，用于事件名前缀（`on${...}`）、路由拼接、i18n key、CSS 属性值等。配 `infer` 还能**反向解析**字符串（第 8 题）。

**来源**：TypeScript 4.1 — "Template Literal Types"; Handbook

### 8. `T extends \`/api/${infer Id}\` ? Id : never` 这种"反解字符串类型"能解决什么真实问题？

它把"运行时字符串解析"提前到编译期。真实用途：① **类型化路由参数**——从 `"/user/:id"` 反解出 `{ id: string }`，让 `router.push` 的 params 被强约束（Vue Router typed routes / 本关第七节 `Params`）；② **事件名 ↔ handler 名映射**（`on*` 约定）；③ **i18n** 校验 `t("user.profile.name")` 的 key 是否存在于翻译对象；④ IPC channel 前缀校验。核心价值：把"字符串约定"升级成"编译期可验证的结构"，杜绝拼写/漏参（呼应 ts-frameworks、ES 模板字符串）。

**来源**：Vue Router — "typed routes"; type-challenges — "String literal parsing"; tRPC

---

## 五、同态与数组元组

### 9. 什么是"同态映射（homomorphic mapped type）"？为什么只有 `{ [K in keyof T]: ... }` 这种形式能保留数组/元组结构？

同态映射特指形如 `{ [K in keyof T]: X }`（`in` 右侧**恰好**是 `keyof 某类型参数`）的映射。TS 对这种"从一个类型逐键映射到另一个"有特殊处理：如果 T 是数组/元组，结果也保持数组/元组，并按位置变换元素类型；`readonly`、可选等修饰符也被逐个原样保留。若写成 `{ [K in Keys]: ... }`（Keys 是**独立**的键联合、非 `keyof T`），就**不是**同态映射，数组会退化成普通对象。这个区别决定了 `Awaited<[Promise<number>, Promise<string>]>` 能否得到 `[number, string]`（呼应 `Promise.all` 类型）。

**来源**：TypeScript — "homomorphic mapped types / array-tuple preservation"; Effective TS — Item 21

### 10. 用映射类型实现 `Awaited<T>` 对 Promise 元组的解包（即 `Promise.all` 的结果类型），大致怎么写？

```ts
type AwaitAll<T extends readonly unknown[]> =
  { [K in keyof T]: Awaited<T[K]> };

type R = AwaitAll<[Promise<number>, Promise<string>, boolean]>;
// [number, string, boolean]
```
关键是**同态映射**：`[K in keyof T]` 对元组逐位保留结构，值位用 `Awaited<T[K]>`（递归条件类型）剥掉每一位的 Promise。`Promise.all` 的官方重载正是靠这类"映射 + Awaited"表达"输入 Promise 元组 → 输出结果元组"。理解它就把映射类型、条件类型、infer、递归四件事全串起来了（呼应 ts-conditional-infer、ts-utility）。

**来源**：lib.es2015 — Promise.all 类型; TypeScript — "mapped tuple types (TS 4.0)"

---

## 六、工程实战与坑

### 11. `K in keyof T` 会带进 `number`/`symbol` 键甚至索引签名，模板字面量拼接报错时怎么稳妥处理？

`keyof T` 可能含 `number`/`symbol` 与索引签名（`[k:string]`），直接 `` `x${K}` `` 会因 K 非 string 报错。稳妥做法：先把键过滤/收窄到字符串——`[K in keyof T as K extends string ? `x${K}` : never]`，用 `K extends string` 做守卫、非字符串键 `as never` 丢弃；或 `string & K` 交叉收窄（见第 6 题）。对索引签名要注意它可能把字面量键"吞掉"（呼应 ts-object-types 索引签名一节）。写通用映射工具时，永远假设键是 `string|number|symbol` 并显式处理非字符串分支。

**来源**：TypeScript — "keyof includes number|symbol / index signatures"; type-fest

### 12. 类型体操很爽，但线上项目里你对"重映射/深递归类型"持什么态度？如何防止它拖垮编译或难维护？

克制 + 上保险：① **能简单就别炫技**——优先内置工具类型和显式类型，体操留给确实需要的通用库层（呼应 ts-utility 第 12 题）；② **加断言测试**——用 `type Expect<T extends true>` + `Equal<A,B>` 给复杂类型写"类型单测"，改坏立刻红（详见 ts-advanced）；③ **控深度、防循环**——深递归要设终止条件，警惕 `excessively deep`，循环引用结构加显式标注；④ **命名 + 注释**——每层拆成命名 type、注明输入→输出意图；⑤ **关注编译性能**——超大映射/条件类型会显著拖慢 tsc，CI 里监控类型检查耗时（呼应 Express L7 CI 门禁）。类型是助力不是目的，可读性与可维护性优先。

**来源**：type-sitter / ts-expect — "type testing"; Total TypeScript; Effective TS — Item 42
