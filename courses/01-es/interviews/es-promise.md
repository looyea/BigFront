# 面试题 · Promise

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）Promise 解决了哪三件事？**
- 参考要点：① 把「未来值」**对象化**——可传递/存储/组合；② 把回调**扁平化**——`.then().then()` 消灭嵌套；③ **统一错误传播**——链尾 `.catch` 兜底像同步 throw。核心：**Promise 是回调的语法糖 + 状态机**。
- 来源：MDN Promise；Jake Archibald 2013 经典演讲《Promise in Practice》。

---

**2）Promise 的三条不变式是什么？**
- 参考要点：① 状态只能从 **pending** 变；② 只能变**一次**（再 resolve/reject 无效）；③ 值/理由**锁定**（不能事后修改）。这是 Promise **可预测**的根基。
- 来源：Promises/A+ 规范；ECMA-262 §27.2。

---

**3）`.then(v => { throw new Error() })` 后，下游的 `.then` 与 `.catch` 分别发生什么？**
- 参考要点：throw 让**返回值**变成 rejected 的新 Promise；下游 `.then(onOk, onErr)` 里的 **onOk 被跳过**，直到遇到 `.catch` 或带 onErr 的 then 才继续。**catch 相当于 `then(null, onErr)` 的语法糖**。
- 来源：Promises/A+；MDN。

---

**4）`Promise.all` / `allSettled` / `race` / `any` 各自适用场景？**
- 参考要点：
  - **all**：并行、**全成功才有意义**（比如首屏所有资源加载完）；
  - **allSettled**：**部分失败也要跑完**（批量上传、埋点、监控）；
  - **race**：**超时兜底**（fetch + timer）、竞速（多 CDN 谁先返回）；
  - **any**：**多路备援**（主源失败自动切备用），全失败抛 AggregateError。
- 来源：MDN；TC39 promise-any 提案。

---

**5）以下代码打印什么？**
```js
Promise.resolve().then(() => console.log('p1'));
queueMicrotask(() => console.log('qm'));
setTimeout(() => console.log('st'));
Promise.resolve().then(() => console.log('p2'));
console.log('sync');
```
- 参考要点：`sync → p1 → p2 → qm → st`。同步跑 sync；微任务队列按入队顺序跑 p1、p2、qm；宏任务最后。
- 来源：StackOverflow 高票；前端各大厂笔试题。

---

**6）如何**用 Promise 实现 5 秒超时**？AbortController 又怎么用？**
- 参考要点：
  ```js
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
  } catch (e) {
    if (e.name === 'AbortError') console.log('超时');
  } finally { clearTimeout(timer); }
  ```
  现代写法：`fetch(url, { signal: AbortSignal.timeout(5000) })`。
- 来源：MDN `AbortController`；web.dev。

---

**7）unhandledrejection 是什么？怎么处理？**
- 参考要点：Promise 被 rejected 但链尾**没人 `.catch`**——浏览器/Node 会派发 `unhandledrejection` 事件。**生产必注册**：`window.addEventListener('unhandledrejection', e => { report(e.reason); e.preventDefault(); })`。Node 里 `process.on('unhandledRejection', ...)`；**Node 15+ 默认让进程 crash**。
- 来源：MDN；Node.js 官方 process 文档。

---

**8）`Promise.resolve(x)` 与 `new Promise(r => r(x))` 有什么区别？**
- 参考要点：`Promise.resolve(x)` 会**智能处理**：x 已是同构造器的 Promise → 直接返回原 Promise；x 是 thenable → 包装并跟随；x 是普通值 → fulfilled。`new Promise(r => r(x))` **每次都新建一个 Promise**——x 是 Promise 也会**多包一层**。生产推荐 `Promise.resolve`。
- 来源：MDN；ECMA-262 §27.2.4.6。

---

**9）`Promise.resolve(p)` 里 p 是**别的库**（Bluebird）的 Promise，行为？**
- 参考要点：**不是同一个构造器** → Promise.resolve 会新建一个**原生 Promise** 跟随 p（因为 p 只是 thenable）。**追问**：这带来的问题？→ **双包 hazard**（同一个库两个版本被不同 Promise 包），某些 instanceof 判断会失败。
- 来源：Bluebird 文档；promises/aplus+。

---

**10）以下代码有什么问题？**
```js
async function foo() { /* ... */ }
foo();
```
- 参考要点：**Floating Promise**——`foo()` 返回的 Promise 若 reject 且没人 await/catch，会变成 unhandledrejection。**修**：`await foo()` 或 `foo().catch(err => ...)`。**追问**：TypeScript ESLint 有 `no-floating-promises` 规则强制。
- 来源：typescript-eslint.io；StackOverflow。

---

**11）手写 `Promise.mapLimit(promises, limit)`：并发不超过 limit 的批量执行。**
- 参考要点：
  ```js
  function mapLimit(items, limit, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    async function run() {
      while (cursor < items.length) {
        const i = cursor++;
        results[i] = await worker(items[i], i);
      }
    }
    return Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
      .then(() => results);
  }
  ```
  **追问**：任一失败要不要中断？改 `Promise.allSettled`。
- 来源：Bluebird `Promise.map({ concurrency })`；p-limit 库源码。

---

**12）手写 `retry(fn, { times, delay })`，用 Promise 实现「失败自动重试」。**
- 参考要点：
  ```js
  async function retry(fn, { times = 3, delay = 100 } = {}) {
    let lastErr;
    for (let i = 0; i <= times; i++) {
      try { return await fn(i); }
      catch (e) { lastErr = e; if (i < times) await new Promise(r => setTimeout(r, delay * 2 ** i)); }
    }
    throw lastErr;
  }
  ```
  **追问**：加**取消信号**？在循环里 `if (signal.aborted) throw new AbortError()`。
- 来源：`async-retry`、`p-retry` 库源码；多份中文八股。
