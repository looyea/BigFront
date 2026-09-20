# node-events 面试题精选

> 共 12 题，覆盖 **EventEmitter 基础语义 / `'error'` 事件雷区 / 监听器管理与泄漏 / 设计与应用 / 与其它异步原语对比** 五类。

---

## 一、EventEmitter 基础语义

### 1. `emit` 是同步还是异步？监听器执行顺序如何保证？

**`emit` 是同步的**：调用它时，Node 当场按**注册顺序**依次调用该事件的每个监听器，全部返回后 `emit` 才返回。所以：

```js
ee.on("x", () => console.log(1));
ee.on("x", () => console.log(2));
ee.emit("x");       // 同步打印 1 然后 2
console.log("after"); // 一定在后面
```

"事件驱动"给人的错觉是异步，其实异步来自**谁、何时去 `emit`**（比如 IO 完成后由 libuv 触发），而不是 `emit` 机制本身（呼应 node-event-loop）。另外 Node 在 `emit` 时对监听列表做了**快照**：emit 过程中新增的监听本次不触发，移除的若未轮到则不再触发。

**来源**：Node.js — "EventEmitter.emit (synchronous)"; 社区 — "is emit sync or async"

### 2. `on` 和 `once` 有什么区别？`once` 适合什么场景？

`on` 每次 `emit` 都会触发；`once` 触发**一次后自动把自己移除**（内部等价于回调执行完顺手 `off`）。适合"**一次性信号**"：连接建立、流 `ready`、进程收到某信号只处理一次等。注意：`once` 帮你自动移除，但**不会自动帮你处理 `'error'`**——一次性错误捕获仍要用 `once("error", ...)` 显式表达。

**来源**：Node.js — "emitter.once"; MDN — "once listener pattern"

---

## 二、`'error'` 事件雷区

### 3. `emitter.emit('error', err)` 时没有 `'error'` 监听器，会发生什么？为什么这样设计？

**抛出未捕获异常、默认使进程崩溃**（呼应 node-async-errors 的 `uncaughtException`）。这是 `'error'` 独有的特殊语义，其它事件名无监听只是 `emit` 返回 `false`、无事发生。设计动机：错误是"必须被严肃对待"的信号，如果允许悄悄 `emit('error')` 而无人接管，就会制造**静默吞错**这一最难排查的问题；Node 选择"**宁可崩也不要咽掉错误**"（fail-fast）。教训："拿到流/socket/EventEmitter，先想清楚它的 `'error'` 谁来接。"

**来源**：Node.js — "'error' event special behavior / EventEmitter"; 社区 — "unhandled error event crashes node"

### 4. 什么是 `events.errorMonitor`？它解决什么进阶痛点？

`require('node:events').errorMonitor` 是一个 Symbol。通常你为了捕获流/socket 的错误而 `on('error', ...)`，但这会**抑制** `'error'` 无人监听即崩的默认行为——有时你想"只旁观记录错误、但不接管它、仍保留默认崩溃语义"。用 `ee.on(errorMonitor, handler)` 注册的监听器会在每次 `'error'` emit 时被调用，**却不改变**"若无常规 error 监听则抛错崩溃"的行为。适合框架层做统一错误埋点而不改变下游错误处理契约。

**来源**：Node.js — "events.errorMonitor symbol"

---

## 三、监听器管理与泄漏

### 5. `removeListener`/`off` 为什么有时移不掉监听？如何正确移除？

因为移除**必须传入注册时同一个函数引用**。`on('x', () => foo())` 注册的是匿名函数，之后 `off('x', () => foo())` 传的是**另一个新函数对象**，引用不同 → 移除无效 → 泄漏。正确姿势：把监听器存成具名变量/字段，`on` 和 `off` 用同一个引用；或一次性场景直接用 `once`。

```js
const h = () => foo();
ee.on("x", h);
ee.off("x", h);   // ✓ 同一引用
```

**来源**：Node.js — "emitter.removeListener requires same reference"; 社区 — "anonymous listener leak"

### 6. `MaxListenersExceededWarning` 是怎么回事？怎么处理才是对的？

同一个事件监听器数量超过默认上限（**10**）时，Node 向 stderr 打此警告，提示"可能内存泄漏"。常见成因：在**每次请求/每个连接/循环体内**都 `on` 一个监听却从不 `off`。正确处理顺序：① **先排查是否真泄漏**（是不是该 `once`、该成对 `off`、该集中注册）；② 确属正常（如一条总线合法服务多个订阅者）再 `setMaxListeners(n)` 或 `setMaxListeners(0)`（不限）。切忌一上来就调大数字掩盖问题。警告本身不影响功能，只是哨兵（呼应 node-deploy-perf 泄漏排查）。

**来源**：Node.js — "MaxListenersExceededWarning / setMaxListeners"; 社区 — "why too many listeners warning"

---

## 四、设计与应用

### 7. 如何用 class 继承 EventEmitter 设计"自定义事件"？举一个真实框架里的同款设计。

```js
class Connection extends EventEmitter {
  onData(buf) { this.emit("data", parse(buf)); }
  onClose()   { this.emit("close"); }
}
const c = new Connection();
c.on("data", handle); c.on("close", () => cleanup());
```

核心是**发布方不依赖订阅方**：`Connection` 只管在关键节点 `emit`，谁关心谁 `on`，实现解耦。同款真实设计俯拾皆是：`http.Server` 发 `'request'`、`net.Socket` 发 `'data'/'close'/'error'`、`ws` 库发 `'connection'/'message'`、Express 的中间件体系与 `app` 本身（呼应 node-http）。

**来源**：Node.js — "extending EventEmitter"; Express — "application object is an EventEmitter"

### 8. EventEmitter 的发布订阅和"观察者模式"是什么关系？适合/不适合用它的场景？

EventEmitter 是**观察者模式**的具体实现：subject（emitter）维护 observer 列表（监听器），状态变化时 `emit` 通知。适合：**一对多通知**、**解耦生产者与消费者**、**异步生命周期信号**（IO、连接、流）。不适合：① **需要"结果/返回值"的一对一异步**——那该用 Promise（`once-promise`/`events.once` 可在事件上包一层）；② **需要背压的数据流**——裸 EventEmitter 不做流控，得用 Stream（呼应 node-streams）；③ **跨进程**——EventEmitter 只在同进程内有效，进程间要 IPC/消息队列（呼应 node-child-process）。

**来源**：Node.js — "events module"; Refactoring Guru — "Observer pattern"

### 9. `events.once(emitter, name)` 这个工具解决什么？

`require('node:events').once` 返回一个 Promise，在下次该事件触发时 resolve（并把多参数收集成数组），同时**自动挂一个 `'error'` 监听**：若期间 emitter 发 `'error'`，Promise 直接 reject，避免"用 once 等一个普通事件时，错误事件因没人监听而崩进程"。适合"只想 await 某个一次性事件"的现代 async 代码：

```js
import { once } from "node:events";
await once(server, "listening");   // 等端口就绪
```

它把"事件"桥接回"Promise/await"世界（呼应 node-async-errors）。

**来源**：Node.js — "events.once helper"

---

## 五、与其它异步原语对比 & 排错

### 10. Promise 和 EventEmitter 各擅长什么？能互相转换吗？

**Promise**：一对一、有明确"完成/失败"结果、可 `await`/组合（`all/allSettled`），天生携带错误链。**EventEmitter**：一对多、可反复触发、无"最终结果"语义、错误靠约定 `'error'` 事件。转换：一次性事件用 `events.once` 转成 Promise（第 9 题）；反之可用 `callbackify` 或手动在 `resolve` 里 `emit`。经验法则：**"有结果" 用 Promise，"有信号/广播" 用事件**。Node 现代 API 把"结果型"操作都 Promise 化了（`fs.promises`），把"流式/多次通知"保留为事件（呼应 node-fs、node-streams）。

**来源**：Node.js — "events vs promises"; 社区 — "when to use EventEmitter vs Promise"

### 11. 线上出现 "Possible EventEmitter memory leak detected"，但业务其实正常，怎么系统排查？

① **定位对象**：警告里会带 `[EventEmitter]`/构造名，配合 `--trace-warnings` 打印出是**谁**在涨；② 看该事件监听是否**随请求/连接线性增长**（每次 `on` 不 `off` = 真泄漏）——若是，改用 `once`、复用单一监听、或 `removeAllListeners`；③ 若确属"一个总线合法挂了很多订阅者"，则用 `setMaxListeners(n)` 显式声明合理上限，别用全局 `defaultMaxListeners`；④ 用 `listenerCount()` 打点验证修复后数量稳定（呼应 node-deploy-perf）。关键：**先证伪"真泄漏"，再谈放宽阈值**，否则放宽只是把 OOM 推迟。

**来源**：Node.js — "--trace-warnings / setMaxListeners"; 社区 — "debug MaxListeners leak warning"

### 12. 你会怎么给一个"任务队列"用 EventEmitter 设计事件接口，并避免常见坑？

设计：`class TaskQueue extends EventEmitter`，在关键节点发语义清晰的事件——`'enqueue'(task)`、`'start'(task)`、`'done'(result)`、失败发 `'error'(err, task)`。避坑清单：**① 一定记得 `'error'` 无人监听会崩**，文档里明确要求使用方 `on('error')`，内部也可用 `errorMonitor` 兜底埋点；**② 提供 `off` 对应接口或让用户用 `once`**，防止使用方反复订阅造成泄漏；**③ 监听器里 `this`** 用箭头/bind 固定；**④ 事件保持"通知"职责**，别在监听器里塞会抛错且未处理的重逻辑（那是订阅方的责任，呼应 node-async-errors 分层错误处理）；**⑤ 若关心"某任务何时完成"的返回值**，对单次任务额外暴露一个 `run(task): Promise`（内部用 `events.once` 包），兼顾"广播"与"取结果"两种需求（呼应第 9、10 题）。

**来源**：Node.js — "EventEmitter design guidance"; 社区 — "designing event-based APIs in Node"
