# 对象类型与属性修饰

> 目标：**掌握描述"一个对象长什么样"的全部手段**——必需/可选/只读属性、索引签名、字面量类型、`readonly` 与映射，理解 TS 的**结构化类型（鸭子类型）**兼容规则与**过剩属性检查**。这是接口/泛型约束的地基。

---

## 一、对象类型基础

```ts
const point: { x: number; y: number } = { x: 0, y: 0 };

// 属性可加类型别名复用
type Coord = { x: number; y: number };
function dist(a: Coord, b: Coord) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
```

---

## 二、可选属性 `?`

```ts
type User = {
  id: number;
  name: string;
  email?: string;      // 可选：外部可传可不传
};

const u: User = { id: 1, name: "Ada" };   // ✓ 不传 email
u.email?.toLowerCase();                    // ✓ 可选链（呼应 es-2020）
// u.email.length;                         // ✗ 可能 undefined
```

坑：`email?: string` 的真实类型是 `string | undefined`（strict 下）。**"没这个键"和"键是 undefined"在默认情况下是同一件事**——除非开 `exactOptionalPropertyTypes`（详见 ts-strict），那时 `{ email: undefined }` 不再合法。

---

## 三、只读属性 `readonly`

```ts
type Config = {
  readonly apiKey: string;
  timeout: number;
};
const c: Config = { apiKey: "k", timeout: 10 };
// c.apiKey = "x";     // ✗ 只读，编译期禁止再赋值
c.timeout = 20;         // ✓
```

`readonly` 是**编译期**约束（擦除后 JS 仍可改），防的是"手滑重新赋值"，不是安全机制。要真正的运行时不可变仍需 `Object.freeze`（呼应 es-object-api）。数组/元组也有只读版：`ReadonlyArray<T>` / `readonly T[]`、`readonly [number, string]`。

---

## 四、索引签名（index signature）

描述"键名未知、值类型已知"的对象：

```ts
type StringMap = { [key: string]: string };
// 等价：Record<string, string>（见 ts-utility）
const headers: StringMap = { "content-type": "application/json" };

// 数字索引：数组本质就是 number 索引签名
type NumObj = { [n: number]: string };
```

规则：
- 索引签名会**约束所有具名属性**——具名属性的类型必须兼容索引签名类型：
  ```ts
  type Bad = { [k: string]: number; name: string };  // ✗ name:string 不兼容 number 索引
  ```
- `key` 可以是 `string`、`number`、或字面量/模板联合（TS 4.4+ 支持 pattern index signature，如 `{ [k: `visit${string}`]: number }`）。
- 想表达"任意对象"用 `{ [k: string]: unknown }` 或 `Record<string, unknown>`，别用 `any`/`Object`（呼应 ts-any-unknown）。

---

## 五、字面量类型与"值即类型"

```ts
let dir: "north" | "south" = "north";
let port: 8080 = 8080;          // 字面量类型：只允许这一个值

type Status = 0 | 1 | 2;        // 数字字面量联合
const btn: { size: "sm" | "md" | "lg"; disabled?: boolean } = { size: "md" };
```

字面量类型是 TS 建模利器：把"只能是这几个值"编码进类型（枚举的轻量替代，呼应 ts-basics）。配合可辨识联合威力巨大（详见 ts-union）。

---

## 六、结构化类型（鸭子类型）——TS 兼容性的核心

TS **不看名字，看形状**。只要一个值"具备目标类型所需的全部成员"，就能赋给它——无需 `implements`：

```ts
interface Point { x: number; y: number }
function print(p: Point) { console.log(p.x, p.y); }

const origin = { x: 0, y: 0, label: "O" };
print(origin);          // ✓ 结构兼容（多一个 label 没关系，因为不是字面量直传）

class P3 { constructor(public x: number, public y: number) {} }
print(new P3(1, 2));    // ✓ 形状匹配即可，无需显式声明 implements Point
```

含义：类型兼容是**子类型**关系——"成员更多"的对象可满足"成员更少"的类型（ richer 可赋给 poorer）。函数参数按**双向宽松**规则比较（详见 ts-functions）。这与 Java 的**名义类型**（必须 `implements`）根本不同。

---

## 七、过剩属性检查（excess property check）

**直接传对象字面量**时，TS 额外严格：出现目标类型没声明的属性就报错，专治拼写错误：

```ts
type Pt = { x: number; y: number };
const a: Pt = { x: 1, y: 2, z: 3 };     // ✗ z 不存在于 Pt（字面量直赋）

const obj = { x: 1, y: 2, z: 3 };
const b: Pt = obj;                       // ✓ 非字面量直传，走结构兼容，不报
```

为什么 `a` 报、`b` 不报？"新鲜字面量"才做过剩检查。绕过它的方式（`b` 那种、类型断言、或加索引签名）要清楚自己在放弃这项保护。

---

## 八、`in`、可选与判空的小配合

```ts
type Rect = { w: number; h: number };
type Circ = { r: number };
type Shape = Rect | Circ;

function area(s: Shape) {
  if ("r" in s) return Math.PI * s.r ** 2;   // ✓ in 收窄到 Circ（详见 ts-narrowing）
  return s.w * s.h;
}
```

`in` 运算符既能在运行时判断键是否存在，也能作为**类型收窄**工具——这是联合对象类型的常用手法。

---

## 九、嵌套与深只读

```ts
type Address = { city: string; zip: string };
type Person = { name: string; address: Address };

// readonly 只挡一层，address 内部仍可变：
type Deep = { readonly name: string; readonly address: { readonly city: string } };
```

要"整棵树一层不变"得用递归工具类型 `Readonly<T>` / 手写 `DeepReadonly<T>`（映射类型，见 ts-utility / ts-advanced）。理解 `readonly` 的"浅"特性很重要。

---

## 十、自检清单

- [ ] 可选属性 `email?: string` 在 strict 下真实类型是什么？`exactOptionalPropertyTypes` 改变了什么？
- [ ] `readonly` 是运行时保护吗？它防的是什么？
- [ ] 索引签名对具名属性有什么约束？想表达"任意对象"该怎么写？
- [ ] 什么是结构化类型？和 Java 名义类型的关键区别？
- [ ] 为什么 `{x,y,z}` 直接赋给 `{x,y}` 类型会报错，但先赋给变量再赋就不报？
- [ ] `readonly` 数组元素为什么默认还能改？深只读怎么办？

---

## 🚀 部署预告

- 对象形状的可组合性直接决定了 **interface/type 的选型**（下一关）与泛型约束（ts-generic-constraints）；
- `Record<string, unknown>` / 索引签名是处理**外部 JSON、配置对象、环境变量**的日常（呼应 ts-declarations、Express L5）；
- 深只读/`Readonly`/`Partial` 等会在 **ts-utility** 从源码层面拆解。

下一关 **ts-interface**——interface 与 type 别名的能力边界、异同选型与声明合并。
