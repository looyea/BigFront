# 内置工具类型全解与手写实现

> 目标：把 `Partial`/`Required`/`Readonly`/`Pick`/`Omit`/`Record`/`Exclude`/`Extract`/`NonNullable`/`ReturnType`/`Parameters`/`Awaited` 这一整批"内置工具类型"讲透——它们不是黑盒魔法，而是**映射类型 + 条件类型 + infer** 的组合拳。看懂它们的源码，你才能自己造工具类型。

---

## 一、什么是"工具类型"

工具类型（Utility Types）= TS 标准库（`lib.es5.d.ts` 等）里预先定义好、**全局可用无需 import** 的泛型类型别名。它们接收已有类型、返回变换后的新类型，是"类型 → 类型"的函数。核心价值：从一份"源类型"派生出多种变体，避免手写重复结构（呼应 ts-object-types 的 DRY 原则）。

```ts
interface User { id: number; name: string; email: string; }

type UserPreview = Partial<User>;         // 全部可选
type UserUpdate  = Omit<User, "id">;      // 去掉 id
type PublicUser  = Pick<User, "id"|"name">// 只留指定键
```

---

## 二、修饰属性"三件套"：Partial / Required / Readonly

```ts
type MyPartial<T>   = { [K in keyof T]?:      T[K] };
type MyRequired<T>  = { [K in keyof T]-?:     T[K] };
type MyReadonly<T>  = { readonly [K in keyof T]: T[K] };
```

关键在于**映射类型** `[K in keyof T]`：遍历 `T` 的每个键，产出新对象类型。修饰符可加可减：
- `?:` 加可选、`-?` **去**可选（`Required`）；
- `readonly` 加只读、`-readonly` 去只读。

`T[K]` 是索引访问类型，把"原键对应的值类型"原样搬过来（呼应 ts-generic-constraints 第 3 题）。这三件套只作用**最外层**，深层不变——"深只读"要递归（见 ts-advanced / 上一关作业挑战延伸）。

---

## 三、挑键两兄弟：Pick / Record

```ts
type MyPick<T, K extends keyof T> = { [P in K]: T[P] };

const u: User = { id:1, name:"a", email:"e" };
type NameOnly = Pick<User, "name">;              // { name: string }
```

`Pick` 的第二参数被 `K extends keyof T` 约束——写错键名直接编译报错。`Record` 则是"从键联合构造对象类型"：

```ts
type MyRecord<K extends keyof any, T> = { [P in K]: T };
type Role = "admin" | "guest";
const perms: Record<Role, string[]> = {          // 必须覆盖 admin 和 guest 两个键
  admin: ["all"], guest: ["read"],
};
```

`Record` 常用来给"字面量联合"（呼应 ts-union 可辨识联合）强制生成"每个变体都要有对应项"的映射表——漏一个键就报错（配合 `satisfies` 更佳，呼应 ts-any-unknown）。

---

## 四、排除与提取：Omit / Exclude / Extract / NonNullable

```ts
type MyOmit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;
type MyExclude<T, U>  = T extends U ? never : T;   // 联合减法（依赖分发）
type MyExtract<T, U>  = T extends U ? T : never;   // 联合交集
type MyNonNullable<T> = T extends null | undefined ? never : T;
```

- `Omit` = 先 `Exclude` 掉要删的键、再 `Pick` 剩下的——是 `Pick`+`Exclude` 的复合。注意 `Omit` 的 `K` **不**受 `keyof T` 约束（可写不存在的键名，静默忽略），这点和 `Pick` 不同，是常见坑。
- `Exclude`/`Extract`/`NonNullable` 全靠**分布式条件类型**（上一关 ts-conditional-infer 第四段已复刻）。`NonNullable` 在严格模式下清理 `| undefined` 尤其实用（呼应 ts-strict）。

```ts
type NoId = Omit<User, "id">;                 // { name; email }
type Flags = Exclude<"a"|"b"|"c", "b">;       // "a" | "c"
```

---

## 五、函数与 Promise 的抽取器：ReturnType / Parameters / ConstructorParameters / InstanceType / Awaited

```ts
type MyReturnType<T extends (...a:any)=>any>    = T extends (...a:any)=>infer R ? R : never;
type MyParameters<T extends (...a:any)=>any>    = T extends (...a:infer P)=>any ? P : never;
type MyAwaited<T>                               = T extends Promise<infer U> ? MyAwaited<U> : T;

function load(): Promise<User> { return null as any; }
type R  = ReturnType<typeof load>;              // Promise<User>
type P  = Parameters<typeof setTimeout>;        // [callback: (...args)=>void, ms?: number]
type Un = Awaited<ReturnType<typeof load>>;     // User（解到非 Promise 为止）
```

它们都用 `infer` 从函数/Promise 结构里"挖"出目标类型（呼应 ts-conditional-infer 第二、四段）。`Awaited` 是**递归**的，专门配合 async 函数剥到底。`ConstructorParameters`/`InstanceType` 则作用于构造签名 `new () => T`（呼应 ts-generic-constraints 第 7 题构造器令牌）。

---

## 六、组合技：工具类型层层套娃

真实工程里几乎从不单用，而是组合：

```ts
type User = { id: number; name: string; meta: { tag: string } };

// 编辑表单：所有字段可选，但 id 必须保留 → 交叉
type UserForm = Partial<Omit<User, "id">> & Pick<User, "id">;

// API 响应统一包装
type ApiResponse<T> = { code: number; data: T; msg: string };
type GetUserResp = ApiResponse<Pick<User, "name">>;

// 校验：只读、且去掉服务端管理字段
type Creatable = Omit<Readonly<User>, "id">;
```

掌握"源类型 → 派生变体"的思维方式，能让接口、DTO、表单、Store 状态共享一份真相、各取所需（呼应 ts-frameworks 里 Vue/Redux 的状态派生类型）。

---

## 七、什么时候该自己造

内置覆盖不到的场景就该自造，命名以 `大驼峰 + 意图清晰` 为准，并写好注释：

```ts
type Nullable<T>      = T | null;
type DeepPartial<T>   = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
type Mutable<T>       = { -readonly [K in keyof T]: T[K] };   // Readonly 的反操作
type PickByType<T,V>  = { [K in keyof T as T[K] extends V ? K : never]: T[K] };
```

`DeepPartial`/`Mutable`/`PickByType` 都是社区高频自定义工具（type-fest 里一抓一大把）。造之前先查 type-fest，别重复造轮子。

---

## 八、自检清单

- [ ] `Partial`/`Required`/`Readonly` 用映射类型怎么写？`-?`、`-readonly` 是什么？
- [ ] `Pick` 和 `Omit` 的键参数约束有何不同？为什么 `Omit` 能写不存在的键？
- [ ] `Record<K,V>` 常配什么类型使用？能强制什么？
- [ ] `Exclude`/`Extract`/`NonNullable` 依赖条件类型的什么机制？
- [ ] `ReturnType`/`Parameters`/`Awaited` 靠哪个关键字抽取？`Awaited` 为何要递归？
- [ ] 用工具类型组合表达"所有字段可选但保留 id"，你会怎么写？

---

## 🚀 部署预告

- 上一关的 `infer` + 条件类型，加上本关反复出现的 `[K in keyof T]`，正是下一关 **ts-mapped（映射类型）** 的主角——把"遍历对象键并逐一变换"讲透，你会真正看懂本关所有工具类型的骨架；
- 深拷贝/深只读/按键过滤这类"套娃"技巧在 ts-advanced 里继续升级；
- 工程上，接口/DTO/Store 的"一份源类型派生多视图"能力，直接对接 Vue/Redux 的类型化状态（呼应 ts-frameworks）。

下一关进入 **ts-mapped**：映射类型与键重映射（`as` 子句）。
