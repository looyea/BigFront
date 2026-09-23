# ts-functions 面试题精选

> 共 12 题，覆盖 **函数类型 / 参数形态 / this / 重载 / 兼容性协变 / 参数设计** 六类。

---

## 一、函数类型

### 1. TS 里描述一个函数类型有哪几种写法？各自适用场景？

① 函数声明上直接标注参数与返回：`function f(a: number): string {}`；② 函数类型表达式：`type Fn = (a: number) => string`，适合命名复用、给回调/高阶函数传参；③ interface 的调用签名 `interface Fn { (a: number): string }`（还能混合属性、写重载）；④ 对象方法简写。日常回调多用 ②；需要"函数 + 额外属性"或声明合并用 ③。

**来源**：TypeScript Handbook — "Functions / function types"; Effective TS — function types

### 2. 什么是"上下文类型推断"？它让哪些标注可以省略？

当变量的类型已知（如被标注为某函数类型、或作为已知签名的回调传入），TS 会把这个类型"下发"给表达式，从而推断出参数的类型——这叫 contextual typing。于是 `const add: (a:number,b:number)=>number = (a,b)=>a+b` 里 `a/b` 不必再标；`nums.map(n => n*2)` 里 `n` 自动是 `number`；解构回调 `([x,y]) => ...` 也能推断。减少冗余、保持单一事实来源（签名只在类型处写一次）。

**来源**：TypeScript — "contextual typing / type inference"; StackOverflow — "contextual typing of parameters"

---

## 二、参数形态

### 3. 可选参数、默认参数、剩余参数分别怎么用？有哪些位置限制？

- 可选 `name?: T`：调用可省略，内部类型为 `T | undefined`；
- 默认 `name: T = value`：可省略且有回退值，类型从默认值可推断；
- 剩余 `...nums: T[]`：收集不定数量实参为数组，必须是**最后一个**参数。
限制：可选/默认参数之后不能再放必选的位置参数（否则无法定位）；`?` 与默认值不能同时用于同一参数。多个可选项建议改对象参数（见第 8 题）。

**来源**：TypeScript Handbook — "Optional parameters / defaults / rest"; MDN — "rest parameters"

### 4. `function f(a?: number)` 里 `a` 的类型是什么？和 `a: number | undefined` 有区别吗？

`a?: number` 的类型是 `number | undefined`（strict 下），且表示"可整个省略"。默认情况下二者对"省略"与"显式传 undefined"不作区分（都能传 undefined）。差异在开了 `exactOptionalPropertyTypes` 时对**属性**才有明显区别（可选属性不允许显式 undefined）；对**函数参数**而言 `a?: number` ≈ `a: number | undefined`。判断时统一按可能 undefined 处理（呼应 ts-object-types、ts-strict）。

**来源**：TypeScript — "optional parameters"; "exactOptionalPropertyTypes" (property semantics)

---

## 三、this

### 5. TS 的 `this` 参数是什么？为什么说它不是真正的参数？

TS 把 `this` 视为函数的"第 0 个参数"，可写 `function f(this: Foo, a: number)`。它**只用于类型检查**，编译后会被擦除，不影响运行时值，也不占用实参位。用途：① `this: void` 要求函数以不依赖 this 的方式调用（防止把方法当普通函数丢失绑定）；② 在回调/DOM 库里显式声明 this 形状；③ 让链式 `return this` 类型正确。箭头函数没有自己的 `this` 参数概念（词法 this，呼应 es-arrow）。

**来源**：TypeScript Handbook — "this types"; Total TypeScript — "the this parameter"

---

## 四、重载

### 6. 什么时候该用函数重载，什么时候该用联合参数或泛型？

- **联合参数**（`(a: string | number)`）：不同输入**处理方式/返回类型相同**时用，最简单；
- **重载**：输入形态与**输出类型存在关联**（进 number 出 number、进 string 出 string），或"传不传某参数决定返回不同"时用；
- **泛型/条件类型**：当"返回类型是参数的函数"能用 `T extends string ? ... : ...` 表达时，优先泛型——比手写多条重载更本质、更好扩展（见 ts-conditional-infer）。
经验：重载数量多且组合爆炸时，往往是泛型的信号。重载本身可读性差、匹配靠顺序，慎用。

**来源**：TypeScript — "Function Overloads"; Effective TS — "prefer union/overloads wisely"; Total TypeScript

### 7. 函数重载里为什么"实现签名"要写得比所有声明签名更宽？会不会对调用者暴露？

对外可见的只有上面那些**声明签名**，实现签名被 TS 隐藏（调用者无法用实现签名的形态去调用）。实现里为覆盖所有声明，参数/返回通常写更宽（联合或 `any`），内部再用运行时判断分发。坑点：实现签名本身**不参与**对外的类型检查，所以别指望它约束调用；且若声明签名顺序不当，可能匹配到不该匹配的分支（越具体越靠前）。

**来源**：TypeScript Handbook — "overload signatures vs implementation"; StackOverflow — "why implementation signature not callable"

---

## 五、兼容性与协变

### 8. TS 判断"函数 A 能否赋给函数类型 B"的规则是什么？

调用安全性方向考虑：① **参数个数**——A 需要的参数不多于 B 提供的即可（允许忽略多余参数，方便回调）；② **返回类型**——A 的返回必须是 B 返回的子类型（协变）；③ **参数类型**——`strictFunctionTypes` 开启时按**逆变**（A 的参数需是 B 参数的父类型才安全）。直觉："能被安全地按 B 的方式调用的函数"才算 B 的实现。

**来源**：TypeScript — "function assignability / variance annotations"; "strictFunctionTypes"

### 9. 为什么说"方法声明语法"和"函数属性语法"在类型检查上不一样？

`interface { foo(x: Animal): void }` 里的**方法** foo 采用**双向协变**（宽松，历史上为常见 OOP 模式放宽），而 `interface { foo: (x: Animal) => void }` 里的**函数属性**在 `strictFunctionTypes` 下受**逆变**检查（更严格更安全）。这导致"把窄参数函数赋给方法位"可能悄悄通过、埋下不安全。理解这点能解释一批"为什么这里不报错"的困惑（见 ts-strict）。

**来源**：TypeScript — "strictFunctionTypes / method vs property"; Anders — "variance and method bivariance"

---

## 六、参数设计与综合

### 10. "对象参数模式"（options object）相比位置参数有什么好处与代价？

好处：① 调用处 `connect({ host, ssl: true })` 具名清晰，无需记顺序、无满屏 `undefined`；② 新增可选项**不破坏**已有签名与调用（向后兼容，利于库演进）；③ 配合解构默认值优雅。代价：① 只有一个必选参数时略显啰嗦；② 参数身份靠键名，重命名要同步类型；③ 无法天然表达"参数顺序语义"。经验：>2 参数或含多个可选项就切对象参数（呼应 ts-declarations 库 options 设计）。

**来源**：Effective TS — "prefer options objects"; "parameter object pattern"

### 11. `function f(...args: [string, number])` 这种"剩余元组参数"有什么用？

它给每个位置参数**分别指定类型**且长度固定——`f("a", 1)` ✓、`f(1,"a")` ✗、少/多参数 ✗。常用于**类型安全转发参数**（把某函数的参数原样传给另一函数并保持类型）、事件发射器 `emit(event: 'click', x: number)` 与 `emit(event:'key', k: string)` 的差异化参数（配合重载/条件类型 + `Parameters<T>`）。是"参数元组（parameter tuple）"能力的体现（见 ts-utility 的 Parameters）。

**来源**：TypeScript 4.0 — "variadic tuple types"; TS — "labeled tuple / parameter elements"

### 12. 若让你为一个"既能同步又能异步、参数可选"的 API 设计类型，你会怎么做？

先问清"输入形态与输出是否有确定关联"：① 若"传 callback 即同步、不传返回 Promise"，用**重载**或更本质的**泛型 + 条件类型**（根据是否有 cb 参数把返回推成 `void` 或 `Promise<T>`）；② 可选项归入**对象参数**避免顺序问题；③ 边界值一律 `unknown` 起步再收窄、禁用 `any`；④ 用 `satisfies` 校验默认配置。总之优先"用类型表达真实契约"而非"多处重载 + as"，让非法调用在编译期就不可构造（贯穿 ts-generic / ts-conditional-infer）。

**来源**：Total TypeScript — "conditional return types"; Effective TS — "API design with types"
