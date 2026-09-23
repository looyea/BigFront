# 严格模式全开关逐个击破

> 目标：把 `strict` 家族每一个开关**单独**讲透——它到底拦住了什么 bug、报错长什么样、怎么正确应对。上一关建了地图，这一关是"每一条 strict 规则背后的血泪"。开 `strict` 不是"给自己找麻烦"，而是让 TS 真正开始为你挡 bug（呼应 ts-project 第三节、第 12 题）。

---

## 一、strictNullChecks：空值不再是"免费的"

`strict` 之王。关闭时 `null`/`undefined` 可赋给任何类型，是 TS 最大 bug 源（"Cannot read property of undefined"）。打开后它们是**独立类型**，可能为空的值必须显式标注：

```ts
let name: string = null;            // ✗ 开启后报错
let name2: string | null = null;    // ✓
function find(k: string): User | undefined { /* ... */ }
const u = find("a");
// u.name;                          // ✗ u 可能 undefined
u?.name;                            // ✓ 可选链
if (u) u.name;                      // ✓ 收窄（呼应 ts-narrowing）
u!.name;                            // "我保证非空"——自担风险（呼应 ts-any-unknown 断言）
```

`?.`、`??`、`!`、类型守卫是日常四件套。`strictNullChecks` 还会让可选属性 `a?: T` 的真实类型是 `T | undefined`——这是很多"看着有其实可能没有"的来源（呼应 ts-basics、下一节的 `exactOptionalPropertyTypes`）。

---

## 二、noImplicitAny：拒绝"默默放弃检查"

函数参数、变量若无法推断出类型，默认落成 `any` 就**报错**，逼你标注：

```ts
function sum(a, b) {}      // ✗ a、b 隐式 any
function sum(a: number, b: number) {}  // ✓
(JSON.parse(s) as { x: number }).x;   // 解析结果给个类型（呼应 ts-any-unknown）
```

`any` 是"逃逸舱口"，一旦渗入就在那条链上关掉所有检查（呼应 ts-any-unknown）。`noImplicitAny` 把"要不要放弃类型"变成**显式决定**——你仍可写 `: any`，但要负责。catch 变量在 4.4+ 默认 `unknown`（`useUnknownInCatchVariables`），同理逼你先收窄再用 `err`（呼应 ts-guards）。

---

## 三、noImplicitThis & strictFunctionTypes

```ts
class Ctor { x = 1; get() { return this.x; } }
const f = new Ctor().get;   // f() 里 this 丢失 → 若隐式 any this 会报（呼应 ts-classes 第 10 题）

// strictFunctionTypes：函数"类型位置"的参数按逆变检查（呼应 ts-functions）
type FnNum = (n: number) => void;
declare function takes(f: (n: number | string) => void): void;
takes((n: number) => {});   // strictFunctionTypes 下：把只吃 number 的函数当能吃 number|string 传 → 报错
```

`strictFunctionTypes` **不**管方法声明的双变（方法仍按老规则），只对"函数类型属性/签名"施加逆变（更安全）。它能抓住"我传入的回调处理不了所有分支参数"的隐蔽 bug。`noImplicitThis` 专治回调/普通函数里 `this` 指向不明。

---

## 四、strictPropertyInitialization & definite assignment

```ts
class Config {
  host: string;         // ✗ 未在构造器里赋值 → 报"没有初始化和赋值"
  port: number;
  constructor(input?: { host: string; port: number }) {
    this.host = input!.host; this.port = input!.port;   // 在构造器里赋值即可满足
  }
  lazy!: string;        // 用 ! 断言"我确定会被赋值"（框架注入/后期填充，自担风险）
  declare ambient: number;  // 仅类型、不生成字段（呼应 ts-classes、useDefineForClassFields）
}
```

它要求"类里声明的实例字段要么有默认值、要么构造器里必被赋值"，防"字段类型是 `string` 但运行时其实是 `undefined`"的谎言。用 `!`（definite assignment）或 `?`（承认真的可为空）明确意图，别用 `!` 掩盖本该处理的 undefined（呼应 ts-any-unknown）。

---

## 五、strict 之外：三个"手动加"的更狠开关

`strict: true` **不含**下面这些，价值极高、务必单独开（呼应 ts-project 第三节）：

```ts
// noUncheckedIndexedAccess：数组/对象索引结果附加 | undefined
const arr = [1, 2, 3];
const x = arr[0];        // number | undefined（不是 number！）
x.toFixed();            // ✗ 逼你处理越界（呼应 ts-basics 越界、ts-advanced）

// exactOptionalPropertyTypes：a?: T 不再允许显式赋 undefined
interface O { a?: string }
const o: O = { a: undefined };   // ✗ 需 a?: string | undefined 才行

// noPropertyAccessFromIndexSignature：索引签名必须用 ['k'] 而非 .k
interface Dict { [k: string]: number }
declare const d: Dict;
d.foo;                  // ✗；d["foo"] ✓（区分"已知属性"与"动态索引"）
```

`noUncheckedIndexedAccess` 最实用——它承认"`arr[i]` 可能就是 `undefined`"这一运行时真相，逼你在取索引后判空或用 `NonNullable`（呼应 ts-utility）。代价是噪音较多，常配合类型守卫用。

---

## 六、开启策略与常见报错速修

| 报错关键词 | 根因 | 正解方向 |
|---|---|---|
| `is possibly 'undefined'` | strictNullChecks | 判空/`?.`/守卫，慎用 `!` |
| `Parameter ... implicitly has an 'any'` | noImplicitAny | 标类型或用泛型/`unknown` |
| `'this' implicitly has type 'any'` | noImplicitThis | 箭头函数/`this: void`/bind |
| `Property ... has no initializer` | strictPropertyInitialization | 构造器赋值/`!`/改可选 |
| `Object is possibly 'undefined'`（索引） | noUncheckedIndexedAccess | 判空 / `NonNullable` / for-of |
| `... not assignable to parameter of type ...` | strictFunctionTypes | 让回调参数覆盖更全或调整签名 |

原则：报错是"真 bug 的预警"，别急着 `@ts-ignore` 消音（临时可用 `@ts-expect-error` 且它会在使用消失时反向报错，更好，呼应 ts-migration）。优先"用类型收窄/守卫解决"，而非"用断言糊弄"。

---

## 七、自检清单

- [ ] `strictNullChecks` 下 `a?: T` 的真实类型是什么？四件套（`?. ?? ! 守卫`）各何时用？
- [ ] `noImplicitAny` 和 `useUnknownInCatchVariables` 共同把什么变成显式决定？
- [ ] `strictFunctionTypes` 为什么对"方法"不生效？它防的是什么 bug？
- [ ] `strictPropertyInitialization` 报错时，`!` 和改成 `? | undefined` 哪个更诚实？
- [ ] 哪三个"更严"开关不在 `strict` 里？`noUncheckedIndexedAccess` 解决了什么运行时真相？
- [ ] `@ts-ignore` vs `@ts-expect-error` 取舍？

---

## 🚀 部署预告

- 严格模式逼出的"空值/索引/断言"处理习惯，正是下一关 **ts-migration** 把 JS 项目逐文件点亮类型的弹药；
- `noUncheckedIndexedAccess` 带来的 `| undefined` 常用 `NonNullable`/守卫消化（呼应 ts-utility、ts-guards）；
- 严格性开关的"何时全开、如何防回退"会连到 ts-tooling（ESLint `@typescript-eslint`、`tsc --noEmit` 进 CI）与 ts-project 第 12 题迁移路径（呼应 Express L7）。

下一关进入 **ts-migration**：把存量 JS 渐进迁移到 TS 的实战策略。
