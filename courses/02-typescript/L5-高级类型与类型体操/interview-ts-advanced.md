# ts-advanced 面试题精选

> 共 12 题，覆盖 **类型断言测试 / 深变换递归 / 路径类型 / 品牌与名义模拟 / 函数签名透传 / 性能与工程边界** 六类。

---

## 一、类型断言测试

### 1. 复杂工具类型怎么写"测试"？为什么需要 `Equal<A,B>` 而不能只靠"能编译通过"？

因为大多数工具类型算出来的是"类型"而非"值"，运行时无从断言，且"能编译"只证明"可赋值"，无法证明"精确相等"（`any`、`{a?:number}` vs `{a:number|undefined}` 都能双向赋值却不"相同"）。社区标准：
```ts
type Equal<A,B> = (<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2) ? true:false;
type Expect<T extends true> = T;
type _ = Expect<Equal<MyPick<User,'name'>, {name:string}>>;
```
`Equal` 借助 TS 内部"两个泛型签名条件类型可互相赋值 ⟺ 参数类型完全相同"的一致性判断做到严格同一性比较。把它写进源码即"类型回归测试"，重构类型时改坏立刻编译失败（呼应 ts-mapped 第 12 题、CI 门禁）。

**来源**：type-simpeq / ts-tooling "Equal trick"; Total TypeScript — "type testing"

---

## 二、深变换递归

### 2. 实现一个"工程可用"的 `DeepReadonly<T>`，为什么要对函数、Date、数组分别短路？

朴素 `{ readonly [K in keyof T]: DeepReadonly<T[K]> }` 会把**一切 object 拆成键值映射**，而函数、`Date`、`Map`、数组都有特殊"骨架"：把函数逐键映射会丢掉调用签名，把 Date 拆成方法列表、把元组拆成丢位次的对象都是错的。工程版先分流：
```ts
type DR<T> =
  T extends readonly (infer E)[] ? readonly DR<E>[]
  : T extends (...a:any[])=>any ? T
  : T extends Date|RegExp ? T
  : T extends object ? { readonly [K in keyof T]: DR<T[K]> }
  : T;
```
"先识别结构再决定要不要递归"是所有深变换（DeepPartial/DeepNullable/结构化 clone 类型）的通用范式（呼应 ts-advanced 第二节）。

**来源**：type-fest — "ReadonlyDeep"; Effective TS — Item 21

### 3. `DeepReadonly` 遇到自引用类型（如 `interface Node { child: Node }`）为什么会栈溢出，又为什么有时反而没事？

递归条件/映射类型对 `Node` 展开成 `{ readonly child: DeepReadonly<Node> }` → 再展开 `DeepReadonly<Node>` … 看似无限。但 **`interface` 是"惰性/具名"的**——TS 对具名接口的递归用"引用相等"短路，能处理正常递归结构（呼应 ts-interface 开放递归）。出事的是**匿名内联对象类型的自引用**或通过类型别名（`type` 是急切展开、不允许直接递归引用自身某些位置）构造的环，或深度极大时触发 `Type instantiation is excessively deep`。对策：优先用 `interface` 表达可递归结构、给深变换加"已访问集合"或深度上限。

**来源**：TypeScript — "recursive types / interface vs alias laziness"; GitHub issue — "excessively deep"

---

## 三、路径类型

### 4. 解释 `Paths<T>` 末尾的 `[keyof T]` 在下标位置是干什么的？为什么常见于这类递归？

```ts
type Paths<T> = { [K in keyof T]-?: ... : never }[keyof T];
```
前半段映射类型生成一个对象 `{ a: "a"|..., b: "b"|... }`，每个属性值是"该子树的路径联合"。末尾 `[keyof T]` 是**索引访问**，把所有属性的值类型再取并集，压成一个总联合 `"a"|...|"b"|...`。这是"先映射成对象、再 `[keyof]` 拍平成联合"的惯用套路（也叫 object-to-union），因为映射类型本身产出对象、无法直接产出联合（呼应 ts-object-types、ts-generic-constraints 索引访问）。

**来源**：type-challenges — "Enumerable String Keyof"; Total TypeScript — "object to union"

### 5. 有了 `Paths<T>`，怎么再实现按路径字符串取到叶子类型？两者如何配合成"类型化 get"？

```ts
type Get<T, P extends Paths<T>> =
  P extends `${infer K}.${infer R}` ? Get<NonNullable<T[K & keyof T]>, R>
  : P extends keyof T ? T[P] : never;
declare function get<T, P extends Paths<T>>(o:T, path:P): Get<T,P>;
get(obj, "b.d.e");   // 返回类型 boolean；"b.x" 因不在 Paths<T> 里直接编译报错
```
`Paths<T>` 既做"合法路径枚举"又做参数约束（非法路径编译期拒绝），`Get<T,P>` 用模板 `infer` 逐段下钻取叶子类型。这就是表单库/i18n/配置系统"字符串 key 强类型"的底层（呼应 ts-mapped 第 8 题）。

**来源**：daisyUI / 表单库 typed path; type-challenges — "Getters and Setters"

---

## 四、品牌与名义模拟

### 6. TypeScript 是结构化类型，为什么有时要"品牌类型（branded / nominal）"？代价是什么？

结构化类型下 `type UserId=string` 和 `type OrderId=string` 完全等价、可随意传错（把订单 ID 传进 `getUser`）。品牌类型交叉一个"永不存在的私有字段"制造名义区分：
```ts
type UserId = string & { readonly __brand: unique symbol };
```
只有显式转换（`as UserId` 或工厂函数 `mkUserId`）才能造出该值，从根上防串号。代价：① 值是"谎言"——运行时仍是普通 string，品牌字段并不真实存在；② 需构造入口，增加样板；③ 反序列化/边界处仍需运行时校验把 `string` 收窄成品牌类型（呼应 ts-guards、Express L5）。它把"名义安全"借类型系统模拟出来，但不提供运行时保证。

**来源**：ts-brand / type-fest — "Branded"; Effective TS — Item 10

---

## 五、函数签名透传

### 7. 实现 `once` / `memoize` 这类高阶函数时，如何做到"返回类型和被包装函数一模一样"？为什么不能用 `(...a:any[])=>any`？

用泛型捕获整个函数类型并原样返回：
```ts
type Fn = (...args:any[]) => any;
declare function once<F extends Fn>(fn:F): F;
declare function memoize<F extends Fn>(fn:F): F & { cache: Map<any,any> };
```
`F extends Fn` 让调用者传入的**具体签名**被 `F` 记住，返回写 `F`（或 `F & 附加成员`）就完整保留参数名、元组、可选、重载、`this`、返回类型。若偷懒写 `(fn:(...a:any[])=>any)=>(...a:any[])=>any`，`any` 会把一切抹平——调用 `once(fetchUser)("id")` 的返回类型变 `any`，失去全部提示与检查（呼应 ts-functions、ts-any-unknown、ts-generic-constraints 第 8 题）。

**来源**：lodash 类型; type-fest — "AnyFunction"; Total TypeScript

---

## 六、性能与工程边界

### 8. 你的 `Equal<A,B>` 为什么写成 `<T>()=>T extends A?1:2` 这种奇怪的函数签名？直接 `A extends B ? (B extends A ? true:false):false` 不行吗？

直接双向 `extends` 会被"赋值兼容"骗过：`any` 与任何类型双向可赋值、`{a?:number}` 与 `{a:number|undefined}` 互相可赋值，于是它们被判 `true`，但严格说并不"同一"。`(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)` 比较的是两个**泛型条件类型签名**，TS 判断其可赋值性时要求 `A`、`B` 在"关系性（relatedness）"上**完全一致**（内部用类型 id 比较），从而把 `any`、可选 vs undefined 等区分开。代价是不可读，所以社区把它封成 `Equal` 复用。

**来源**：type-simpeq — Equal; GitHub issue — "strict type equality"

### 9. 一个"很聪明"的递归类型让 `tsc` 从 3 秒变 40 秒，你如何定位并缓解？

定位：`tsc --diagnostics` 或 `--extendedDiagnostics` 看 `checkTypes`/`instantiate` 耗时；`--generateTrace <dir>` 生成火焰图，能看出卡在哪个文件/类型；VSCode 里对可疑表达式单独 `// @ts-expect-error` 二分。缓解：① 收窄递归输入（先把大联合 `Extract` 到必要成员，防模板字面量笛卡尔积爆炸）；② 给递归设深度上限或用尾递归友好写法；③ 把重复计算的子类型**具名**并交给 TS 缓存（别名比内联更易复用）；④ 用 `interface` 惰性替代急切 `type`；⑤ 库类型用 `skipLibCheck` 跳过对 `.d.ts` 的深度检查（呼应 ts-project、ts-declarations）。

**来源**：TypeScript Wiki — "Performance / generateTrace"; ts-prune; angular — "perf tuning"

### 10. `Distributive Omit`、去掉索引签名的 `Exact`、防 `any` 逃逸……这些"补丁型"高级类型说明了工具类型的什么局限？

说明内置工具类型多为"够用即可"的粗粒度件，边界处会"漏"：`Omit` 会把索引签名与 `readonly`/文档丢掉（呼应 ts-utility 第 5、11 题）、双向 `extends` 判等不严、`Parameters` 对重载取最后一版。于是社区造出 `MergeOpaque`、`Simplify`、`Prettify`、`NoInfer`（TS 5.4）等"补丁"。启示：① 理解底层机制（映射/条件/infer/分发）才能判断某个内置在你的场景会不会"漏"；② 关键类型一定要用 `Expect<Equal>` 验证，别假定内置完美；③ 优先 type-fest 等久经考验的补丁，别裸奔（呼应 ts-utility 第 12 题）。

**来源**：type-fest — "Prettify / Simplify / Except"; TS 5.4 — "NoInfer"

### 11. 有人说"类型写得越严格越好"，你在 ts-advanced 这个层级会怎么把握"严格"与"实用"的度？

分场景。库/框架的**公共 API 边界**、跨团队契约、"传错就出事故"的地方（品牌类型、路径校验、`Expect<Equal>` 回归）值得上重炮。但业务内部若处处深递归/条件套娃，收益递减、维护与编译成本陡增，还会吓退同事。务实准则：**默认开 `strict` 拿到 90% 收益**（呼应 ts-strict），把体操留给"通用、复用、易错"的三处；宁可多写一个具名中间类型让人看懂，也不要一行"聪明流"。类型的目标是**降低缺陷与沟通成本**，不是炫技（呼应 ts-mapped 第 12 题、贯穿全包）。

**来源**：Effective TS — "know your limits / Item 42"; Total TypeScript

### 12. 把 `Paths<T>` + `Get<T,P>` 用在真实业务（如配置对象、i18n）时要注意哪些"生产级"细节？

① **数组处理**：是否允许 `items.0.name` 数字下标，要在 `Paths` 里显式加 `number` 分支否则被当对象拆；② **可选/空值**：递归穿过 `T | undefined` 会污染路径类型，常用 `NonNullable` 归一；③ **深度爆炸**：配置对象很大时 `Paths` 联合成员数随层数指数增长，需限深或按需 `Extract` 子树；④ **函数/Date 短路**（见第 2 题），否则路径会钻进去出不来；⑤ **循环引用**用 `interface` 或访问集兜底；⑥ 对外仍以运行时校验为准（类型只是开发期护栏，i18n key 缺失要配 CI 扫描，呼应 Express L7、ts-guards）。把这些边界处理好，`Paths` 才从"玩具"变"生产力"。

**来源**：i18next — "typed translations"; type-fest; vue-i18n — "resource type inference"
