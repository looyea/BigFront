# 自定义类型守卫与穷尽检查

> 目标：**把"是不是某类型"封装成可复用、能跨函数传播的判定**——类型谓词 `x is T`、断言函数 `asserts x is T`、`never` 穷尽检查、`as const` 与判别字段配合，形成 TS 里最实用的三件安全武器。

---

## 一、类型谓词 `x is T`

普通返回 `boolean` 的函数**不会**收窄调用点的变量（上一关已见）。把返回类型写成**类型谓词** `参数 is 类型`，就能让调用点自动收窄：

```ts
function isString(x: unknown): x is string {
  return typeof x === "string";      // 运行时判断照写，返回类型用 is 声明
}

function f(x: unknown) {
  if (isString(x)) {
    x.toUpperCase();                 // ✓ x 被收窄为 string
  }
}
```

**类型守卫函数**：TS 内置一批"返回布尔但携带谓词信息"的守卫，如 `Array.isArray`、`x instanceof C`、`typeof`。自定义时你就写 `x is T`。

---

## 二、判别对象的可复用守卫

对可辨识联合，写一个通用 `is` 守卫非常常见：

```ts
type Success<T> = { ok: true; data: T };
type Failure = { ok: false; error: string };
type Result<T> = Success<T> | Failure;

function isSuccess<T>(r: Result<T>): r is Success<T> {
  return r.ok === true;
}

function use<T>(r: Result<T>) {
  if (isSuccess(r)) {
    console.log(r.data);         // ✓ 收窄到 Success，有 data
  } else {
    console.log(r.error);        // ✓ 收窄到 Failure，有 error
  }
}
```

---

## 三、断言函数 `asserts x is T`

另一种形态：**不返回布尔，而是"要么通过、要么抛错"**，让后续代码假定已收窄：

```ts
function assertIsNumber(x: unknown): asserts x is number {
  if (typeof x !== "number") throw new Error("not a number");
}

function compute(x: unknown) {
  assertIsNumber(x);      // 通过则之后 x: number；不通过直接抛错
  return x.toFixed(2);    // ✓ x 已是 number
}
```

也支持"断言一个条件"：`function assert(cond: boolean, msg: string): asserts cond`。适合做**前置校验/不变式**（呼应 Express L5 校验中间件、防运行时意外）。注意 `asserts` 函数调用必须**在使用前**、且 TS 要求调用点变量是显式类型的参数/`const`。

---

## 四、`in` 与 `instanceof` 作为守卫

内置守卫无需你写 `is`，直接可用（上一关）：

```ts
function describe(x: { eat(): void } | { code(): void }) {
  if ("eat" in x) x.eat();       // in 守卫收窄
  else x.code();
}
function show(v: Error | Date) {
  if (v instanceof Error) alert(v.stack);   // instanceof 守卫
  else alert(v.toISOString());
}
```

---

## 五、穷尽检查（exhaustiveness）——never 兜底

处理可辨识联合时，在 `default` 里把剩余赋给 `never`：一旦漏处理某支，编译器报错。

```ts
type Shape =
  | { kind: "circle"; r: number }
  | { kind: "square"; side: number };

function area(s: Shape): number {
  switch (s.kind) {
    case "circle": return Math.PI * s.r ** 2;
    case "square": return s.side ** 2;
    default:
      // 处理完所有 kind 后，这里的 s 应是 never
      const _exhaustive: never = s;
      return _exhaustive;
  }
}

// 将来新增 { kind:'tri'; ... } 而忘了加 case，area 里 default 的赋值会报错：
//   Type '{ kind:"tri"; ... }' is not assignable to type 'never'.
```

这是"**用类型消失证明分支齐全**"：所有合法情况都处理后，剩余类型收敛为 `never`；还有未处理支就不是 `never`，赋值失败 → 编译期拦截"忘处理新状态"。可封装成工具函数：

```ts
function assertNever(x: never): never {
  throw new Error("Unexpected value: " + JSON.stringify(x));
}
// default: return assertNever(s);
```

---

## 六、`as const` 与判别式建模

`as const` 把常量对象/数组冻结成字面量类型，配合可辨识联合与 `never` 穷尽，构建强类型状态机：

```ts
const STATES = {
  idle:    { step: 0 },
  loading: { step: 1, reqId: "" },
  error:   { step: 2, msg: "" },
} as const;

type StateKey = keyof typeof STATES;      // 'idle'|'loading'|'error'
function stepOf(k: StateKey): number {
  return STATES[k].step;                  // 返回类型是精确的 0|1|2
}
```

没有 `as const`，`step` 会被推成宽类型 `number`，`StateKey` 也可能退化——精度全靠 `as const` 守住（呼应 ts-object-types、ts-basics）。

---

## 七、守卫函数 vs 判别字段：怎么选

| 场景 | 推荐 |
|------|------|
| 能改类型定义、成员有多种状态 | **可辨识联合 + switch + never 穷尽**（最声明式、可复用、可穷尽） |
| 不能改的第三方类型、靠属性/原型区分 | **自定义 `is` 守卫 / `in` / `instanceof`** |
| 只想"校验即抛错、后续放心用" | **断言函数 `asserts x is T`** |
| 边界外部数据一次性转成类型 | **zod/valibot `parse`（运行时校验 + 静态类型）** |

判别字段偏"数据自带身份"，守卫偏"你去探测身份"，两者常结合使用。

---

## 八、自检清单

- [ ] 为什么普通 `boolean` 返回的函数不能收窄调用点变量？`x is T` 改了什么？
- [ ] 断言函数 `asserts x is T` 和守卫函数 `x is T` 的用法区别？
- [ ] 穷尽检查里 `default: const _: never = s` 为什么能"漏分支就报错"？
- [ ] `assertNever` 工具函数怎么写、怎么用？
- [ ] `as const` 在状态机建模里起什么作用？
- [ ] 判别字段和自定义守卫，什么时候各用哪个？

---

## 🚀 部署预告

- 类型守卫 + 穷尽检查是** reducer / 状态机 / 协议解析 / API 结果处理**的安全底座（呼应 ts-frameworks、Express L5）；
- `asserts` 前置校验与 zod `parse` 是"从 `unknown` 到可信类型"的两条主流路径（贯穿 ts-any-unknown）；
- 判别字段、`is`、`never` 这些"依赖输入类型算输出/约束"的能力，会在 **L4 泛型**里被抽象成可复用的多态代码。

下一关进入 **L4**——**ts-generic**：泛型函数/接口/类与类型参数推断。
