# 函数类型、可选参数与重载

> 目标：**掌握 TS 描述函数的全部语法**——函数类型表达式、可选/默认/剩余参数、`this` 类型、函数重载签名，以及函数参数在结构化类型下的**双向协变**兼容规则。

---

## 一、函数类型两种写法

```ts
// 1) 声明式：参数与返回都标注
function add(a: number, b: number): number { return a + b; }

// 2) 函数类型表达式（type/interface 命名，便于复用/传回调）
type Adder = (a: number, b: number) => number;
const add2: Adder = (a, b) => a + b;   // 上下文推断，参数无需再标
```

上下文推断的红利：当变量已被标注为函数类型，实现里的参数类型可省略（`add2` 的 `a/b` 自动是 `number`）。回调传参同理：`nums.map(n => n * 2)` 里 `n` 由 `map` 签名推断。

---

## 二、可选参数 `?`、默认参数、剩余参数

```ts
function greet(name: string, title?: string) {   // title: string | undefined
  return title ? `${title} ${name}` : name;
}

function area(w: number, h: number = w) {         // 默认参数：可省且类型已知
  return w * h;
}

function sum(...nums: number[]): number {         // 剩余参数：数组类型
  return nums.reduce((a, b) => a + b, 0);
}
```

规则：
- 可选参数后**不能再跟必选参数**（除非用默认值，默认值参数天然可省）；
- 有多个可选/默认参数时，调用要用**命名对象参数**更清晰（见第六节模式）；
- 剩余参数只能是最后一个，类型写成数组或元组。

---

## 三、`void` 返回与回调

```ts
type Cb = (n: number) => void;
function each(nums: number[], cb: Cb) { for (const n of nums) cb(n); }

// 传一个"其实有返回值"的回调也合法（返回值被忽略）——呼应 ts-any-unknown
each([1, 2], n => console.log(n));        // console.log 返回 void
each([1, 2], n => n * 2);                 // ✓ 返回 number 也被允许，因为期望 void
```

期望 `=> void` = "我不关心返回值"，所以任何返回类型的函数都能充当该回调位。

---

## 四、`this` 类型

TS 里的 `this` 是**第一个特殊"参数"**，可标注，仅用于类型检查、擦除后不存在：

```ts
// 用 this: void 强制"必须以普通函数方式调用"，防丢失 this 绑定
function getThis(this: void) { return this; }

// 显式声明 this 形状，便于回调/链式
class Counter {
  n = 0;
  inc(this: Counter) { this.n++; return this; }
}
const c = new Counter();
c.inc().inc();          // ✓

// 避免 this 丢失：箭头函数或明确 this 参数
```

`this` 参数常见于：DOM 回调库、要求"别把方法当普通函数调用"的 API。现代 React 组件里也常用 `this: void` 约束（呼应 ts-frameworks）。

---

## 五、函数重载（overload signatures）

当"参数形态不同 → 返回类型不同"，联合参数表达不了这种关联，用**重载签名**：

```ts
function fib(n: number): number;
function fib(n: string): string;         // 输入 number 出 number，输入 string 出 string
function fib(n: any): any {              // 实现签名（对外不可见）
  return typeof n === "number" ? n * n : String(n);
}

fib(5);       // number ✓
fib("5");     // string ✓
// fib(true); // ✗ 没有匹配的重载
```

要点：
- 上面是**声明签名**（对外契约），最后一个是**实现签名**（调用者看不到）；
- 按**从上到下**顺序匹配，越具体的放前面；
- 实现签名参数常写得比所有声明更宽（`any` 或联合），内部再区分。

```ts
// 更实际的例子：根据是否传 callback 决定返回同步值还是 Promise
function read(p: string): string;
function read(p: string, cb: (s: string) => void): void;
function read(p: string, cb?: (s: string) => void): string | void {
  const s = "content";
  if (cb) { cb(s); return; }
  return s;
}
```

**能用联合/泛型/条件类型表达时优先不用重载**——重载的可维护性较差（见第七节）。

---

## 六、实用模式：用对象参数取代长位置参数

```ts
// 反例：一堆可选位置参数，调用时满是 undefined
function connect(host: string, port?: number, ssl?: boolean, timeout?: number) {}
connect("h", undefined, true);          // 可读性差

// 正例：命名对象参数，可选字段一目了然
type ConnOpts = { host: string; port?: number; ssl?: boolean; timeout?: number };
function connect2(o: ConnOpts) {}
connect2({ host: "h", ssl: true });      // ✓ 清晰、可扩展、不受顺序影响
```

对象参数是社区公认的"多于两个参数就改用对象"实践，配合 `satisfies`/解构默认值很顺手。

---

## 七、函数兼容性与双向协变

结构化类型下，"一个函数能否赋给某函数类型"看：
- **参数**：调用方传的参数个数 ≤ 被赋函数期望的个数即可（少收参数是允许的，常见于回调忽略多余参数）；
- **参数类型**：现代 TS 对参数采用**双向协变**（既允许更宽也倾向允许更窄的合理情形），返回类型则要求**协变**（返回更具体子类型可赋给返回较宽类型的函数）；
- `strictFunctionTypes` 会把函数参数检查收紧为**逆变**（更安全，但方法声明语法不受其约束——这是经典坑，详见 ts-strict）。

```ts
type Fn = (a: Animal) => void;
const f1: Fn = (a: Dog) => {};    // strictFunctionTypes 下：✗（Dog 比 Animal 窄，不安全）
const f2: Fn = (a: Animal) => {}; // ✓
```

---

## 八、自检清单

- [ ] 函数类型表达式 `(a: number) => void` 和带返回标注的声明有何区别？上下文推断省了什么？
- [ ] 可选参数、默认参数、剩余参数各自的顺序与位置限制？
- [ ] 为什么"有返回值的函数"能传给期望 `=> void` 的回调位？
- [ ] `this` 参数是干嘛的？`this: void` 起什么约束作用？
- [ ] 重载的三个"坑"：匹配顺序、实现签名可见性、什么时候宁可用泛型？
- [ ] 参数双向协变、返回协变，`strictFunctionTypes` 改变了什么？

---

## 🚀 部署预告

- **对象参数模式**是配置类 API、库选项的统一入口（呼应 ts-declarations 里库的 options 类型、Express 中间件选项）；
- 函数类型与重载是 **泛型约束/条件类型推断返回**的基础（ts-generic、ts-conditional-infer）；
- `strictFunctionTypes` 与"方法 vs 函数属性"的兼容性差异会在 **ts-strict** 专门拆解。

下一关进入 **L3**——先讲 **ts-union**：联合与交叉类型、字面量联合与可辨识联合。
