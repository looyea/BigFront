# ts-interface 面试题精选

> 共 12 题，覆盖 **interface vs type / 声明合并 / 扩展方式 / 开放封闭 / 函数与可索引接口 / 选型** 六类。

---

## 一、interface vs type

### 1. `interface` 和 `type` 有什么区别？分别在什么时候用？

对"描述对象形状"二者基本可互换。关键差异：① `type` 能命名**任意类型**（联合、交叉、元组、原始别名、映射/条件类型、`typeof`），interface 不能；② `interface` 支持**声明合并**（同名自动并入成员），`type` 重名报错；③ interface **开放**、type **封闭**；④ 报错时 interface 多以**名字**显示更清晰，复杂 type 常展开成长字面量。选型：对象/类契约、需被继承或增强第三方类型 → interface；类型运算 → type；团队保持一致最重要。

**来源**：TypeScript Handbook — "Interfaces vs Type Aliases"; Effective TS — item 9; StackOverflow — "interface vs type"

### 2. 有哪些事情是 `type` 能做而 `interface` 做不到的？举三例。

① 联合/字面量：`type S = 'a' | 'b'`、`type ID = string | number`；② 元组/原始别名：`type Pair = [number, string]`、`type Name = string`；③ 类型级计算：映射类型 `type Opt<T> = { [K in keyof T]?: T[K] }`、条件类型 `type X<T> = T extends string ? 1 : 0`、`typeof` 查询。这些都超出 interface "只能描述对象/函数/索引形状"的能力边界。

**来源**：TypeScript — "Type Aliases / Mapped / Conditional types"; utility-types 源码

---

## 二、声明合并

### 3. 什么是接口的声明合并？有什么实战价值？

多次声明**同名 interface**，其成员会被取并集自动合并：
```ts
interface Win { title: string }
interface Win { alert(): void }   // 合并 → { title; alert() }
```
实战价值：① **扩展全局对象**（给 `Window`/`globalThis` 挂注入的变量）；② **给第三方库类型加成员**而无需改其源码（模块增强，配合 `declare module`）；③ 分段声明（如把 mixin 合并进主类型）。这是 type 别名给不了的能力，也是很多"类型增强"技巧的地基（见 ts-declarations）。

**来源**：TypeScript Handbook — "Declaration Merging"; "Module Augmentation"; Effective TS

### 4. 如何给 Express 的 `Request` 加一个 `user` 字段并在 TS 下可用？

用 interface 声明合并 + 模块增强：
```ts
declare module 'express-serve-static-core' {
  interface Request { user?: User }
}
```
之后 `req.user` 就有类型（呼应 09-express 认证中间件挂 user）。原理是 Express 的 `Request` 是 interface，能被你再合并；若原库把类型写成 `type` 就无法这样增强——这也是"库 API 用 interface 更友好"的现实理由。

**来源**：Express + TS discussions — "extend Request"; TypeScript — "module augmentation"; @types/express

---

## 三、扩展与组合

### 5. `interface extends` 与 `type 交叉 &` 有何异同？

都能组合类型。差异：`extends` 是 interface 间继承（可多重 `A extends B, C`），报错更贴近"缺成员"；`&` 是类型交叉，能作用于任意类型（对象、函数、联合），但**遇到冲突属性**（同名不同类型）会得到 `never` 或难以诊断的错误，且交叉不触发"新鲜字面量"的过剩检查（语义与 extends 有别）。多 interface 用 extends 更直观；跨 type/联合/函数组合用 `&`。二者对纯对象形状大多等价。

**来源**：TypeScript — "Interfaces extends / Intersection Types"; StackOverflow — "extends vs intersection"

### 6. 交叉类型 `A & B` 处理"同名属性类型不同"时会怎样？

同名属性会被**再次交叉**：`{a: string} & {a: number}` 的 `a` 变成 `string & number` = `never`，于是该属性不可能有合法值——常导致意外把对象变成"不可构造"。这与联合 `|`（保留各自）不同。实战里交叉用于"叠加字段"很爽，但同名冲突要警惕（比如把两个都含 `id` 的类型交叉，`id` 类型不一致就翻车）。诊断此类"隐式 never"是常见面试点。

**来源**：TypeScript — "Intersection types / never"; Total TypeScript — "intersections & conflicts"

---

## 四、开放 vs 封闭

### 7. "interface 是开放的、type 是封闭的"是什么意思？对设计库 API 有何影响？

开放指消费者可再写同名 interface 往里**加成员**（声明合并），无法禁止；封闭指 type 别名一旦定义，外部**不能**再改变其结构。影响：① 发布库时若希望用户可扩展（加字段、增强），把公共形状做成 interface；② 若希望类型**精确不可被篡改**（例如内部不变式、防止用户误加成员破坏推断），用 type 更安全；③ 开放也意味着"你无法保证 interface 只有你写的这些成员"。据此权衡"可扩展性 vs 可控性"。

**来源**：TypeScript — "open vs closed types"; Effective TS — item on interface/type openness

---

## 五、函数与可索引接口

### 8. 能用 interface 描述函数和"可被索引的对象"吗？怎么写？

可以。函数调用签名：
```ts
interface Compare { (a: number, b: number): number }
```
索引签名：
```ts
interface StringList { [i: number]: string }
interface Mixed { [k: string]: unknown; length: number }
```
不过实践中函数类型更常用 `type Fn = (a:number,b:number)=>number`（更简洁、便于组合）。interface 里也能写多个调用签名来表达重载（详见 ts-functions）。

**来源**：TypeScript Handbook — "Function Types / Indexable types in interfaces"

### 9. class 能 implements 一个 type 别名吗？还是只能 implements interface？

class 可以 `implements` 一个对象类型的 **type 别名**（只要它解析成成员形状），也能 implements interface。区别在于：interface 因声明合并/开放，更适合当"类要履行的契约"；而 type 若含联合/交叉等非对象结构，则不能直接 implements（不是"成员形状"）。真正需要"运行时可判断实现了谁"时，TS 也不提供 Java 式名义接口检查——`implements` 只是**编译期**校验类具备这些成员（结构化）。

**来源**：TypeScript — "class implements"; "implements vs nominal interfaces"; Effective TS

---

## 六、选型与思辨

### 10. 为什么很多库把对外配置类型定义成 interface 而不是 type？

因为 interface 的**开放性/声明合并**允许使用者在不 fork 库的前提下扩展类型（加自定义字段、增强 `Request`/`Window` 等），对框架类库尤重要（Express、Vue、NestJS 大量用 interface 以便用户 module augmentation）。代价是库作者无法锁死形状。若类型需要参与联合/映射/条件运算或必须精确封闭，才会选 type。这是"可扩展性优先 vs 精确性优先"的取舍。

**来源**：Vue — "ComponentCustomProperties augmentation"; NestJS/Express — "declaration merging"; library design guides

### 11. 什么情况下你会毫不犹豫地用 type 而不是 interface？

需要 interface 表达不了的东西时：联合 `A | B`、字面量联合、元组、`typeof x`、映射类型 `{ [K in keyof T]: ... }`、条件类型 `T extends U ? X : Y`、对已有类型做工具运算（`Partial`/`Pick` 本质都是 type）。以及希望类型**封闭不可被外部合并**时。反之，纯粹的对象契约、且预期会被继承/增强，用 interface。

**来源**：TypeScript — "Mapped/Conditional types"; utility-types & type-fest 源码

### 12. 有人说"新代码统一用 type 就行，interface 可以退休了"，你同意吗？

部分合理但不全面。用 type 确实能覆盖绝大多数日常场景且心智统一，但 interface 有两个 type 暂时替代不了的能力：**声明合并**（增强第三方/全局类型、库的可扩展契约）与更友好的**具名报错/开放扩展**。一个健康的策略是：**默认用 type，需要"被合并/被扩展"的对象契约（尤其库作者）才用 interface**——把选择交给能力需求，而非站队。团队一致比选哪个更重要。

**来源**：Matt Pocock — "type vs interface (2024)"; Effective TS — item 9; TS design discussions
