# 面试题 · ES2021

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）`a ||= b`、`a = a || b` 有什么细微差别？**
- 参考要点：逻辑赋值是**短路赋值**——当 a 已为 truthy 时，`a ||= b` **不执行赋值**（不触发 setter、不重新写属性）；而 `a = a || b` 无论如何都会把 a 再写一遍。对带 setter 的属性 / Proxy（set trap 计数）/ 响应式系统，这个差别可观察。
- 来源：MDN 逻辑赋值运算符；TC39 logical-assignment-operators(ES2021)。

---

**2）`??=` 与 `||=` 给默认值时的行为差别？哪个更安全？**
- 参考要点：`||=` 在左值为 **falsy**（0 / '' / false / null / undefined）时赋右值；`??=` 只在 **nullish**（null / undefined）时赋右值，**保留 0 / '' / false**。当「0、空串是合法值」时 `??=` 更安全（现代默认）。
- 来源：MDN；TC39(ES2021)；2ality。

---

**3）`Promise.any` 与 `Promise.race` 的区别？各适合什么？**
- 参考要点：`race` 取**第一个 settle**（无论成功或失败）——先 reject 你就先拿到错误；`any` 取**第一个 fulfilled**，忽略失败，**全部 reject** 才抛 `AggregateError`。用途：race 做**超时**（配一个 reject 的 timer）；any 做**多源竞速取最快成功**（CDN 备援）。
- 来源：MDN Promise.any/race；TC39 promise-any(ES2021)。

---

**4）`Promise.any` 全失败时抛的是什么？怎么拿到所有错误？**
- 参考要点：抛 **`AggregateError`**（ES2021 同时新增该错误类型），`err.errors` 是一个包含所有 reject reason 的数组。注意它不是普通 Error 的 `cause`，而是专门聚合多个错误。
- 来源：MDN AggregateError；TC39(ES2021)。

---

**5）`replaceAll` 相比 `replace` 解决了什么坑？传正则时的限制？**
- 参考要点：`replace(str, ...)` 传字符串只替换**第一个**，想全替换得写 `/-/g` 正则（易忘 g）。`replaceAll('-', '_')` 直接全替换，参数是字符串时不需要正则。**限制**：若第一个参数传**正则**，该正则**必须带 g**，否则抛 `TypeError`。
- 来源：MDN String.replaceAll；TC39(ES2021)。

---

**6）数字分隔符 `_` 会影响运行时值或类型吗？书写规则有哪些？**
- 参考要点：不影响，`1_000 === 1000` 为 true，`typeof` 仍是 number，纯粹提升可读性。**规则**：不能位于数字**首/尾**、不能**紧邻小数点**、不能**连续两个**。 BigInt（`1_000n`）也支持。
- 来源：MDN 数字字面量；TC39 numeric-separators(ES2021)。

---

**7）`WeakRef` 与 `WeakMap` 都能弱引用，区别在哪？**
- 参考要点：`WeakMap` 是**键弱引用**、需要一张表管理；`WeakRef` 是**对单个对象的弱引用句柄**，用 `.deref()` 取回（可能 undefined）。WeakRef 适合「缓存若干大对象但不阻止其回收」的细粒度场景，WeakMap 适合「以对象为键附加元数据」。
- 来源：MDN WeakRef/WeakMap；TC39 symbols-as-weakmap-keys 与 WeakRef(ES2021)。

---

**8）为什么「不要」用 `FinalizationRegistry` 关闭资源/连接？**
- 参考要点：它的回调依赖 **GC 时机**，而 GC **不保证发生、不保证何时发生**，甚至在页面卸载时可能不跑。用它做**正确性关键**的清理（关 socket、释放锁、扣费）会导致**泄漏或错序**。只适合「丢了也无所谓」的提示性索引清理。
- 来源：MDN FinalizationRegistry「Warning」；TC39(ES2021)；V8 blog。

---

**9）以下代码打印什么？**
```js
let x = NaN;
x ??= 1;
x ||= 2;
console.log(x);
```
- 参考要点：先 `x ??= 1`：NaN 非 nullish，保留 NaN；再 `x ||= 2`：NaN 是 falsy，赋值 → x = 2。输出 `2`。**追问**：`??` 判的是 nullish 不是 NaN——`NaN ?? 1` 得 NaN。
- 来源：MDN；TC39(ES2021)；StackOverflow。

---

**10）`Promise.any([])`（空数组）会发生什么？**
- 参考要点：立即 **reject**，原因是 `AggregateError`（errors 为空数组）——因为没有任何 promise 能 fulfilled。**对比**：`Promise.all([])` 立即 resolve 空数组；`Promise.allSettled([])` 立即 resolve 空数组；`Promise.race([])` **永远 pending**。
- 来源：MDN Promise.any；TC39(ES2021)。

---

**11）如何对 `WeakRef` / `FinalizationRegistry` 做兼容性处理？**
- 参考要点：二者**无法 polyfill**（依赖引擎真正的 GC 语义）。用特性检测降级：`if (typeof WeakRef === 'function') { 用弱引用缓存 } else { 退回普通 Map + 手动淘汰 }`。构建时把它们标为「需 target 支持」，别指望 core-js 补上。
- 来源：MDN「Polyfill 不可能」注记；caniuse；TC39(ES2021)。

---

**12）现场手写：用 ES2021 特性实现「多 CDN 竞速 + 结果缓存（惰性初始化）」。**
- 参考要点：
  ```js
  const cdns = ['https://a/x.js', 'https://b/x.js', 'https://c/x.js'];
  cache.url ??= await Promise.any(
    cdns.map(u => fetch(u, { method: 'HEAD' }).then(r => { if (!r.ok) throw r; return u; }))
  );   // 取最快可用的 CDN；命中缓存则跳过
  ```
  用到 `??=`（惰性初始化）、`Promise.any`（竞速取最快成功、忽略失败源）、`AggregateError`（全挂时兜底）。
  **追问**：想「3 秒没成功就用默认」→ 与一个 `timeout()` race。
- 来源：MDN Promise.any / logical assignment；GreatFrontEnd 场景题；TC39(ES2021)。

---

**13）WeakRef 和 FinalizationRegistry 的正确心智模型与坑是什么？**
- 参考要点：GC 时机完全由引擎决定：**不保证回调何时跑、甚至不跑**；跨 realm/带循环引用可能永远不触发 registry 回调。所以铁律：FinalizationRegistry 只能做「清理加速器」（提前释放显存/句柄），不能做正确性依赖（计数、结算、数据落盘）——要确定性清理用显式 dispose 协议 + try/finally（或 ES2026 的 using 语法）。WeakRef 的正当场景：内存缓存表（deref 判活）、DOM 节点弱持有。
- 来源：MDN《FinalizationRegistry》"caveats" 章节；v8.dev《WeakRef and FinalizationRegistry》。

---

**14）replaceAll 相比 replace 修了什么？正则版有什么强制要求？**
- 参考要点：`replace(搜索串, x)` 只换第一处、且参数带正则才有全局语义——字符串模式写 /|/g 之类根本不对。replaceAll 对**字符串模式即全替换**；传正则时必须带 g 旗标否则 TypeError（防止「以为全局其实没有」继续存在）。底层语义：匹配后按**不重叠**推进，替换串里的 `$<name>` 支持命名组。老代码 `split(sep).join(x)` hack 全部可以替换掉。
- 来源：MDN《String.prototype.replaceAll》；tc39/proposal-replaceAll 动机（g-only 正则约束）。

---

**15）数字分隔符的书写规则有哪些？会影响运行时吗？**
- 参考要点：纯源码层糖：解析后不存在任何痕迹（值、typeof、序列化全不受影响）。规则：只能夹在**数字之间**——开头/结尾/相邻两个 `1__0`、`1._0`、`0x_1` 之外的非法位都 SyntaxError；BigInt 也行 `1_000n`。工程收益是读数：`1_000_000`、`0b1111_0000`、信用卡号分段；配合 eslint `no-numeric-separators` 反向禁用属于团队口味问题。
- 来源：MDN《Numeric separators》；tc39/proposal-numeric-separator 语法边界用例表。
