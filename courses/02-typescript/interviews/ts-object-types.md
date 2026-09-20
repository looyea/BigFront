# ts-object-types 面试题精选

> 共 12 题，覆盖 **属性修饰 / 索引签名 / 字面量类型 / 结构化类型 / 过剩属性检查 / 深只读** 六类。

---

## 一、属性修饰

### 1. 可选属性 `?` 与 `| undefined` 是一回事吗？`exactOptionalPropertyTypes` 改变了什么？

默认（不开 `exactOptionalPropertyTypes`）下，`email?: string` ≈ `email: string | undefined`，"没有该键"和"键值为 undefined"被视作可互换。开启 `exactOptionalPropertyTypes` 后二者区分：`{ email?: string }` 表示"可以没有 email 键"，但**若提供就不能显式写 undefined**（`{ email: undefined }` 报错）。这让"缺省"和"显式空值"表达不同语义，更贴近真实数据契约，但迁移时会引发一批报错，需谨慎（详见 ts-strict）。

**来源**：TypeScript 4.4 — "exactOptionalPropertyTypes"; TS docs — "optional properties"

### 2. `readonly` 属性和 `Object.freeze` 有什么区别？

`readonly` 是**编译期**的类型约束：TS 禁止 `obj.x = ...`，但类型擦除后产物的 JS 里对象照样能被改（甚至 `as any` 绕过）。`Object.freeze` 是**运行时**行为：真正冻结对象使写入静默失败/报错。前者防"自己人手滑"，后者提供运行时不可变保证。要"类型 + 运行时"双保险得两者配合，或用 `DeepReadonly` + 实际 `freeze`（呼应 es-object-api 的 freeze）。

**来源**：TypeScript — "readonly modifier"; MDN — "Object.freeze"; Effective TS — readonly vs freeze

---

## 二、索引签名

### 3. 什么是索引签名？`{ [k: string]: T }` 和 `Record<string, T>` 什么关系？

索引签名描述"键名运行时才确定、值类型固定"的对象，如动态 headers、字典表。`{ [k: string]: T }` 与 `Record<string, T>` **语义等价**（后者是内置工具类型的可读写法）。注意：一旦有 string 索引签名，所有具名属性类型都必须兼容它（否则报错）；且 `obj.anything` 都被认为返回 `T`（不含 undefined），这可能掩盖"其实键不存在"的运行时事实——`noUncheckedIndexedAccess` 会把它变成 `T | undefined`（见 ts-strict）。

**来源**：TypeScript — "Indexable types"; utility-types — "Record"; TS — "noUncheckedIndexedAccess"

### 4. `{}`、`Object`、`object`、`Record<string, unknown>` 有什么区别？该用哪个？

- `{}`：非 null/undefined 的任何值（连数字都算），**不是"空对象"**，易误解；
- `Object`：Object 类型的实例，几乎无信息量且能赋万物，基本别用；
- `object`（小写）：非原始值（对象/数组/函数），适合做"接受任意对象"的参数约束；
- `Record<string, unknown>`：明确的"字符串键 + 未知值"对象，取值被强制收窄，是处理任意字典/外部 JSON 的首选。
经验：表达"未知结构的对象"用 `Record<string, unknown>`，"接受任意非原始值"用 `object`。

**来源**：Total TypeScript — "{} vs Object vs object"; typescript-eslint — "ban-types"; StackOverflow

---

## 三、结构化类型

### 5. TS 的"结构化类型"和 C#/Java 的"名义类型"有什么本质区别？各有什么利弊？

名义类型看**类型名/继承声明**：两个字段一模一样的类，没 `implements` 同一接口就互不兼容。结构化类型看**形状**：只要成员齐备即兼容，无需显式声明。优点：天然支持鸭子类型、跨库类型自动适配、写适配器/测试桩轻松；缺点：可能"意外兼容"——两个语义完全不同但形状相同却被视为可互换（如 `UserId` 和 `OrderId` 都是 `string` 就能混用）。要恢复名义性可用**品牌类型（branded types）**：`type UserId = string & { readonly __brand: 'User' }`。

**来源**：TypeScript wiki — "Nominal vs structural subtyping"; "branded / opaque types"; Effective TS

### 6. 既然结构化兼容，为什么还需要 interface/type？

类型声明的价值不只是"兼容判定"，还有：① **命名与文档**（`User` 比一坨内联结构可读）；② **契约固化**（函数参数标 `User`，传错形状就报错/补全受限）；③ **约束与复用**（泛型 `T extends User`、声明合并扩展库类型）；④ **捕获意图**（品牌类型、可选/只读语义）。结构化是"赋值时的裁判规则"，声明是"你希望世界长什么样的表达"。

**来源**：TypeScript Handbook — "Interfaces / Object Types"; "When to use interfaces"

---

## 四、字面量类型

### 7. 什么是字面量类型？它在建模中有什么用？

字面量类型是"只允许某一个具体值"的类型：`"a"`、`42`、`true` 都能当类型。多个用 `|` 联合起来就形成封闭集合：`type Level = 'low' | 'mid' | 'high'`。用途：状态机、事件名、配置枚举、按钮 variant——把"合法取值"编码进类型，传别的编译期就报错，且 IDE 只补全这些值。相比 `enum`，字面量联合是纯类型、零运行时（呼应 ts-basics）。

**来源**：TypeScript — "Literal Types"; Total TypeScript — "literal types"; "string union vs enum"

### 8. `as const` 具体做了什么？为什么常和字面量类型搭配？

`as const` 把对象/数组做**深度只读 + 字面量类型收窄**：数组变 `readonly` 元组、属性变只读且值锁到字面量类型。经典用法——从一组常量派生联合类型：
```ts
const ROLES = ['admin','editor','guest'] as const; // readonly ['admin','editor','guest']
type Role = typeof ROLES[number];                   // 'admin'|'editor'|'guest'
```
没有 `as const`，数组会推成 `string[]`，`typeof ROLES[number]` 就退化成 `string`，失去精确性。

**来源**：TypeScript — "const type assertions / as const"; StackOverflow — "as const"

---

## 五、兼容性规则细节

### 9. 对象赋值时"属性更多"的一方能不能赋给"属性更少"的类型？为什么？

可以（在非字面量直传的情况下）。结构化子类型里，"成员更丰富"的类型是"成员更少"类型的**子类型**——它满足了目标所需的全部成员，多出的成员无害。所以 `{x,y,z}` 的变量可赋给 `{x,y}` 类型。唯一例外是**过剩属性检查**：直接写对象字面量赋给窄类型时，多出的键会报错（专门抓拼写错误）。两条规则并存，一个管兼容性、一个管字面量新鲜度。

**来源**：TypeScript spec — "subtype relation"; "Excess property checking"; Effective TS

### 10. 为什么可选属性参与索引签名兼容时容易踩坑？举例。

`type M = { [k: string]: number; count?: number }`：`count?: number` 实为 `number | undefined`，而索引签名要求所有值都是 `number`，`undefined` 不兼容 → 报错。修法：把索引签名值类型写成 `number | undefined`，或让 `count: number`（非可选）。这类"可选属性 vs 索引签名"的冲突在写配置/事件映射时常见，理解了 `?` = `| undefined` 就能诊断。

**来源**：TypeScript — "index signature / optional property"; GitHub issue — "not assignable to string index type"

---

## 六、综合与权衡

### 11. 深只读（DeepReadonly）为什么不能靠一层 readonly？你会怎么实现？

`readonly`/`Readonly<T>` 只作用于最浅一层，嵌套对象内部仍可改。要整棵树只读需**递归映射类型**：对每个属性，若其值是对象就再套一层 `DeepReadonly`，数组用 `readonly T[]`，联合/函数保持。核心用 `extends` + `keyof` + 条件类型（见 ts-utility、ts-mapped）：
```ts
type DeepReadonly<T> =
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
```
理解"浅 vs 深"能避免误以为加了 readonly 就绝对不可变。

**来源**：TypeScript — "Mapped types / Readonly"; utility-types — "DeepReadonly"; Total TypeScript

### 12. 团队里如何为"配置对象 / API 响应 / 表单数据"这三类选类型策略？

- **配置对象**：具名 `interface`（含 `readonly` + 字面量联合枚举取值），配合 `satisfies` 校验默认值又保留精确类型；
- **API 响应**：边界先 `unknown`，用 zod 定义 schema 并 `z.infer` 出 TS 类型（单一数据源，运行时+静态双保），别手写 `as`（呼应 Express L5、ts-any-unknown）；
- **表单数据**：可辨识联合表达"字段随类型变化"（如 payment method 切换），配合收窄保证只在对应分支访问对应字段（呼应 ts-union/ts-guards）。
共性：让"非法状态不可表示"，把校验放在边界、把精确性留在类型。

**来源**：colinhacks — "Zod inference"; Total TypeScript — "modeling state"; "make illegal states unrepresentable"
