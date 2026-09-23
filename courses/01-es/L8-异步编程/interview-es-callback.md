# 面试题 · 回调函数

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）什么是 Callback？JS 为什么离不开它？**
- 参考要点：**把函数当参数传给另一个函数，在未来的某时刻被调用**。JS 是**单线程 + 事件循环**——所有非 CPU 密集型异步（I/O、网络、定时器、事件）都必须靠回调驱动；Promise / async / RxJS 都是**建立在回调之上**的抽象层。
- 来源：MDN Callback 文档；Node.js 官方指南。

---

**2）Node 为什么统一用 Error-First 约定？给一个例子。**
- 参考要点：cb 的第一个参数**永远是 error**（成功时为 null），业务数据从第二位起。设计动机：① 错误不能吞——检查第一位就知道成败；② 多返回值——第二三位放数据；③ 可组合——每层能同样处理。示例：`fs.readFile(path, (err, data) => { if (err) throw err; ... })`。
- 来源：Node.js 官方 Convention 文档。

---

**3）为什么 `try/catch` 抓不住 setTimeout 里抛出的错误？**
- 参考要点：setTimeout 的回调**在新栈帧**里执行——原栈帧已经退出。try/catch 是**同步**语法，只能抓**当前栈帧**里的 throw。修法：① 在 setTimeout 回调里套 try/catch；② 用 Promise + `.catch`；③ 全局兜底 `window.onerror` / `process.on('uncaughtException')`。
- 来源：MDN `Error handling`；StackOverflow 高票。

---

**4）什么是「Zalgo」？为什么不能说「Don't release Zalgo」？**
- 参考要点：一个函数**有时同步、有时异步**调回调——导致上层代码的行为依赖数据分布（cache 命中/未命中）。经典事故：`let result; getData(id, d => result = d); use(result)`——同步时能拿到，异步时 undefined。**「Don't release Zalgo」**（Caolan McMahon / Isaac Z. Schlueter）：让回调永远异步，用 `setImmediate` / `process.nextTick` / `queueMicrotask` 强制。
- 来源：Isaac Z. Schlueter 博文《Avoiding Release Zalgo》；Blog: Blog.izs.me。

---

**5）Callback Hell 的三重罪是什么？Promise 分别怎么解？**
- 参考要点：① **纵向膨胀**（每层缩进 + 重复错误检查）→ Promise 链式 `.then()` 扁平；② **作用域地狱**（内层能用外层变量）→ Promise 每步只依赖上一步；③ **组合困难**（并行、竞速、失败传播）→ `Promise.all / race / allSettled / any` 语义化组合。
- 来源：C# 与 Node 圈的经典讨论；callbackhell.com；MDN。

---

**6）控制反转的四大风险与防御写法？**
- 参考要点：信任问题：第三方库可能：① 调 0 次 → 用 `once` flag；② 调多次 → flag 保护；③ 同步调 → `setTimeout / queueMicrotask` 强制异步；④ 传错参数 → 检查后再转发；⑤ 抛错 → `try/catch` 包裹后走 error 通道。
- 来源：Robert C. Martin《Clean Architecture》里 DIP 讨论；Node conf 演讲；Isaac Schlueter 博文。

---

**7）`uncaughtException` 与 `unhandledRejection` 有什么区别？生产怎么用？**
- 参考要点：**uncaughtException**：同步代码里未捕获的 throw（含 setTimeout 里的）；**unhandledRejection**：Promise reject 没人 `.catch`。**生产建议**：两者都要注册 → **记日志 → 优雅关闭 → process.exit(1)**（Node 15+ 默认对 unhandledRejection 抛错）；不要吞掉继续跑——进程状态已经不可预测。
- 来源：Node.js 官方 `process` 文档；Sentry / PM2 生产实践。

---

**8）以下代码打印顺序？**
```js
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
console.log('4');
```
- 参考要点：`1 → 4 → 3 → 2`。同步跑完打 1、4；微任务队列（Promise）打 3；宏任务（setTimeout）打 2。**这是 Promise 与回调协作的**核心规则**——下一关事件循环详解。
- 来源：StackOverflow 高票；IBM Developer 系列文章；前端面试常见题。

---

**9）手写一个 `once(fn)` 保证回调只调用一次。**
- 参考要点：
  ```js
  function once(fn) {
    let called = false, result;
    return function (...args) {
      if (!called) { called = true; result = fn.apply(this, args); }
      return result;
    };
  }
  ```
  **追问**：ESM 里如何**共享 once 状态**给一个模块的多个消费者？→ 模块单例特性 + `export const onceX = once(x)`。
- 来源：Lodash 文档 `once`；MDN。

---

**10）手写 `retry(times, task, cb)`：task 是 Error-First 异步任务，失败时最多重试 times 次。**
- 参考要点：
  ```js
  function retry(times, task, cb) {
    cb = once(cb);
    (function attempt(left, lastErr) {
      task((err, ...ok) => {
        if (!err) return cb(null, ...ok);
        if (left <= 0) return cb(err || lastErr);
        setTimeout(() => attempt(left - 1, err), 100);
      });
    })(times);
  }
  ```
  **追问**：如何加**指数退避**？把 `100` 改成 `Math.min(2 ** (times-left) * 100, MAX)`。
- 来源：`async` 库源码；多份社区文章。

---

**11）Promise 出现后回调还重要吗？举 3 个仍在使用回调的场景。**
- 参考要点：**同步 API 依然是回调**——`Array.map / filter / sort / reduce` 的 comparator；事件绑定 `addEventListener`；观察者 `MutationObserver / IntersectionObserver`；框架钩子 `Vue watch / React useEffect`。异步 I/O 场景基本切到 Promise。
- 来源：MDN；Vue/React 官方文档。

---

**12）Node 里的 `process.nextTick` 与 `setImmediate` 与 `setTimeout(fn, 0)` 分别在什么时机执行？**
- 参考要点：`process.nextTick` 在**当前操作完成后、事件循环继续前**执行——优先级最高，会「插队」；`queueMicrotask` 与 Promise 微任务同级；`setImmediate` 在 **check 阶段**（I/O 完成后）；`setTimeout(fn, 0)` 在 **timers 阶段**（有最小延迟）。**推荐**：新代码用 `queueMicrotask`（浏览器/Node 通用），避免用 `process.nextTick`（可能饿死事件循环）。
- 来源：Node.js 官方《Event Loop, Timers, process.nextTick》。
