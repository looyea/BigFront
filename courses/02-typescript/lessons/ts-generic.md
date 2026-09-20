# 泛型入门

> 目标：**理解泛型是"类型的函数"**——用类型参数 `T` 写可复用又类型安全的抽象，掌握泛型函数/接口/类型别名/类的写法，理解**类型参数推断**与**默认类型参数**，摆脱"为了复用而退化成 `any`"。

---

## 一、为什么需要泛型

需求："返回传入数组的第一个元素"。不用泛型只有两条坏路：

```ts
// 坏路 1：any —— 丢掉类型安全
function firstBad(arr: any[]): any { return arr[0]; }
const x = firstBad(["a"]);    // x: any，后续毫无保护

// 坏路 2：为每种类型写一份重载 —— 不可扩展
function firstStr(a: string[]): string | undefined;
function firstNum(a: number[]): number | undefined;
```

泛型的解法：把"元素类型"变成**参数**，用一个 `T` 占位，调用时才具体化：

```ts
function first<T>(arr: T[]): T | undefined { return arr[0]; }
first(["a"]);     // T 推断为 string → string | undefined
first([1, 2]);    // T 推断为 number
first<boolean>([true]);   // 显式指定 T
```

**泛型 = 在类型层面参数化**，既复用逻辑又保留精确类型。

---

## 二、泛型函数与类型参数推断

```ts
function identity<T>(x: T): T { return x; }

identity(5);            // T = number，返回 number
identity("hi");         // T = string
identity<string>("hi"); // 显式传入 T
```

大多数时候 **TS 会自动推断 `T`**（从实参形状反推），无需手写尖括号。只有推断不出或想强制更宽/更窄时才显式指定。推断能力是泛型好用的关键，也是很多"看起来没写类型却正确"的来源。

多类型参数：

```ts
function pair<A, B>(a: A, b: B): [A, B] { return [a, b]; }
pair(1, "x");           // [number, string]
```

---

## 三、泛型接口与类型别名

```ts
interface Box<T> {
  value: T;
  unwrap(): T;
}
const b: Box<number> = { value: 1, unwrap() { return this.value; } };

interface Pair<A, B> { first: A; second: B }

// 泛型类型别名
type Handler<T> = (payload: T) => void;
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
```

标准库到处是泛型接口：`Array<T>`、`Promise<T>`、`Record<K, V>`、`Map<K, V>`——用它们时你其实一直在消费泛型。

---

## 四、泛型类

```ts
class Stack<T> {
  private items: T[] = [];
  push(item: T) { this.items.push(item); }
  pop(): T | undefined { return this.items.pop(); }
}

const numStack = new Stack<number>();
numStack.push(1);
// numStack.push("a");   // ✗ 这个栈只装 number

const strStack = new Stack<string>();
strStack.push("a");
```

泛型让同一个类对不同元素类型各有一套安全约束。注意：`T` 在运行时被擦除，`new Stack<T>()` 里拿不到 `T`（呼应 ts-intro），要按类型分支得传构造器/工厂（呼应 ts-generic-constraints）。

---

## 五、默认类型参数

给类型参数设默认值，减少调用噪音：

```ts
function create<T extends string = "default">(name: T) { return name; }
create();               // T = "default"
create("hi");           // T = "hi"

interface Response<T = unknown> {    // 不写就是 unknown（安全默认，呼应 ts-any-unknown）
  data: T;
  status: number;
}
const r: Response = { data: null as unknown, status: 200 };
const user: Response<{ id: number }> = { data: { id: 1 }, status: 200 };
```

默认类型参数让 API 在"不关心具体类型"时有合理回退，且默认用 `unknown` 比默认 `any` 更安全。

---

## 六、泛型 vs any：一句话分清

```ts
function echoAny(x: any): any { return x; }     // 调用后信息全丢
function echo<T>(x: T): T { return x; }          // 进什么类型出什么类型，信息保留
```

`any` 是"放弃类型"，泛型是"**用变量代表类型、把关系保留下来**"。凡是你想用 `any` 做"多种类型都能传"的复用场景，第一反应应该是"能不能改成泛型"。

---

## 七、泛型约束预览（预告下一关）

裸 `T` 什么都不知道，不能访问任何属性：

```ts
function longest<T>(a: T, b: T) {
  // a.length    // ✗ T 上不一定有 length
  return a;
}
// 需要约束：T extends { length: number }（详见 ts-generic-constraints）
function longest2<T extends { length: number }>(a: T, b: T) {
  return a.length >= b.length ? a : b;   // ✓ 约束后能访问 length
}
```

约束（`extends`）是泛型真正变强大的开关——下一关专讲。

---

## 八、自检清单

- [ ] 为什么说"泛型是类型的函数"？它和 `any` 的本质区别？
- [ ] 类型参数推断什么时候发生？什么时候需要显式写 `<T>`？
- [ ] 泛型接口/别名/类怎么写？举一个标准库泛型的例子。
- [ ] 默认类型参数有什么用？为什么 `= unknown` 比 `= any` 好？
- [ ] 为什么裸 `T` 不能访问属性？需要什么才能访问？（引出约束）
- [ ] 泛型擦除对运行时判断意味着什么？

---

## 🚀 部署预告

- 泛型是**数据层/请求层复用**的核心：`Response<T>`、`Repository<T>`、`useRequest<T>` 等（呼应 Express、框架课）；
- 库的公共 API 大量靠泛型表达"输入决定输出"，发布时要生成正确的带泛型 `.d.ts`（ts-publish）；
- 真正的威力在**约束**（`extends`/`keyof`）与**条件类型 + infer**——下两关解锁，之后你就能读懂 `Partial`/`Pick` 的源码了。

下一关 **ts-generic-constraints**——用 `extends` 给类型参数加约束，让泛型既能复用又能安全访问成员。
