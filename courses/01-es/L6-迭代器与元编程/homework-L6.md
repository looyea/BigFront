# L6 作业：元编程

> 覆盖本阶段 3 关：`es-symbol`、`es-iterator`、`es-proxy`。
> 提交方式：读代码题直接答；手写实现放 `homework/L6.answers.js`。

---

## 一、读代码写结果（每题 2 分，共 20 分）

**A1.**
```js
const a = Symbol('k'), b = Symbol('k');
const c = Symbol.for('k'), d = Symbol.for('k');
console.log(a === b, c === d, Symbol.keyFor(a), Symbol.keyFor(c));
```

**A2.**
```js
const obj = { [Symbol.toPrimitive](hint) { return hint === 'number' ? 1 : 'x'; } };
console.log(+obj, `${obj}`, obj + '');
```

**A3.**
```js
console.log(Object.getOwnPropertyNames({ a: 1, [Symbol('s')]: 2 }));
console.log(Reflect.ownKeys({ a: 1, [Symbol('s')]: 2 }));
```

**A4.**
```js
function* g() {
  const a = yield 1;
  const b = yield a + 1;
  return a + b;
}
const it = g();
console.log(it.next().value, it.next(10).value, it.next(5).value);
```

**A5.**
```js
function* a() { yield 1; yield 2; }
function* b() { yield* a(); yield 3; }
console.log([...b()]);
```

**A6.**
```js
const target = { x: 1 };
const p = new Proxy(target, {
  get(t, k) { console.log('G', k); return t[k]; },
  set(t, k, v) { console.log('S', k); t[k] = v; return true; },
});
p.x;
p.y = 2;
console.log('x' in p);
```

**A7.**
```js
const p = new Proxy({ a: 1 }, { has: () => false });
console.log('a' in p, Object.keys(p));
```

**A8.**
```js
const range = {
  from: 1, to: 3,
  *[Symbol.iterator]() { for (let i = this.from; i <= this.to; i++) yield i; },
};
const [x, y] = range;
console.log(x, y, [...range]);
```

**A9.**
```js
class MyArr extends Array {
  static get [Symbol.species]() { return Array; }
}
const m = new MyArr(1, 2, 3);
console.log(m.map(x => x * 2).constructor.name);
```

**A10.**
```js
const frozen = Object.freeze({ v: 1 });
const p = new Proxy(frozen, { get: () => 99 });
try { console.log(p.v); } catch (e) { console.log(e.constructor.name); }
```

---

## 二、手写实现（每题 6 分，共 30 分）

**B1 · range(from, to) 可迭代**：不预生成数组，`for (const x of range(1, 100))` 逐个 yield；`[...range(1,3)]` 得 `[1,2,3]`。

**B2 · take(n, iterable) / mapGen(f, iterable)**：**惰性**——`take(3, mapGen(x=>x*x, naturals()))` 前 3 个平方数；naturals 是无限生成器。

**B3 · observed(obj, cb)**：返回 Proxy；任何属性读写都调用 `cb(op, key, value)`，`op` 是 'get'/'set'/'delete'/'has'。

**B4 · validator(schema)**：接受 `{ age: v => typeof v === 'number', name: v => typeof v === 'string' }`；返回 Proxy，set 时校验，不通过抛 `TypeError`；未定义规则的键**放行**。

**B5 · lazy pipeline**：写 `iter.map(f)` / `iter.filter(pred)` / `iter.take(n)` 三个函数（都用生成器），要求：**未消费前不执行任何计算**。

---

## 三、场景改造（20 分）

**给一个「带缓存与惰性求值的斐波那契」**：
```js
// 用法
const fibs = fib();             // 生成器
const first10 = take(10, fibs); // 惰性取前 10
const fibCached = memoizeGen(fib); // 缓存前 n 个
```

请实现：
1. `function* fib()`：无限斐波那契生成器；
2. `take(n, iterable)`：生成器版；
3. `memoizeGen(genFn)`：**接受**返回生成器的函数，产出一个新函数——同一个实例上重复迭代时缓存已 yield 的项；不同实例仍独立。

**追问**：`for-await-of` 版本怎么写（模拟异步拉取）？

---

## 四、面试简答（每题 6 分，共 18 分）

**Q1**：Symbol 键在 `Object.keys` / `for-in` / `JSON.stringify` 里都不可见——那 Symbol 是不是「真私有」？和 ES2022 `#field` 相比差在哪？

**Q2**：`for-of` 里的 `break` 会调用迭代器的 `return` 方法；解释生成器里 `finally { ... }` 与 `it.return()` 的关系。

**Q3**：Vue 3 为什么用 Proxy 而不是 defineProperty？「无法 polyfill」的根源是什么？

---

## 五、拓展挑战（12 分，选做）

用 **Proxy + 生成器 + Symbol** 写一个 mini redux-saga：
- `run(function* () { const r = yield call(fetch, url); yield put({ type: 'OK', r }); })`
- `call(fn, ...args)` 返回 `{ type: 'CALL', fn, args }` 这样的 effect 对象；
- 调度器在生成器 next 里遇到 CALL 时执行 `fn(...args)` 并 `next(结果)` 回填；
- 遇到 PUT 时把 action 派发到外部 store。

**追问**：`yield*` 在这里能扮演什么角色（把子 saga 组合起来）？

---

## 我的答案（作答区）

（待补）
