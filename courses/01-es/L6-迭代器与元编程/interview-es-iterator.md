# 面试题 · 迭代器与生成器

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）什么是可迭代协议？什么是迭代器协议？两者的关系？**
- 参考要点：**可迭代协议**：对象有 `[Symbol.iterator]()` 方法，返回 Iterator；**迭代器协议**：对象有 `next()` 方法，返回 `{ value, done }`。Iterable **生产** Iterator。数组、字符串、Map、Set 是 Iterable；`arr[Symbol.iterator]()` 得到 Iterator。
- 来源：MDN《Iteration protocols》；ECMA-262；javascript.info《Iterable objects》。

---

**2）`for-of` 与 `for-in` 与 `forEach` 的差别？为什么 Array 上不建议 for-in？**
- 参考要点：for-of 走**迭代器协议**（元素）；for-in 遍历**可枚举字符串键**（含原型链、含手动加的属性）；forEach 是数组方法，闭包回调。Array 上 for-in 会把 `arr.foo = 1` 的 `'foo'` 也吐出来，且下标是字符串——危险。
- 来源：MDN；javascript.info；StackOverflow 高票。

---

**3）`break` 出现在 `for-of` 循环里，迭代器的哪个方法会被调用？用途？**
- 参考要点：`it.return()`（若定义）。**用途**：**清理资源**——比如打开的文件句柄、事件监听、生成器 finally 块。生成器 return() 会触发 `finally { ... }`，是「提前退出时的析构钩子」。
- 来源：ECMA-262 IteratorClose；javascript.info。

---

**4）以下代码打印什么？**
```js
function* gen() {
  try {
    yield 1; yield 2; yield 3;
  } finally {
    console.log('cleanup');
  }
}
for (const x of gen()) { if (x === 2) break; }
```
- 参考要点：打印 `2` 然后 `cleanup`。break 触发 it.return() → 生成器抛 Completion('return') → 走 finally。
- 来源：MDN generators；javascript.info《Generators advanced》。

---

**5）生成器的 `next(v)` 参数注入到哪里？给一个「协程式输入」例子。**
- 参考要点：`yield` **表达式的求值结果**——即 `const x = yield` 里 x 就是下次 next(v) 的 v。经典例：
  ```js
  function* echo() {
    while (true) { const v = yield; console.log('got', v); }
  }
  const e = echo(); e.next(); e.next('hi');   // got hi
  ```
- 来源：MDN《gen.next()》；javascript.info。

---

**6）`yield*` 与手动 for-of yield 有什么本质区别？**
- 参考要点：**双向透传**——`yield*` 时外层 `next(v)` 直接进入被委托 iterator；`throw(err)` 也进入；`return(v)` 让被委托 iterator 走完 return。**手写** `for (const x of it) yield x;` 只能传值，throw 与 return 语义丢失。redux-saga 的 effect 组合依赖 yield*。
- 来源：MDN `yield*`；javascript.info。

---

**7）如何判断一个对象是否 Iterable？**
- 参考要点：`typeof obj[Symbol.iterator] === 'function'`。**追问**：是不是 Iterator？看 `typeof obj.next === 'function'`。Generator 对象**同时**是二者（`gen[Symbol.iterator]() === gen`）。
- 来源：MDN；StackOverflow。

---

**8）`new Set(...)` 能接收什么参数？`new Map(...)` 呢？**
- 参考要点：都接收**可迭代对象**——`new Set('abc')` 是 {a,b,c}；`new Map([['k',1]])` 需要元素本身是 2 元组或可迭代（`[[k,v], ...]`）。**追问**：`new Set(arr)` 的**去重规则**？→ SameValueZero。
- 来源：MDN `Set` / `Map`。

---

**9）`Array.from(iterable, mapFn)` 相比 `[...iterable].map(mapFn)` 的优势？**
- 参考要点：`Array.from` **不用先建中间数组**——内存与性能更省（尤其大 iterable）；且支持第二参数 mapFn，能带索引；`thisArg` 也能传。
- 来源：MDN `Array.from`；StackOverflow 高票。

---

**10）以下代码结果为？**
```js
const range = {
  from: 1, to: 3,
  *[Symbol.iterator]() { for (let i = this.from; i <= this.to; i++) yield i; },
};
console.log([...range], [...range]);
```
- 参考要点：`[1,2,3] [1,2,3]`。因为 `[Symbol.iterator]()` **每次调用**都新建迭代器（生成器函数每次返回新的 generator 对象），所以可**重复**迭代。若把 `this.it = ...` 挂在 this 上就只可一次。
- 来源：javascript.info；MDN。

---

**11）生成器 vs async/await：两者谁更底层？async 是什么的语法糖？**
- 参考要点：**生成器 + Promise = async/await**。async 函数本质是「用 co 模式跑一个生成器，把 yield 换成 await」——regenerator-runtime 就是这么实现的。**结论**：能用 async/await 满足的需求就别生成器，产物更小。需要「暂停/协程/惰性管道」时才生成器。
- 来源：MDN；tj/co 库源码；Babel regenerator 文档。

---

**12）`for-await-of` 与 `for-of + await` 的语义区别？**
- 参考要点：`for-await-of` 走 `Symbol.asyncIterator`——每个 next() 返回 Promise，引擎自动 await；**串行**（下一条要等上一条完成）。**`for-of + await`**：如果它本身是 sync iterable + await 每一项也是串行。**要并发**：`await Promise.all([...it].map(async x => ...))`。**Node.js Readable 流 / Web Streams API** 用 for-await。
- 来源：MDN `for await...of`；Node.js 文档《stream iterator》。

---

**13）`yield n++` 与 `yield ++n` 有什么区别？`next(v)` 注入的是哪个位置？**
- 参考要点：`yield n++` 先以 **n 的旧值**作为产出值，暂停点恢复前 `n++` 已发生（副作用在挂起前完成）；`yield ++n` 则先自增再产出**新值**。`next(v)` 把 v 作为**上一个 `yield` 表达式整体**的求值结果注回函数内（第一次 next 的参数会被丢弃，因为此时还没有 yield 在等）。考点常配「无限 counter + reset 注入」手写题。
- 来源：MDN《yield 运算符》；javascript.info《高级迭代与 generator 返回》。

---

**14）生成器的 `return()` / `throw()` 分别何时被触发？如何用它做资源清理？**
- 参考要点：`for-of` 提前 break/throw 时引擎调 `it.return()`，生成器从当前 yield 处**沿 finally 路径**收尾（try/finally 里的清理代码执行）；`it.throw(err)` 把异常**注入到 yield 表达式处**，可被函数内 try/catch 捕获——两方法都让 done=true。实战：包文件句柄/DB 连接的生成器在 `finally` 里 close；错误边界用 throw 做协程控制流。
- 来源：MDN《Generator.prototype.throw/return》；TC39 iterations 提案文档。

---

**15）`take(10, map(x => x*x, naturals()))` 这种惰性管道，map 实际执行了多少次？为什么？**
- 参考要点：只执行 **10 次**（严格说 take 探到第 11 个时才判定终止）。生成器不 `next()` 就不运行——整条管道是**拉取式（pull）**：消费端每要一个值才推动上游算一步，`naturals()` 的 `while(true)` 永远不会跑完。这正是 Iterator Helpers / RxJS 「冷流」雏形：`it.map(f).take(10)` 同一协议，优点是**无限序列可处理、内存 O(1)**。
- 来源：tc39/proposal-iterator-helpers（GitHub）；javascript.info《惰性求值》。
