# L2 作业 · 对象、接口与函数

覆盖：ts-object-types / ts-interface / ts-functions。五段式。

---

## 一、读代码（10 小题：判断能否编译通过、为什么）

1. `type Pt = {x:number; y:number}`；`const p: Pt = {x:1,y:2,z:3}` 报不报错？若 `const o={x:1,y:2,z:3}; const p2: Pt=o` 呢？
2. `email?: string` 在 strict 下是什么类型？用 `u.email.length` 为什么会报错？
3. `type M = { [k:string]: number; name: string }` 为什么报错？
4. 结构化兼容：`interface P{ x:number; y:number }`，`{x:1,y:2,label:'O'}`（非字面量直传）能赋给 `P` 吗？
5. 同名 `interface Box{a:string}` 两次声明会怎样？同名 `type Box=...` 两次呢？
6. `function f(a?: number, b: string){}` 能通过编译吗？为什么？
7. `type Adder=(a:number,b:number)=>number; const add: Adder=(a,b)=>a+b;` 里 a、b 为何不用标类型？
8. `each([1,2], n=>n*2)`，`each` 参数是 `(n:number)=>void`，为何返回 number 的回调也能传？
9. 重载里最后那个"实现签名"能否被调用者直接调用？
10. `readonly arr: number[]` 与 `const` 变量指向的数组，各自挡住了什么？

---

## 二、手写（5 题）

1. 用 `interface` 定义 `Entity`（`readonly id: string`）并 `extends` 出 `Product`（含 `name`、可选 `price`）。
2. 用 `type` 表达：状态 `'idle'|'loading'|'success'|'error'`，以及函数类型 `Fetcher = (url: string) => Promise<unknown>`。
3. 写一个 `connect` 函数，用**对象参数**取代 `(host, port?, ssl?, timeout?)`，并给 `ssl` 默认 `false`。
4. 写一个重载 `format(v: number): string` 与 `format(v: Date): string`，实现签名合理写宽。
5. 用 `declare interface` 合并，给全局 `Window` 增加 `appConfig?: { env: string }`，并在代码里安全读取。

---

## 三、场景题（1 题）

你在封装一个表单组件的 props 类型。字段分两类：文本框 `{ kind:'text', value: string }`、数字框 `{ kind:'number', value: number }`、下拉 `{ kind:'select', value: string, options: string[] }`。要求：
- 用 interface/type 设计一个能表达"三种字段"的类型；
- 说明为什么这里"可辨识联合 + 字面量 kind"比"一个大对象全可选"更好（提示：非法组合、访问 options 的安全）；
- 写一个函数，只有在 `select` 分支才能访问 `options`。

---

## 四、简答题（3 题）

1. interface 与 type 的三个关键差异是什么？你团队会怎么定选型规则？
2. 什么是结构化类型？它和名义类型对"两个形状相同、名字不同的类型"的判定有何不同？
3. 开启 strictFunctionTypes 后，函数参数与返回分别按什么方向（协变/逆变）检查？"方法简写"为何是例外？

---

## 五、挑战题 🏆

设计一个**类型安全的事件总线**：

```ts
type Events = {
  login: { userId: string };
  purchase: { itemId: string; amount: number };
  error: unknown;
};
```

要求：
1. 写 `on<K extends keyof Events>(event: K, cb: (payload: Events[K]) => void): void`，让回调参数自动对上事件负载类型；
2. 写 `emit<K extends keyof Events>(event: K, payload: Events[K]): void`，使得 `emit('login', { itemId: 'x' })` 编译报错；
3. 用 `on('login', p => ...)` 验证 `p.userId` 有自动补全、`p.amount` 报错。

（提示：会用到泛型 + `keyof` 约束，正是下一关 ts-generic / ts-generic-constraints 的主题——先凭 L2 直觉尝试，卡住就来 L3/L4 找答案。）
