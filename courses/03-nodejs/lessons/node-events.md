# EventEmitter：Node 的事件驱动内核

> 目标：讲透 `EventEmitter` —— Node 里"发布/订阅"的最小原语。`fs.ReadStream`、`http.Server`、`socket`、`process` 全都是它的实例（呼应 node-basics 的 `process.on`、node-async-errors 的进程兜底事件）。掌握 `on/once/emit/removeListener`、**`'error'` 事件的特殊语义**（没人监听就抛未捕获异常）、`maxListeners` 泄漏告警、以及如何继承它设计自定义事件。

---

## 一、为什么整个 Node 都在"发事件"

Node 的哲学是**事件驱动**：一个耗时操作（读文件、来连接、收到字节）不阻塞主线程，而是"在合适时机**发一个事件**"，你提前注册好监听器去响应（呼应 node-event-loop 的 poll 阶段回调）。`EventEmitter` 就是这套机制的通用实现：

```js
import { EventEmitter } from "node:events";

const ee = new EventEmitter();
ee.on("greet", (name) => console.log("你好", name));   // 注册监听
ee.emit("greet", "小明");                                // 触发：同步按注册顺序调用所有监听
// 输出：你好 小明
```

关键：`emit` 是**同步**的——它当场把该事件的所有监听器按注册顺序依次调用完才返回（呼应 node-event-loop："事件"不代表"异步"）。异步的是"谁、什么时候去 `emit`"，而不是 `emit` 本身。

---

## 二、核心 API 一览

| 方法 | 作用 | 备注 |
| --- | --- | --- |
| `on(evt, fn)` / `addListener` | 注册监听，可重复触发 | 两者等价，`on` 更常用 |
| `once(evt, fn)` | 只触发一次后自动移除 | 适合"就绪/关闭"这类一次性信号 |
| `off(evt, fn)` / `removeListener` | 移除某个监听 | **必须传同一个函数引用** |
| `removeAllListeners([evt])` | 移除全部（或某事件全部） | 清理利器 |
| `emit(evt, ...args)` | 同步触发 | 返回是否有监听者 |
| `listenerCount(evt)` | 该事件监听数 | 排查泄漏 |
| `eventNames()` | 已注册的事件名数组 | — |

```js
function ready() { console.log("只打印一次"); }
ee.once("ready", ready);
ee.emit("ready");   // 打印
ee.emit("ready");   // 不再打印（once 已自动移除）

ee.on("data", h);
ee.off("data", h);  // ✓ 同一个 h 引用才能移除
ee.off("data", (...a) => h(...a));  // ✗ 新箭头函数，移不掉 → 泄漏
```

`removeListener` 在**当前这次 `emit` 中**移除的监听，若还没轮到它就不会被调用；`emit` 期间新增的监听，本次不会被调用（Node 在 emit 时对监听列表做了快照）。

---

## 三、`'error'` 事件：唯一的"雷区"语义

所有事件里，`'error'` 是**特殊**的：**`emit('error')` 时若没有任何 `'error'` 监听器，Node 不会安静返回，而是抛出一个未捕获异常，直接让进程崩溃**（呼应 node-async-errors 第四节 `uncaughtException`）：

```js
const stream = getSomeStream();
// ✗ 忘了挂 error 监听
stream.emit("error", new Error("读盘失败"));   // → 抛出 → 进程崩溃

// ✓ 任何可能 emit('error') 的对象，务必先挂监听
ee.on("error", (e) => logger.error(e));
ee.emit("error", new Error("读盘失败"));       // 被监听器接住，不崩
```

这不是玄学：`fs` 流、`net.Socket`、`http` 连接在出错时都会 `emit('error')`。**只要你不监听，错误就升级成进程级崩溃**。所以规则是："拿到一个 EventEmitter/流/socket，第一件事就是考虑它的 `'error'` 谁来接"（呼应 node-stream-pipeline 用 `pipeline` 正是为了统一收口这些 error 事件）。

其它事件名没有这种"没监听就崩"的语义——`emit('foo')` 无人监听只是返回 `false`、什么都不发生。

---

## 四、maxListeners：内存泄漏的哨兵

同一个事件注册过多监听器，往往是"忘了 `off`"的信号（每次请求都 `on` 一个、连接反复 `on`）。默认超过 **10 个**同事件监听，Node 往 stderr 打警告：

```
MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
11 data listeners added to [EventEmitter].
```

三种应对：

```js
ee.setMaxListeners(0);        // 0 = 不限制（确属正常时，如给多个子任务共用一个总线）
require("node:events").EventEmitter.defaultMaxListeners = 20;  // 全局调（慎用）
// ✓ 首选：反思是不是泄漏 → 用完 off / 用 once / 集中在一处注册
```

警告本身**不影响功能**，只是提示。真正要防的是"闭包持有大对象 + 永不移除"造成的真泄漏（呼应 node-deploy-perf 的泄漏排查）。

---

## 五、继承 EventEmitter 设计自定义事件

Node 内置对象大多"是一个 EventEmitter"。你也可以 `class` 继承它，把"状态变化"暴露成事件，让使用者解耦订阅：

```js
import { EventEmitter } from "node:events";

class Order extends EventEmitter {
  place(item) {
    this.item = item;
    this.emit("placed", item);          // 通知外界"已下单"
  }
  ship() {
    if (!this.item) { this.emit("error", new Error("还没下单")); return; }
    this.emit("shipped", this.item);    // ★ 别忘了外部要 on('error')
  }
}

const order = new Order();
order.on("placed", (i) => console.log("记录", i));
order.once("shipped", (i) => console.log("发货", i));
order.on("error", (e) => console.error("出错", e.message));  // 必须挂，否则崩
order.place("书");
order.ship();
```

好处：`Order` 不需要知道谁关心它的状态，发事件即可；关注方按需 `on/once`。这正是 `http.Server`（`on('request')`）、`ws` 库（`on('connection')`）的设计范式（呼应 node-http）。

---

## 六、事件与"背压 / 生命周期"的呼应

`EventEmitter` 是流的底座。流在生命周期末了会发 `'close'`、出错发 `'error'`、可读发 `'data'`、读完发 `'end'`（呼应 node-streams）。当消费端处理不过来时，流用 `pause()/resume()` 与内部缓冲实现**背压**，底层仍是事件驱动。理解 `emit` 同步、`'error'` 崩、监听要成对 `off` 这三点，就为 L4 的 stream 打好了地基。

---

## 七、常见坑速查

1. **`this` 丢失**：监听器里的 `this` 指向 EventEmitter 实例本身，用箭头函数会捕获外层 `this`——需要实例方法作监听时用 `ee.on('x', this.m.bind(this))` 或 class 字段箭头。
2. **匿名函数移不掉**：`on('x', () => ...)` 之后再 `off` 传新函数无效（引用不同）——要移除就得存下引用。
3. **`errorMonitor`**：`require('node:events').errorMonitor`（Symbol）可用来**只监听流/socket 的 `'error'` 而不抑制其余错误默认行为**，进阶用法。
4. **emit 返回值**：`ee.emit('x')` 返回 `boolean`——是否有监听者，可用来判断"有没有人接管"。

---

## 八、自检清单

- [ ] `emit` 是同步还是异步？为什么？
- [ ] `on` 和 `once` 的区别？怎么移除一个监听、为什么必须同一引用？
- [ ] 为什么 `emit('error')` 没有监听会导致进程崩溃？其它事件呢？
- [ ] `MaxListenersExceededWarning` 说明了什么？三种应对分别适合何时？
- [ ] 如何 `class` 继承 `EventEmitter` 设计自定义事件？和 `http.Server` 有何共通？
- [ ] `events.errorMonitor` 解决什么进阶场景？

---

## 🚀 部署预告

- 本关的 `'error'` 崩语义，是 L4 **node-streams / node-stream-pipeline** 里"为什么一定要处理流的 error、`pipeline` 帮你收口"的直接前提；
- `http.Server` 是 EventEmitter（`on('request')`），到 **node-http** 会亲手验证（呼应）；
- 监听器泄漏与 `setMaxListeners`，会在 **node-deploy-perf** 的内存/句柄泄漏排查里回马枪；
- 进程 `uncaughtException`/`SIGTERM` 都是 `process` 这个 EventEmitter 上的事件（呼应 node-async-errors、node-basics）。

下一关进入 **node-fs**：文件系统的同步、回调与 Promise 三副面孔。
