# 面试题 · ES2024

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）`Object.groupBy` 与 `Map.groupBy` 的区别？各适合什么场景？**
- 参考要点：Object.groupBy 返回**原型 null** 的对象，键只能 string/symbol，整数键自动排序；Map.groupBy 返回 Map，键**任意类型**，保持**插入顺序**。场景：groupBy 结果是**枚举分类**（有限种类）用 Object；**动态键**（用户 ID / 对象做 key）或需要 `.size` 用 Map。
- 来源：TC39 groupBy 提案；MDN；Node 21+。

---

**2）`Promise.withResolvers` 解决了什么以前不好写的场景？**
- 参考要点：以前要在**构造器外**拿 resolve/reject 只能用 hack（把 `new Promise` 的 executor 里的参数赋值给外部变量）——代码**丑且易忘**。`Promise.withResolvers()` 一步解构。场景：class 方法里「外部 resolve」一个 promise（Modal.show / queue.push / lazy cache / IPC 回调注册）。
- 来源：TC39 promise-withresolvers 提案；MDN；Node 22+。

---

**3）`ArrayBuffer.transfer()` 与 `.slice()` 有什么本质区别？**
- 参考要点：`transfer` 是**零拷贝**——转移底层内存所有权，原 buffer **detached**（byteLength=0）；`slice` 是**复制**——两份独立内存。性能：transfer O(1) 与大小无关；slice O(n)。场景：Web Worker 传大数据、GPU buffer 管理。
- 来源：TC39 resizable-arraybuffer 提案；MDN ArrayBuffer.transfer。

---

**4）`String.isWellFormed` / `toWellFormed` 解决什么问题？给一个真实事故场景。**
- 参考要点：**代理对截断**——网络分包 / `String.prototype.substr` 在中间切断 / 数据库字段截断 → 产生**不合法的 UTF-16 字符串**；JSON.stringify / URL / DOM 接口都会**抛错**或产生替代字符。`isWellFormed` 检测；`toWellFormed` 用 `\uFFFD` 替换不合法代理。
- 来源：TC39 well-formed 提案；MDN；多份 Unicode 截断事故报告。

---

**5）`Atomics.waitAsync` 为什么需要？与 `Atomics.wait` 的区别？**
- 参考要点：`Atomics.wait` **阻塞当前线程**——主线程用就冻结 UI；只能在 Worker 里跑。`waitAsync` 返回 `{ async, value }`——`value` 是 Promise，**主线程可用**。场景：SharedArrayBuffer + 跨 Worker 同步 + UI 不冻结。
- 来源：MDN Atomics.waitAsync；TC39 提案；web.dev（COOP/COEP 前提）。

---

**6）`Array.fromAsync` 怎么用？与 `for await...of` + `push` 比有什么优势？**
- 参考要点：`await Array.fromAsync(asyncIterable)` → 直接得到数组。**优势**：一行替代手写循环 + push + 等全部完成。内部是**并发**调 next（不是串行），性能更好。**限制**：需要 iterable 能**并发安全**。
- 来源：TC39 array-fromasync 提案；Node 22+。

---

**7）`Object.groupBy` 返回值的原型为什么是 null？**
- 参考要点：避免继承 `Object.prototype` 上的方法（toString / hasOwnProperty / constructor）污染分组键——如果有一个分组叫 'toString'，Object.prototype.toString 会被 shadow。**null proto** = **纯字典**，无原型干扰。
- 来源：TC39 groupBy 提案讨论；MDN。

---

**8）以下代码打印什么？**
```js
const buf = new ArrayBuffer(8);
new Uint8Array(buf)[0] = 42;
const t = buf.transfer();
console.log(new Uint8Array(buf)[0], new Uint8Array(t)[0]);
```
- 参考要点：`undefined 42`（或 `0 42`）。buf 被 **detached**，读写返回 0/undefined；t 持有全部 8 字节。
- 来源：MDN ArrayBuffer.transfer；V8 blog。

---

**9）ES2024 对 `structuredClone` 做了什么补充？**
- 参考要点：`structuredClone` 现在支持克隆 **ArrayBuffer（含 resizable）**、**DataView** 等新类型；配合 `transfer` 可以在 Worker 间**零拷贝传递**。
- 来源：HTML Living Standard；MDN structuredClone。

---

**10）**`toWellFormed` 和 `normalize` 有什么区别？**
- 参考要点：`normalize('NFC')` 处理**编码等价**（é = e + ́ → 单码点 é）——字符串**合法**但形式不同；`toWellFormed` 处理**编码不合法**（代理对截断）——修复成合法 UTF-16。两者互补：先 toWellFormed 保证合法性，再 normalize 统一形式。
- 来源：MDN；Unicode TR15。

---

**11）ES2024 的 `Promise.withResolvers` 和 Node.js `stream.Readable.fromWeb` 有什么关系？**
- 参考要点：Node / 库内部**大量**需要「在异步回调里 resolve」的模式——以前手写 `new Promise((res) => { resolve = res })` 到处都是。`withResolvers` 让这个模式**标准化且清晰**。Node 22 内部已大量使用。
- 来源：Node.js changelog；GitHub PR 讨论。

---

**12）现场手写：用 `Object.groupBy` + `toWellFormed` 做一个「安全分组 API 响应」。**
- 参考要点：
  ```js
  function safeGroupBy(items, keyFn) {
    const safe = items.map(i => typeof i === 'string' ? i.toWellFormed() : i);
    return Object.groupBy(safe, keyFn);
  }
  // 场景：后端返回含不完整 emoji 的 name，分组时不能崩溃
  const grouped = safeGroupBy(users, u => u.dept?.toWellFormed() ?? 'unknown');
  ```
- 来源：MDN；多份 Unicode 安全处理文章。

---

**13）ArrayBuffer 家族的多线程版图：SAB、Atomics、transfer 怎么配合？**
- 参考要点：SharedArrayBuffer 让多 Worker 看同一段内存；Atomics（wait/notify/compareExchange/waitAsync ES2024）提供同步原语——经典模式：主线程 Atomics.wait 挂起等 worker notify（UI 线程禁用 wait，会死锁，waitAsync 就是为可取消场景补的）。transfer 是「所有权转移」防双写竞态：转移后 detach。大流量数字信号走 SAB+Atomics 无锁环形队列；普通数据用 structuredClone+transfer 零拷贝投递。COOP/COEP 跨源隔离是 SAB 的部署前提（侧信道 Spectre 治理）。
- 来源：MDN《Atomics.waitAsync》；web.dev《COOP+COEP 与 SharedArrayBuffer》；html.spec 内存模型。

---

**14）toWellFormed 和 normalize 各修什么？文本管线里的 surrogate 事故怎么防？**
- 参考要点：normalize(NFC/NFD) 处理**组合字符等价**（e+́ 与 é）；toWellFormed 处理**编码残缺**（孤立代理对→U+FFFD 或剔除）。事故模板：按 code unit 截断字符串（定长字段/分片）切开 emoji 代理对 → 半个 surrogate 进 DB/JSON（配合 ES2019 well-formed stringify 变 ?）。防线：截断用 `Intl.Segmenter`（grapheme 意识）或 Array.from（码点数组）再 join；入库前 toWellFormed 洗一次；长度统计用 `Array.from(s).length` 别信 s.length。
- 来源：MDN《String.prototype.toWellFormed》；Unicode TR15（Normalization）+ 代理对截断事故讨论。

---

**15）Promise.withResolvers 落地在哪些模式？和旧 Deferred 有何异同？**
- 参考要点：三处高频：① 握手/队列（消息 ID → 外部事件 resolve，RPC 客户端）；② 手动控制异步流（流背压里等消费方 ready）；③ 测试（可控完成时机）。相比 jQuery/bluebird 的 Deferred：只有原生 promise（无状态查询/进度链），但换来规范语义——resolve 一次性、thenable 协议一致。注意：executor 捕获写法 `let r; new Promise(res => r = res)` 与 withResolvers 完全等价，后者只是省掉「可变变量」这层坏味道。
- 来源：tc39/proposal-promise-with-resolvers 动机（stage-2.7 讨论帖）；MDN《Promise.withResolvers》。
