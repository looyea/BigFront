# interface 与 type 别名

> 目标：**分清 `interface` 和 `type` 各自能做什么、何时用哪个**，掌握 `extends`、声明合并、用它们描述对象/函数/可索引形状，理解两者重叠与独有能力的边界。

---

## 一、两者都能描述对象形状

```ts
// interface
interface User {
  id: number;
  name: string;
}

// type 别名
type User2 = {
  id: number;
  name: string;
};
```

对**对象类型**而言，日常写法里二者几乎可互换：都能 `extends`/交叉、都能当函数参数类型、都能被 class `implements`。

```ts
interface Admin extends User { perms: string[] }
type Admin2 = User & { perms: string[] };   // 交叉，效果类似
```

---

## 二、type 独有：更广泛的类型运算

`type` 能命名**任意类型**，不只是对象——这是它比 interface 更通用的地方：

```ts
type ID = string | number;                 // 联合
type Handler = (e: Event) => void;         // 函数类型
type Pair = [string, number];              // 元组
type Flags = "a" | "b" | "c";              // 字面量联合
type Mapped<T> = { [K in keyof T]: boolean };  // 映射类型
type Cond<T> = T extends string ? 1 : 0;   // 条件类型
type Arr = { a: string }[];                // 数组
typeof someVar;                            // 查询类型
```

interface 只能描述"对象/函数/可索引**形状**"，表达不了联合、交叉、原始别名、映射/条件类型。**要这些能力就得用 type。**

---

## 三、interface 独有：声明合并（declaration merging）

同名 interface 会**自动合并**，成员取并集：

```ts
interface Window { title: string }
interface Window { close(): void }
// 合并后 Window = { title: string; close(): void }
```

这是 interface 的杀手锏，用于：
- **扩展全局/第三方类型**：给 `Window`、`NodeJS.ProcessEnv`、 Express 的 `Request` 补字段（呼应 exp-*、ts-declarations）：
  ```ts
  declare global { interface Window { MyBridge?: {...} } }
  ```
- **库的类型增强**：在不改源码前提下给已有 interface 加成员。

`type` 别名**重名会直接报错**（不能合并）。

---

## 四、其它细微差异

| 维度 | interface | type |
|------|-----------|------|
| 声明合并 | ✓ | ✗（重名报错） |
| 表达联合/交叉/原始/映射/条件 | ✗（有限） | ✓ |
| `implements` / `extends` | ✓ 直观 | ✓（交叉） |
| 错误信息 | 常用**名字**（更短清晰） | 复杂结构常**展开成字面量**（可能很长） |
| 性能 | 编译器对具名 interface 有一定优化（缓存） | 复杂 type 计算更多 |
| 扩展方式 | `extends` | `&` 交叉 |
| 能描述"能被计算"的类型 | 否 | 是 |

一个容易忽略的点：`interface` 是**开放**的（别人可再合并进成员），`type` 是**封闭**的（定义即定死）。设计对外 API 时，这个"开放/封闭"差异影响可演进性。

---

## 五、用它们描述函数与可索引形状

```ts
// 函数形状
interface Compare { (a: number, b: number): number }
const cmp: Compare = (a, b) => a - b;

// 可索引形状
interface StringList { [i: number]: string }
// 混合：既能有方法又能被索引
interface Dict { [k: string]: unknown; length: number }
```

函数类型更常用 `type Fn = (a: A) => R`；需要重载签名时 interface/type 里都可写多行调用签名（见 ts-functions）。

---

## 六、选型建议

- **描述对象/类契约、且可能被继承或需要声明合并（尤其扩展第三方/全局）** → `interface`；
- **需要联合、交叉、映射、条件、原始别名、函数类型别名、元组等一切"类型运算"** → `type`；
- 团队内**保持一致**比纠结每个点更重要——常见约定：对外公共 API 与库类型增强用 `interface`，内部复杂类型用 `type`。
- 拿不准时：**能用 interface 表达对象就用 interface，需要类型级计算时自然切到 type。**

---

## 七、实战片段

```ts
// 用 interface 定义可扩展的实体契约
interface Entity { readonly id: string }
interface User extends Entity { name: string; email?: string }

// 用 type 做类型运算
type UserPreview = Pick<User, "id" | "name">;       // 见 ts-utility
type OptionalUser = Partial<User>;
type UserKey = keyof User;                          // "id" | "name" | "email"（见 ts-generic-constraints）
```

---

## 八、自检清单

- [ ] interface 和 type 在"描述对象"上有什么区别？为什么说前者几乎可互换？
- [ ] 哪些类型只能用 type 表达？（举 3 例）
- [ ] 什么是声明合并？给一个"扩展第三方 interface"的例子。
- [ ] "开放 vs 封闭"对设计对外 API 有什么影响？
- [ ] 错误信息可读性上，interface 和 type 有何不同？
- [ ] 你团队的选型约定会怎么定？

---

## 🚀 部署预告

- **声明合并**是给没有类型的老库/全局补形状的关键手段（ts-declarations 会配合 `declare module`/`declare global` 深讲）；
- 扩展 **Express 的 `Request`**（挂 `user` 字段）、**给 `Window` 注入全局变量**都是 interface 合并的日常（呼应 09-express、03-nodejs）；
- `Pick`/`Partial`/`keyof` 等类型运算会在 **ts-utility / ts-generic-constraints** 展开。

下一关 **ts-functions**——函数类型、可选/默认/剩余参数、重载签名与 `this` 类型。
