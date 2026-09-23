# ts-utility 面试题精选

> 共 15 题，覆盖 **工具类型总览 / 属性修饰三件套 / 挑键与排除 / 函数与 Promise 抽取 / 组合与自定义** 五类。

---

## 一、总览

### 1. 什么是内置工具类型（Utility Types）？它们解决什么问题？

它们是 TS 标准库预定义、全局可用（无需 import）的**泛型类型别名**，本质是"类型 → 类型"的函数：接收已有类型、返回变换后的新类型。解决的问题是 **DRY**——从一份"源类型"（如接口 `User`）派生出多种变体（可选版、去某键版、只读版），而不手抄重复结构。典型：`Partial`/`Pick`/`Omit`/`Record`/`ReturnType` 等。它们的实现并不神秘，全是映射类型 + 条件类型 + `infer` 的组合（本关逐一拆解）。

**来源**：TypeScript Handbook — "Utility Types"; lib.es5.d.ts

---

## 二、属性修饰三件套

### 2. 手写 `Partial`/`Required`/`Readonly`，并解释 `?`、`-?`、`readonly`、`-readonly` 修饰符。

```ts
type Partial<T>   = { [K in keyof T]?:          T[K] };
type Required<T>  = { [K in keyof T]-? :         T[K] };
type Readonly<T>  = { readonly [K in keyof T]:   T[K] };
type Mutable<T>   = { -readonly [K in keyof T]:  T[K] };
```
`[K in keyof T]` 是映射类型，遍历 `T` 所有键；值写 `T[K]`（索引访问）原样搬运。修饰符前缀：`?` 加可选、`-?` **移除**可选（`Required`）、`readonly` 加只读、`-readonly` 移除只读（`Mutable`）。注意三者只作用**最外层**，深层属性不受影响——深只读需 `DeepReadonly` 递归实现（见 ts-advanced）。

**来源**：lib.es5.d.ts — Partial/Required/Readonly; TypeScript — "mapped type modifiers +/-"

### 3. `Readonly<T>` 和 `as const` 是一回事吗？

不是。`as const` 是**值层面**的断言，对一个字面量表达式生效，把它推断成最精确的只读+字面量类型（数组变 `readonly` 元组、字符串变字面量类型、属性全 `readonly`），且会**递归到底**。`Readonly<T>` 是**类型层面**工具，只把已给定类型 `T` 最外层属性加 `readonly`，不改变字面量宽窄、不递归。二者常配合：`const obj = {...} as const` 得到深只读字面量类型；若只想浅只读某个已有类型则用 `Readonly<T>`（呼应 ts-object-types、ts-generic-constraints 第 9 题）。

**来源**：TypeScript — "as const vs Readonly"; Effective TS — Item 9

---

## 三、挑键与排除

### 4. `Pick` 与 `Record` 看起来都在"造对象类型"，区别是什么？

`Pick<T, K extends keyof T>` 是**从已有类型里挑键**——K 必须是 T 的合法键，值类型沿用 `T[K]`。`Record<K, T>` 是**从零按键联合构造**——K 是任意键联合（约束到 `keyof any`），所有键的值统一为 T。换句话说：Pick 保留源类型的"键→值"对应关系，Record 只借键名、值由你指定。典型：`Record<Role, string[]>` 给每个角色配一份权限（值同构）；`Pick<User,"name">` 只要 name 且保 `string`（值异构）。

**来源**：lib.es5.d.ts — Pick/Record; StackOverflow — "Pick vs Record"

### 5. `Omit` 是如何用 `Pick` 和 `Exclude` 组合出来的？它和 `Pick` 的键约束差异会引发什么坑？

```ts
type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;
```
先 `Exclude<keyof T, K>` 从"所有键"里剔除要删的，再 `Pick` 剩下的。坑在键约束：`Pick` 的 `K extends keyof T`，写错键名编译期就报错；`Omit` 的 `K` 只约束到 `keyof any`（即 `string|number|symbol`），于是 `Omit<User, "idd">`（拼错）不会报错、静默不删——因为它把 `"idd"` 当成"要排除的键"但 `keyof T` 里根本没有它，`Exclude` 无匹配即原样返回。要"删且校验"，用 `Omit<User, keyof { [P in keyof User as P extends "id" ? unknown : never]: User[P] }>` 之类花式写法，或干脆用 `Pick` 白名单。

**来源**：lib.es5.d.ts — Omit; GitHub issue — "Omit does not check keys"

### 6. `Exclude`/`Extract`/`NonNullable` 为什么"一行条件类型"就能实现联合运算？

因为它们依赖**分布式条件类型**：当左侧是裸类型参数且传入联合时，条件类型对每个成员分别求值再重新联合。
```ts
type Exclude<T,U>  = T extends U ? never : T;
type Extract<T,U>  = T extends U ? T : never;
type NonNullable<T>= T extends null | undefined ? never : T;
```
命中"要删除"条件的成员被替换成 `never`，而 `never` 在联合里等于"消失"（空成员），于是 `Exclude` 做减法、`Extract` 做交集、`NonNullable` 剥掉 `null|undefined`。`NonNullable` 在 `strictNullChecks` 下清理可选属性带来的 `| undefined` 极常用（呼应 ts-strict、ts-conditional-infer 第 7 题）。

**来源**：lib.es5.d.ts; TypeScript — "distributive conditional types"

---

## 四、函数与 Promise 抽取

### 7. `ReturnType` / `Parameters` / `ConstructorParameters` / `InstanceType` / `Awaited` 分别抽取什么？靠哪个关键字？

都靠 `infer`（呼应 ts-conditional-infer）：
```ts
type ReturnType<T extends (...a:any)=>any>       = T extends (...a:any)=>infer R ? R : never;
type Parameters<T extends (...a:any)=>any>       = T extends (...a:infer P)=>any ? P : never;
type ConstructorParameters<T extends new(...a:any)=>any> = T extends new(...a:infer P)=>any ? P : never;
type InstanceType<T extends new(...a:any)=>any>  = T extends new(...a:any)=>infer R ? R : never;
type Awaited<T>                                  = T extends Promise<infer U> ? Awaited<U> : T;
```
`ReturnType`/`Parameters` 作用于调用签名，`ConstructorParameters`/`InstanceType` 作用于构造签名 `new (...) => T`，`Awaited` **递归**剥 Promise 直到非 Promise（配合 async 函数）。`Awaited<ReturnType<typeof fetchUser>>` 是拿"异步函数真正返回的数据类型"的标准写法。

**来源**：lib.es5.d.ts; TypeScript 4.5 — "Awaited"

---

## 五、组合与自定义

### 8. 工程里如何"一份源类型派生多视图"？举例接口/DTO/表单场景。

用工具类型组合表达"同一实体的不同用途视图"，共享单一真相：
```ts
type User = { id: number; name: string; createdAt: Date };
type UserCreate = Omit<User, "id"|"createdAt">;          // 建表入参
type UserForm   = Partial<Omit<User,"id">> & Pick<User,"id">; // 编辑表单
type UserDto    = Pick<User, "id"|"name">;               // 列表精简返回
type UserSafe   = Omit<User, "createdAt">;               // 对外隐藏字段
```
好处：源类型一改，所有派生视图自动同步，杜绝手写不同步（呼应 ts-object-types、ts-frameworks 的 Store/Vuex 状态派生）。API 层再套 `ApiResponse<T> = { code:number; data:T }` 泛型包装即可。

**来源**：Effective TS — "derive types from a single source"; type-fest

### 9. `DeepPartial<T>` 怎么实现？它比 `Partial` 多做了什么、又有什么坑？

```ts
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
```
`Partial` 只把最外层键变可选，`DeepPartial` 递归地把**每一层嵌套对象**的键都变可选，适合"深度配置对象只需覆盖部分字段"。坑：① 对数组/函数/Date/Map 等特殊对象会被误递归，需用条件类型排除（`T[K] extends Date ? T[K] : ...`）；② 遇到循环引用类型会触发 excessively deep；③ 递归深度大时性能下降。生产环境建议直接用 type-fest 的 `PartialDeep`（已处理大量边界）。

**来源**：type-fest — "PartialDeep"; StackOverflow — "Deep Partial type"

### 10. `keyof any` 是什么？为什么 `Record<K extends keyof any, T>` 和 `Omit` 用它做键约束？

`keyof any` = `string | number | symbol`，即"所有可能成为对象键的类型"的联合（JS 里对象键只能是这三类）。所以 `Record<K extends keyof any, T>`、`Omit<T, K extends keyof any>` 用它的含义是"K 只需是个键类型，不要求属于某个具体对象"。对比 `keyof T`（T 的合法键，更严格）。副作用就是第 5 题的坑——`Omit` 因此不校验键是否真存在于 T。日常书写"任意键联合"时 `keyof any`（或等价的新语法 `PropertyKey`）是标准约束（呼应 ts-generic-constraints 第 2 题）。

**来源**：TypeScript — "keyof any / PropertyKey"; lib.es5.d.ts — Record/Omit

### 11. 为什么很多"看起来该用工具类型"的地方，用了反而丢失信息？举一个 `Omit` 丢文档/签名的例子。

工具类型经映射类型"重建"对象后，会**丢失原始声明上的 JSDoc、属性注释、以及函数属性的重载/this 签名**（映射把每个属性规范化）。例如 `interface Server { /** 生产地址 */ url:string; handler(a:string):void; handler(a:number):void }` 有重载，`Omit<Server,"url">` 之后重载被压平为单一签名、注释消失、hover 提示变差。对策：对"要保留完整形状"的类型优先用 `interface extends Omit<...>` 或干脆显式重写，而不是盲目套工具类型（呼应 ts-interface 声明合并、ts-object-types）。

**来源**：GitHub issue — "mapped types lose JSDoc / overload"; Total TypeScript

### 12. 你如何决定"用内置工具类型 / 用 type-fest / 自己手写"三者？

顺序：① 优先内置（`Partial`/`Pick`/`Omit`/`Record`/`Awaited`…），语义标准、团队都熟、无额外依赖；② 内置覆盖不到（`PartialDeep`、`SniceCaseKeys`、`IsUnion`、精确 `Omit` 校验等）先查 **type-fest**——它久经考验、处理了无数边界，别重复造轮子；③ 只有当需求非常专有、或不想引入 type-fest 依赖时才手写，且要：加注释说明输入→输出、拆中间命名 type、控制在 2~3 层嵌套内、写单测级别断言（`type Assert = Expect<Equal<...>>`）验证正确性。可读性与可维护性永远优先于"炫技一行流"（贯穿 ts-advanced）。

**来源**：type-fest README; Total TypeScript — "when to write custom types"

---

## 补充（新专题 13-15）

### 13. 白板实现：Partial、Required、Pick、Omit、Record、ReturnType 各自源码长什么样？谁依赖谁？

依赖链：`Partial<T>={[P in keyof T]?:T[P]}`；Required 加 `-?` 并 readonly 无关；`Pick<T,K>={[P in K]:T[P]}`（K extends keyof T）；`Omit<T,K>=Pick<T,Exclude<keyof T,K>>`；`Record<K extends keyof any,T>={[P in K]:T}`（所以 Record 的键约束是「能当键的」= string|number|symbol）；`ReturnType<T>=T extends (...a:any)=>infer R?R:never`（infer 登场）。加分点：-? 与 ? 只能配 mapped 不能配可选链式；Omit 对索引签名的缺陷；Record 用 Exclude 做键约束（Record<K, never>）。能顺写这 6 行，映射类型/条件类型/约束三关全通。

**来源**：TypeScript lib.es5.d.ts 官方定义（逐字可查）。

### 14. DeepPartial / DeepReadonly 这类递归工具为什么要给 Date/Function/数组开特判通道？

对象分支「一刀切递归」会：Date 被变成 `{getTime?: ...}` 残废、函数被当对象递归返回类型、数组丢方法（映射数组键会得到 {[x:number]:...} 但 length/iterator 语义漂移）。标准模板：`T extends Date|RegExp|Function ? T : T extends (infer U)[] ? DeepPartial<U>[] : T extends object ? {[K in keyof T]?:DeepPartial<T[K]>} : T`——顺序敏感（Function 要在 object 前判，因为函数也是 object 形状被 typeof 区分但 `T extends object` 对函数为真）。深工具类型是「类型级 Visitor 模式」：先判叶子再入递归，是写给人看的守门员。

**来源**：type-fest 源码《PartialDeep》的 builtin/typed-array 排除链；TS-FAQ 递归类型守卫写法。

### 15. 工具类型叠三层还能维护吗？你怎么在团队里立「类型体操」的度？

度量：① hover 可读性（复杂推导必须 `type 具名 = ...` 落盘，报错信息带别名）；② 编译性能（大仓 type instantiation 计数，重递归 O(n²) 能感知）；③ 测试覆盖——类型也要测试（tsd/expect-type 的 expectAssignable 断言给工具类型上回归锁）。度：公共库/基建（请求层、ORM）值得上重类型；业务表单/组件「显式优于 clever」，两行 if 收窄胜过天书条件。实践：能用 lib 内置不手搓、能 type-fest 不自研，自研必配类型测试+注释「为什么需要」。

**来源**：tsd / expect-type README；type-challenges 维护者 Matt 的「何时不要用复杂类型」讨论。
