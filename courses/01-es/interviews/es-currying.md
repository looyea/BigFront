# 面试题 · 高阶函数、柯里化与组合

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）什么是高阶函数？举 5 个 JavaScript 里的高阶函数（含至少 2 个框架 API）。**
- 参考要点：接收或返回函数。原生：Array.map/filter/reduce、setTimeout、Promise.then。框架：React.forwardRef、Redux.applyMiddleware、Koa.compose、Express.use、Vue.defineComponent。
- 来源：MDN《Higher-order function》；javascript.info《Function, the basics》。

---

**2）现场手写 `curry(fn)`：一个 N 元函数变成可以任意分次调用的柯里化函数。追问：`fn.length` 在带默认值/rest 时如何失效？**
- 参考要点：
  ```js
  function curry(fn) {
    return function curried(...args) {
      if (args.length >= fn.length) return fn.apply(this, args);
      return (...more) => curried.apply(this, args.concat(more));
    };
  }
  ```
  `fn.length` 只计算**第一个默认值之前**的形参数；带 rest 时 rest 不计。→ 需要显式传 arity 或用占位符。
- 来源：javascript.info《Currying》；dmitripavlutin.com《Currying in JavaScript》；GreatFrontEnd 手写题。

---

**3）柯里化与部分应用有什么区别？给一个「柯里化更合适」和一个「部分应用更合适」的场景。**
- 参考要点：柯里化是**每次吃一个**，可以任意顺序、任意次；部分应用一次固定**任意数量**前缀。柯里化适合构建 DSL 与 pipe 风格；部分应用适合简单参数复用（bind）。
- 来源：SitePoint《Currying vs Partial Application》；StackOverflow 高票。

---

**4）手写 `pipe` 与 `compose`。**
- 参考要点：
  ```js
  const pipe    = (...fns) => (x) => fns.reduce((a, f) => f(a), x);
  const compose = (...fns) => (x) => fns.reduceRight((a, f) => f(a), x);
  ```
  **追问**：如何处理**多初始参数**的 pipe？→ `(...init) => fns.reduce((acc, f) => Array.isArray(acc) ? f(...acc) : f(acc), init)`（Ramda pipe 就是这个语义）。
- 来源：Ramda 源码；lodash/fp flow 文档；You Don't Know JS 类型卷。

---

**5）以下代码打印什么？**
```js
const add = curry((a,b,c) => a+b+c);
const partial = add(1);
const complete = partial(2, 3);
console.log(complete);
```
- 参考要点：6。通用 curry 允许一次传多个参数（因为 `args.concat(more)` 会累加）。这与「严格一元柯里化」有区别。
- 来源：javascript.info《Currying partial application》。

---

**6）手写 `once(fn)`：函数只能被调用一次，之后每次调用都返回第一次的结果。**
- 参考要点：
  ```js
  function once(fn) {
    let called = false, ret;
    return function (...args) {
      if (called) return ret;
      called = true;
      ret = fn.apply(this, args);
      return ret;
    };
  }
  ```
  **追问**：如何处理 `this` 与参数透传？如何处理抛错情况（第一次抛错应不应该保留 called=true）？—— 通常**不保留**（下次仍会尝试调用），因为「成功过一次」才是 once 的语义。lodash.once 就是这个行为。
- 来源：lodash.once 源码；MDN 相关。

---

**7）以下代码打印什么？**
```js
function logger(level) {
  return (...args) => console.log(`[${level}]`, ...args);
}
const warn = logger('WARN');
warn('disk', 80, 'full');
```
- 参考要点：`[WARN] disk 80 full`。这是柯里化 + rest 的常见配合，形成「配置 → 使用」的两阶段。
- 来源：多份中文八股；Smashing Magazine 函数式专题。

---

**8）Koa 的 `compose(middlewares)` 是怎么实现的？为什么需要「防止多次 next」？**
- 参考要点：核心 dispatch(n) 递归调用第 n 个中间件，把 dispatch(n+1) 包成 `next` 传入。防止多次 next：`if (n <= index) return Promise.reject(...)`——同一中间件多次 next 会让下游重复运行，产生不可预测副作用。
- 来源：Koa 源码 `lib/compose.js`；koa 官方文档「Middleware HOWTO」。

---

**9）说出柯里化的 3 个收益与 3 个代价。**
- 参考要点：收益——参数复用、延迟决策、pipe 友好、依赖注入清晰。代价——类型推断变复杂（TS 常常要断言）、可读性下降（新手懵）、运行时开销（每次判长度、闭包分配）。
- 来源：Ramda 官方 FAQ《Why is currying a big deal》；2ality《Currying in ES6》。

---

**10）在 React 里，`useMemo(() => expensiveFn(a, b), [a, b])` 与「柯里化 + 缓存」的关系是什么？**
- 参考要点：都是「把依赖前置成参数、把结果延迟到实际需要时」的思路。柯里化在纯函数层面做参数分区，useMemo 在渲染层面做结果缓存。两者互补：柯里化后 `const f = prep(a)(b)` 天然适合 memo 掉 `prep(a)`。
- 来源：React 官方 `useMemo` 文档；overreacted.io《A Complete Guide to useMemo》。

---

**11）写一个 `tap(fn)`：把值传进副作用函数但不改变流水线。**
```js
pipe(
  (x) => x * 2,
  tap(console.log),   // 记录中间值
  (x) => x + 1,
)(3);
```
- 参考要点：`const tap = (fn) => (x) => { fn(x); return x; };`。**追问**：如何支持异步 tap？→ 返回 `(x) => Promise.resolve(fn(x)).then(() => x)`。
- 来源：Ramda `R.tap`；lodash/fp `tap`。

---

**12）如果面试官让你**不用 curry**实现 `add(1)(2)(3)` 得 6，怎么办？如果再加 `add(1)(2)(3)()` 结束调用呢？**
- 参考要点：
  ```js
  // 变体：不定长 add(1)(2)(3) 得 6
  function add(a) {
    return function (b) {
      return function (c) { return a + b + c; };
    };
  }
  // 不定长：用 valueOf/toPrimitive
  function add(a) {
    let sum = a;
    const f = (x) => { sum += x; return f; };
    f.valueOf = () => sum;
    f.toString = () => String(sum);
    return f;
  }
  console.log(+add(1)(2)(3)); // 6
  ```
- 来源：StackOverflow《Implement add(2)(3)(4) in JavaScript》高票；多份中文八股。
