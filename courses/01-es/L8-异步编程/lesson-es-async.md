# async / await：让异步像同步

> 目标：**理解 async/await 是 Generator + Promise + 自动执行器**的语法糖；掌握 **错误处理**、**串行 vs 并行**、**顶层 await**、**for-await-of**；识别 8 大反模式。

---

## 一、语法糖解剖

```js
async function foo() {
  const a = await p1;
  const b = await p2;
  return a + b;
}
```

**等价于**（Babel regenerator 大致产物）：
```js
function foo() {
  return __async(function* () {
    const a = yield p1;
    const b = yield p2;
    return a + b;
  });
}
// __async 内部：跑 generator，把每个 yield 出来的 Promise 用 .then 接上，再 next(结果)
```

**三块拼图**：
1. **Generator** 提供**暂停/恢复**能力；
2. **Promise** 提供**值的容器**与错误传播；
3. **自动执行器**（thunk runner）把两者黏合——`yield promise` → `.then(v => gen.next(v))`。

---

## 二、`async` 函数的**四条硬规则**

1. **永远返回 Promise**——即使 `return 42`，也是 `Promise<42>`；抛错也是 rejected。
2. **`await` 后必**产生一个微任务**（哪怕 await 一个非 Promise）——`await 42` 会**多等 1 个 tick**。
3. **执行到 `await` 才让出**——`await` 前面的代码是同步跑的。
4. **抛错等价 reject**——不用像回调那样 `reject(err)`。

```js
async function f() { throw new Error('boom'); }
f().catch(e => console.log(e.message));   // boom
```

---

## 三、错误处理：**try/catch 复活**

```js
async function load() {
  try {
    const r = await fetch('/api/user');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const u = await r.json();
    return u;
  } catch (e) {
    report(e);
    return FALLBACK;
  } finally {
    hideLoading();
  }
}
```

**四种模式**（按需选）：
1. **就地 try/catch**——细粒度处理每步；
2. **函数末尾再抛**——外层聚合；
3. **不 catch 让调用方处理**——库函数默认；
4. **包装成 tuple**（Go 风格）：
   ```js
   const to = (p) => p.then(v => [null, v]).catch(e => [e]);
   const [err, user] = await to(fetchUser());
   ```

**⚠️ 陷阱**：
- 顶层 async 函数的 throw → 变 rejected → **必须 await/catch**，否则 unhandledrejection；
- `for await...of` 里 throw 会关掉迭代器（触发 `return`）。

---

## 四、**串行 vs 并行**（面试最爱）

**❌ 反模式：无依赖却串行**
```js
const a = await fetchA();   // 等
const b = await fetchB();   // 再等——总耗时 = a + b
```

**✅ 并行**
```js
const [a, b] = await Promise.all([fetchA(), fetchB()]);   // 总耗时 = max(a, b)
```

**✅ 提前发起 + 稍后 await**
```js
const pA = fetchA();     // 立即开始（不等）
const cfg = await loadConfig();   //  meanwhile A 在跑
const a = await pA;                // 再取结果
```

**⚠️ 有依赖就必须串行**——不要为「并行」而并行：
```js
const u = await getUser();
const orders = await getOrders(u.id);   // 依赖 u，不能 all
```

**⚠️ Promise.all 有一票否决**——一个失败全失败。想「部分失败也要拿数据」：`allSettled`。

---

## 五、循环里的 async

```js
// ❌ for 循环 + let i 闭包陷阱
for (var i = 0; i < 3; i++) {
  setTimeout(async () => { await doIt(i); });   // 全 3
}

// ✅ let / 立即执行
for (let i = 0; i < 3; i++) { ... }

// ❌ forEach + async
list.forEach(async x => { await doIt(x); });   // forEach 不等

// ✅ 串行
for (const x of list) { await doIt(x); }

// ✅ 并行
await Promise.all(list.map(x => doIt(x)));

// ✅ 有限并发
for (const chunk of chunks(list, 5)) {
  await Promise.all(chunk.map(x => doIt(x)));
}
```

---

## 六、`for await...of`（ES2018）

消费**异步可迭代对象**（AsyncIterable）：
```js
async function* stream() {
  yield 1; await sleep(100);
  yield 2; await sleep(100);
  yield 3;
}

for await (const x of stream()) console.log(x);   // 1 → 2 → 3
```

**真实场景**：
- **Node.js Readable stream**（Node 10+ 原生 AsyncIterable）：
  ```js
  for await (const chunk of fs.createReadStream('big.txt')) { ... }
  ```
- **fetch 响应流**：`for await (const chunk of response.body) { ... }`
- **SSE / WebSocket 消息**：库把它们包成 AsyncIterable；
- **分页 API**：写生成器逐页 yield。

---

## 七、顶层 `await`（ES2022）

```js
// config.js
export const cfg = await fetch('/c.json').then(r => r.json());
```

**能力**：模块**顶层**（不在 async 函数里）直接 await。

**⚠️ 三坑**：
1. **阻塞下游依赖链**——所有 import config.js 的模块都等它；
2. **不能出现在 CJS**（`require` 是同步）；
3. **打包 target 需要 esnext**——旧浏览器降级要靠 regenerator。

**适合**：polyfill 加载、feature detection、WASM init、单例配置。**不适合**：普通业务数据。

---

## 八、`await` 一个非 Promise

```js
const v = await 42;         // 合法，等价 Promise.resolve(42)
const u = await undefined;  // 合法，v = undefined
```

**⚠️ 会**多等一个 tick**——`await 42` 内部还是走一次微任务。**

**优化写法**（热点路径）：
```js
async function hot() {
  // 别在这里 await 常量
}
```

---

## 九、Promise 与 async 的错误传播

```js
async function a() { throw new Error('A'); }
async function b() { await a(); }
async function c() { await b(); }

c().catch(e => console.log(e.message));   // A
```

**关键**：throw 在 async 链里**自动冒泡**——像同步 stack。**⚠️ 但**：只有在**同一个 await 链上**才冒泡；`setTimeout(async () => { await a() })` 是**新链**，接不住。

---

## 十、8 大反模式（**面试送分题**）

1. **漂浮 Promise**：`foo()` 不 await 不 catch；
2. **无依赖串行 await**：`await A; await B;` 应改 `Promise.all`；
3. **forEach + async**：不等待；
4. **try/catch 包整个函数体**：粒度太粗，掩盖错误来源；
5. **catch 里 return** 又**不 rethrow**：吞错，链下游拿到 undefined；
6. **await 一个已经 await 过的**：`const v = await (await p)` 多等一 tick；
7. **在 finally 里 await**：可能吞掉原异常（finally 里的 rejection 覆盖 try 里的）；
8. **async 构造函数**：`new async Foo()` 不支持——用工厂 `static async create()`。

---

## 十一、`async` 与 Promise 的选型

| 场景 | 首选 | 原因 |
| --- | --- | --- |
| 顺序流程 | `async/await` | 可读性接近同步 |
| 简单一次性回调 | `.then` | 不用建 async 作用域 |
| 组合（并行、超时） | `Promise.all/race` + `await` | 语义化 |
| 事件流 / 大文件 | `for await...of` | 原生 AsyncIterable |
| **性能极敏感** | 手写 `.then` | async 每次 await 都有微任务开销 |

---

## 十二、自检清单

- [ ] 用 Generator + Promise 手写 `__async(fn)`。
- [ ] 无依赖的两个 fetch 怎么并行？有依赖呢？
- [ ] `await 42` 会发生什么？为什么要多等一个 tick？
- [ ] `for await...of` 与普通 `for...of` 区别？给一个 Node stream 例子。
- [ ] 顶层 await 的三条限制？
- [ ] 8 大反模式各是什么？

---

## 🚀 部署预告（本关点到，细节在 L10）

**async/await 与构建/部署：**

1. **Babel 降级成本**：`@babel/preset-env` target 是 Chrome 55+ 时 async/await **原生支持不转**；含 IE 或 Android 4.4 时**降级成 regenerator-runtime**——**约 5KB gzipped**——是**首屏最大的一块 legacy 包袱**。
2. **`availableModern` target 检查**：Vite 默认 target `es2020`（原生 async），旧浏览器要配 `@vitejs/plugin-legacy` 出双份产物。
3. **顶层 await**：需要打包 target `esnext`；生产慎用（阻塞链路）。
4. **sourcemap**：regenerator 产物**栈极深**——`.map` 上传 Sentry 是**唯一**能看清源码位置的方案。
5. **异步错误上报**：生产 `window.onerror` 抓不到 async throw——必须配 `unhandledrejection` 监听才能捕获全部；这是**埋点系统**的地基。

细节 L10 展开。**你现在只需要记住**：**async 让代码好读但每层 await 都有微任务成本，Babel 转它需要 regenerator——两者一起决定了 target 与体积。**
