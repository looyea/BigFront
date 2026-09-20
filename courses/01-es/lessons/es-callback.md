# 回调函数：异步的原点

> 目标：**理解「回调是 JS 异步的最 primitive 抽象」**；掌握 **Error-First 约定**、**控制反转**、**Callback Hell** 的三重罪；能识别「**Zalgo**」（同步/异步行为不一致）并修好；知道为什么需要 Promise。

---

## 一、什么是回调（Callback）

**回调 = 把一个函数当参数传给另一个函数，让它在未来某个时刻被调用**。

```js
[1, 2, 3].map(x => x * 2);        // 同步回调
fs.readFile('a.txt', (err, data) => {});   // 异步回调
button.addEventListener('click', () => {});  // 事件回调
setTimeout(() => {}, 1000);        // 定时器回调
```

**JS 单线程 + 事件循环**决定了：**所有非 CPU 密集型的异步**（I/O、网络、定时器、事件）都必须靠回调。回调不是「一种模式」，而是**JS 与外部世界交互的唯一原生方式**。

---

## 二、同步 vs 异步回调

| 维度 | 同步 | 异步 |
| --- | --- | --- |
| 何时执行 | 立即、在返回前 | 事件循环下一 tick 或之后 |
| 例子 | `[].map(fn)`、`arr.forEach(fn)` | `setTimeout`、`fetch(...).then` |
| 栈 | 与调用者**同一个栈帧** | 独立栈帧 |
| 错误处理 | `try/catch` 能接住 | `try/catch` **接不住**，只能靠 err 参数 |

---

## 三、Error-First 约定（Node 风格）

**规范**：回调第一个参数**永远是 error**，其它业务数据从第二位起；没有错误时第一位是 `null`。

```js
function doSomething(cb) {
  try {
    const result = hardWork();
    cb(null, result);           // 成功
  } catch (e) {
    cb(e);                       // 失败
  }
}

doSomething((err, data) => {
  if (err) { console.error('失败', err); return; }
  console.log('成功', data);
});
```

**为什么这样设计**：
1. **错误不能吞**——不用 try/catch，只要检查 err；
2. **多返回值**——第二三位放业务；
3. **可组合**——每个中间步骤都能同样处理，形成链。

---

## 四、控制反转（Inversion of Control）

**信任问题**：你把回调交给第三方，你**不知道**它到底会：
- 调你几次？（0 次？2 次？）
- 什么时候调？（同步？异步？）
- 传什么参数？
- 出错时怎么办？

```js
// 用户代码
getData((err, data) => {
  alwaysRunAfter();       // 如果 getData 抛错前不调 cb，这行永远不执行
});

// 库代码
function getData(cb) {
  throw new Error('boom');  // 回调一次都没被调用
}
```

**防御性写法**（`async` 库的思路）：
```js
function safeGet(cb) {
  let called = false;
  const wrapper = (...args) => {
    if (called) return;
    called = true;
    cb(...args);
  };
  setTimeout(() => {
    try { /* 干活 */ wrapper(null, data); }
    catch (e) { wrapper(e); }
  }, 0);
}
```

**四道保险**：① **异步**用 setTimeout / queueMicrotask 保证不在同一栈；② **try/catch** 抓错误转发给 cb；③ **flag** 保证只调用一次；④ 参数遵循 Error-First。

---

## 五、Zalgo：同步/异步混合的鬼故事

**"Don't release Zalgo"** —— 一个函数**有时候同步调用回调、有时候异步**调用回调——会导致极其隐蔽的 bug。

```js
function fetchOrCache(key, cb) {
  if (cache[key]) cb(cache[key]);        // 同步！
  else fetchData(key, d => { cache[key] = d; cb(d); });   // 异步
}

let data;
fetchOrCache('x', d => data = d);
console.log(data);   // 有时是 d，有时是 undefined——灾难
```

**修法**：**永远异步**——把同步路径也包一层 `setTimeout(cb, 0)` 或 `queueMicrotask(cb)`（更规范）。

**Robert Kieffer（lru-cache 作者）的名言**：*"Release Zalgo 的代码在**你测试时恰好正确**，但会在**你上线后**用另一种数据分布炸掉。"*

---

## 六、Callback Hell（金字塔厄运）

```js
getUser(uid, (err, user) => {
  if (err) return handle(err);
  getOrders(user.id, (err, orders) => {
    if (err) return handle(err);
    getOrderDetail(orders[0].id, (err, detail) => {
      if (err) return handle(err);
      getProduct(detail.pid, (err, product) => {
        if (err) return handle(err);
        console.log(product);
      });
    });
  });
});
```

**三重罪**：
1. **纵向膨胀**——N 层嵌套 → 每层都要重复 `if (err) return handle(err)`；
2. **作用域地狱**——内层能用外层变量，改起来牵一发动全身；
3. **组合困难**——想并行 3 个请求？手写 `counter + results`。

**缓解手段（Promise 之前）**：
- **命名函数拆开**（"金字塔"变"扁平"）；
- **async / Promise 库**（`neo-async`、`bluebird`）；
- **thunk 化**（把 `(cb) => fn(args, cb)` 包装成 `thunk()`）——这是 co 与 generator 方案的基础。

但**真正的解药是 Promise**——本阶段下一关。

---

## 七、Node.js 里的错误传播与 `uncaughtException`

异步回调里抛错，`try/catch` 接不住：

```js
try {
  setTimeout(() => { throw new Error('boom'); }, 0);
} catch (e) {
  console.log('接住', e);   // 永远不会打印
}
```

**为什么**：setTimeout 的回调是**新栈帧**，抛出时原栈帧已经退出。

**最后防线**（Node）：
- `process.on('uncaughtException', cb)`——捕获未处理同步抛错；
- `process.on('unhandledRejection', cb)`——捕获未处理的 Promise rejection；
- **生产建议**：捕获后**记日志 + 优雅退出**，**不要**继续运行——进程状态已经不可预测。

---

## 八、回调的现代用法

**Promise 出现后，回调并没有消失**——很多**同步 API** 仍然是回调风格：
- `Array.prototype.map / filter / reduce / sort / find` 的比较器；
- `JSON.stringify(obj, replacer)`、`localStorage.setItem` 无关；
- `addEventListener`、`MutationObserver`、`IntersectionObserver`；
- Vue/React 里的 `watch(source, cb)`、`useEffect(fn)`。

**约定**：**同步操作用普通回调**（不用 Error-First）；**异步 I/O 用 Promise**（新代码基本不再用 Error-First）。

---

## 九、手写 `parallel` 与 `waterfall`（async 库思路）

理解回调的组合模式能加深「为什么 Promise 更好」。

```js
// 并行跑一批异步任务，全部完成后回调
function parallel(tasks, cb) {
  const results = new Array(tasks.length);
  let pending = tasks.length;
  if (!pending) cb(null, results);
  tasks.forEach((t, i) => {
    t((err, r) => {
      if (err) { cb = once(cb); cb(err); return; }
      results[i] = r;
      if (--pending === 0) { cb = once(cb); cb(null, results); }
    });
  });
}

// 串行：上一步的输出作为下一步的输入
function waterfall(fns, cb) {
  cb = once(cb);
  (function next(err, ...acc) {
    const fn = fns.shift();
    if (!fn) return cb(null, acc[acc.length - 1]);
    fn(...acc, next);
  })();
}
```

**看完你就懂了 Promise 的价值**：`parallel` ≈ `Promise.all`，`waterfall` ≈ `.then().then()`。

---

## 十、自检清单

- [ ] 什么是 Error-First 约定？为什么这样设计？
- [ ] 举一个 Zalgo 的例子并说怎么修。
- [ ] 为什么 `try/catch` 抓不住 setTimeout 里的 throw？
- [ ] 控制反转的四道保险是什么？
- [ ] Callback Hell 的三重罪是什么？Promise 分别怎么解？

---

## 🚀 部署预告（本关点到，细节在 L10）

**回调时代与构建/部署的关联：**

1. **polyfill 场景**：老浏览器里 `addEventListener` 缺失时，`attachEvent` 回调签名兼容层是 polyfill 经典任务。
2. **`process.on('unhandledRejection')`**：Node 服务部署时**必须**注册——不然未捕获的 rejection 直接杀进程，PM2 / Docker 会不停重启；这是**生产部署**第一条硬约束。
3. **Babel 转 async/await 的**产物**就是回调**：regenerator 内部把 async 函数拆成状态机 + 一堆闭包 + 回调驱动。看懂 Promise 与回调才能看懂 regenerator 的产物。
4. **sourcemap 与栈帧**：异步回调的调用栈**天然被切断**（原栈帧已退），排查错误时看 DevTools 的 **Async Stack Traces** 面板才能看到完整链；生产环境要上传 `.map` 到 Sentry 才能定位真源码。

细节 L10 全面展开。**你现在只需要记住**：**回调是所有异步抽象的底座——不懂回调 = 不懂 Promise 与 async/await 到底解决了什么。**
