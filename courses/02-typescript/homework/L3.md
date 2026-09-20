# L3 作业 · 联合、收窄与类型守卫

覆盖：ts-union / ts-narrowing / ts-guards。五段式。

---

## 一、读代码（10 小题：判断能否编译、收窄到什么类型）

1. `function f(x: string | number) { return x.toString(); }` 能编译吗？`x.length` 呢？
2. `type P = {a:string} & {a:number}`，访问 `p.a` 的类型是什么？为什么？
3. 下面 if 分支里 `x` 分别被收窄成什么？
   ```ts
   function g(x: string | number | boolean) {
     if (typeof x === "string") { /* 1 */ }
     else if (typeof x === "number") { /* 2 */ }
     else { /* 3 */ }
   }
   ```
4. `if (typeof obj === "object")` 之后能直接 `obj.foo` 吗？还缺什么？
5. `name?: string`，`if (name)` 与 `if (name != null)` 收窄/排除的东西有何不同？`name=''` 时各自走哪个分支？
6. 可辨识联合 `Shape`（circle|square），`switch(s.kind)` 的每个 case 里 `s` 是什么类型？
7. `default: const _: never = s;` 在漏了一个 kind 时会怎样？
8. `function isCat(a: Animal): a is Cat` 里的 `a is Cat` 起什么作用？换成返回 `boolean` 会怎样？
9. `(string | number)[]` 与 `string[] | number[]` 差别是什么？各能 push 什么？
10. 去掉 `as const`，`const arr = ['a','b']; type T = typeof arr[number];` 的 T 是什么？加了呢？

---

## 二、手写（5 题）

1. 用可辨识联合定义 `Notification`：`email`（带 `address`）、`sms`（带 `phone`）、`push`（带 `device`），写 `render(n)` 用 `switch` 分支。
2. 写一个类型谓词 `isPaymentSuccess(r): r is Success` 处理 `Result< Order >`（成功有 `order`、失败有 `error`），并在 `if` 里安全访问。
3. 写一个断言函数 `assertNonEmpty(s: unknown): asserts s is string`，非空字符串才通过，否则抛错。
4. 给第 1 题的 `render` 补 `default` 的 `never` 穷尽检查；再新增一种 `kind:'inapp'` 但不加 case，记录报错信息。
5. 用 `as const` 定义一组角色 `['admin','editor','guest']`，派生出 `Role` 联合类型，并写 `label(r: Role): string`。

---

## 三、场景题（1 题）

你在写一个 HTTP 响应处理层。响应可能是：`{ status:'success', data: T }`、`{ status:'error', code:number, message:string }`、`{ status:'loading' }`。要求：
- 用可辨识联合建模 `ApiResult<T>`；
- 写 `handle` 函数用 `switch` 处理三种，`default` 用 `never` 兜底；
- 说明为什么这比 `{status:string; data?:T; code?:number}` 安全（用两个非法例子论证）；
- 若数据来自 `fetch`（运行时不可信），你的处理流程应如何加上运行时校验这一环？

---

## 四、简答题（3 题）

1. 类型守卫 `x is T` 与类型断言 `as T` 的本质区别？为什么说前者"有证据"、后者"可能骗人"？
2. 穷尽检查为什么用 `never` 而不是抛个错就行？编译期拦截相比运行期的价值是什么？
3. `as const` 作用于类型层面还是运行时？它和 `Object.freeze` 的区别？

---

## 五、挑战题 🏆

实现一个**类型安全的 `match` 工具**（类似函数式语言的 pattern matching）：

```ts
type Shape =
  | { kind: 'circle'; r: number }
  | { kind: 'rect'; w: number; h: number }
  | { kind: 'triangle'; base: number; height: number };

function area(s: Shape): number {
  return match(s, {
    circle:   (c) => Math.PI * c.r ** 2,
    rect:     (r) => r.w * r.h,
    triangle: (t) => (t.base * t.height) / 2,
  });
}
```

要求：
1. `match` 的 handlers 对象必须**恰好覆盖**所有 `kind`（少一个编译报错、多一个不存在的 kind 也报错）；
2. 每个 handler 的参数被收窄到对应变体（`c` 自动是 circle 支，能访问 `r`）；
3. 提示：会用到 `keyof`、映射类型、可辨识联合泛型约束——这正是 **L4 泛型 / L5 映射类型** 的主题，先尝试用本关知识逼近，感受"类型不够用"的边界，带问题进入下一关。
