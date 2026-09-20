# 面试题 · structuredClone 与序列化

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）`JSON.parse(JSON.stringify(obj))` 深拷贝有什么坑？说出至少 7 条。**
- 参考要点：① undefined / 函数 / Symbol 作对象 value 时**属性被删**；② NaN / Infinity / -Infinity → null；③ BigInt → 抛 TypeError；④ Date → 字符串（失去方法）；⑤ RegExp → `{}`；⑥ Map / Set → `{}`；⑦ 循环引用抛 TypeError；隐藏坑：原型链丢、getter/setter 丢、非枚举属性丢、toJSON 会被调用。
- 来源：MDN `JSON.stringify`；StackOverflow 高票；lodash.cloneDeep 文档对比。

---

**2）structuredClone 支持哪些类型？不支持哪些？**
- 参考要点：**支持**：所有 primitive 含 BigInt、Array/Object/Map/Set/Date/RegExp/Error、ArrayBuffer/SharedArrayBuffer/TypedArray/DataView、Blob/File/ImageData/ImageBitmap/CryptoKey、循环引用；**不支持**：函数、Symbol（作值抛错，作 key 静默丢）、DOM 节点、带 `[[ThrowIfDetached]]` 已分离的 buffer、Error 的 cause 与栈部分字段（不同实现有差异）、原型链、getter/setter 语义、非枚举属性。
- 来源：HTML Standard《Structured clone》；MDN `structuredClone`。

---

**3）`structuredClone(new Foo())` 后 `instanceof Foo` 为什么失败？如何正确克隆类实例？**
- 参考要点：结构化克隆产物是**普通对象**，原型链不保留（HTML 规范明说）。要保留：手写递归 `Object.create(Object.getPrototypeOf(v), ...)` 或用 `lodash.cloneDeep`（后者也只是拷贝自有可枚举，仍然丢原型）；真要保留类语义，只能自己实现 `Symbol.for('clone')` 协议或给类加 `.clone()` 方法。
- 来源：HTML 标准；StackOverflow《structuredClone and prototypes》。

---

**4）`transfer` 参数干什么用？给一个性能敏感场景。**
- 参考要点：把 ArrayBuffer/MessagePort/OffscreenCanvas 等 transferable **转移所有权**而不是拷贝字节——原对象变空（byteLength 0）。**场景**：Web Worker 里做 FFT / 图像滤镜，一次传 4MB 图像 Buffer，用拷贝要多花 3-5ms，用 transfer 只是**指针交接** O(1)。这是 Canvas 离屏渲染、AudioWorklet、WASM 数据交换的基础。
- 来源：HTML Standard《Transferable》；web.dev《Speed up your website with the Cache API》Worker 段。

---

**5）现场手写 `deepClone(obj)`，处理：循环引用、原型链、getter/setter、Symbol 键、Date/RegExp/Map/Set/TypedArray。**
- 参考要点：WeakMap 记录已拷对象处理循环；`Object.create(Object.getPrototypeOf(obj), ...)` 保留原型；`Reflect.ownKeys` 遍历含 Symbol + 不可枚举；`getOwnPropertyDescriptor` + `defineProperty` 保留 getter/setter（**不能对带 get/set 的描述符再递归 value**）；特殊类型按 `instanceof` 分支。
- 来源：多份中文手写题；lodash.cloneDeep 源码；MDN。

---

**6）JSON.stringify 的第二个参数 replacer 与第三个参数 space 分别怎么用？**
- 参考要点：
  ```js
  JSON.stringify(x, (key, value) => typeof value === 'function' ? undefined : value, 2);
  JSON.stringify(x, ['id', 'name'], 4);   // 白名单数组
  ```
  replacer 也可以返回包装对象用于恢复；`toJSON` **优先于** replacer 被调用。**追问**：如何用 replacer + reviver 完整序列化 Date / Map / Set？→ 用 `__type` 标记；或用 `structuredClone` 免手工。
- 来源：MDN `JSON.stringify`；jsonlint 讨论。

---

**7）说说 JSON.stringify 与 structuredClone 的性能对比。**
- 参考要点：小对象差不多；**大对象**（>10MB）时 structuredClone 通常更快（走 C++ 内部实现，无字符串中间态）；JSON 大法要走「转字符串 → 解析」两遍，产生临时字符串内存开销。跨 Worker 时 structuredClone + transfer 明显优于 JSON。
- 来源：web.dev 性能文章；MDN。

---

**8）`toJSON` 方法的调用时机与优先级？**
- 参考要点：JSON.stringify 遇到**带 toJSON 的属性**（Date、Moment、Decimal.js 等）时**优先调用它**，用返回值代替原对象；replacer 后于 toJSON 被调用；structuredClone **不走** toJSON。想绕过：`Object.assign({}, withToJSON)` 剥离原型。
- 来源：ECMA-262 §20.6.1.4；MDN `toJSON`。

---

**9）Error 对象 structuredClone 之后 `.stack` 还在吗？为什么？**
- 参考要点：**部分保留**——现代浏览器会保留 message/name/自定义字段，**stack 字符串**可能保留但**不保证能反向映射到原代码**（因为栈指向的函数在克隆方无意义）。**追问**：错误上报时不能靠 structuredClone 转发 Error——要**上报原始堆栈字符串 + sourcemap** 让服务端还原。
- 来源：MDN `structuredClone`；Sentry 官方文档《Handling Errors》。

---

**10）如何在 SSR（Next/Nuxt）里把带函数 / Map / 类实例的 state 传到客户端？**
- 参考要点：**不能直接传**——SSR 序列化边界本质是 structuredClone 类协议（Next flight 走类 RSC 序列化、Nuxt payload 走 JSON + 自定义 replacer）。工程做法：① state 里**只放纯数据**（这是 React/Vue 官方约定）；② 函数变成客户端引用的 hook 或 action id；③ Map/Date 用自定义 replacer；④ 类实例转成 plain object + 类型标签，客户端 hydrate 时 new 回来。
- 来源：Next.js App Router RSC 序列化文档；Nuxt 3 payload 源码。

---

**11）什么是 `MessageChannel`？它和 structuredClone 什么关系？**
- 参考要点：一对 `port1`/`port2` 双向消息通道，`postMessage(msg)` 内部就走结构化克隆算法。**用途**：宏任务调度（`setTimeout(0)` 的替代）、Worker 与主线程通信、跨 iframe 通信、`scheduler.yield()` 类 API 的底层。追问：为什么 setTimeout 有时会被 clamp 到 4ms 而 MessageChannel 不会？—— 事件循环 task source 不同。
- 来源：HTML Standard《Channel messaging》；MDN。

---

**12）`Object.freeze` + 深冻结 vs `structuredClone`，React 状态管理里各扮演什么角色？**
- 参考要点：**freeze（dev 模式）**：防止意外修改，出错就抛——Redux dev 环境常用；**structuredClone**：做**快照**（undo/redo 历史、时间旅行调试器）——每次 dispatch 前把 state 克隆一份存档。**追问**：Redux DevTools 的时间旅行是怎么实现的？→ 每次 action 存一份 state 的**深拷贝**（老版本用 JSON 大法，新版用类似 structuredClone 的算法）。
- 来源：Redux 源码 `createStore.js`（dev 环境 deepFreeze）；Redux DevTools 文档。
