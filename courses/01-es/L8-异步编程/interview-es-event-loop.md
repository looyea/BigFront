# 面试题 · 事件循环

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）为什么 JS 是单线程却能做到非阻塞 I/O？**
- 参考要点：**调用栈**单线程；**Web API / libuv** 是多线程（浏览器内部线程池 / Node 用 libuv 线程池处理 fs、dns、crypto）；**事件循环**把已完成的回调塞回调用栈。**一句话**：JS 单线程 + 事件循环 + 底层多线程 API = 非阻塞 I/O + 无锁并发。
- 来源：MDN《Event Loop》；Node.js 官方《Event Loop, Timers, and process.nextTick》；Philip Roberts 经典演讲。

---

**2）宏任务与微任务的区别？各举 5 个例子。**
- 参考要点：**微任务**：Promise.then / catch / finally、queueMicrotask、MutationObserver、process.nextTick（Node）、await 后续；**宏任务**：setTimeout、setInterval、setImmediate（Node）、I/O、UI 事件（click / scroll）、postMessage、requestAnimationFrame（近似）。**规则**：一个宏任务 → 清空微任务 → 渲染。
- 来源：HTML 规范 §9.7；MDN；Node.js 官方文档。

---

**3）浏览器一次 tick 里发生了什么？（详细）**
- 参考要点：① 取一个宏任务并执行到栈空；② 清空**微任务队列**（新入队的也在这一轮跑完，最多 100 层防死循环）；③ **每 16.6ms 至多一次**：`requestAnimationFrame` 回调 → Style/Layout/Paint；④ 若有空闲继续微任务或渲染；⑤ 取下一个宏任务。**⚠️** 渲染不是每 tick 都做。
- 来源：HTML 规范 §9.7；Chrome 团队《Inside look at modern web browser》系列文章（web.dev）。

---

**4）以下代码打印顺序？**
```js
async function async1() {
  console.log('a1 start');
  await async2();
  console.log('a1 end');
}
async function async2() { console.log('a2'); }
console.log('script start');
setTimeout(() => console.log('timeout'), 0);
async1();
new Promise(res => { console.log('promise1'); res(); })
  .then(() => console.log('promise2'));
console.log('script end');
```
- 参考要点：`script start → a1 start → a2 → promise1 → script end → a1 end → promise2 → timeout`。**关键**：`await async2()` 里的 async2 同步打完 a2 返回 Promise；a1 end 排在**微任务**；两个微任务顺序：a1 end 先入队 → promise2 后入队 → 都跑完再进 setTimeout 宏任务。
- 来源：StackOverflow 高票；前端各大厂笔试题；MDN。

---

**5）`await` 到底让出了什么？让出几个 tick？**
- 参考要点：**让出「当前 await 之后的所有代码」**——把它们包成 `.then(继续)` 入微任务队列。**tick 数**：现代 V8 优化后每次 await 让出 **1 个微任务**；早期规范是 3 个（V8 已改进）。**追问**：`await await await 42` = 3 个 tick。
- 来源：ECMA-262 §27.7.2；Mathias Bynens / V8 团队关于 await 优化的博客。

---

**6）Node 事件循环有哪六个阶段？`setImmediate` 在哪一阶段？**
- 参考要点：**timers → pending callbacks → idle, prepare → poll → check → close callbacks**。`setImmediate` 在 **check** 阶段；`setTimeout` 在 **timers**；I/O 回调在 **poll**；`socket.on('close')` 在 **close**。**每阶段之间**清空微任务与 nextTick 队列。
- 来源：Node.js 官方《Event Loop, Timers, and process.nextTick》。

---

**7）`process.nextTick` 与 `setImmediate` 的区别？**
- 参考要点：**nextTick 不是事件循环的一部分**——它在**当前操作完成后、事件循环继续前**执行，优先级**高于**微任务；**setImmediate** 在 check 阶段。**递归 nextTick** 会**饿死 I/O**——官方不推荐。新代码用 `queueMicrotask`（浏览器/Node 通用）。
- 来源：Node.js 官方文档；Isaac Schlueter 相关讨论。

---

**8）**在 Node REPL 里 `setTimeout(() => console.log('t'), 0)` 与 `setImmediate(cb)` 打印顺序？**
- 参考要点：**在**主模块**里**顺序**不确定**——取决于事件循环进入 timers 阶段前是否已过 1ms；**在 I/O 回调里**（比如 fs.readFile 内）**总是** `setImmediate` 先（因为在 poll 阶段，紧接着是 check）。这是官方文档专门解释的经典考点。
- 来源：Node.js 官方文档示例。

---

**9）`requestAnimationFrame` 与 `setTimeout(fn, 16)` 的区别？为什么动画用 rAF？**
- 参考要点：**rAF**：与显示器 VSync 对齐（60Hz = 16.6ms、120Hz = 8.3ms）；页面不可见时**暂停**（省电）；回调参数带**当前时间戳**；执行时机在**渲染前**（style/layout 之前）。**setTimeout**：与刷新率不对齐会**掉帧 / 撕裂**；后台仍跑。**结论**：动画必 rAF。
- 来源：MDN rAF；web.dev《Inside look at modern web browser》。

---

**10）**长任务（5 秒）怎么切分让 UI 不冻结？**
- 参考要点：核心是**让出主线程**给事件循环——几种切法：
  - `await new Promise(r => setTimeout(r, 0))` 每 N 项让一帧（**兼容性最好**）；
  - **`scheduler.yield()` / `postTask()`**（新的 Prioritized Task Scheduling API，Chrome 121+）；
  - **`requestIdleCallback`**（在浏览器空闲时跑，Chrome 47+）；
  - **Web Worker**（真正多线程，切不动就搬走）；
  - **React 并发渲染**内部用 `MessageChannel` + 时间切片。
- 来源：web.dev《Long Tasks》；MDN `requestIdleCallback`；React 18 官方文档。

---

**11）**为什么 `queueMicrotask` 里的 throw 是 uncaughtException 而不是 unhandledRejection？
- 参考要点：queueMicrotask 语义上等价 `Promise.resolve().then(fn)`——**但错误处理不同**：微任务回调里的 throw **规范定义为**「Report the exception」——不产生 rejected Promise。所以 window.onerror / process.on('uncaughtException') 才抓得到。**结论**：需要 catch 就用 Promise；只需排队就用 queueMicrotask。
- 来源：HTML 规范 `queueMicrotask`；MDN。

---

**12）现场手写：`sleep(ms)` 用 Promise + setTimeout；`runAtMost(limit, tasks)` 用微任务实现限流。**
- 参考要点：
  ```js
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  async function runAtMost(limit, tasks) {
    const results = new Array(tasks.length);
    let cursor = 0;
    async function worker() {
      while (true) {
        const i = cursor++;
        if (i >= tasks.length) return;
        results[i] = await tasks[i]();
        await Promise.resolve();     // 每完成一个主动让出一次微任务
      }
    }
    await Promise.all(Array.from({ length: limit }, worker));
    return results;
  }
  ```
  **追问**：如何加超时？把 `await tasks[i]()` 换成 `Promise.race([tasks[i](), sleep(T).then(() => { throw new TimeoutError() })])`。
- 来源：`p-limit`、`p-timeout` 库源码；StackOverflow 高票。
