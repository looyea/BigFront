# 事件循环：宏任务、微任务与 Node 阶段

> 目标：**掌握浏览器事件循环的完整模型**（Call Stack → Microtask Queue → Macrotask Queue → Render）；能口算打印顺序；理解 **Node 六阶段**与 `process.nextTick` 的**插队**；知道 `requestAnimationFrame` 与渲染的关系。

---

## 一、为什么需要事件循环

JS **单线程**——同一时刻只能跑一段代码。**并发**（网络、I/O、定时器）靠：
- **调用栈**（Call Stack）跑同步代码；
- **Web API**（浏览器/Node 内置的**多线程**能力）承接异步任务；
- **事件循环**把已完成的回调按规则塞回调用栈。

**一句话**：**JS 单线程 + 事件循环 = 非阻塞 I/O + 无锁并发**。

---

## 二、宏任务 vs 微任务

| 类别 | 常见源 |
| --- | --- |
| **Microtask**（微任务） | `Promise.then/catch/finally`、`queueMicrotask`、`MutationObserver`、`await` 后续（部分）、`process.nextTick`（Node） |
| **Macrotask**（宏任务） | `setTimeout`、`setInterval`、`setImmediate`（Node）、I/O、`postMessage`、`requestAnimationFrame`（近似宏任务）、UI 事件 |

**核心规则**：
> **每跑完一个宏任务**，清空**所有**微任务，然后**可能**渲染一次，再取下一个宏任务。

**为什么微任务优先**：微任务是「**当前操作完成后立刻做的事**」——语义上就是「同一轮」；宏任务是「下一轮」。

---

## 三、浏览器事件循环完整图

```
┌───────────────────────────┐
│  Call Stack 同步代码       │ ← 一直跑到栈空
└──────────┬────────────────┘
           │
           ▼
┌───────────────────────────┐
│  Microtask Queue          │ ← 全部清空（新入队的也在这一轮清完）
└──────────┬────────────────┘
           │
           ▼
┌───────────────────────────┐
│  Render（每 16.6ms 一次）  │ ← requestAnimationFrame 在此之前跑
└──────────┬────────────────┘
           │
           ▼
┌───────────────────────────┐
│  下一个 Macrotask（一个）  │ ← setTimeout / 事件 / I/O
└──────────┬────────────────┘
           │
           └──→ 回到 Microtask Queue
```

**⚠️ 微任务里再入队的微任务也会**在本轮**清空**（不是只跑第一轮）——所以死循环的 await 会饿死事件循环。

**⚠️ 渲染不是每轮都做**：浏览器**最多每 16.6ms 渲染一次**；如果微任务把这一帧的时间吃完，就跳过渲染。

---

## 四、必考经典题

**Q1**：
```js
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
console.log('4');
```
**答**：`1 → 4 → 3 → 2`。同步跑 1、4；栈空清微任务 3；下一轮宏任务 2。

**Q2**（async/await 版）：
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
**答**：`script start → a1 start → a2 → promise1 → script end → a1 end → promise2 → timeout`。

**关键**：`await async2()` 相当于 `async2()` + 一个 `.then`——a1 end 在**下一轮微任务**。

---

## 五、`queueMicrotask` 与 `Promise.resolve().then`

**语义等价**——但 `queueMicrotask` 更清晰、错误处理更规范（`throw` 会变成 uncaughtException 而不是 unhandledRejection）：
```js
queueMicrotask(() => console.log('qm'));
Promise.resolve().then(() => console.log('p'));
// 输出：qm → p（按入队顺序）
```

**为什么存在**：让**不用 Promise 的代码**也能排队微任务——`MutationObserver` 就是靠微任务派发。

---

## 六、`requestAnimationFrame` vs `setTimeout`

| 维度 | `setTimeout` | `requestAnimationFrame` |
| --- | --- | --- |
| 时机 | 至少 N ms 后（可能延后） | **下一帧**渲染前 |
| 精度 | 与刷新率无关 | 与屏幕刷新率对齐（60Hz = 16.6ms） |
| 后台标签页 | 仍跑（1s 节流） | **暂停**（省电） |
| 用途 | 通用延迟 | **动画、绘制** |

**动画必用 rAF**——避免卡顿 & 掉帧。

**⚠️ 事件循环图**里 rAF 在**渲染前**跑，不属于微任务也不完全属于宏任务队列。

---

## 七、Node 事件循环的**六个阶段**

```
   ┌───────────────────────────┐
┌─►│  timers                   │  setTimeout / setInterval 到期回调
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │  pending callbacks         │  系统操作回调（如 TCP 错误）
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │  idle, prepare             │  内部
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │  poll                      │  拿新 I/O 事件、执行 I/O 回调（**最重要的阶段**）
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │  check                     │  setImmediate 回调
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │  close callbacks           │  socket.on('close', ...)
└──└───────────────────────────┘
```

**每阶段之间**都会**清空微任务队列**——但 **`process.nextTick` 比微任务还靠前**。

---

## 八、`process.nextTick` 的**插队**

```js
Promise.resolve().then(() => console.log('microtask'));
process.nextTick(() => console.log('nextTick'));
console.log('sync');
// sync → nextTick → microtask
```

**规范建议**：**新代码用 `queueMicrotask`**，别用 `nextTick`——**递归 nextTick 会饿死 I/O**：
```js
function spin() { process.nextTick(spin); }   // ❌ 事件循环永远进不了 poll 阶段
spin();
```

Node 官方文档明确："Using `process.nextTick` recursively can starve the event loop of I/O operations."

---

## 九、Node 与浏览器**微任务时机**的区别

- **浏览器**：一个宏任务 = 一次 event loop tick → **执行完整个宏任务**才清微任务；
- **Node**（旧版本 ≤ 10）：每个 I/O callback 之间清一次微任务——**更细粒度**；
- **Node 11+**：与浏览器对齐——一个宏任务后清一次。

**结果**：同一段代码在 Node 与浏览器里微任务与 setTimeout 的相对顺序可能不同（Node 10 vs 11）。**记住**：Node ≥ 14 后基本与浏览器一致。

---

## 十、`async` 函数在事件循环里的位置

```js
async function foo() {
  console.log('1');
  await bar();
  console.log('2');
}
foo();
console.log('3');
```
**答**：`1 → 3 → 2`。`await` 之前的代码**同步**跑（在**当前宏任务**里），`await` 之后的代码进入**微任务队列**。

**深层**：V8 内部把 `await X` 拆成：
1. 求值 X（同步）；
2. `Promise.resolve(X).then(继续)` —— 每次 await 至少**一个**微任务；
3. 复杂情况可能 2-3 个 tick（V8 已优化到 1 个）。

**性能敏感**代码里连 await 也要**数着用**。

---

## 十一、真实工程模式

### 模式 1：**批量微任务合并**
Vue `nextTick` / React 18 并发渲染都基于此：状态变化 → 排入微任务队列 → 微任务末尾**一次性** flush 更新，避免连续 setData 触发 100 次重渲染。

### 模式 2：**长任务切分**
一次算 5 秒 → 拆 5000 个 1ms 微任务 → **浏览器每帧之间有空隙渲染**（不冻结 UI）。
```js
async function chunked(items, work) {
  for (let i = 0; i < items.length; i++) {
    work(items[i]);
    if (i % 100 === 0) await new Promise(r => setTimeout(r, 0));  // 让出一帧
  }
}
```

### 模式 3：**rAF 节流滚动**
`scroll` 事件秒级触发上百次 → 用 rAF 合并到帧率频率。
```js
let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { doHeavy(); ticking = false; });
});
```

### 模式 4：**微任务里 throw**
```js
queueMicrotask(() => { throw new Error('x'); });    // 触发 window.onerror / uncaughtException
Promise.reject(new Error('x'));                      // 触发 unhandledrejection
```
**监控埋点**要**同时**注册两者。

---

## 十二、自检清单

- [ ] 说出宏任务 vs 微任务 5 个例子。
- [ ] 描述事件循环一 tick 干了什么（浏览器版）。
- [ ] Node 六阶段顺序？`setImmediate` 在哪一阶段？
- [ ] `process.nextTick` 为什么可能饿死 I/O？
- [ ] 手写 `await` 让出一帧的代码。
- [ ] 为什么 `requestAnimationFrame` 更适合动画？

---

## 🚀 部署预告（本关点到，细节在 L10）

**事件循环与部署/构建：**

1. **微任务与 hydration**：SSR 页面 hydrate 阶段大量 Promise 微任务集中触发 → **首屏可交互时间**（TTI）取决于**微任务队列消化速度**。Vite 构建产物用**动态 import 分片**让微任务链**分帧消化**。
2. **`unhandledrejection` 监控**：Node 服务与前端都要注册；生产构建的 sourcemap **必须**上传（`.map` 与产物 URL 对齐），否则栈不可读。
3. **Babel 降级 async/await 引入 regenerator**——每次 await 会多**若干**微任务——target 老浏览器时**性能与顺序都有微妙变化**。
4. **polyfill 加载时机**：`core-js` 通过 TLA 或顶层 `.then` 注入，与业务代码**同处一个事件循环**——注意 polyfill 是否**阻塞**首个宏任务。
5. **首屏**：`requestAnimationFrame` 常用于**首屏动画与埋点触发**——构建产物要**避免** TTI 之前有大量 rAF 队列积压。
6. **`setTimeout(fn, 0)` 的最小延迟**：嵌套超过 5 层会钳到 4ms——构建工具与热重载代码要注意。

细节 L10 展开。**你现在只需要记住**：**能口算打印顺序 = 稳过异步面试题的一半；另一半是「微任务与错误处理」。**
