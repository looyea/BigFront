# 联合类型与交叉类型

> 目标：**吃透 `|`（联合）与 `&`（交叉）的语义**，掌握字面量联合、**可辨识联合（discriminated union）** 这一 TS 最强建模模式，理解联合的存取规则——为下一关"类型收窄"打好地基。

---

## 一、联合类型 `|`：或

`A | B` 表示"值是 A **或** B"。它是类型的**并集**（成员取两边之和）。

```ts
let id: string | number;
id = "abc";     // ✓
id = 123;       // ✓
// id = true;   // ✗

function pad(v: string | number) {
  // 联合类型上，只能直接访问"所有成员共有"的成员
  // v.length;   // ✗ number 没有 length
  // v.toFixed(); // ✗ string 没有 toFixed
  return String(v).length;   // ✓ 先归一到共同类型
}
```

**核心规则**：联合类型 `A | B` 上，只有 **A 和 B 都有的成员**才能直接访问；要访问某一支特有的成员，必须先**收窄**（下一关）。这与交叉正好相反。

---

## 二、字面量联合：把取值范围锁死

```ts
type Direction = "north" | "south" | "east" | "west";
type HttpResponse = 200 | 201 | 404 | 500;
type Switch = "on" | "off";

function move(d: Direction) { /* d 只能是那四个字面量之一 */ }
move("north");     // ✓
move("up");        // ✗ 不在集合里，且 IDE 只补全合法值
```

字面量联合是"轻量枚举"（纯类型、零运行时，呼应 ts-basics），也是可辨识联合的判别标签来源。

---

## 三、交叉类型 `&`：且

`A & B` 表示"值**同时**是 A 和 B"。它是类型的**交集**（成员取两边之并——拥有所有成员）。

```ts
type Named = { name: string };
type Aged = { age: number };
type Person = Named & Aged;      // { name: string; age: number }

const p: Person = { name: "Ada", age: 36 };   // 必须同时满足两者
```

交叉常用于**组合**（mixin、把多个小契约拼成大契约）：

```ts
interface Serializable { serialize(): string }
interface Loggable { log(): void }
type Service = Serializable & Loggable & { name: string };
```

坑（呼应 ts-interface）：同名属性类型冲突会被再交叉——`{a:string} & {a:number}` 的 `a` 是 `string & number = never`。

---

## 四、可辨识联合（Discriminated Union）——TS 建模王牌

给联合的每个成员加一个**共有且唯一**的字面量"判别字段"（tag），TS 就能凭它自动收窄：

```ts
type Shape =
  | { kind: "circle"; r: number }
  | { kind: "rect"; w: number; h: number }
  | { kind: "triangle"; base: number; height: number };

function area(s: Shape): number {
  switch (s.kind) {
    case "circle":   return Math.PI * s.r ** 2;        // 这里 s 收窄到 circle，可访问 r
    case "rect":     return s.w * s.h;                  // 收窄到 rect
    case "triangle": return (s.base * s.height) / 2;    // 收窄到 triangle
  }
}
```

`kind` 就是判别标签（discriminant）。`switch (s.kind)` 每个 case 里，`s` 自动缩小到对应变体，**只有那一支的特有字段可访问**——这就是可辨识联合的威力：**把"不同状态下有不同数据"编码进类型**。

---

## 五、为什么优于"大对象全可选"

反面模式：

```ts
// 糟糕：所有字段都可选，非法组合满天飞
type BadShape = { kind: string; r?: number; w?: number; h?: number };
const b: BadShape = { kind: "circle", w: 5 };   // "circle 却带 w、没有 r" —— 编译器放行！运行时炸
```

可辨识联合让 `{ kind:'circle', w:5 }` **根本写不出来**（circle 变体没有 w、必须有 r）。这就是"**make illegal states unrepresentable**"（让非法状态不可表示）——TS 高级建模的核心思想（贯穿 ts-guards 的穷尽检查）。

---

## 六、联合与数组/函数

```ts
// 联合数组：元素是两种类型之一
const mix: (string | number)[] = ["a", 1, "b"];
// 数组的联合（少见但要注意语义不同）：
const either: string[] | number[] = ["a"];

// 联合返回值
function parse(s: string): number | null {
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}
const v = parse("x");        // number | null
// v.toFixed();              // ✗ 可能 null，需先判空
if (v !== null) v.toFixed(); // ✓ 收窄到 number
```

`T | null` / `T | undefined` 是最常见的联合，配合判空收窄（呼应 ts-strict 的 strictNullChecks）。

---

## 七、distributed union 的直觉（预告）

联合类型在很多运算下会**自动分发**到每个成员。例如给可辨识联合做映射/条件时会逐支处理（深入见 ts-conditional-infer）。先建立直觉：`A | B` 参与某些类型运算 ≈ 分别对 `A`、`B` 运算再取并。

```ts
type Val<T> = T extends { kind: infer K } ? K : never;
type Kinds = Val<Shape>;      // "circle" | "rect" | "triangle"（分发提取每支 kind）
```

---

## 八、自检清单

- [ ] 联合类型上为什么只能直接访问"共有成员"？想访问特有成员怎么办？
- [ ] `&`（交叉）和 `|`（联合）在"成员多少"上方向相反，怎么记？
- [ ] 什么是判别字段（discriminant）？可辨识联合如何解决"不同状态不同数据"？
- [ ] 为什么"全可选大对象"是反面模式？可辨识联合怎样让非法组合写不出来？
- [ ] `T | null` 用起来要注意什么？
- [ ] 交叉类型同名属性冲突会得到什么？

---

## 🚀 部署预告

- 可辨识联合是**状态机、Action/Reducer（Redux 风格）、路由参数、事件负载、API 响应联合**的标准建模法（呼应 ts-frameworks 的 reducer、Express 的路由参数联合）；
- 判别字段 + `switch` + `never` 兜底 = 穷尽检查（下一关 ts-guards）；
- 联合的分发特性会在 **ts-conditional-infer** 成为条件类型的核心机制。

下一关 **ts-narrowing**——如何用 `typeof`/`in`/`instanceof`/判空把联合类型安全地"缩小"到某一支。
