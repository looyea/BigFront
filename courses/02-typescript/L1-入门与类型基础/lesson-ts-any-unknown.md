# any / unknown / never / void 与安全边界

> 目标：**把 TS 里四个"特殊类型"讲透**——`any` 是逃生舱不是默认、`unknown` 才是类型安全的顶层类型、`never` 表"不可能"、`void` 表"无返回值"；建立"尽量少 any、边界用 unknown + 收窄"的安全直觉。

---

## 一、any：关闭检查的逃生舱

`any` 让该值**绕过所有类型检查**——任何属性、任何调用、任何赋值都不报错。它是从动态 JS 渐进迁移的兼容口，但**用了就等于那块代码退回无类型世界**，且会**传染**（`any` 参与运算结果常还是 `any`）。

```ts
let a: any = getValueFromSomewhere();
a.foo.bar.baz();          // ✓ 不报错（运行时可能炸）
const n: number = a;      // ✓ any 可赋给任何类型（危险）

function bad(x: any) { return x.length; }   // x 是啥都可能，编译器放弃了
```

**隐式 any**：`noImplicitAny`（`strict` 的一部分）会禁止"推断不出类型时默认 any"，逼你显式处理。CI 里应禁止 `: any`（ESLint `@typescript-eslint/no-explicit-any`）。

> 心法：**每写一个 `any`，都是给编译器签的一张"我保证对"的空头支票。** 能用 `unknown` 就别用 `any`。

---

## 二、unknown：类型安全的顶层类型

`unknown` 也是"什么都能赋进来"，但**取用时必须先收窄**——不能直接当任何具体类型用。它是"我不知道这是什么，编译器你别假设"。

```ts
let u: unknown = JSON.parse(text);
// u.toUpperCase();          // ✗ 不能直接用
// const s: string = u;      // ✗ unknown 不能直接赋给具体类型

if (typeof u === "string") {
  u.toUpperCase();           // ✓ 收窄后能用
}
if (typeof u === "object" && u !== null && "id" in u) {
  // u 被收窄为对象且含 id
}
```

对比：

| | 能赋给任意类型 | 从任意类型赋来 | 使用其成员前 |
|---|---|---|---|
| `any` | ✓（危险） | ✓ | 无需收窄（直接放行） |
| `unknown` | ✗（须收窄/断言） | ✓ | **必须收窄或断言** |

**边界数据首选 `unknown`**：`catch (e)` 的 `e`、`JSON.parse` 结果、无类型库的返回、`postMessage` 的 `data`——先落 `unknown`，再用类型守卫/zod 建立信任（呼应 ts-guards、Express L5）。TS 4.4+ 起 `catch (e)` 默认就是 `unknown`（`useUnknownInCatchVariables`）。

```ts
try { /* ... */ } catch (e) {          // e: unknown
  if (e instanceof Error) console.error(e.message);
}
```

---

## 三、never：不可能的值

`never` 是**底类型**——没有任何值属于它。用途有三：

1. **永不返回的函数**（抛异常 / 死循环）：
```ts
function fail(msg: string): never { throw new Error(msg); }
function loop(): never { while (true) {} }
```
2. **穷尽性检查**：可辨识联合被处理完后，剩余分支类型应是 `never`，用它兜底逼你处理所有情况（详见 ts-guards）：
```ts
function area(s: Shape): number {
  switch (s.kind) {
    case "circle": return Math.PI * s.r ** 2;
    case "square": return s.side ** 2;
    default: {
      const _exhaustive: never = s;   // 若漏了某个 Shape，这里报错
      return _exhaustive;
    }
  }
}
```
3. **不可达/空交集**：`string & number` 是 `never`；某些条件类型的兜底分支。

> 小心 `never[]`：空数组无标注时可能推成 `never[]`，`push` 任何值都报错——给它显式类型（呼应 ts-basics）。

---

## 四、void：无返回值

`void` 表示函数**不返回有意义的值**。与 `never` 区别：`() => void` 会正常返回（返回 `undefined`），`() => never` 永不正常返回。

```ts
function log(m: string): void { console.log(m); }
let v: void = undefined;      // void 变量只能放 undefined（strict 下）
```

回调场景的微妙规则：TS **允许**把有返回值的函数传给期望 `() => void` 的参数（常见于 `Array.forEach`——它忽略返回值）。但反过来不行，别指望靠 `void` 传数据。

---

## 五、类型断言 as：谨慎的"我说了算"

`as` 是**你**告诉编译器"请把它当这个类型"，编译器基本照办、运行时不校验：

```ts
const input = document.getElementById("app") as HTMLElement;
const data = response as User;      // 危险：如果 response 实际不是 User，运行时才炸
```

- 只能断言到**相关**类型；跨无关类型要 `as unknown as T`（等于双重放行，尽量少）；
- **断言不是转换**：`x as number` 运行时不会把字符串变数字，只是改类型；
- 优先用**类型守卫收窄**或 `satisfies`（TS 4.9+）替代断言：

```ts
const sizes = { small: 1, medium: 2 } satisfies Record<string, number>;
// 既校验符合 Record<string,number>，又保留精确字面量类型（不像 as 会拓宽/丢信息）
```

---

## 六、`Object` / `{}` / `Record<string, unknown>` 的坑

```ts
let o: Object;    // ✗ 几乎别用：能赋任何东西但只能访问 Object 的通用方法
let e: {};        // 表示"非 null/undefined 的值"，不是"空对象"，容易误解
let r: Record<string, unknown>;   // ✓ 想表达"键任意的对象"时更合适
```

描述"任意对象"优先用 `Record<string, unknown>` 或索引签名 `{ [k: string]: unknown }`，而不是 `Object`/`{}`/`any`（详见 ts-object-types）。

---

## 七、选型速查

| 需求 | 用什么 | 不用 |
|------|--------|------|
| 真的不知道、且要强制校验 | `unknown` + 守卫 | `any` |
| 迁移期临时放行、第三方无类型 | `any`（并记 TODO / eslint-disable） | 到处 `any` |
| 函数不返回有用值 | `void` | `any` |
| 永不返回 / 穷尽兜底 / 空交集 | `never` | `void` |
| 告诉编译器"这就是 X" | 守卫 / `satisfies` 优先，其次 `as` | 滥用 `as` |

---

## 八、自检清单

- [ ] `any` 和 `unknown` 的核心区别？为什么说 unknown 更安全？
- [ ] `catch (e)` 里 e 默认是什么类型？怎么安全使用？
- [ ] `never` 有哪三种典型用途？
- [ ] `void` 和 `never` 区别？为什么 `forEach` 能接受有返回值的回调？
- [ ] 类型断言 `as` 运行时会发生什么？`satisfies` 比 `as` 好在哪？
- [ ] 想描述"任意对象"，`Object` / `{}` / `Record<string, unknown>` 选哪个？

---

## 🚀 部署预告

- **CI 门禁**：ESLint `no-explicit-any` + `tsc --noEmit`（`noImplicitAny`）把 `any` 挡在门外（呼应 ts-tooling、Express L7）；
- **运行时校验**：边界 `unknown` → zod/valibot `parse` → 拿回精确 TS 类型，是"从不可信到可信"的标准姿势（呼应 Express L5、ts-publish）；
- 类型守卫与 `satisfies` 会在 **ts-guards / ts-narrowing** 深入。

下一关进入 **L2**——先讲 **ts-object-types**：对象类型、属性修饰、索引签名与结构化类型的兼容性规则。
