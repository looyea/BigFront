# 迭代器协议与生成器

> 目标：**吃透两个协议**——**可迭代协议**（Iterable）与**迭代器协议**（Iterator）；理解 `for-of` / 展开 / `Array.from` / 解构**背后的同一套机制**；掌握 `function*` 生成器语法与 `yield*` 委托；能手写无限迭代器、惰性求值管道。

---

## 一、两个协议：**Iterable** vs **Iterator**

**Iterable（可迭代）**：对象上有 `[Symbol.iterator]()` 方法，**每次调用返回一个 Iterator**。数组、字符串、Map、Set、TypedArray、NodeList、arguments 都是。

**Iterator（迭代器）**：一个**状态机**对象，有 `next()` 方法，每次返回 `{ value, done }`。

```js
// 目的：一个 Iterable 每次调 [Symbol.iterator] 生产一个一次性 Iterator，逐步 next 到 done
const arr = [1, 2];
const it = arr[Symbol.iterator]();   // it 是 Iterator

it.next();  // { value: 1, done: false }
it.next();  // { value: 2, done: false }
it.next();  // { value: undefined, done: true }
it.next();  // 永远 { value: undefined, done: true }（幂等）
```

**⚠️ Iterator 是**一次性**的**——走完不会自动重置。想再来一次必须**再调 `[Symbol.iterator]()`** 拿新的。

---

## 二、`for-of` 的展开伪代码

```js
// 目的：for-of 本质就是下面的手写循环——拿 iterator、循环 next、done 则 break
for (const x of iterable) { body }
// 大致等价：
const it = iterable[Symbol.iterator]();
for (;;) {
  const { value, done } = it.next();
  if (done) break;
  const x = value;
  body;
}
```

**这就解释了为什么**：
- 展开 `[...iterable]` = 循环 push 到数组；
- 解构 `const [a, b] = iterable` = 调 `it.next()` 两次；
- `Array.from(iterable)` = 走 iterator + 可选 mapFn；
- `new Map(kvs)` / `new Set(iterable)` = 遍历收集；

**都是同一套协议**。**自定义对象只要挂 `[Symbol.iterator]` 就能被所有这些语法/函数消费**。

---

## 三、手写 Iterable：三种风格

**风格 1：返回数组迭代器**
```js
const range = {
  from: 1, to: 5,
  [Symbol.iterator]() {
    let cur = this.from;
    const end = this.to;
    return {
      next() {
        return cur <= end ? { value: cur++, done: false } : { value: undefined, done: true };
      },
    };
  },
};
[...range];   // [1,2,3,4,5]
```

**风格 2：用生成器（推荐，简洁）**
```js
// 目的：生成器版本——* 方法自动满_iterator，代码更短（与风格1行为一致）
const range = {
  from: 1, to: 5,
  *[Symbol.iterator]() {
    for (let i = this.from; i <= this.to; i++) yield i;
  },
};
// ✅ 应用：同样能被 for-of / 展开 / Array.from 消费
[...range];               // [1,2,3,4,5]
Array.from(range);         // [1,2,3,4,5]（range 已是 Iterable）
```

**风格 3：只可迭代一次 vs 多次**——上例每次 `[Symbol.iterator]()` 都新状态，可多次遍历；如果把状态挂 `this` 上就只可一次（危险）。

---

## 四、生成器 `function*`：可中断的函数

**核心机制**：`function*` 的调用不执行函数体，而是返回一个 **Generator 对象**（既是 Iterator 又是 Iterable）。每次 `.next()` **执行到下一个 yield 暂停**，把值传出；`.next(v)` 又能把 v **注回**到函数内部（`yield` 表达式的求值结果）。

```js
// 目的：可中断函数——每次 next(v) 把 v 注回上一个 yield 表达式，然后跑至下一个 yield
function* counter() {
  let n = 0;
  while (true) {
    const reset = yield n++;    // 暂停；下一次 next(v) 的 v 就是 reset
    if (reset) n = 0;
  }
}
const c = counter();
c.next().value;      // 0  （首跑至 yield，n++ 后置返回 0，n 变 1）
c.next().value;      // 1  （reset=undefined，不重置；yield n++ 返回 1，n 变 2）
c.next(true).value;  // 0  （注入 true→reset=true→n 归 0→yield n++ 返回 0，n 变 1）
c.next().value;      // 1  （n=1 返回后变 2）
```

**（追问）**：`next(true)` 那一轮先把 `reset` 接为 true、`n` 归零，**然后才**执行下一句 `yield n++`——因后置自增，返回的是归零后的 **0**（而不是旧值 1）。输出序列为 `0, 1, 0, 1`。**这就是生成器最容易搞混的地方**。

**Generator 是 Iterable**：
```js
// 目的：Generator 对象自身也是 Iterable（[Symbol.iterator] 返回自己），能直接展开
function* gen() { yield 1; yield 2; }
const g = gen();
g[Symbol.iterator]();   // 返回自己
[...g];                   // [1, 2]（但 g 已耗尽）
```

---

## 五、`yield*`：**委托**给另一个可迭代对象

```js
// 目的：yield* 把输出委托给另一个可迭代/生成器，逐个转发
function* a() { yield 1; yield 2; }
function* b() { yield 0; yield* a(); yield 3; }
[...b()];   // [0, 1, 2, 3]
```

**`yield*` 语义**：把右边的 iterator 逐个 next 转发；且 next(v) / throw(err) 都会**透传**给被委托的 iterator——**协程链**由此实现。Redux-saga 的 `yield*` 就是这套。

---

## 六、迭代器与惰性求值

生成器天生**惰性**——不 next 就不执行：

```js
// 目的：惰性求值管道——naturals 无限、map/take 按需消费，不 next 不执行
function* naturals() { let n = 0; while (true) yield n++; }
function* take(n, it) { for (const x of it) { if (n-- <= 0) return; yield x; } }
function* map(f, it)   { for (const x of it) yield f(x); }

// 前 10 个平方数
const s = take(10, map(x => x * x, naturals()));
[...s];   // [0, 1, 4, 9, ..., 81]
```

**这就是 RxJS / Iterator helpers (proposal-iterator-helpers) 的雏形**。Chrome 里已经能直接 `it.map(x => x*2).take(10)`。

---

## 七、`Iterator` 的 return / throw：**协议完整面**

```js
// 目的：Iterator 协议的完整形状——return/throw 可选，供提前退出时清理资源
const it = {
  next() { /* ... */ },
  return(v) { console.log('cleanup'); return { value: v, done: true }; },   // 可选
  throw(err) { /* ... */ return { value: undefined, done: true }; },        // 可选
};
```

**for-of 会触发 return**：
- **正常结束**（next 返回 done:true）—— 不触发 return；
- **提前 break / throw / return** —— **触发** `it.return()`，让迭代器**清理资源**。

生成器里对应 `finally { ... }`：
```js
// 目的：for-of 里 break 会触发迭代器的 return，生成器里的 finally 负责清理
function* files() {
  try {
    yield 'a'; yield 'b'; yield 'c';
  } finally {
    console.log('cleanup');
  }
}
for (const f of files()) { if (f === 'b') break; }
// 打印：a, b, cleanup
```

---

## 八、`for-await-of` 与 `Symbol.asyncIterator`

异步版协议：`[Symbol.asyncIterator]()` 返回的对象，`next()` **返回 Promise**：

```js
// 目的：异步版迭代——[Symbol.asyncIterator] 的 next 返回 Promise，for-await 串行拉取
async function* fetchPages() {
  for (let i = 1; i <= 3; i++) {
    yield await fetch(`/api/page/${i}`).then(r => r.text());
  }
}
for await (const page of fetchPages()) { console.log(page.length); }
```

**用途**：Stream API（Node、Web）、EventEmitter 转异步队列、SSE / WebSocket 消息流。**关键**：`for-await` **串行**——每条 await 完成才要下一条；要并发用 `Promise.all + for-of` 或流式并发库。

---

## 九、`Array.from` 与 `mapFn`：为什么需要它

```js
// 目的：Array.from 同时吃类数组与可迭代，第二个参数 mapFn 边转边映射
Array.from({ length: 3 }, (_, i) => i * i);   // [0, 1, 4]
Array.from('abc');                              // ['a','b','c']
Array.from(new Set([1,2,3]));                   // [1,2,3]
```

**Array.from 接收**：① 类数组（有 `length` + 索引）；② 可迭代对象。**Array.from 走 iterator**，所以稀疏数组会被填 undefined；`[...arr]` 同理。

---

## 十、自检清单

- [ ] 说出 Iterable 与 Iterator 的关系（前者生产后者）。
- [ ] 手写 `[Symbol.iterator]` 让自定义对象能被 `for-of` / 展开 / 解构消费。
- [ ] 解释 `yield n++` 与 `yield ++n` 的区别，以及 next(v) 注入的位置。
- [ ] 说出 `yield*` 与手动 for-of-yield 的差别（**能透传 next 参数与 throw**）。
- [ ] `for-of` 里 `break` 时迭代器的 `return` 方法何时被调用？
- [ ] `for-await-of` 与 `for-of + await` 的性能语义差别。

---

## 🚀 部署预告（本关点到，细节在 L10）

**迭代器与生成器在构建/运行时会被怎样处理？**

1. **生成器降级**：Babel `@babel/plugin-transform-regenerator` 把 `function*` 编译成**状态机 + runtime**——引入 `regenerator-runtime`（约 5KB gzip），代码体积翻 3-5 倍。**移动端 target** 尤其要注意，能不用生成器就不用（改用 async/await 更常见）。
2. **for-of 降级**：转成 `try { var _i = arr[Symbol.iterator](); ... }`——**每步 next()** 都有开销。Babel `loose` 模式下对 Array 用 `for (var i=0;i<arr.length;i++)` 兜底——但失去 Set/Map 支持。
3. **展开降级**：`[...x]` → `_toConsumableArray(x)` 走 `Array.from` 或手动 slice——**性能有差**。
4. **`for-await-of` 与 async generators**：`@babel/plugin-proposal-async-generator-functions`，产物引入 async generator helper，体积再加。
5. **Iterator helpers 提案**（`.map/.filter/.take`）：**没有降级方案**，只有新版 V8 / SpiderMonkey 支持——target 老环境只能走 polyfill 库 `iterator-helpers-polyfill`。

细节 L10 `es-build` 展开。**你现在只需要记住**：**生成器是「JS 里最贵的语法糖」——每次 `function*` 都要背 regenerator 的运行时；能 async/await 就别 generator。**
