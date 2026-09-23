# L3 作业：函数进化

> 覆盖本阶段 3 关：`es-arrow`、`es-params`、`es-currying`。
> 提交方式：读代码题直接答；手写实现放 `homework/L3.answers.js`；简答写在本文件末尾。

---

## 一、读代码写结果（每题 2 分，共 20 分）

**A1.**
```js
const obj = { n: 1, get() { return () => this.n; } };
const g1 = obj.get();
const g2 = obj.get.call({ n: 99 });
console.log(g1(), g2());
```

**A2.**
```js
const f = (a = 1, b = a + 1) => [a, b];
console.log(f(), f(10), f(undefined, 5));
```

**A3.**
```js
function foo(...args) { return args.length; }
console.log(foo(), foo(1), foo(1, 2, 3));
```

**A4.**
```js
const a = { x: 1, get y() { return this.x * 2 } };
const b = { ...a };
console.log(b.x, b.y, Object.getOwnPropertyDescriptor(b, 'y').get);
```

**A5.**
```js
const arr = [1, 2, 3, 4, 5];
const [head, ...tail] = arr;
const merge = (...xs) => xs.flat();
console.log(head, tail, merge(arr, [6, 7]));
```

**A6.**
```js
function add(a) {
  let s = a;
  const f = (x) => { s += x; return f; };
  f.toString = () => s;
  return f;
}
console.log(String(add(1)(2)(3)));
```

**A7.**
```js
const pipe = (...fns) => (x) => fns.reduce((a, f) => f(a), x);
const t = pipe((n) => n + 1, (n) => n * 2);
console.log(t(5));
```

**A8.**
```js
const counter = (n = 0) => (n);
console.log(counter(), counter(5));
```

**A9.**
```js
let x = 1;
function f(x = 2, y = x) { return [x, y]; }
console.log(f(), f(3), f(3, 4));
```

**A10.**
```js
function once(fn) {
  let v;
  return (...a) => v === undefined ? (v = fn(...a)) : v;
}
let n = 0;
const inc = once(() => ++n);
console.log(inc(), inc(), inc(), n);
```

---

## 二、手写实现（每题 6 分，共 30 分）

**B1 · curry(fn)**：支持 `fn(a)(b)(c)`、`fn(a, b)(c)`、`fn(a)(b, c)` 三种分次形式；`this` 与 `fn.length` 都要保留。

**B2 · pipe / compose**：两个都用 reduce 实现；`pipe` 是左到右，`compose` 是右到左；两者互为逆序。

**B3 · once**：只运行一次；追问——第一次抛错时是否保留 called 状态？给出你的选择并解释。

**B4 · memoize(fn)**：Map 缓存 + 支持 `.cache` / `.clear()`；对象参数版本用 WeakMap 改写一版。

**B5 · retry(times, fn)**：异步 fn 失败最多重试 times 次；给出「指数退避」（每次多等 2^n × 100ms）版本。

---

## 三、场景改造（20 分）

有一个「配置驱动」的表单验证函数：
```js
function validate(value, rules) {
  const errs = [];
  for (const r of rules) {
    const e = r(value);
    if (e) errs.push(e);
  }
  return errs;
}
```

请：
1. 用柯里化 + 组合写成 `rule.required(value)` / `rule.minLength(5)(value)` / `rule.pattern(/^\d+$/)(value)` 三种规则；
2. 用 `pipe` 组合规则；
3. 用一个 `everyRule(...rules)` 高阶函数**替代** for 循环。

**追问**：为什么这样写方便单元测试？

---

## 四、面试简答（每题 6 分，共 18 分）

**Q1**：箭头函数不能做哪 4 件事？分别给一个「如果硬要」会怎么翻车的例子。

**Q2**：`{...obj}` 与 `Object.assign({}, obj)` 的语义差异，从 getter、Symbol、setter 三个角度答。

**Q3**：柯里化的收益与代价各说 3 条；你的项目里会不会全面上柯里化？为什么？

---

## 五、拓展挑战（12 分，选做）

写一个 `middleware(...handlers)`（**Koa 风格**，洋葱模型）：
- 每个 handler 是 `async (ctx, next) => { /* 前段 */ await next(); /* 后段 */ }`。
- 输出顺序：外层前 → 内层前 → 内层后 → 外层后。
- 处理 next 被多次调用的错误。

**追问**：如何加入超时（超过 3 秒直接 reject）？

---

## 我的答案（作答区）

（待补）
