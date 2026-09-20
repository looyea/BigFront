# Promise：异步的一等公民

> 目标：**吃透 Promise 状态机**（pending / fulfilled / rejected）与三条不变式；掌握 **链式 then**、**异常穿透**、**四种聚合**（all / allSettled / race / any）；能**手写一个符合规范的 Promise**；知道常见坑（floating promise、unhandledrejection、返回 Promise 陷阱）。

---

## 一、Promise 解决的三件事

1. **把「未来值」变成**对象**——可传递、可存储、可组合**；
2. **把回调**扁平化**——链式 `.then().then()` 消灭嵌套；
3. **统一错误传播**——像同步 throw 一样，`.catch` 在链尾兜底。

**一句话**：Promise 是**回调的语法糖 + 状态机**。

---

## 二、状态机与三条不变式

```
        ┌─── resolve(value) ───► fulfilled(value)   [不可逆]
pending┤
        └─── reject(reason)   ───► rejected(reason)  [不可逆]
```

**三条不变式**：
1. **状态只能从 pending 变**，一旦变化就**锁死**（settle）；
2. **只能变一次**——再 resolve/reject 无效；
3. **值/理由必须锁定**——不能事后修改。

**核心 API**：
```js
const p = new Promise((resolve, reject) => {
  // 执行器：同步运行
  try { resolve(42); } catch (e) { reject(e); }
});
p.then(v => console.log(v));        // 42
```

**⚠️ 执行器里 throw** = 自动 reject；**⚠️ 忘记 reject** = Promise 永远 pending。

---

## 三、`then` / `catch` / `finally`

### `then(onFulfilled, onRejected)`
- 两个参数**都是可选**；
- **总返回新 Promise**——支持链式；
- 返回值规则：
  - 返回**普通值** → 新 Promise fulfilled 该值；
  - 返回**另一个 Promise** → 新 Promise 跟随它的状态；
  - **throw** → 新 Promise rejected。

### `catch(onRejected)`
- 等价于 `then(null, onRejected)`；
- **⚠️ 只捕获「上游」的错误，不捕获自己回调里的 throw**——但因为 catch 返回新 Promise，链后续可以继续。

### `finally(onSettled)`
- 无论 fulfilled 还是 rejected 都执行；
- **不接参数**、**不改变状态**（除非它自己 throw，会覆盖原结果）；
- 常用于关 loading、清 timer。

```js
showLoading();
fetch(url)
  .then(r => r.json())
  .then(d => render(d))
  .catch(e => showError(e))
  .finally(() => hideLoading());
```

---

## 四、链式与异常穿透

```js
Promise.resolve()
  .then(() => { throw new Error('A'); })
  .then(() => console.log('不会跑'))              // 跳过
  .catch(e => { console.log('捕到', e.message); return 'recovered'; })
  .then(v => console.log('catch 的返回值:', v));  // 'recovered'
```

**关键规则**：`.catch` 相当于「上游 throw 才跑；跑完恢复正常继续下游」。

**⚠️ 反模式**：
```js
// 错：catch 里再 throw 会打断后续链
.then(step1)
.catch(handleErr)
.then(step2)   // handleErr 里 throw 就跳过 step2
```

**推荐**：**链尾**放一个总 catch，中间用 `.then(v => { if (bad) throw ...; return v; })`。

---

## 五、四种聚合器（对比表）

| API | 触发 fulfilled | 触发 rejected | 用途 |
| --- | --- | --- | --- |
| `Promise.all(iter)` | **全部** fulfilled → 值数组（**顺序保留**） | **任一** rejected → 立即 reject | 并行、都成功才有意义 |
| `Promise.allSettled(iter)` | 全部 settle → `{status, value/reason}[]` | **从不** reject | 批量、部分失败也要跑完 |
| `Promise.race(iter)` | **第一个 settle**（无论成败）跟随 | 同 | 超时兜底、竞速 |
| `Promise.any(iter)` | **第一个 fulfilled** | 全部 rejected → `AggregateError` | 多 CDN 备援 |

**⚠️ 空数组**：
- `all([])` → resolved 空数组
- `any([])` → **rejected**（永远不会有 fulfilled）

**⚠️ 非 Promise 输入**：四个 API 都会走 `Promise.resolve(item)` 包装。

---

## 六、`resolve` 的三种输入 & Thenable

```js
p1 = Promise.resolve(42);                 // 直接 fulfilled
p2 = Promise.resolve(otherPromise);       // 返回 otherPromise 本身（同构造函数）
p3 = Promise.resolve({ then: (rs) => rs(7) });   // fulfilled 7（**thenable**）
```

**Thenable** = 任何带 `then` 方法的对象。**Promise 是 thenable 的一种**——第三方库（Bluebird、jQuery.Deferred）返回的也是 thenable，能被原生 Promise 消化。

**为什么 `Promise.resolve(p)` 直接返回 p**：当构造器一致时不需要包一层——性能与「identity」优化；跨实现（原生 vs Bluebird）时会包。

---

## 七、常见坑（**面试高频**）

### 坑 1：**Floating Promise**（漂浮）
```js
async function go() { /* ... */ }
go();   // 没 await 也没 .catch——异常静默丢失
```
**修**：要么 `await`，要么 `.catch(err => ...)`；ESLint 有 `no-floating-promises`（TS 项目常开）。

### 坑 2：**return 一个 Promise vs 返回一个值**
```js
.then(v => { /* 什么都不 return */ })   // 下一个 then 收到 undefined（链断了）
```
—— **每个 then 都要显式 return**。

### 坑 3：**`new Promise` 里忘记 resolve**
```js
new Promise((resolve) => {
  fs.readFile(path, (err, data) => {
    if (err) throw err;         // ❌ 只 throw，不 reject
    resolve(data);
  });
});
```
—— 上面代码里 throw 会被 Promise 构造函数**同步**捕获转 rejected；但**在异步回调里** throw 是**另一个栈帧**——Promise 永远 pending。**修**：`reject(err)` 或包一层 try/catch。

### 坑 4：**同步循环里 await**
```js
list.forEach(async x => { await doIt(x); });   // ❌ forEach 不等 Promise
```
**修**：`for (const x of list) await doIt(x)`（串行）或 `await Promise.all(list.map(async x => doIt(x)))`（并行）。

### 坑 5：**reject 一个非 Error**
```js
reject('boom');   // 能跑，但 catch 里 e 是字符串，栈丢了
```
**永远 `reject(new Error('...'))`**——保留 stack。

### 坑 6：**unhandledrejection 全局兜底**
```js
window.addEventListener('unhandledrejection', e => {
  report(e.reason);
  e.preventDefault();
});
```
—— 生产**必须**注册，与 `window.onerror` 一起做监控上报。

---

## 八、Promise 与事件循环（预告）

- 执行器**同步**运行；
- `resolve` / `reject` **不立刻**触发 then；
- then / catch / finally 的回调进**微任务队列**——**当前宏任务结束后、下一个宏任务前**清空；
- 与 `queueMicrotask(cb)` 等价。

细节在 `es-event-loop` 关展开。

---

## 九、手写 Promise（迷你版）

```js
class MyPromise {
  constructor(exec) {
    this.state = 'pending';
    this.value = undefined;
    this.reason = undefined;
    this.onFulfilled = [];
    this.onRejected = [];
    const resolve = (v) => this.#settle('fulfilled', v);
    const reject = (r) => this.#settle('rejected', r);
    try { exec(resolve, reject); } catch (e) { reject(e); }
  }
  #settle(state, val) {
    if (this.state !== 'pending') return;
    this.state = state;
    (state === 'fulfilled' ? this.onFulfilled : this.onRejected).forEach(f => queueMicrotask(f));
    (state === 'fulfilled' ? this.onFulfilled : this.onRejected).length = 0;
    this.value = val; this.reason = val;
  }
  then(onOk, onErr) {
    onOk ??= v => v;
    onErr ??= e => { throw e; };
    return new MyPromise((res, rej) => {
      const run = (fn, val) => queueMicrotask(() => {
        try { const r = fn(val); r && r.then ? r.then(res, rej) : res(r); }
        catch (e) { rej(e); }
      });
      if (this.state === 'fulfilled') run(onOk, this.value);
      else if (this.state === 'rejected') run(onErr, this.reason);
      else { this.onFulfilled.push(() => run(onOk, this.value)); this.onRejected.push(() => run(onErr, this.reason)); }
    });
  }
  catch(fn) { return this.then(null, fn); }
  finally(fn) { return this.then(v => { fn(); return v; }, e => { fn(); throw e; }); }
}
```

**⚠️ 缺什么才算「符合 Promises/A+ 规范」**：**resolve 一个 thenable 时要递归解开**（x 是 thenable 不能直接 fulfilled）；`resolve(this)` 要抛 `TypeError`（循环引用）。**面试写到这里就赢了**。

---

## 十、自检清单

- [ ] 画出 Promise 状态机；说出三条不变式。
- [ ] `.then` 的返回值三种情况分别怎么处理？
- [ ] `Promise.all` 与 `allSettled` 的差别？什么场景用哪个？
- [ ] `Promise.race` 怎么做超时？给 3 行代码。
- [ ] `forEach(async x => ...)` 有什么问题？
- [ ] 手写 Promise 至少支持 then / catch / finally。

---

## 🚀 部署预告（本关点到，细节在 L10）

**Promise 与构建/部署的关系：**

1. **polyfill 成本**：老浏览器（IE 全部版本、Android 4.4）没有 Promise——`core-js/es/promise` 约 **2-3KB gzipped**；`browserslist` 里含这些就必然被 `@babel/preset-env + useBuiltIns: 'usage'` 注入。
2. **转 async/await 依赖 Promise**：Babel 把 async 降级成「regenerator + Promise」——**Promise 不能少**，即使 target 是老环境。
3. **unhandledrejection 监控**：生产**必须**在 index.html 顶部**先于业务代码**注册 `window.addEventListener('unhandledrejection', ...)`，把错误送到 Sentry / 自建埋点——**这是前端可观测性地基**。
4. **Tree-shaking 与 Promise 静态方法**：`Promise.all` 等被视为**纯函数**——摇不动但也不会被误删。
5. **sourcemap 与 async 栈**：Promise 链的 `.then` 里 throw 的 stack 是**部分**栈（原栈已退）；DevTools 里 **Async Stack Traces** 才能看完整；生产 sourcemap 上传时要保证 chain 里每一步都能反解到源文件。

细节 L10 全面展开。**你现在只需要记住**：**Promise 是现代前端异步的**唯一底座**——理解状态机 + 微任务 = 理解 90% 的异步面试题。**
