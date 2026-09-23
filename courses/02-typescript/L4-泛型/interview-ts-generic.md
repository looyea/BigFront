# ts-generic 面试题精选

> 共 15 题，覆盖 **泛型本质 / 类型推断 / 泛型接口类 / 默认参数 / 泛型 vs any / 擦除** 六类。

---

## 一、泛型本质

### 1. 什么是泛型？为什么说它是"类型的参数"？

泛型让你**在写函数/接口/类时把"类型"本身作为参数**延迟到使用时才确定，用 `T` 这样的类型变量占位。就像普通函数把"值"参数化实现逻辑复用，泛型把"类型"参数化实现**类型层面的复用**——同一套签名适配无数具体类型，且调用后仍保留精确类型关系。例：`identity<T>(x: T): T` 是"输入类型→输出类型相同"这一约束的模板，`T` 由调用实参填入。

**来源**：TypeScript Handbook — "Generics"; "Generics for Java/JS programmers"

### 2. 泛型和 `any` 都能"接受多种类型"，为什么要用泛型？

关键差别是**是否保留类型关系**。`any` 让参数/返回都变成"无类型"，调用方拿到的是 `any`，后续彻底失去检查与补全；泛型用类型变量把"进来的具体类型"记录并回传，`first<T>(a: T[]): T` 里传 `string[]` 得 `string`、传 `number[]` 得 `number`。经验法则：**凡想用 `any` 做"多类型复用"的地方，先考虑泛型能否替代**——能就绝不用 `any`（呼应 ts-any-unknown）。

**来源**：TypeScript — "generic vs any"; Effective TS — "prefer generics to any"

---

## 二、类型推断

### 3. TS 泛型的类型参数是如何被推断的？什么时候推断不出来需要显式写？

TS 用**调用处的实参类型**去匹配形参中出现的类型变量，解出 `T`（如 `f(5)` 令 `T=number`，`f(['a'])` 对 `T: string[]` 解出 `T=string`）。推断失败/不理想的典型情况：① 类型变量只出现在返回位置、参数里"看不见"它（无实参线索）；② 想让 `T` 比实参更宽/更窄（如实参是字面量 `"a"` 但你想要 `string`）；③ 高阶/嵌套泛型推断过深而放弃。这些时显式 `f<string>(...)` 指定。

**来源**：TypeScript — "type argument inference"; StackOverflow — "cannot infer type parameter"

### 4. 为什么有时明明传了字面量，泛型 `T` 却被推断成更宽的类型（或反之）？

这涉及**拓宽（widening）规则**。传给 `T` 的参数，若上下文期望是"某可变/联合位置"，字面量类型可能拓宽为基类型（`"a"`→`string`）。想让 `T` 捕获精确字面量，用 `T extends string` 约束会抑制拓宽、或用 `as const` 传入。理解这一点能解释 `useState('')` 推成 `string`、以及为何某些泛型工具"没保留字面量"（呼应 ts-basics const/let、ts-conditional-infer）。

**来源**：TypeScript — "literal widening / const type parameter"; Total TypeScript — "generic widening"

---

## 三、泛型接口与类

### 5. 泛型接口和泛型函数有什么区别？标准库里有哪些泛型接口？

泛型函数把类型参数用于**单次调用**；泛型接口把类型参数绑定到**整个类型实例**，在使用处（`Box<number>`）固定后贯穿该值生命周期。标准库遍地泛型接口：`Array<T>`、`ReadonlyArray<T>`、`Promise<T>`、`Map<K,V>`、`Set<T>`、`Record<K,V>`、`Iterable<T>`、`IteratorResult<T>`。你自己的 `Repository<T>`、`Response<T>`、组件 `Props<T>` 都是同一思路（呼应 ts-declarations、框架课）。

**来源**：TypeScript lib (lib.es5.d.ts) — "Array/Promise/Map"; Handbook — "Generic Interfaces"

### 6. 泛型类和"多态"的关系？能给泛型参数加约束吗？

泛型类实现**参数多态**——同一份类代码对不同 `T` 生成各自类型安全的实例（`Stack<number>` 与 `Stack<string>` 互不通用）。能给类型参数加约束：`class Box<T extends HasId>`，之后类内可安全访问 `t.id`。约束用 `extends`，与函数泛型一致，下一关专讲 `extends`、`keyof`、多约束（呼应 ts-generic-constraints）。

**来源**：TypeScript — "generic classes / constraints"; Handbook — "Generic Class Constraints"

---

## 四、默认类型参数

### 7. 默认类型参数有什么用？为什么 `= unknown` 是比 `= any` 更好的默认？

默认类型参数在调用方**不指定** `T` 时提供回退，减少样板：`Response<T = unknown>`。选 `unknown` 作默认体现"安全优先"：不指定时数据被视为"未知、用前必须收窄"，保护下游；而 `= any` 会让"忘了写泛型"的地方**静默放弃检查**，是隐患来源。API 设计里，"合理默认 + 可覆盖"能显著降低上手成本（呼应 ts-any-unknown 的 unknown 优先）。

**来源**：TypeScript — "default type parameters"; Effective TS — "sensible generic defaults"

---

## 五、泛型 vs 重载

### 8. "输入 number 返回 number、输入 string 返回 string"，用泛型还是重载？

两者都行，取舍不同：泛型 `function f<T extends number|string>(x:T): T` 更简洁且自动覆盖所有分支，但要求"输出类型是输入类型的**同一变量**"；重载则能表达**更复杂的跨类型映射**（进 A 出 B、进 C 出 D 无共同变量）或依赖运行时区分。若"输入决定输出且二者同源"→泛型最优雅；若"几种离散签名互不相关"→重载；若要"从输入类型**计算**出不同输出类型"→条件类型 + infer（ts-conditional-infer）。

**来源**：TypeScript — "generics vs overloads"; Effective TS — "when to use overloads vs generics"

---

## 六、擦除与运行时

### 9. 泛型被类型擦除，会带来哪些"运行时拿不到类型"的具体困扰？

因为 `T` 编译后不存在：① 无法 `if (T === string)` 或 `new T()`（Java 泛型同样擦除，但 TS 更彻底）；② 无法按 `T` 做运行时校验/序列化分派；③ 数组/联合的运行时类型判断得靠传入**构造器/工厂/判别标签**显式携带信息：`function make<T>(ctor: new () => T): T { return new ctor(); }`。设计通用容器/反序列化时要把"类型信息"当**值**传进来，不能指望 `T`（呼应 ts-intro、ts-classes）。

**来源**：TypeScript — "type erasure of generics"; StackOverflow — "cannot use type parameter at runtime"; "pass constructor as token"

---

## 七、综合与思辨

### 10. 你会在什么情况下**不该**用泛型（避免过度设计）？

泛型有认知与编译成本，以下情况克制使用：① 类型本来就固定、没有"多种类型复用"需求，硬套 `<T>` 徒增噪音；② 只为"少写一个具体类型名"而引入 `T` 却没有任何关系要保留；③ 业务实体清晰可枚举时，直接具名类型/可辨识联合比泛型更可读；④ 泛型嵌套过深导致推断崩、报错难懂（此时拆分或用具名类型）。原则：**泛型服务于"类型间的关系与复用"，没有这个需求就别为炫技而泛型化**（贯穿 ts-advanced 可读性权衡）。

**来源**：Effective TS — "don't over-parameterize"; "generic-free API design"; Total TypeScript

### 11. `Array<T>` 里为什么需要类型参数而不能就是 `Array`？TS 如何处理"泛型必须传参"？

`Array` 是**泛型类型**（类型构造器），未填参数的 `Array` 在现代 TS 里是"开放泛型"，会尝试从上下文推断，孤立使用时**隐式取 `any`**（`Array` ≈ `Array<any>`）从而丢失元素类型安全。`noImplicitAny` 不直接管这个，但 `T` 缺失会让 `arr[0]` 变 `any`。所以务必写全 `Array<string>`/`string[]`。工具类型（`Promise.resolve`、`useState<T>` 等）都靠这个参数把内部值类型传播出去。

**来源**：TypeScript — "generic type requires type arguments / implicit any"; StackOverflow — "Array vs Array<any>"

### 12. 有人说"泛型让类型系统能表达'关系'，而不只是'集合'"，你如何理解并举例？

基础类型描述"值属于哪个集合"（`number` 是所有数字）。泛型进一步表达**跨位置的类型关系/依赖**：`map<T,U>(arr: T[], fn: (x: T) => U): U[]` 编码了"输出数组元素类型 = 回调返回类型、且回调入参 = 输入数组元素类型"这一**约束链**；`Result<T,E>` 表达"成功携带 T、失败携带 E"。配合约束/条件类型（下两关），还能表达"当 T 是字符串时返回 A 否则 B"这类**计算出的关系**。泛型把类型从静态标签升级为可参数化、可推理的关系系统。

**来源**：TypeScript — "generics express relationships"; "parametric polymorphism"; Shape of Programming (类型多态)

---

## 补充（新专题 13-15）

### 13. 泛型接口的「变体」：为什么 Array<Dog> 能赋给 Array<Animal> 在类型上其实不健全？

数组可变：`const ds: Dog[]=[]; const as: Animal[]=ds; as.push(cat as Cat)`——cat 顺着引用进了 Dog[]，读 ds[1] 即崩。TS 因历史 ergonomics（大量函数式消费场景）维持**双向协变**（unsound 妥协），只读消费请用 `readonly Dog[]`——它是真·协变安全（push 不存在）。理解三条线：函数参数逆变（strictFunctionTypes）、对象属性协变（也是 unsound，可变属性）、readonly 家族恢复理论正确性。

**来源**：TS Handbook《Type Relationships: variance》；TS 设计文档「Why is array covariance allowed」。

### 14. 泛型是怎么被「推断引擎」定型的？多个候选位置冲突时按什么规则归并？

每个使用位置是带「优先级」的收集器：返回值位置权重最高，参数位置先字面量后基类型兜底；同优先级候选→取**联合**（`f(1) / f("a")` 分别调用各自定型，单次调用多参冲突才 union）；上下文敏感函数（回调）分两轮：先定 T 再给回调 contextual type——所以 `(x) => x as number` 不干扰 T 推断。加宽时机：无约束裸 T 的字面量参数会 widen 到基类型，除非 `T extends string` 或调用点 as const。推断不出→unknown 兜底→显式类型参数。

**来源**：TS 深入文档《Type inference, contextually typed》；Deep Dive inangod 的 inference candidates 章节。

### 15. 泛型擦除导致运行时要「类型判断」拿不到 T，工程上有哪些标准代偿？

经典三式：① **传工厂**：`create<T>(factory: new ()=>T)` 用构造签名当运行时令牌（DI 容器标准姿势）；② **传 schema**：`parse<T>(s: ZodSchema<T>)` schema 既给类型又给运行时（zod 的核心卖点）；③ **传字典**：`register<T>(map: Record<string, Ctor<T>>)` 用键找实现。设计口径：**类型参数只影响编译，行为需要运行时信息就作为值传入**——把「class 当类型用 vs 当值用」（typeof C）分清楚，是泛型 API 设计第一课。

**来源**：TS Handbook《Generic class types / construct signatures》；NestJS DI 文档 @Injectable token 机制。
