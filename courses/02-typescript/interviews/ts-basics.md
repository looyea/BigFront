# ts-basics 面试题精选

> 共 12 题，覆盖 **基础类型 / 类型推断 / 注解策略 / 数组元组 / 枚举 / void-never / 别名** 七类。

---

## 一、类型推断与注解

### 1. TypeScript 的类型推断（inference）是怎么工作的？什么时候必须显式标注？

TS 从初始值、参数默认值、上下文类型逐步推断变量/表达式类型，力求"少写也对"。必须/建议显式标注的场景：① 无初值声明（`let x: string`）；② 空数组/空对象（否则推成 `never[]`）；③ 想比推断更宽或更精确（`let x: string | null = null`）；④ **导出的公共函数边界**——显式参数与返回类型固化契约，防止实现内部改动悄悄改变对外类型，且报错信息更聚焦；⑤ 递归函数返回类型（推断会循环失败）。原则：**内部信任推断，边界显式签名**。

**来源**：TypeScript Handbook — "Type Inference / Basic Type Declarations"; Total TypeScript — "annotation vs inference"

### 2. `const s = 'a'` 和 `let s = 'a'` 推断结果不同，为什么？有什么实际影响？

`const` 不可重新赋值，TS 保留**最精确的字面量类型** `"a"`；`let` 可变，拓宽（widening）为 `string`。影响：字面量类型在做联合、可辨识联合、映射键、函数重载选择时是关键——`const` 能让值作为精确成员参与 `type Dir = "up" | "down"` 的匹配，`let` 拓宽后就不行了。`as const` 则把整个对象/数组深冻结为字面量类型（呼应 ts-guards）。

**来源**：TypeScript — "Literal types / widening"; StackOverflow — "const vs let type inference"; "as const"

---

## 二、原始类型

### 3. `number` 和 `Number`、`string` 和 `String` 有什么区别？为什么变量标注要用小写？

小写 `number/string/boolean` 是**原始类型**；大写 `Number/String/Boolean` 是**包装对象的接口类型**（构造函数的类型）。用大写标注变量会带来诡异行为：对象类型可被 `null` 之外的意外值满足、方法调用与原始值语义不一致、且与 JS 实际产生的原始值不匹配。规则：**几乎永远用小写原始类型**，大写只在极少数需要描述"Number 对象/构造器"时使用。

**来源**：TypeScript — "primitive types"; StackOverflow — "number vs Number in typescript"; Effective TS

### 4. `null` 和 `undefined` 在类型系统里怎么处理？strictNullChecks 有何影响？

关掉 `strictNullChecks` 时，`null/undefined` 可赋给任何类型——这是大量"Cannot read property of undefined"运行时报错的根源。打开后（`strict` 包含它），`null/undefined` 是独立类型、不在其它类型值域内，你必须显式写 `string | null` 并在使用前判空——把空值变成**类型可见的显式契约**。现代项目务必开启（详见 ts-strict）。

**来源**：TypeScript — "strictNullChecks"; Anders Hejlsberg — "null and undefined"; TS docs FAQ

---

## 三、数组、元组与对象

### 5. `number[]` 与 `Array<number>` 有什么区别？元组和数组的本质差异？

`number[]` 与 `Array<number>` **完全等价**，前者是语法糖；多维修 `number[][]` 或 `Array<Array<number>>`。元组 `[string, number]` 是**定长、按位置类型**的数组子类型——每个下标可有不同类型且长度固定，适合"返回多个不同类型结果""Map entry"等结构化场景。`readonly [..]` / `as const` 得到不可变元组，配合函数式风格防意外 `push`。

**来源**：TypeScript Handbook — "Tuples / Arrays"; Effective TS — item on tuples

### 6. 什么是"过剩属性检查"（excess property check）？

把**字面量对象**直接赋给某类型时，若多出了目标类型里没有的属性，TS 会报错——即使按结构化兼容本应允许。它只针对"新鲜的"对象字面量，帮助你抓拼写错误（`{ x:1, y:2 }` 赋给 `{x:number}` 会报，但若先赋给一个变量再传则绕过）。这是对象字面量的额外严格性，深入见 ts-object-types。

**来源**：TypeScript — "Excess Object Property Checks"; StackOverflow — "excess property check"

---

## 四、枚举

### 7. `enum` 和字面量联合 `type Dir = 'up' | 'down'` 怎么选？

数字/字符串 `enum` 会**生成运行时对象**（是少数会 emit 代码的 TS 结构），提供具名成员与（数字枚举）反向映射，但也带来体积、`ReverseMap` 困惑、跨包内联问题。字面量联合是**纯类型、零运行时**，配合 `as const` 对象能得到既精确又轻量的替代。现代风格倾向后者，除非你需要真正的运行时枚举语义或团队约定要 `enum`。`const enum` 能内联消除运行时，但在 `isolatedModules`（esbuild/SWC/Vite 单文件转译）下被限制/禁用（呼应 ts-tooling）。

**来源**：TypeScript — "enums / const enum"; Total TypeScript — "the trick with enums"; "isolatedModules"

### 8. `enum` 和 `const enum`、和 TS 5.0 的"枚举放宽"有什么关系？

早期 `enum` 成员类型互不兼容；TS 5.0 放宽了一些限制（允许更多 `const enum` 内联、混合值枚举等）。`const enum` 在声明处被内联为字面量、不产生对象——更快更小，但要求消费者也参与类型检查，故 `isolatedModules`（逐文件转译的主流构建）里只能用 `preserveConstEnums`/禁用，容易踩坑。理解这些对选型和跨工具兼容很关键。

**来源**：TypeScript 5.0 — "const enum improvements"; TS — "isolatedModules"; Rollup/Vite discussions

---

## 五、顶层与底层类型

### 9. 简述 `any` / `unknown` / `never` 在类型"格"（lattice）里的位置。

把类型看成集合：`unknown` 是**顶类型**（所有类型都是它的子类型，什么都能赋给它），`any` 行为"两边通吃"的逃生舱（既可当顶也可当底，且关掉检查），`never` 是**底类型**（是所有类型的子类型，没有值属于它）。关系：任何值可赋给 `unknown`/`any`；`never` 可赋给任何类型；`unknown` 赋给别的类型前必须收窄，`any` 则可随意赋给任何类型（危险）。详见 ts-any-unknown。

**来源**：TypeScript — "unknown type / never type"; "type lattice / top & bottom types"

### 10. `type` 别名能做的事 `interface` 都能做吗？反过来呢？

不完全。`type` 更通用：能表示联合、交叉、元组、原始别名、映射/条件类型、`typeof` 派生等；`interface` 专攻对象形状，独有优势是**声明合并**（同名 interface 自动合并）、`implements`/`extends` 语义直观、错误信息更友好、某些场景性能略好（可命名递归）。经验：**对象/类的契约用 interface，其它（联合、函数类型、工具类型）用 type**。深入见 ts-interface。

**来源**：TypeScript — "Interfaces vs Type Aliases"; Effective TS — item 9; StackOverflow — "interface or type"

---

## 六、思辨与实战

### 11. 函数返回类型该写还是让推断算？给出你的取舍。

内部/私有/简单函数：让推断算，减少噪音、避免冗余。对外/被别的模块 import 的函数：**显式写返回类型**，理由：① 它是稳定契约，防止你重构实现时无意改变了外部可见类型（breaking change）；② 编译更快（不需在调用点展开推断）；③ 报错定位在定义处而非每个调用处；④ 生成的 `.d.ts` 精确（发布库需要，呼应 ts-publish）。这与"边界显式、内部宽松"总原则一致。

**来源**：Total TypeScript / Matt Pocock — "return type annotations"; Effective TS — public API types

### 12. 类型别名/字面量类型用得好能"把非法状态变成不可表示"，举一例说明。

用可辨识联合 + 字面量把状态机编码进类型：`type State = {status:'idle'} | {status:'loading', reqId:string} | {status:'error', msg:string}`。这样"loading 却没有 reqId""error 却没 msg"这类非法组合**根本写不出来**（编译不过），且 `switch(state.status)` 能自动收窄到对应变体、配合 `never` 兜底保证穷尽（呼应 ts-union/ts-guards）。把"运行时才发现的非法数据"提前到"类型层面无法构造"，是 TS 建模的高级价值。

**来源**：TypeScript — "Discriminated Unions"; "Make illegal states unrepresentable"; Functional Light Software
