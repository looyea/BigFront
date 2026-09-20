# L1 作业 · 入门与类型基础

覆盖：ts-intro / ts-basics / ts-any-unknown。五段式，先读后写，最后挑战。

---

## 一、读代码（10 小题：判断编译是否通过、推断出什么类型、运行结果）

1. 下面 `.ts` 编译成 `.js` 后，`interface` 和类型标注还在吗？为什么？
   ```ts
   interface Box { w: number }
   const b: Box = { w: 1 };
   ```

2. `tsc --noEmit` 和 `tsc` 的区别？哪个适合放 CI 门禁？

3. 用 `tsx app.ts` 能跑起来，是否代表没有类型错误？为什么？

4. 推断出下列每个变量的类型：
   ```ts
   const a = "hi";
   let b = "hi";
   const c = [1, 2, 3];
   const d = [];
   ```

5. `function f(x: any) { return x.y.z; }` 会不会报错？隐患在哪？

6. 下面为什么会报错？怎么修（两种写法）？
   ```ts
   const list = [];
   list.push(1);
   ```

7. `catch (e) { console.log(e.message); }` 在 `strict` 下为何报错？正确写法？

8. `const s = "a" as const;` 与 `let s2 = "a";` 类型分别是什么？

9. `void` 和 `never` 分别适合哪种函数？各举一例。

10. `enum E { A, B }` 编译后会产生运行时代码吗？`type T = 'a' | 'b'` 呢？

---

## 二、手写（5 题）

1. 写一个 `tsconfig.json`，要求：输出 ES2022、含 DOM 类型、开启 strict、产物到 `dist`、源码根 `src`。
2. 定义类型 `User`（`id: number`、`name: string`、可选 `email?: string`），并写 `greet(u: User): string` 返回 `Hi, {name}`。
3. 用**元组**表示"HTTP 状态 + 响应体"，写一个返回 `[number, string]` 的函数，并解构调用。
4. 把一段 `JSON.parse` 的结果先按 `unknown` 接收，用 `typeof` 收窄确认是 `string` 后再调用 `toUpperCase()`。
5. 用 `satisfies` 改造下面代码，使校验为"值是数字或数字数组"，同时保留每个键的精确类型：
   ```ts
   const config = { port: 8080, hosts: ["a", "b"] };
   ```

---

## 三、场景题（1 题）

你接手一个从 JS 迁移到 TS 的老项目，同事为了"快速消除红线"，在几十个文件里塞满了 `: any` 和 `as`。请回答：
- 这会带来什么问题（从类型安全、传染、维护角度）？
- 给出至少 4 条可落地的收口措施（tsconfig / eslint / 边界校验 / 评审规则）。
- 对"外部接口返回的数据"应遵循怎样的处理流程？

---

## 四、简答题（3 题）

1. 用你自己的话解释"类型擦除"，并说明它对泛型和运行时判断的两个直接影响。
2. `any` 与 `unknown` 的区别是什么？为什么"边界数据首选 unknown"？
3. `as`（类型断言）与 `satisfies` 与 `: T`（类型标注）三者，各自会不会改变/保留被推断出的精确类型？

---

## 五、挑战题 🏆

设计一组类型，把"订单状态机"编码为**非法状态不可表示**：

- 状态有 `idle`（无字段）、`loading`（必须有 `reqId: string`）、`error`（必须有 `code: number` 和 `msg: string`）、`done`（必须有 `data: T`，用泛型）。
- 要求：① 用可辨识联合 + 字面量类型定义 `OrderState<T>`；② 写一个 `describe(s: OrderState<T>): string` 用 `switch` 处理，并在 `default` 用 `never` 做穷尽检查；③ 证明"loading 但没有 reqId"这种对象**写不出来**（编译报错）。

提交你的类型定义 + 一个故意写错触发穷尽检查报错的例子（注释说明报错原因）。
