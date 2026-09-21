# 面试题 · ES2025

> 本关所有面试题**整理自公开互联网题库与官方 spec 摘要**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。**版本归属以 tc39.es / 262.ecma-international.org 为准。**

---

**1）Iterator Helpers 与 `Array.prototype.map/filter` 的本质区别？**
- 参考要点：① **惰性** vs 急切——Array 每步遍历全量并**新建中间数组**，Iterator 助手逐个流过、按需计算；② 能作用于**任意可迭代对象/生成器/无限流**，Array 方法要求是先有完整数组；③ 需要**终端操作**（toArray/reduce/…）才真正执行。**追问**：为什么小数组用 `arr.map` 反而够用？——短链一次性物化开销小，Iterator 优势体现在大/无限/流式。
- 来源：TC39 Iterator Helpers 提案；2ality；InfoWorld ES2025 综述。

---

**2）`Iterator.from(gen()).take(3)` 为什么不会卡死在无限生成器上？**
- 参考要点：`take` 是**惰性短路**——只从源拉取所需数量即调用生成器的 `return()` 停止；直到终端 `toArray()` 才驱动，且只会驱动 3 次迭代。Array 的 `slice` 要求先把整个数组构造完，无限源根本构造不出来。
- 来源：TC39 提案；MDN Iterator。

---

**3）`arr.map` 和 `Iterator.from(arr).map` 结果一样吗？迭代器链能复用吗？**
- 参考要点：`toArray()` 后值相同，但语义不同（惰性 vs 急切）。**关键**：Iterator 链**是一次性**的，被终端消费后再迭代为空；要复用得重新 `Iterator.from` 或 `toArray()` 存起来。Array 数组可反复 map。
- 来源：MDN；StackOverflow。

---

**4）`Promise.try` 解决什么问题？和 `Promise.resolve().then(fn)`、`try/catch` 各差在哪？**
- 参考要点：`Promise.resolve().then(fn)` 能把同步错误转成 rejection 但**可读性差**；手写 `try { return Promise.resolve(fn()) } catch(e){ return Promise.reject(e) }` 太啰嗦。`Promise.try(fn)` 一行：**无论 fn 同步抛错还是返回 rejected，都统一成 Promise**，错误都归到链尾 `.catch`。**追问**：async 函数其实也有这效果——但 Promise.try 适合包「不确定是否为异步」的普通函数。
- 来源：TC39 promise-try 提案；MDN；V8 blog。

---

**5）`RegExp.escape` 防的是什么？给一个不用它出 bug 的例子。**
- 参考要点：防**正则注入/意外语义**。如把用户搜索词直接 `new RegExp(userQuery)`：输入 `.*` 会匹配一切、`(` 会抛 SyntaxError、极端情况引发 ReDoS。`RegExp.escape(userQuery)` 把元字符转义，按**字面量**匹配。**类比**：SQL 参数化防注入。
- 来源：TC39 regexp.escape 提案；MDN；OWASP ReDoS。

---

**6）`Math.sumPrecise` 能彻底解决浮点误差吗？它精确的是什么？**
- 参考要点：**不能**。它做的是「把一串 double **精确累加**、**只在最终舍入一次**」，消除的是**累加顺序/中间舍入误差**；结果仍是双精度 Number，`0.1` 本身不可精确表示的问题依旧。要真正十进制精确得用 BigDecimal/整数分单位。**追问**：什么时候值得用？——大量浮点求和（统计、金额按分转元前）需要比朴素 reduce 更稳的总和。
- 来源：TC39 Math.sumPrecise 提案；MDN。

---

**7）ES2025 允许「同名 getter/setter」是什么意思？之前会怎样？**
- 参考要点：对象字面量/class 里 `get x()` 与 `set x()` **共享同一个键名**，ES2025 前重复键触发早期 `SyntaxError`（哪怕一个是 get 一个是 set）。现在规范**特批** get/set 成对同键合法。ESLint `no-dupe-keys` 也随之放行该组合。
- 来源：TC39「Allow get and set to share a name」提案；MDN。

---

**8）`using`（显式资源管理）和装饰器是 ES2025 的特性吗？**
- 参考要点：**不是**。二者至今（截至 ES2025/16 版）**未进入语言标准**，仍在 TC39 推进，业界多预计落到 **ES2026**。很多「ES2025 新特性」文章把它们混进来是**误传**。工程里 `using` 目前靠 TypeScript 5.2+ 编译到 WeakRegistry 等 polyfill 使用，装饰器靠 Babel/TS 插件。**答题落点**：体现你有**版本核对**意识。
- 来源：TC39 提案仓库状态；TypeScript 5.x 文档；2ality。

---

**9）Iterator Helpers 怎么和异步数据源配合？**
- 参考要点：异步版挂在异步迭代器上（`Symbol.asyncIterator`），配 `for await`。`Iterator.from(asyncIter).map(...).take(n)`，`take` 提前结束会**尽早 `return()` 关闭上游流**。典型：处理 ReadableStream / 逐行日志 / 分页拉取（呼应 [es-2018](es-2018.md) for-await）。
- 来源：TC39 提案（含 async 助手）；Node.js stream 文档。

---

**10）以下代码打印什么？**
```js
function* nat(){ let i=1; while(true) yield i++; }
console.log(Iterator.from(nat()).filter(n=>n%2===0).take(3).toArray());
```
- 参考要点：`[2, 4, 6]`。无限生成器经 `filter` 只保留偶数、`take(3)` 短路、`toArray` 物化。若没有惰性 take，`while(true)` 永不终止。**追问**：去掉 `.take(3)` 会怎样？→ `toArray()` 无限增长直至内存耗尽/OOM。
- 来源：TC39 提案；MDN Iterator。

---

**11）如何在生产环境安全使用 Iterator Helpers / Promise.try（兼容性策略）？**
- 参考要点：先**特性检测**：`typeof Iterator === 'function' && typeof Iterator.from === 'function'`、`typeof Promise.try === 'function'`。不满足则回退（`for...of`+手动 `break`；`Promise.resolve().then(fn)`）。这些是**运行时 API**，Vite `build.target` 不 polyfill——需 `core-js`/`iterator-helpers` 补丁，且惰性语义在 polyfill 下不总等价，故更推荐**特性检测 + 优雅降级**而非硬 polyfill。基线：Node 22+/Chrome 122+/FF 128+/Safari 17.4+（Promise.try 更宽）。
- 来源：caniuse；MDN；core-js 文档。

---

**12）现场手写：用 ES2025 特性重写「从日志流取前 100 条含 error 的行并计数」。**
- 参考要点：
  ```js
  // 旧：Array 版要求先把全部行读进内存
  const lines = await readAllLines(stream);
  const errs = lines.filter(l => l.includes('error')).slice(0, 100);
  // 新：Iterator Helpers 惰性流式，最多读够 100 条即停
  const errs = Iterator.from(lineStream(stream))     // 异步/同步迭代器皆可
    .filter(l => l.toLowerCase().includes('error'))
    .take(100)
    .toArray();
  const count = errs.length;
  ```
  优点：**内存友好 + 可短路**（大/无限流不再全量物化）。**追问**：数据源是异步流时，用 `[Symbol.asyncIterator]()` + `for await` 消费或异步助手版本。
- 来源：TC39 Iterator Helpers 提案；MDN；Node.js stream。
