# ts-union 面试题精选

> 共 15 题，覆盖 **联合语义 / 交叉语义 / 字面量联合 / 可辨识联合 / 建模哲学 / 联合运算** 六类。

---

## 一、联合与交叉

### 1. `A | B` 与 `A & B` 分别是什么？在"能访问的成员"上方向为何相反？

`A | B`（联合）：值是 A 或 B 之一。因为它"不确定到底是哪支"，所以只能直接访问 **A、B 共有**的成员，特有成员要先收窄。`A & B`（交叉）：值同时是 A 和 B，必须满足两边全部约束，因此能访问 **A 与 B 的全部成员**。记忆：联合是"取或、求安全交集(共有)"，交叉是"取且、求成员并集"。二者对偶，是类型格里的"并/交"运算。

**来源**：TypeScript Handbook — "Union Types / Intersection Types"; "type lattice meet/join"

### 2. 交叉类型 `{a:string} & {a:number}` 会发生什么？如何诊断？

同名属性 `a` 被再次交叉成 `string & number`，没有任何值同时是字符串和数字 → `never`。于是该对象"看起来有 a 却无法赋任何合法值"，常表现为"这个赋值/构造怎么都不通过""参数类型是 never"等诡异报错。诊断：展开交叉看具体属性类型、用 `type X = A & B` 单独 hover 检查。修法：统一冲突属性类型，或改用组合而非交叉。

**来源**：TypeScript — "intersection of conflicting props / never"; StackOverflow — "types and never intersection"

---

## 二、字面量联合

### 3. 字面量联合相比 enum 的优势？`typeof arr[number]` 这个惯用法解释一下。

字面量联合（`'a'|'b'`）是**纯类型、零运行时**，不产生 enum 那样的运行时对象，摇树友好、无跨包内联烦恼。惯用法：把一组合法值写成 `as const` 数组作单一数据源，再用 `typeof ARR[number]` 抽出联合类型：
```ts
const ROLES = ['admin','editor'] as const;   // readonly ['admin','editor']
type Role = typeof ROLES[number];            // 'admin' | 'editor'
```
`[number]` 是"取该（元组/数组）类型的数字索引元素类型"，把每个元素类型联合起来。好处：值集合与类型同源，改数组即改类型（呼应 ts-object-types、ts-mapped）。

**来源**：TypeScript — "as const / indexed access on tuple"; Total TypeScript — "deriving union from array"

---

## 三、可辨识联合

### 4. 什么是可辨识联合？它解决什么问题？举例。

联合的每个成员都带一个**共有的字面量判别字段**（tag/discriminant），TS 能据该字段在分支里自动确定是哪一支，从而安全访问其特有字段。解决"同一概念在不同状态下携带不同数据"的建模：
```ts
type State =
  | { status:'idle' }
  | { status:'loading'; reqId: string }
  | { status:'error'; code: number };
```
`switch(s.status)` 每个 case 收窄到对应变体。典型应用：Redux/组件 reducer 的 Action、UI 状态机、API 响应（成功/失败）、事件负载。

**来源**：TypeScript — "Discriminated Unions"; "Making illegal states unrepresentable"; Redux TS docs

### 5. 判别字段需要满足什么条件才能被 TS 识别？

① 是所有成员**共有**的属性；② 各成员在该属性上是**字面量类型**且互不相同（`'idle'`/`'loading'`…）；③ 该属性可访问（通常必填；若可选需配合收窄技巧）。满足后，对它的相等比较/`switch` 即可触发收窄。若判别字段值不唯一或不是字面量，联合就无法被辨识。可用泛型 + `extends { status: string }` 约束这类形状（见 ts-generic-constraints）。

**来源**：TypeScript Handbook — "discriminant property requirements"; TS docs — "tagged unions"

---

## 四、建模哲学

### 6. "Make illegal states unrepresentable" 是什么意思？为什么它是 TS 的高级价值？

指**通过类型设计让不合法的数据组合根本无法被构造/通过编译**，从而把"运行时才发现的错误"消灭在类型层。反例是一个把所有字段都设为可选的"上帝对象"——任何子集都能构造，非法组合蒙混过关；正例是可辨识联合/sum 类型——`error` 状态必须带 `code`、`idle` 状态不能带 `data`，写错就编译失败。价值：让"代码能编译"与"数据合法"高度重合，减少防御式判空、让状态机在类型上自洽。

**来源**：Yaron Minsky — "make illegal representations unrepresentable"; Functional Light Software; TS discriminated unions

### 7. sum 类型（和类型）与 product 类型（积类型）分别对应 TS 的什么？

- **sum（和类型）= 联合 `|`**：值"是 A 或 B"，可能性空间相加（`|A|+|B|`），如 `bool = true|false`、可辨识联合；
- **product（积类型）= 对象/交叉 `&`/元组**：值"既有 A 又有 B"，可能性空间相乘（`|A|*|B|`），如 `{x:boolean; y:boolean}` 有 4 种。
理解这个代数视角有助于估算类型组合规模、识别"该用联合还是对象"，也是类型体操里 `Exclude`/`Extract` 等运算的直觉来源。

**来源**：TypeScript — "sum and product types"; "type theory for programmers"; category theory in TS

---

## 五、联合与数组/函数

### 8. `(string | number)[]` 和 `string[] | number[]` 有什么区别？

前者是"**元素**可以是 string 或 number 的数组"（同一数组里可混放）；后者是"**整个数组**要么是纯字符串数组、要么是纯数字数组"（两种数组类型的联合）。语义完全不同，写错会导致约束过松或过死。类似地 `Promise<A | B>`（解析值为并）与 `Promise<A> | Promise<B>`（两个不同 Promise 之一）也不同。括号位置决定运算优先级（呼应 ts-basics 数组）。

**来源**：TypeScript — "distributive over arrays/promise"; StackOverflow — "(A|B)[] vs A[]|B[]"

### 9. 函数返回 `T | null` 与 `T | undefined` 是常见模式，使用时要注意什么？

调用点拿到的是联合，**不能直接使用**（除非访问共有成员），必须先判空收窄：`if (v != null)`（同时挡 null 和 undefined）、`v ?? 默认值`、可选链 `v?.x`。这也是 `strictNullChecks` 的主要收益——把"可能没有"编码进类型，逼你处理。返回哪种要一致约定（查找失败常用 `null` 或 `undefined`，团队统一）。深入见 ts-narrowing、ts-strict。

**来源**：TypeScript — "strictNullChecks / nullable"; MDN — "Optional chaining / nullish"

---

## 六、综合

### 10. 联合类型在条件类型里会"分发"，这是什么？举个提取判别字段值的例子。

当条件类型的检查对象是一个**裸类型参数**且为联合时，条件类型会对联合的**每个成员分别求值再取并**（distributive conditional types）。例如：
```ts
type Tag<T> = T extends { kind: infer K } ? K : never;
type Tags = Tag<Shape>;   // Shape 的三支分别求 kind，得 'circle'|'rect'|'triangle'
```
若不想分发，可用元组包住 `[T] extends [...]` 抑制。这是 `Exclude`/`Extract`/`NonNullable` 等内置工具类型的底层机制（见 ts-conditional-infer、ts-utility）。

**来源**：TypeScript Handbook — "Distributive conditional types"; utility-types — Exclude/Extract

### 11. 建模"一个请求可能成功或失败"，你会怎么设计类型？

用可辨识联合把两种结果显式分开，且让数据只在对应分支出现：
```ts
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```
调用方 `switch(r.ok)` 收窄：成功才有 `value`、失败才有 `error`，逼你处理失败分支。比 `{ ok: boolean; value?: T; error?: E }`（全可选）安全得多——后者能表示"ok:true 却没 value"的非法态。可再配 `unwrap`/`match` 辅助函数（呼应 Rust 风格 Result、ts-guards 穷尽）。

**来源**："Result type" pattern; Rust Result; Total TypeScript — "modeling results with unions"

### 12. 联合类型太多导致可访问成员几乎为空，怎么改善体验？

当 `A|B|C` 各支几乎无共有成员时，未收窄前什么都干不了、体验差。改善：① 优先设计**可辨识联合**，用判别字段进 `switch` 即自动到单支；② 用**类型守卫/`in`**收窄（见 ts-guards/narrowing）；③ 避免把语义无关的类型塞进同一联合（拆分成不同参数或函数重载）；④ 若是"输入宽松、处理统一"的场景，可在边界 `String()/Number()` 归一或用函数重载表达"进 A 出 A"。核心：窄化越早、共有面越清晰越好用。

**来源**：TypeScript — "narrowing unions / discriminants"; Effective TS — "modeling unions carefully"

---

## 补充（新专题 13-15）

### 13. 用可辨识联合给「一次 API 请求」建模，你会怎么设计类型？

判别键 `status: "idle" | "loading" | "success" | "error"` 且**数据内聚进分支**：success 分支 `data` 必有、error 分支 `error` 必有，而不是 `{loading, data, error}` 三布尔共存（能表达「loading 且有旧 data 又带 error」的非法态）。UI 对 union 做穷举 switch，加新态编译期全线标红——「make illegal states unrepresentable」。再上一层：success 里细分 stale/fresh（SWR 缓存语义）；带泛型 `Request<T>` 让 data 类型跟接口走；配套 `assertNever` 兜穷举。这套模式同样适合表单（pristine/dirty/submitting/submitted+errors）。

**来源**：Effective TypeScript Item 39《用可辨识联合取代布尔标志》；TypeCasts《Complex state machines with ADTs》。

### 14. 联合类型在条件类型里会「分发」，这带来什么能力与坑？

能力：`type ToNull<T> = T extends string ? "S" : T` 对 `"a"|"b"|1` 逐成员计算再并回去——Exclude/Extract/NonNullable 全家都吃这红利，穷举加工联合零样板。坑：① ** naked T 才分发**（`T extends` 左侧是裸类型参数）；写成 `[T] extends` 元组即关闭——需要「整体判断」时反而要用元组刹车（如 Equal 测试）。② 空联合 never 输入直接返回 never（连 false 分支都不进）——工具类型对空集要特判。③ 分发后每个分支独立推断，跨成员组合信息丢失。识别口诀：裸参数=映射，裹起来=整体。

**来源**：TS Handbook《Conditional Types: 分发规则》；type-challenges 社区「naked type parameter」解释页。

### 15. 判别字段可以是哪些形态？给一个没有显式 kind 字段的联合做收窄的手段。

标准形态：字面量类型公共键（`type/status/kind` 约定俗成）、无参构造签名的布尔字面量（`ok: true`/`ok: false` 也能判别）。没有判别键时按可用信号选：`in` 收窄（属性有无）、`typeof`（原始类型混联）、可调用性 `typeof x === "function"`、instanceof（类体系）、tagged by 返回类型守卫。反模式警告：用「可选属性有无」当判别（`if (a.href)` 区分组件变体）——属性被人为删了就崩；新增成员时也不会穷举报错。**加 kind 是重构成本最低的设计补丁**：联合类型没判别字段=建模未完成。

**来源**：TS Handbook《Discriminants / Narrowing with the in operator》；Total TypeScript《无判别键的收窄策略》。
