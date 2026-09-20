# 面试题 · async / await

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）async / await 的语法糖本质是什么？**
- 参考要点：**Generator + Promise + 自动执行器**。async 函数编译后是一个 Generator，每次 await 编译成 yield；自动执行器把 yield 出来的 Promise 用 `.then(v => gen.next(v))` 接上，让 Generator 恢复。Babel 产物里能看到 `regeneratorRuntime.async(...)`。
- 来源：MDN；Babel 官方文档；TC39 async-functions 提案。

---

**2）async 函数与普通函数的三个语义差别？**
- 参考要点：① **永远返回 Promise**（`return 42` → `Promise<42>`）；② 函数体内 **throw 自动变 rejected**；③ 遇 `await` **让出控制权**（把后续代码放进微任务）。
- 来源：ECMA-262 §27.7；MDN。

---

**3）以下代码打印顺序？**
```js
async function foo() { console.log('A'); await bar(); console.log('B'); }
async function bar() { console.log('C'); }
foo(); console.log('D');
```
- 参考要点：`A → C → D → B`。`foo()` 同步跑到 await 前的 bar()——bar 同步打完 C 返回 Promise；foo 让出；外层 D；bar 已 resolve，微任务里 B。
- 来源：StackOverflow 高票；前端大厂笔试题。

---

**4）如何并行发起两个不相关的请求？如何**串行**发起？如何用 `Promise.all` 与「先发起后 await」？**
- 参考要点：
  - 并行：`const [a, b] = await Promise.all([fetchA(), fetchB()])`；
  - 串行（有依赖）：`const u = await getUser(); const o = await getOrders(u.id);`；
  - 提前发起：`const pA = fetchA(); const cfg = await loadConfig(); const a = await pA;`——A 与 cfg **同时**在跑。
- 来源：MDN；web.dev 性能文章。

---

**5）`forEach(async x => ...)` 为什么不能用？给两种替代方案。**
- 参考要点：forEach 忽略回调返回值——async 回调返回的 Promise 没人 await，外层继续跑。**替代**：① `for (const x of list) await doIt(x)` 串行；② `await Promise.all(list.map(x => doIt(x)))` 并行；③ 有限并发用 `p-limit` 或手写 chunks。
- 来源：ESLint `no-restricted-syntax`；StackOverflow 高票。

---

**6）顶层 `await`（ES2022）适合什么，不适合什么？**
- 参考要点：**适合**：polyfill / feature detection / WASM init / 一次性配置——「必须在下游用前完成」的异步工作。**不适合**：业务数据加载（阻塞依赖链）、频繁热重载库、循环依赖里的模块（可能死锁）。**限制**：只在 ESM 顶层，CJS 不支持；打包 target esnext。
- 来源：TC39 top-level-await 提案；Node.js 官方文档；v8.dev。

---

**7）`await` 一个非 Promise 会发生什么？为什么不是零成本？**
- 参考要点：`await 42` 等价 `await Promise.resolve(42)`——内部会**多等一个微任务**。多次 await 常量累积开销；`await await await 42` 会等**三个** tick（历史上甚至更多，V8 优化后每次 await 只等一 tick）。
- 来源：ECMA-262；Mathias Bynens 关于 await 优化的讨论；v8.dev。

---

**8）`for await...of` 与普通 `for...of` 的区别？给一个 Node 场景。**
- 参考要点：for-await-of 消费 **AsyncIterable**（每项是 Promise）——每次 next 会 await。**Node 场景**：`for await (const chunk of fs.createReadStream(path))`（Node 10+ Readable 原生实现 AsyncIterable）；`for await (const event of sseStream)`。
- 来源：MDN `for await...of`；Node.js 官方 stream 文档。

---

**9）async 函数里 `try/catch` 抓不住 setTimeout 抛错——为什么？**
- 参考要点：`setTimeout(fn)` 的 fn 在**新栈帧**执行——async 函数的 try/catch 依赖**同一个 await 链**才冒泡。**修**：① 在 setTimeout 回调里包 try/catch；② 用 `await new Promise((res, rej) => setTimeout(...))`；③ 全局 `unhandledrejection` 兜底。
- 来源：MDN；StackOverflow。

---

**10）async 构造函数为什么不支持？替代方案？**
- 参考要点：`new Foo()` 语义是「立即拿到实例」——但 async 里 await 需要**延后**，无法同时满足。构造器不能 async。**替代**：① 静态工厂 `static async create() { const f = new Foo(); await f.init(); return f; }`；② 惰性 init：`await foo.ready()`。
- 来源：TC39 讨论；StackOverflow 高票。

---

**11）写出「有限并发」的 `runAll(tasks, limit)`。**
- 参考要点：
  ```js
  async function runAll(tasks, limit) {
    const results = new Array(tasks.length);
    let i = 0;
    async function worker() {
      while (i < tasks.length) {
        const cur = i++;
        try { results[cur] = { ok: true, v: await tasks[cur]() }; }
        catch (e) { results[cur] = { ok: false, e }; }
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
    return results;
  }
  ```
  **追问**：`p-limit` 库的**保序**输出正是这个模式。
- 来源：`p-limit`、`p-queue` 库源码；多份中文八股。

---

**12）手写 `__async`（模拟 Babel 自动执行器）。**
- 参考要点：
  ```js
  function __async(genFn) {
    return function (...args) {
      return new Promise((resolve, reject) => {
        const gen = genFn.apply(this, args);
        function step(key, arg) {
          let r;
          try { r = gen[key](arg); } catch (e) { return reject(e); }
          if (r.done) return resolve(r.value);
          Promise.resolve(r.value).then(v => step('next', v), e => step('throw', e));
        }
        step('next');
      });
    };
  }
  // 用法
  const load = __async(function* () {
    const a = yield fetchA();
    const b = yield fetchB();
    return a + b;
  });
  ```
  这就是 async/await 的本质——**用 Promise 驱动 Generator**。
- 来源：Babel regenerator-transform 源码；MDN Generator。
