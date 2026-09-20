# L8 作业：异步编程

> 覆盖本阶段 4 关：`es-callback`、`es-promise`、`es-async`、`es-event-loop`。
> 提交方式：读代码题直接答；手写实现放 `homework/L8.answers.js`。

---

## 一、读代码写结果（每题 2 分，共 20 分）

**A1.**
```js
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
queueMicrotask(() => console.log('4'));
console.log('5');
```

**A2.**
```js
async function foo() {
  console.log('a');
  await bar();
  console.log('b');
}
async function bar() { console.log('c'); }
foo();
console.log('d');
```

**A3.**
```js
Promise.resolve(1)
  .then(v => { console.log(v); throw new Error('E'); })
  .then(() => console.log('never'))
  .catch(e => { console.log(e.message); return 2; })
  .then(v => console.log(v));
```

**A4.**
```js
const p = new Promise((resolve, reject) => {
  resolve(1);
  reject(2);
  resolve(3);
});
p.then(v => console.log('ok', v)).catch(e => console.log('err', e));
```

**A5.**
```js
const [a, b, c] = await Promise.allSettled([
  Promise.resolve(1),
  Promise.reject('E'),
  new Promise(() => {}),   // 永不 settle
]);
console.log(a, b, c);
```
—— 会发生什么？

**A6.**
```js
// Node 里
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
```
顺序**确定吗**？为什么？

**A7.**
```js
async function a() { return 1; }
async function b() { const v = await a(); return v + 1; }
b().then(console.log);
setTimeout(console.log.bind(null, 'timeout'), 0);
```

**A8.**
```js
Promise.resolve().then(() => console.log('m1'))
  .then(() => Promise.resolve().then(() => console.log('m3')));
Promise.resolve().then(() => console.log('m2'));
```

**A9.**
```js
try {
  await Promise.all([
    Promise.reject(new Error('A')),
    new Promise((_, rej) => setTimeout(() => rej(new Error('B')), 10)),
  ]);
} catch (e) { console.log(e.message); }
```
—— 打印什么？B 会**变成 unhandledrejection** 吗？

**A10.**
```js
const p = new Promise((resolve) => {
  setTimeout(() => { throw new Error('boom'); }, 0);
  resolve('ok');
});
p.catch(e => console.log('caught', e));
```

---

## 二、手写实现（每题 6 分，共 30 分）

**B1 · 手写迷你 Promise**（不用 thenable 递归解开）：支持 constructor / then / catch / finally；执行器里 throw 自动 reject；state 只能从 pending 变。

**B2 · 手写 `Promise.all`**：任一 reject 立即 reject；空数组立即 fulfill 空数组；输入含非 Promise 要包装。

**B3 · 手写 `Promise.race`** 与 `Promise.any`（用 all 或 allSettled 组装不算；要从 `new Promise` 开始）。

**B4 · 手写 `sleep(ms)` + `retry(fn, { times, backoff })`**：失败时按 `100, 200, 400, ...` 指数退避重试。

**B5 · 手写 `mapLimit(items, limit, asyncWorker)`**：并发不超过 limit；输出保持原顺序；一个失败不影响其它。

---

## 三、场景改造（20 分）

**给一个「批量下载 100 张图片，最多 5 张并发，实时显示进度，失败不影响其它，最后打包 zip」**的场景：

请写出核心 `async function downloadAll(urls, onProgress)`：
1. **并发不超过 5**；
2. 每完成一个（无论成败）调 `onProgress(done, total)`；
3. 单个失败**不中断**整批；
4. 返回 `{ ok: Blob[], fail: { url, err }[] }`；
5. **取消**：`onProgress` 返回值若是 `{ abort: true }`，立刻停剩余任务并返回已完成部分（用 AbortController 或 flag）。

**追问**：如何加**单张 5 秒超时**？

---

## 四、面试简答（每题 6 分，共 18 分）

**Q1**：画出浏览器事件循环一 tick 的完整流程（含宏任务、微任务、渲染）。

**Q2**：`Promise.race` 与 `Promise.any` 的区别？给一个 all / race / any 都不合适、只能用 allSettled 的场景。

**Q3**：什么是 Floating Promise？ESLint 有哪个规则可以拦？为什么生产环境**必须**注册 `unhandledrejection`？

---

## 五、拓展挑战（12 分，选做）

**用 Generator + 自动执行器手写一个「不用 async 关键字」的 async 语法糖**：

```js
function co(genFn) {
  // 你的实现：返回一个函数，调用后返回 Promise
  // 内部：new Generator，每次 next 得到 { value, done }；
  // 把 value 用 Promise.resolve 包，then(v => gen.next(v)) 递归；
  // reject 时用 gen.throw(e)；done 时 resolve(y.value)。
}

const main = co(function* () {
  const a = yield fetchA();
  const b = yield fetchB();
  return a + b;
});
main().then(console.log);
```

**追问**：co 的 yield 支持数组吗（模拟并行）？（提示：`Array.isArray(y.value) → Promise.all(y.value)`）。

---

## 我的答案（作答区）

（待补）
