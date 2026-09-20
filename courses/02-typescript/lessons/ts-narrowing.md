# 类型收窄

> 目标：**掌握 TS 控制流分析（CFA）的全部收窄手段**——`typeof`、`instanceof`、`in`、truthiness、相等/`switch`、`typeof` 对 null 的坑，理解收窄是"编译器顺着代码流程自动缩小类型"，而非你手动断言。

---

## 一、什么是类型收窄（narrowing）

一个变量的**声明类型**可能很宽（联合、`unknown`），但 TS 会**顺着控制流**（if/switch/循环/异常）分析，在每个点上把它的**当前类型缩小**到更精确的版本。收窄是自动的、局部的、可逆的（离开分支回到原类型）。

```ts
function len(x: string | number) {
  // 这里 x: string | number
  if (typeof x === "string") {
    return x.length;      // 分支内 x 被收窄为 string ✓
  }
  return x.toFixed();     // 余下分支 x 收窄为 number ✓
}
```

---

## 二、typeof 收窄

对原始类型最常用，TS 认识 7 种 `typeof` 结果并据此缩窄：

```ts
function f(x: unknown) {
  if (typeof x === "string") { x.toUpperCase(); }        // x: string
  else if (typeof x === "number") { x.toFixed(2); }      // x: number
  else if (typeof x === "boolean") { /* x: boolean */ }
  else if (typeof x === "function") { /* x: Function */ }
  else if (typeof x === "symbol") { /* x: symbol */ }
  else if (typeof x === "bigint") { /* x: bigint */ }
  else if (typeof x === "undefined") { /* x: undefined */ }
  // object 分支：typeof 'object' 含 null，要额外判 null（见下）
}
```

**经典坑**：`typeof null === "object"`。所以要判"是对象且非 null"：

```ts
if (typeof x === "object" && x !== null) {
  // 现在 x 才真正是可访问的对象类型
}
```

---

## 三、truthiness 收窄（判空）

利用"假值"把 `undefined | null | 0 | '' | false` 从联合里剥掉：

```ts
function greet(name?: string | null) {
  if (name) {                 // 排除了 undefined/null/'' 
    return "Hi " + name;      // name: string（非空）
  }
  return "Hi anonymous";      // name: string | null | undefined
}

// 更精确：只想排除 null/undefined，保留 ''/0
if (name != null) { /* name: string */ }     // == null 同时挡 null 与 undefined
if (name !== undefined) { /* string | null */ }
```

注意 truthiness 会连带排除 `0`/`""`，若这些是合法值要用 `!== undefined`/`!= null` 精确判断。

---

## 四、in 收窄

`"prop" in obj` 判断属性存在，可把联合对象缩到"含该属性"的那支：

```ts
type Cat = { meow: () => void };
type Dog = { bark: () => void };

function speak(a: Cat | Dog) {
  if ("meow" in a) {
    a.meow();          // 收窄为 Cat
  } else {
    a.bark();          // 收窄为 Dog
  }
}
```

`in` 对**可选属性判别**尤其有用，也可用在可辨识联合之外的"形状探测"场景（呼应 ts-object-types）。

---

## 五、instanceof 收窄

对 class 实例，`instanceof` 按原型链判断并缩窄：

```ts
function handle(e: Error | Date) {
  if (e instanceof Error) { console.error(e.message); }   // Error
  if (e instanceof Date) { console.log(e.getTime()); }     // Date
}

// 异常处理的标准姿势（呼应 ts-any-unknown 的 catch: unknown）
try { /* ... */ } catch (err) {
  if (err instanceof Error) {
    console.error(err.stack);
  }
}
```

坑：`instanceof` 依赖同一份 class 引用，跨 realm（iframe/vm/多份 Node 副本）会失效——这类场景改用鸭子类型/`in`/判别字段或 `Object.prototype.toString`（呼应 es-types）。

---

## 六、相等 / switch 收窄（含可辨识联合）

与字面量的相等比较、`switch` 都能收窄：

```ts
type Action =
  | { type: "inc"; by: number }
  | { type: "reset" };

function reduce(s: number, a: Action): number {
  switch (a.type) {
    case "inc":  return s + a.by;     // 收窄到 inc 支
    case "reset": return 0;
  }
}

// 与字面量比较
function f(x: string | number, kind: "a" | "b") {
  if (kind === "a") { /* kind 收窄为 'a' */ }
}
```

可辨识联合 + `switch` 是收窄的主力模式（上一关 ts-union 的核心兑现）。

---

## 七、收窄的"aliased 条件"与持久化

TS 能把收窄结果**存进变量或作为函数返回**后再用（TS 4.4+ 的 aliased discriminants / CFA of readonly 属性）：

```ts
const isStr = typeof x === "string";
if (isStr) { /* x 收窄为 string —— 因为 isStr 是 const 且直接来自 typeof */ }
```

但对 `let`、或非 `readonly` 的复杂表达式，TS 可能因"值可能变"而不持久化收窄。要稳定跨函数用收窄，用**自定义类型谓词**（下一关 ts-guards）。

---

## 八、收窄不会跨函数边界自动传播

```ts
function isBig(n: number | string) {
  return typeof n === "string";        // 返回 boolean，丢失"n 是 string"的信息
}
function use(n: number | string) {
  if (isBig(n)) {
    // n 仍是 number | string —— 普通 boolean 返回不会收窄 n！
  }
}
```

要让"一个函数的判断结果能收窄另一个变量"，必须把它写成**类型谓词** `n is string`（详见 ts-guards）——这是 narrowing 与 guard 的分水岭。

---

## 九、自检清单

- [ ] 收窄是"手动断言"还是"编译器顺控制流自动缩窄"？离开分支会怎样？
- [ ] `typeof x === 'object'` 为什么还要 `&& x !== null`？
- [ ] truthiness 判空和 `!= null` 有何不同？`0`/`''` 是合法值时怎么选？
- [ ] `in`、`instanceof`、`switch(判别字段)` 各自适合什么形状？
- [ ] 为什么普通返回 boolean 的函数不能收窄外部变量？该用什么替代？

---

## 🚀 部署预告

- 收窄是处理 **`unknown` 边界数据**（catch、JSON、postMessage）落到具体类型的关键动作（呼应 ts-any-unknown、Express L5）；
- 跨函数/复杂判定要靠**类型谓词**，下一关 **ts-guards** 会补上"自定义守卫 + 断言函数 + never 穷尽"这块拼图；
- 可辨识联合 + 收窄在 Vue/React 的 reducer、路由守卫里天天用（呼应 ts-frameworks）。

下一关 **ts-guards**——把"是不是某类型"封装成可复用、可跨函数传播的判定。
