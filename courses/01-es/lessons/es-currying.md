# 高阶函数、柯里化与组合

> 目标：**把「函数是一等公民」从口号变成手感**——能手写 `curry` / `compose` / `pipe`，能识别框架源码里的高阶函数模式，能判断什么时候值得为「通用性」多写一层抽象。

---

## 一、什么使一个函数「高阶」？

满足**任一**条件即高阶函数（HOF, Higher-Order Function）：
1. **接收函数**作为参数（`map(fn)`、`debounce(fn)`）；
2. **返回函数**作为结果（`curry(fn)`、`memoize(fn)`）；
3. 两者都有（`once(wrap(fn))` 类）。

**核心洞察**：JavaScript 里函数是**一等公民**（第一类值），可以像字符串/对象一样赋值、传参、返回。这带来一整套组合式编程工具。

---

## 二、五种最常见的高阶模式

```js
// 1. 变换集合
[1,2,3].map(x => x * 2).filter(x => x > 2);

// 2. 计时 / 装饰
function time(fn, label = fn.name) {
  return (...args) => {
    console.time(label);
    try { return fn(...args); } finally { console.timeEnd(label); }
  };
}

// 3. 重试
function retry(times, fn) {
  return async (...args) => {
    let lastErr;
    for (let i = 0; i < times; i++) {
      try { return await fn(...args); } catch (e) { lastErr = e; }
    }
    throw lastErr;
  };
}

// 4. once
function once(fn) {
  let called = false, ret;
  return (...args) => called ? ret : ((called = true), (ret = fn(...args)));
}

// 5. 中间件（Express/Koa 内核）
function compose(middlewares) {
  return function (ctx) {
    let i = -1;
    const dispatch = (n) => {
      if (n <= i) return Promise.reject(new Error('next() called multiple times'));
      i = n;
      const fn = middlewares[n];
      if (!fn) return Promise.resolve();
      return Promise.resolve(fn(ctx, () => dispatch(n + 1)));
    };
    return dispatch(0);
  };
}
```

**框架里的高阶函数俯拾皆是**：Redux `applyMiddleware`、React `forwardRef`、Vue `defineComponent`、Express 中间件链、Koa `compose`、`useMemo(fn, deps)`。

---

## 三、柯里化：把 `f(a,b,c)` 变成 `f(a)(b)(c)`

**定义**：**柯里化**（currying）是把多参数函数转换成一系列「一次只吃一个参数、返回下一个函数」的过程。术语来自 Haskell Curry。

```js
const add = (a) => (b) => (c) => a + b + c;
add(1)(2)(3); // 6
```

**为什么要柯里化**：**延迟决策 + 复用部分参数**。
```js
const log = (level) => (msg) => console.log(`[${level}]`, msg);
const info = log('INFO');
const err  = log('ERROR');
info('start');  err('boom');
```

---

## 四、手写通用 curry（**面试高频**）

```js
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) return fn.apply(this, args);
    return (...more) => curried.apply(this, args.concat(more));
  };
}
```

**三条要点**：
1. 用 `fn.length` 判断是否凑齐——**要求原函数有固定数量的形参**（不能是 rest 参数）。
2. `curried` 是 function 而不是箭头，因为要保留 `this`；返回的内层用箭头是**故意**——捕获 curried 的 this。
3. 支持「一次多传几个」的偏应用：`add(1, 2)(3)` 也能跑。

**追问 A**：如何处理 `fn.length` 不可靠（如 `(a, b = 2) => {}` length 是 1）？→ 用占位符：`add(1, _, 3)(2)`。
**追问 B**：`curry` 与 `bind` 的区别？→ bind 只能固定**前缀**参数，且返回的函数不能再 curry；curry 可以任意顺序、任意分次。

---

## 五、组合与管道

**compose（右到左）**：`compose(f, g, h)(x) === f(g(h(x)))`
**pipe（左到右）**：`pipe(f, g, h)(x) === h(g(f(x)))`

```js
const pipe = (...fns) => (x) => fns.reduce((acc, f) => f(acc), x);
const compose = (...fns) => pipe(...fns.reverse());

const add10 = (x) => x + 10;
const double = (x) => x * 2;
const square = (x) => x * x;
const calc = pipe(add10, double, square);
calc(3); // ((3+10)*2)^2 = 676
```

**为什么 pipe 更常用**：阅读顺序符合数据流；compose 学术味重。 lodash/fp、Ramda、rxjs operators 大多用 pipe 风格。

---

## 六、部分应用（Partial Application）：柯里化的近亲

**区别**：
- **柯里化**：`f(a,b,c)` → `f(a)(b)(c)`，**只允许一次一个**。
- **部分应用**：`f(a,b,c)` → `g(b,c)`，**可以一次固定任意数量的参数**。

```js
const multiply = (a, b) => a * b;
const double = multiply.bind(null, 2); // 部分应用：固定第一个
double(5); // 10
```

工程里 **bind / 默认参数 / 箭头包装**都能实现部分应用；柯里化则更强调**通用工具**。

---

## 七、柯里化在真实代码里的三个用途

1. **函数式工具箱**：lodash/fp 全部 API 都自动柯里化——`_.map([1,2,3], x => x*2)` 与 `_.map(x => x*2)([1,2,3])` 都可用，方便 pipe。
2. **依赖注入**：`makeService(config)(logger)(ctx)` 让每一层只关心自己的输入。
3. **测试替身**：`makeHandler({ api })` 返回真正 handler；测试时传假 api，生产传真 api。

**代价**：**类型推断变复杂**（TS 里柯里化函数的推导经常要断言）；**可读性下降**（新手看不懂 `f(a)(b)(c)`）；**运行时开销**（每次都要判 args.length）。**不要柯里化不需要柯里化的函数**。

---

## 八、`tap` / `thunce`？——高阶工具家族

```js
const tap = (fn) => (x) => { fn(x); return x; };       // 副作用插入
const when = (pred, f) => (x) => pred(x) ? f(x) : x;   // 条件
const unless = (pred, f) => when((x) => !pred(x), f);
const always = (x) => () => x;                          // 常量函数
const identity = (x) => x;                              // 单位元
```

Ramda / lodash/fp 里这些是标配。写起来像 DSL，读起来很顺。

---

## 九、自检清单

- [ ] 举出 5 个高阶函数（含至少 2 个框架里的）。
- [ ] 手写 `curry(fn)`，说明如何处理 `this` 与偏应用。
- [ ] 说出柯里化与部分应用的差别。
- [ ] 手写 `pipe(...fns)` 与 `compose(...fns)`。
- [ ] 说出柯里化的 3 个收益与 3 个代价。

---

## 🚀 部署预告（本关点到，细节在 L10）

**高阶函数在构建/运行时会被怎样优化？**

1. **V8 的 inline cache** 对高阶函数的**多态调用点**会退化到 megamorphic——同一个 `map(fn)` 里 fn 形状频繁变化，去优化明显。生产火焰图上常看到 `Array.prototype.map` 慢，八成是回调形状太多。
2. **Tree-shaking 与顶层高阶函数调用**：`const f = pipe(a, b, c)` 有副作用（读了 a/b/c）→ 打包器不会摇掉；`const f = (x) => a(b(c(x)))` 只是箭头嵌套，若未被引用可被摇掉。
3. **Babel 对 curry 无特殊处理**：因为 curry 是运行时行为，不是语法糖——所以柯里化的开销在生产也**不会**被压掉。
4. **minifier 会内联小 lambda**：`x => x * 2` 传给 map 时，esbuild 有时会保留原样，terser 有时会把 `.map(x => x*2)` 改写成 for 循环（`--unsafe` 模式）。**压栈深度与 curry 递归**在 minify 后**不会自动 tail-call 优化**——JS 引擎里 TCO 只在 Safari 严格模式生效，其他都放弃了。

细节 L10 `es-build` 展开。**你现在只需要记住**：**高阶函数是抽象，抽象就要付运行时成本——理解它、控制它、别到处用。**
