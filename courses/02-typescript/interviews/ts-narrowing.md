# ts-narrowing 面试题精选

> 共 12 题，覆盖 **收窄机制 / typeof / truthiness / in / instanceof / switch / 边界** 七类。

---

## 一、收窄机制

### 1. 什么是类型收窄？它和类型断言（as）有什么本质区别？

收窄（narrowing）是编译器通过**控制流分析**，在某个代码点根据条件判断把变量的类型自动缩小到更精确的子类型——它是**基于证据的、编译器验证过的**。类型断言 `as` 是**你单方面命令**编译器"把它当这个类型"，运行时不校验、也没证据。区别：收窄是"证明确实是"，断言是"我说是就是（可能是骗）"。优先用收窄，`as` 只在确知编译器无法推断的边界（如 DOM 已知元素）谨慎使用（呼应 ts-any-unknown）。

**来源**：TypeScript Handbook — "Narrowing / Type Guards"; "type assertions vs narrowing"

### 2. 收窄是持久的吗？离开 if 分支会怎样？

收窄是**局部、按控制流点生效**的。在 `if` 为真的分支里变量被缩窄，出了该作用域（或变量可能被重新赋值处）会回到原声明类型。TS 在分支合流点会取各分支类型的联合。此外，若变量在收窄后被 `let` 重新赋值，TS 会保守地放弃之前的收窄。要跨函数稳定传播收窄，用类型谓词（见 ts-guards）。

**来源**：TypeScript — "control flow analysis / narrowing scope"; "assignments reset narrowing"

---

## 二、typeof

### 3. TS 能根据 typeof 的哪些结果收窄？判"对象"时为什么必须额外排除 null？

TS 认识 `typeof` 的返回：`"string"`/`"number"`/`"bigint"`/`"boolean"`/`"symbol"`/`"undefined"`/`"function"`/`"object"`，据此把联合缩到对应类型。但 JS 里 `typeof null === "object"`（历史 bug），所以 `typeof x === "object"` 分支仍包含 `null`，访问 `x.foo` 可能运行时崩。标准写法 `typeof x === "object" && x !== null` 才收窄到真正的对象。`typeof x === "object"` 也包含数组、函数以外对象等，无法进一步区分，要配合 `Array.isArray`/`instanceof`。

**来源**：MDN — "typeof (null returns object)"; TypeScript — "typeof narrowing"; "Array.isArray"

---

## 三、truthiness / 判空

### 4. `if (x)`、`if (x != null)`、`if (x !== undefined)` 三种判法分别收窄掉什么？

- `if (x)`：排除所有**假值**——`false`、`0`、`""`、`null`、`undefined`、`NaN`；若这些是业务合法值（如 count=0）会误伤。
- `if (x != null)`（宽松不等）：只排除 `null` 和 `undefined`，保留 `0`/`""`/`false`。
- `if (x !== undefined)`：只排除 `undefined`，`null` 仍在。
选哪个取决于"哪些值对你而言算缺省"。处理可选参数/字段时，`!= null` 常是最安全的判缺省手段（呼应 strictNullChecks）。

**来源**：TypeScript — "truthiness narrowing"; MDN — "falsy"; ESLint — eqeqeq 与 != null 例外

### 5. 关闭 strictNullChecks 时，判空收窄为什么"形同虚设"？

不开 `strictNullChecks`，`null`/`undefined` 可赋给任何类型、也不算独立类型，联合里根本不会出现它们——于是"判空"不改变任何类型，`x.foo` 也不会因未判空而报错。结果是空值安全全靠你自己记得判，运行时 `Cannot read property of undefined` 依旧频发。开启后 `T | null` 成为显式类型，判空收窄才真正生效并保护你。这是强烈建议开 strict 的核心理由（详见 ts-strict）。

**来源**：TypeScript — "strictNullChecks"; Anders Hejlsberg — "billion dollar mistake / null"

---

## 四、in / instanceof

### 6. `in` 收窄适合什么场景？它和判别字段收窄有何互补？

`in` 适合"两支对象类型靠**是否有某属性**区分、却没有共同判别字段"的情况（如 `{meow}` vs `{bark}`）。判别字段收窄适合"有共同 tag 字面量"的可辨识联合。两者互补：能设计判别字段就优先可辨识联合（清晰、可穷尽）；面对无法改的既有形状（第三方/联合但无 tag）就用 `in` 探测属性存在来收窄。`in` 也可用于运行时键存在判断，一举两得（呼应 ts-object-types）。

**来源**：TypeScript — "in operator narrowing"; "discriminated union vs property check"

### 7. `instanceof` 收窄的原理与局限？

原理：`x instanceof C` 运行时沿 `x` 的原型链查找 `C.prototype`，TS 据此把 `C` 从联合里挑出来。局限：① 依赖**同一个构造器引用**，跨 realm（iframe、`vm`、Node 多副本、结构化克隆后）时"另一个 realm 的 Array/Error"与原 realm 的 `Array` 不是同一引用，`instanceof` 返回 false——改用 `Array.isArray` 或鸭子类型/判别字段；② 只适用于有原型链的 class/函数，对纯字面量对象/联合原始类型无效（用可辨识联合更好）。

**来源**：MDN — "instanceof / cross-realm"; TypeScript — "instanceof narrowing"; "Array.isArray"

---

## 五、switch 与可辨识联合

### 8. 用 switch 收窄可辨识联合有什么额外好处？

除了自动把每支收窄到对应类型，配合 `default` 分支的 `never` 兜底可做**穷尽性检查**——将来给联合新增一个变体而忘了在 switch 处理时，编译器立刻在 default 处报错（详见 ts-guards）。这把"加了新状态却没更新所有分支"这类高危 bug 交给编译器兜住，对 reducer/状态机/协议处理极其有价值（呼应 ts-frameworks 的 reducer）。

**来源**：TypeScript — "exhaustiveness checking"; Redux — "reducer with discriminated unions"

---

## 六、边界与坑

### 9. 为什么"把收窄条件存进一个布尔变量"有时失效？

TS 对**别名收窄（aliased conditions and discriminants）**的支持有前提：该变量是 `const`（或 `readonly` 属性），且其初始化直接来自对目标变量的类型判定表达式。若用 `let`、或条件里混入其它可变状态、或间接层太多，TS 无法保证目标未被改动，就不会传播收窄。稳妥做法：内联判断，或封装成返回**类型谓词**的函数（ts-guards）。

**来源**：TypeScript 4.4 — "Control flow analysis of aliased conditions"; GitHub — "narrowing lost in variable"

### 10. 收窄后 TS 有时仍"过度乐观"（说非空却可能为空），怎么回事？

常见于：① 闭包捕获的变量在别处被改写（收窄基于假设不再变）；② 可选属性经过函数调用后又被访问（TS 不追踪跨调用的属性变化，除非 `readonly`/可辨识）；③ `as` 伪造了类型。对策：把可变数据先复制到 `const` 局部再判用；用 `readonly` 让编译器信任不变性；关键不变式用类型谓词/运行时校验兜底。理解收窄的"静态近似"本质（呼应 ts-intro 类型擦除）能避免过度依赖它。

**来源**：TypeScript — "narrowing invalidation / mutable closures"; Effective TS — narrowing pitfalls

---

## 七、综合

### 11. 面对一个 `unknown` 的外部数据，你会如何一步步把它"安全"落到具体类型？

① 先做**运行时存在性/形状校验**建立信任——`typeof`、`x !== null`、`in`、`Array.isArray`、`instanceof`，或直接上 zod/valibot 的 `parse`（内部完成运行时校验并返回带类型的结果，最省心，呼应 Express L5）；② 对可辨识结构，用判别字段 + `switch` 分支收窄到各变体；③ 复杂判定封装成**类型谓词**函数，跨函数复用与传播；④ 全程避免 `as`/`any` 走捷径。目标是"证据驱动的收窄"而非"断言式放行"。

**来源**：colinhacks — "Zod for runtime validation"; TypeScript — "narrowing unknown"; typescript-eslint

### 12. 联合类型收窄后，某些成员"消失了"，如何反向利用这一点做穷尽？

对可辨识联合逐一处理后，剩余未处理分支的类型会变成 `never`。在 `default`/末尾写 `const _x: never = s;`——若还有未处理分支，`s` 就不是 `never`，赋值报错，逼你补全。这就是"用类型消失做穷尽证明"。一旦联合新增成员忘了处理，编译器在这一点报警（见 ts-guards 完整写法）。该技巧把"分支是否齐全"变成编译期可检查的命题。

**来源**：TypeScript — "exhaustiveness via never"; "never as exhaustiveness check"; Total TypeScript
