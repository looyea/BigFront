# ts-generic-constraints 面试题精选

> 共 12 题，覆盖 **extends 约束 / keyof / 索引访问 / 约束关联 / 构造器令牌 / 拓宽抑制** 六类。

---

## 一、约束基础

### 1. 为什么裸类型参数 `T` 不能访问属性？`extends` 约束改变了什么、没改变什么？

裸 `T` 代表"任意类型"，编译器无法保证它拥有任何具体成员，故 `t.foo` 报错。`T extends U` 把 `T` 的取值范围限制为 `U` 的子类型，函数体内即可按 `U` 安全访问其成员。但**对调用者**而言，返回类型仍是 `T`（保留实参的精确类型），不会被"降级"成 `U`——所以 `longest<T extends HasLength>(a:T,b:T):T` 传两个 `string` 返回类型仍是 `string` 而非 `HasLength`。约束是"下界承诺"，不是"结果拓宽/收窄"。

**来源**：TypeScript Handbook — "Generic Constraints"; Effective TS — "constraints don't widen return"

### 2. `T extends object` 和 `T extends Record<string, unknown>` 有何不同？

`object` 仅表示"非原始值"，成员未知，索引/访问仍受限；`Record<string, unknown>` 明确"有任意 string 键、值为 unknown"，可 `o[someString]` 索引（得 unknown）。若你想遍历/索引对象的动态键，用后者更合适；若只是"要访问几个已知属性"，用精确的具名约束 `T extends { a: X; b: Y }`。选错会导致"明明 extends object 却 `o[k]` 报错"（k 非 keyof T）。

**来源**：TypeScript — "object vs Record constraints"; utility-types — Record; StackOverflow

---

## 二、keyof 与索引访问

### 3. 解释 `keyof`、`O[K]`（索引访问类型）如何联手实现"属性名安全的 get"。

`keyof O` 生成 O 全部键的**字面量联合**（`{name:string;age:number}` → `"name"|"age"`）。约束 `K extends keyof O` 让第二个参数只能是这些合法键；返回类型写 `O[K]`（索引访问类型）会解析成"O 中该键的值类型"，且随 `K` 的具体字面量精确化：`get(user,'name')` → `O['name']` = `string`。三件套合起来：非法键编译期拒绝、合法键返回值类型自动精确，是 `Pick`/`Record` 等工具类型的共同基础。

**来源**：TypeScript — "keyof / indexed access types"; Handbook — keyof constraint example

### 4. `keyof` 用在一个具体对象变量上为什么要写 `keyof typeof obj`？

`keyof` 作用于**类型**，而 `obj` 是个**值**。`typeof obj` 是"查询类型"——从值取出它的类型，再 `keyof` 取键。惯用法：
```ts
const config = { host: '', port: 0 };
type ConfigKey = keyof typeof config;   // 'host' | 'port'
```
这是从"对象字面量"派生"键联合/值联合"的标准手法（配合 `as const` 保精确，呼应 ts-object-types、ts-guards）。直接写 `keyof config` 会报错，因为 config 是值。

**来源**：TypeScript — "typeof type query + keyof"; "keyof typeof pattern"; Total TypeScript

---

## 三、约束之间的关联

### 5. 如何用一个泛型参数的类型去约束另一个？举例说明"键-值对应"。

类型参数可相互引用（按声明顺序，后者可依赖前者）：
```ts
function setProp<T, K extends keyof T>(o: T, k: K, v: T[K]) { o[k] = v; }
```
`K extends keyof T` 让键合法，`v: T[K]` 让**值的类型随键而定**——`setProp(user,'age','x')` 因 `T['age']=number` 而报错。这就是"键-值一一对应"的类型表达，`Object.assign`、事件绑定 `on<Name extends keyof Events>(name, cb: (p:Events[Name])=>void)`（呼应 L2 挑战题）同理。

**来源**：TypeScript — "dependent type parameters"; typed event emitter 惯用法

### 6. 为什么 `<A, B extends A>` 合法而反过来 `<B extends A, A>` 会报错？

类型参数**从左到右**解析，后者可引用**已经声明**的前者，反之则引用了"还不存在"的名字。故 `B extends A` 必须排在 `A` 之后。默认类型参数同理——`= 默认` 里只能引用在它之前确定的类型参数（`<T, K extends keyof T = keyof T>`）。这是书写泛型签名的硬顺序规则，调试"Cannot find name 'A' as type parameter"时先看顺序。

**来源**：TypeScript — "type parameter ordering / declaration order"; GitHub issues — "type parameter order constraint"

---

## 四、构造器与类型令牌

### 7. 泛型擦除下，`function create<T>(ctor: new () => T): T` 为什么是常见解法？

因为运行时拿不到 `T`（擦除），无法 `new T()`。把"类型信息"作为**值**（一个构造器/工厂）显式传进来，`ctor` 在运行时真实存在、可 `new ctor()`，同时它的类型 `new () => T` 让 TS 反推出 `T` 是实例类型。于是既有运行时行为、又有静态类型。同类模式：Angular/NestJS 的 DI token、序列化器注册表、`parse<T>(schema)`（zod 把校验器作为值携带类型）。抽象构造器用 `abstract new (...) => T` 以匹配 class（含抽象）。

**来源**：Angular DI — "InjectionToken"; NestJS — "provider tokens"; zod — "schema as runtime type carrier"

### 8. 约束到"任意函数类型"该怎么写？`(...args: any[]) => any` 有什么隐患？

标准约束是 `T extends (...args: any[]) => any` 或更精确的 `T extends (...args: never[]) => unknown`（用 `never[]`/`unknown` 做"最宽松函数"逆变友好写法）。`any[]`/`any` 简单但会让 `T` 的参数/返回类型信息变模糊，配合 `Parameters<T>`/`ReturnType<T>` 时可能提取到 `any`（呼应 ts-utility）。现代推荐：装饰器/`once`/`memoize` 里用 `(...args: never[]) => unknown` 约束，再用 `Parameters<T>`/`ReturnType<T>` 精确还原，避免 any 泄漏（呼应 ts-any-unknown）。

**来源**：type-fest — "AnyFunction"; TypeScript — "constrain to function type"; Total TypeScript

---

## 五、拓宽与字面量捕获

### 9. 为什么 `T extends string` 能把传入的字面量"锁住"不拓宽成 string？

给 `T` 加 `extends string` 约束后，TS 在做类型推断时会把实参当作**字面量类型**保留（而非拓宽为基类型 `string`），因为约束把候选域限定在字符串子类型上，倾向于保留最精确成员。所以 `makeConst('hi')` 得到 `T='hi'`。TS 5.0 还引入 `const` 类型参数 `<const T>` 显式要求"按 const 方式推断"，用于无需手写 `as const` 就冻结传入对象/字面量。

**来源**：TypeScript — "literal type inference with constraints"; TS 5.0 — "const type parameters"

---

## 六、约束进阶与坑

### 10. 为什么函数体里 `T extends HasLength` 却仍不能把 `T` 当具体类型返回/构造？遇到"需要 T 的成员运算"怎么办？

约束只是"下界"，函数体内 `T` 仍是"某个未知子类型"，你只能用到约束里声明的成员（`length`），访问不到调用者实际类型独有成员。若需要"根据 T 的形状计算返回类型"，光靠约束不够——要用**条件类型/映射类型**对 `T` 做类型运算（下一关 ts-conditional-infer、ts-mapped）。若需要**运行时**按 T 分支/实例化，则用构造器令牌（第 7 题）。约束管"能安全访问什么"，类型运算管"能计算/生成什么"。

**来源**：TypeScript — "limits of constraints / need conditional types"; mapped types

### 11. 常见报错"Type 'T' is not assignable to type ... "在约束下为什么还会出现？如何对症？

即使有约束，`T` 作为"任意满足约束的子类型"未必能赋给更具体的目标。例：`function f<T extends object>(t:T){ const x: {id:string}=t; }` 仍报错——`T` 可能是没有 `id` 的 object。对症：① 把目标要求并入约束（`T extends {id:string}`）；② 用 `as` 明确断言（自担风险）；③ 若从索引来，检查是否 `noUncheckedIndexedAccess` 带来 `| undefined`（见 ts-strict）；④ 泛型默认导致 T 变 `unknown`，补上类型参数。核心：约束是"至少"，不等于"恰好"。

**来源**：TypeScript — "T not assignable / constraint insufficient"; Effective TS — generic assignability

### 12. `T extends A extends B ? ...` 这类嵌套约束/条件你怎么组织才不会失控？

实践准则：① 一层约束一层职责——先用 `extends` 限定输入形状，再用条件类型基于该形状做**窄范围**计算，别把三层条件塞一行；② 把中间结果**命名**为独立 `type`（`type Core<T> = ...` 再喂给下一步），报错时可逐层 hover 检查；③ 避免在约束里做复杂条件（TS 对约束位置的推断能力弱于别名位置）；④ 深嵌套会触发"Type instantiation is excessively deep"，此时用具体类型或拆分。可读性 > 类型花活（贯穿 ts-advanced）。

**来源**：TypeScript — "avoid deep conditional nesting / excessively deep"; Total TypeScript — "readable type helpers"
