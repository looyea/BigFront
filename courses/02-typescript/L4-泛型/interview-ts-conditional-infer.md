# ts-conditional-infer 面试题精选

> 共 15 题，覆盖 **条件类型基础 / infer 提取 / 分发机制 / 工具类型复刻 / 递归与高阶技巧** 五类。

---

## 一、条件类型基础

### 1. 条件类型 `T extends U ? X : Y` 和普通 `if/else` 有什么本质区别？它发生在什么时候？

它发生在**编译期的类型层**，不是运行时的值层。`if/else` 根据运行时的值选择执行分支；条件类型根据传入的**类型**选择"结果类型"，产物仍然是一个类型（可能被后续类型引用），代码里根本不存在对应语句——类型擦除后（呼应 ts-intro）什么都不剩。它的价值是让"输出类型依赖输入类型形状"成为可能，把静态签名从"人工重载"变成"可计算函数"。判断标准：写在类型别名/函数签名泛型位、用 `extends` 做真值测试的，才是条件类型。

**来源**：TypeScript Handbook — "Conditional Types"; Effective TS — Item 27

### 2. 条件类型和 `extends` 约束（`T extends U`）都能写 `extends`，二者分工是什么？

约束是"限定输入的下界"——告诉编译器 `T` 至少长什么样，函数体里能安全访问 `U` 的成员，但不会产生"分叉结果"。条件类型是"基于输入做计算、产出不同类型"——同一个泛型函数，传 `string` 得到一种返回类型、传 `number` 得到另一种，靠 `? :` 分叉。一句话：**约束管"能安全访问什么"，条件类型管"能根据输入算出什么"**（呼应 ts-generic-constraints 第 10 题）。二者常配合：先 `T extends SomeShape` 限定，再在返回类型里用条件类型基于 `T` 计算。

**来源**：TypeScript — "constraints vs conditional types"; Total TypeScript

---

## 二、infer 提取

### 3. `infer` 能出现在哪里？给出从数组、函数、Promise 里各提取一个类型的写法。

`infer` **只能出现在条件类型 `extends` 子句的类型模式里**，声明一个"待推断占位符"，TS 匹配结构时把命中的类型填进去。
```ts
type Elem<T> = T extends (infer U)[] ? U : never;           // 数组/元组元素
type Ret<T> = T extends (...a: any[]) => infer R ? R : never; // 函数返回
type Inner<T> = T extends Promise<infer P> ? P : T;           // Promise 内部
```
可在同一模式里写多个 `infer`（`T extends [infer A, infer B] ? ...`）分别捕获多个位置。它是 `ReturnType`/`Parameters`/`Awaited` 等内置工具类型的实现核心。

**来源**：TypeScript Handbook — "infer Types"; MDN — ReturnType

### 4. 为什么 `T extends (infer U)[] ? U : never` 作用在 `[1, 2]` 上得到 `1 | 2` 而不是别的？

元组 `[1, 2]` 的元素类型是各位置类型的联合 `1 | 2`，`infer U` 匹配的是"元素类型"这个整体，因此捕获到 `1 | 2`。若换成 `readonly [1, 2]` 或用位置式 `T extends [infer A, infer B] ? ...` 才能分别拿到 `1` 和 `2`。这体现了 `infer U` 在数组/元组上"取联合元素类型"的默认行为，也是 `Elem` 类工具对元组会"压平成联合"的原因（需要保序保长度时要改用位置捕获）。

**来源**：TypeScript — "variadic tuple / infer position"; type-challenges

---

## 三、分发机制

### 5. 什么是分布式条件类型？触发条件是什么？如何关闭分发？

当条件类型 `extends` 左侧是**裸类型参数**（naked type parameter，即直接写 `T` 而非 `T[]`、`[T]`、`T | X` 等包装形式）且传入的实参是**联合类型**时，条件类型会**自动分发**到联合的每个成员分别计算，再把结果重新联合起来：`ToArray<"a"|"b">` → `ToArray<"a"> | ToArray<"b">` → `"a"[] | "b"[]`。关闭分发的标准手法是把裸参数包进元组：`[T] extends [U] ? ... : ...`——此时左侧不再是"裸类型参数"，联合被当整体判断。分发还有个特例：`T` 为 `never` 时分布式条件类型直接返回 `never`（空联合分发零次）。

**来源**：TypeScript Handbook — "Distributive Conditional Types"; type-challenges — "Avoid distribution"

### 6. 为什么 `never` 参与分布式条件类型会"直接得到 never"？这算 bug 吗？

不算，是设计使然。分发本质是"对联合的每个成员各算一次再取并集"，而 `never` 是**空联合**（零个成员），所以对零个成员分发、并集仍为空 = `never`。这个性质被广泛利用：`Exclude<T, never>`、以及用条件类型做"是否为 never"检测 `type IsNever<T> = [T] extends [never] ? true : false;`（必须加元组关闭分发，否则 `never` 因分发短路永远返回 `never`，检测失效）。这是面试高频陷阱。

**来源**：TypeScript — "never as empty union / distribution"; type-challenges — "IsNever"

---

## 四、工具类型复刻

### 7. 用条件类型 + 分发解释 `Exclude`/`Extract`/`NonNullable` 三兄弟为什么"一行就能实现"。

```ts
type MyExclude<T, U>  = T extends U ? never : T;   // 命中→never→从联合消失
type MyExtract<T, U>  = T extends U ? T : never;   // 未命中→never→被剔除
type MyNonNullable<T> = T extends null | undefined ? never : T;  // 剔除 null/undefined
```
关键在于**分发 + `never` 在联合里被吸收**：把联合拆开逐个判断，命中"要删除"条件的成员替换成 `never`（等于不出现），保留的成员原样留下，重新联合时就完成了"集合减法/交集"。`NonNullable` 只是"删除条件固定为 null|undefined"的 `Exclude`（标准库里 `NonNullable<T> = T extends null | undefined ? never : T`）。

**来源**：TypeScript lib.es5.d.ts — Exclude/Extract/NonNullable; Effective TS — Item 28

### 8. `ReturnType<T>` 和 `Parameters<T>` 大致怎么实现？对重载函数取到的是哪个签名？

```ts
type MyReturnType<T extends (...a: any) => any> =
  T extends (...a: any) => infer R ? R : never;
type MyParameters<T extends (...a: any) => any> =
  T extends (...a: infer P) => any ? P : never;
```
`ReturnType` 用 `infer R` 抓返回位、`Parameters` 用 `infer P` 抓参数元组。重载函数的类型在内部是"重载签名的联合/列表"，条件类型推断时**只会匹配到最后一个（最specific以外的）重载签名**——这是 TS 已知限制，`Parameters`/`ReturnType` 对重载可能拿不到你想要的那一版；需要精确控制时改用显式 `interface` 里单独命名某签名，或避免对重载做类型抽取。

**来源**：TypeScript lib — ReturnType/Parameters; GitHub issue — "conditional type resolves last overload"

---

## 五、递归与高阶技巧

### 9. 递归条件类型能做什么？`Awaited` 为什么要递归而不是只剥一层？有什么风险？

递归条件类型让"类型运算"能按结构自我套用，处理嵌套/不定深度形状。`Promise<Promise<number>>` 只剥一层得到 `Promise<number>` 仍不对，必须递归 `T extends Promise<infer U> ? Awaited<U> : T` 直到命中非 Promise 才停，故标准 `Awaited` 是递归的。`DeepReadonly`、`Flatten`、`StringToPath`（把 `"a.b.c"` 拆成路径联合）都靠递归。风险是深度过大或存在循环引用时会触发 **"Type instantiation is excessively deep and possibly infinite"**，需靠具体类型、加终止条件或限制深度（尾递归优化在旧版有限）来兜底（呼应 ts-generic-constraints 第 12 题、ts-advanced）。

**来源**：TypeScript — "recursive conditional types / Awaited"; lib.es5.d.ts — Awaited

### 10. 条件类型 + 映射类型 + `keyof` 如何联手实现"按值类型过滤键"（如只保留 string 字段）？

单靠条件类型只能对整个 `T` 判断，要"逐键判断"必须配合映射类型遍历 `keyof`：
```ts
type PickByType<T, V> = {
  [K in keyof T as T[K] extends V ? K : never]: T[K];
};
```
`in keyof T` 生成每个键，`as` 子句（键重映射）里用条件类型决定"保留该键还是映射成 `never`（删除）"。这体现了条件类型很少单打独斗——它负责"判断/计算"，映射类型负责"遍历结构"，二者组合才表达"对对象逐属性变换"（详见 ts-mapped）。

**来源**：TypeScript 4.1 — "Key Remapping via as"; type-fest — PickByType

### 11. `T extends U ? X : Y` 里的 `extends` 到底是不是"子类型"判断？和赋值兼容是什么关系？

基本可以理解为"可赋值性"判断：`A extends B` 在条件类型里为真，约等于"类型为 A 的值能赋给类型为 B 的位置"。因此它是**结构化/赋值兼容**语义，而非名义继承——`{a:1,b:2}` extends `{a:number}` 为真（多余的 b 不影响赋值方向）。要注意边界：字面量 `'a'` extends `string` 为真（字面量是 string 子类型）、`any` 与 `never` 参与时结果反直觉（`any extends string ? 1 : 2` 会同时走两支得到 `1 | 2`）、带 `|`/函数协变逆变时判断更微妙。把它当"能否赋值"能解释大多数场景，但拿不准就用具体类型实跑（呼应 ts-any-unknown）。

**来源**：TypeScript Handbook — "Assignability / Conditional Types"; Effective TS — "extends means assignable"

### 12. 实践中如何避免条件类型写成一坨"天书"？可维护的条件类型有什么风格约定？

准则：① 每一层条件只做一件事，复杂逻辑拆成命名的中间 `type`（`type Core<T> = ...` 再喂下一步），报错时能逐层 hover 定位；② 需要"整体判断"用 `[T] extends [U]` 显式决定是否分发，别依赖默认；③ 优先用内置工具类型（`Pick`/`Omit`/`Exclude`…）组合而非手写等价物，减少出错面（呼应 ts-utility）；④ 用 `extends infer` 提取一次命名复用，避免同一模式反复 `infer`；⑤ 加注释说明"输入→输出"意图，深嵌套会触发 excessively deep 需及时降级为具体类型。可读性 > 类型炫技（贯穿 ts-advanced）。

**来源**：Total TypeScript — "readable conditional types"; type-fest — source style guide

---

## 补充（新专题 13-15）

### 13. infer 能出现在哪些位置？它的「协变位置多次推断合并、逆变位置冲突」规则是什么？

infer 必须出现在 extends 右侧的结构内（数组元素/函数参返/对象属性/模板字面量/索引访问），候选收集后在**结果位置**使用。同一 T 多候选：协变位置（返回、数组元素）取联合，逆变位置（函数参数）取交叉——`(x: infer T)=>void` 与 `(x: infer T)=>void` 交叉会让 `T` 变 `A & B`。多分支共享 infer 名（三元嵌套）非法：同一条件类型作用域内 infer 重名报错；跨辅助 type 别名复用要参数传递。取重载签名：infer 只命中**最后一条**声明（合并后形状），拿多签名要手写 case-by-case。

**来源**：TS 3.7/4.7 release notes 对 infer 位置的扩展；Deep Dive《Infer in contravariant position intersection》。

### 14. Awaited<T> 为什么要递归？TS 对「类型级递归」设了哪些闸？

Promise 可嵌套（`Promise<Promise<number>>` 运行时自动 flatten，类型也要剥到底）且 thenable 可能带 thenable——`T extends PromiseLike<infer U> ? Awaited<U> : T` 自然递归。闸门：实例化深度（默认 100 报错 Excessively deep）、联合展开宽度 100k 熔断、递归类型「同一环节重复命中」检测（tail type 列表记忆化）。工程守则：递归工具类型带「短路出口」（先判 primitive/Function/Date），深嵌套对象上按需而非默认全递归；type-only 递归≠运行时递归但同样能炸编译。

**来源**：TS lib 中 Awaited 的官方实现注释；TS 4.1「Recursive conditional types」release notes 限制章节。

### 15. 分发律给条件类型带来什么、又埋了什么坑？NonNullable<never> 为什么是 never？

裸类型参数在 `T extends U ? X : Y` 中被**逐成员分发**再并结果：`Exclude<"a"|"b","b">` = ("a" extends "b"?never:"a") | ("b" extends "b"?never:"b") = "a"——Exclude/Extract/NonNullable 的魔法全来自此。坑：① never=空联合，分发后=空联合=never，分支根本不执行（`NonNullable<never>` 是 never 而非 never 进 false 分支拿 never——巧合般结果对，但 `T extends any ? 1 : 2` 对 never 返回 never 会让人以为 false 分支坏了）；② 整体判断（数组 T 传入想拿 union 的联合而非逐成员）要 `[T] extends` 刹车；③ 泛型默认值下 T 可能已经是联合——写工具类型先想清楚要不要分发。

**来源**：TS Handbook《Distributive conditional types》；type-challenges 社区 never 分发讨论。
