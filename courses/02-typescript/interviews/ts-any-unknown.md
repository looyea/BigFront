# ts-any-unknown 面试题精选

> 共 12 题，覆盖 **any / unknown / never / void / 断言与 satisfies / 类型格** 六类。

---

## 一、any

### 1. `any` 到底做了什么？为什么说它是"类型系统的逃生舱"而不是常态？

`any` 关闭该值上的所有类型检查：任何属性访问、函数调用、赋值都被放行，且它能赋给任何类型、任何类型也能赋给它。它的存在是为了**从动态 JS 渐进迁移**时给一个"这块先不检查"的口子。之所以是逃生舱：一旦用了，那段代码就退回无类型世界，还会**传染**——`any` 参与表达式常把结果也变成 `any`，让下游推断集体失效。团队里应通过 `noImplicitAny` + ESLint `no-explicit-any` 把它限制在最小范围。

**来源**：TypeScript Handbook — "any type"; typescript-eslint — "no-explicit-any"; Effective TS — item on any

### 2. 什么是"隐式 any"？如何杜绝？

当 TS 推断不出类型、又没标注时，历史上会默认成 `any`（隐式 any），埋下无检查的洞。开启 `noImplicitAny`（`strict` 家族成员）后，这类"会隐式变 any"的地方改为报错，逼你显式标注或加类型守卫。配合 `@typescript-eslint/no-unsafe-*` 规则集，可在 lint 层拦截 any 值被使用/传播。

**来源**：TypeScript — "noImplicitAny"; typescript-eslint — "typed linting rules"; TS strict mode

---

## 二、unknown

### 3. `unknown` 相比 `any` 解决了什么问题？

`unknown` 是**顶类型**：任何值都能赋给它，但它**不能**被直接当具体类型使用——访问成员、赋值给别的类型前，必须先**收窄**（`typeof`/`instanceof`/`in`/自定义守卫）或显式断言。于是它给了你"我确实不知道这是什么"的诚实表达，同时**强迫你在使用前证明它是什么**，避免 any 那种"无声放行一切"的风险。凡是不确定来源的值（外部 JSON、`catch`、无类型库返回、`postMessage`）都应先落 `unknown`。

**来源**：TypeScript 3.0 — "unknown type"; Total TypeScript — "unknown vs any"; MDN/TS docs

### 4. `catch (e)` 里为什么推荐把 e 当 unknown 处理？

JS 里 `throw` 可以抛任意值（字符串、对象都可能），所以 `e` 未必是 `Error`。TS 4.4 起在 `strict`/`useUnknownInCatchVariables` 下 `e` 默认 `unknown`，直接 `e.message` 会报错，逼你 `if (e instanceof Error)` 收窄——避免对一个可能不是 Error 的对象取 `.message` 而在运行时炸。这是把"异常也是不可信边界"这一事实编码进类型。

**来源**：TypeScript 4.4 — "useUnknownInCatchVariables"; typescript-eslint — "no-unsafe-*"

---

## 三、never

### 5. `never` 有哪些用途？为什么 `string & number` 是 never？

① **永不正常返回**的函数返回类型（总抛错或死循环）；② **穷尽性检查**——可辨识联合处理完所有分支后 default 里把剩余赋给 `: never`，若漏分支则报错（详见 ts-guards）；③ **空交集/不可能值**：`string & number` 要求同时是字符串又是数字，没有任何值满足，故为 `never`；④ 某些条件类型的兜底分支。`never` 是所有类型的子类型（底类型），可赋给任何地方，但没有值能赋给 `never`。

**来源**：TypeScript — "never type"; "exhaustiveness checking with never"; TS — "intersection never"

### 6. 空数组 `const a = []` 为什么会推成 `never[]`？怎么办？

没有初值元素可供推断元素类型，TS 在严格语境下把空数组字面量推成 `never[]`（"目前没有任何合法元素"），于是 `a.push(1)` 报错。解决：显式标注 `const a: number[] = []`，或给初值，或用泛型工具。理解这点能解释很多"往空数组 push 报错"的困惑。

**来源**：TypeScript — "evolving array types / never[]"; StackOverflow — "push into empty array typescript"

---

## 四、void

### 7. `void` 和 `never` 有什么区别？

`void` = 函数会正常结束、但**不返回有用的值**（实际返回 `undefined`）；`never` = 函数**永不把控制权正常交回**（抛异常/死循环），或表示"无值的类型"（空交集、穷尽后剩余）。赋值方向：`never` 可赋给任何类型（底类型），但 `void` 不可随意赋给别的非 void 类型。实践里 `void` 常出现在回调/副作用函数，`never` 常出现在抛错工厂和穷尽兜底。

**来源**：TypeScript — "void / never"; StackOverflow — "void vs never"

### 8. 为什么把 `() => number` 传给期望 `() => void` 的参数是合法的？

因为期望 `() => void` 表达的是"**我调用你不关心返回值**"，所以任何返回类型的函数都能安全充当（返回值只是被忽略）。这是 TS 有意为之的赋值规则，让 `arr.forEach(x => doSomething(x))`（doSomething 有返回）不报错。反向不成立：不能把 `() => void` 当 `() => number` 用。

**来源**：TypeScript — "function assignability / void return"; Effective TS — void callbacks

---

## 五、断言与 satisfies

### 9. 类型断言 `as` 的风险在哪？`as unknown as T` 又意味着什么？

`as` 是"我比编译器更懂"的命令，运行时**不做任何校验**，所以若真实值不符合断言类型，错误会溜到运行时才爆。它还可能**掩盖**更精确的推断（断言后类型就是你写死的）。当两个类型无重叠时 `as` 会拒绝，有人用 `as unknown as T` 强行两段跳——这等于**双重关闭检查**，是"我知道我在撒谎/我很确定"的信号，应尽量少用，优先类型守卫、`satisfies` 或修数据建模。

**来源**：TypeScript — "type assertions"; Total TypeScript — "as / satisfies"; Effective TS — item on assertions

### 10. `satisfies`（TS 4.9）解决什么痛点？和 `as`、和 `: T` 标注的区别？

痛点：`x: T` 标注会把 `x` 的类型**变宽成 T**（丢字面量精度），`x as T` 又会放弃检查且可能失真。`satisfies` 兼顾两者：既**校验** `x` 符合 `T`，又**保留** `x` 自身被推断出的精确类型。典型：`const palette = { r: [255,0,0], g: '#0f0' } satisfies Record<string, string | number[]>` —— 校验结构合法，同时 `palette.r` 仍是精确的 `[number, number, number]`、`palette.g` 是 `string`，而非被统一拓宽成联合成员类型。

**来源**：TypeScript 4.9 — "satisfies operator"; Andrés (Orquesta) — "satisfies explained"

---

## 六、类型格与综合

### 11. 用"类型格（type lattice）"解释 `unknown`、`any`、`never` 的关系。

把类型按"可赋值性"排成格：`unknown` 是**顶**（所有类型 ≤ 它，万物可赋给它），`never` 是**底**（它 ≤ 所有类型，可赋给任何地方）。`any` 不守规矩——它被**双向兼容**（既可当顶又可当底）且会中断检查，所以它不是格里的普通节点，而是"把这块从格中摘出去"的开关。安全排序：优先精确类型 → 不确定用 `unknown`（强制收窄）→ 实在过渡才用 `any`（并加 lint 限制）。

**来源**：TypeScript spec — "assignability / subtype relations"; "top and bottom types"; category theory in types

### 12. 生产项目里你如何约束 any、保障边界安全？给一套可落地的规则。

① tsconfig 开 `strict`（含 `noImplicitAny`）；② ESLint 开 `@typescript-eslint/no-explicit-any`（error）+ `no-unsafe-*` 系列，CI 阻断；③ 所有**外部边界**（HTTP body、env、localStorage、`JSON.parse`、第三方无类型库）先 `unknown`，经 zod/valibot `parse` 得运行时校验 + 静态类型；④ 确需临时 `any` 时用 `// eslint-disable-next-line` + `// TODO` 标注原因并排期清理；⑤ 用 `satisfies`/守卫替代 `as`。这样把"信任"集中建立在边界校验点，内部全程类型安全流转。

**来源**：typescript-eslint — "recommended rules"; colinhacks — "Zod"; Effect/valibot docs; team TS style guides
