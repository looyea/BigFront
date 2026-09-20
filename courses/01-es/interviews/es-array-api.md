# 面试题 · Array 方法

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）列出 9 个**会修改原数组**的方法。**
- 参考要点：push、pop、shift、unshift、splice、sort、reverse、fill、copyWithin。**追问**：ES2023 新增的非变异版本？→ `toSorted` / `toReversed` / `toSpliced` / `with`。
- 来源：MDN《Arrays and mutability》；TC39 change-array-by-copy 提案。

---

**2）`forEach` / `for` / `for-of` / `for-in` 遍历数组，各自适合什么场景？为什么 ESLint 建议**不要用 for-in 遍历数组**？**
- 参考要点：for 最快最灵活；for-of 走迭代器协议、支持所有可迭代对象、能 break；forEach 语义清晰、能传 thisArg、**不能 break**；for-in 遍历**可枚举字符串键**（含原型链），会带上手动加的属性、下标是**字符串**——不适合数组。
- 来源：MDN 各页；javascript.info《Loops》；Airbnb Style Guide。

---

**3）以下代码打印什么？**
```js
const a = [1, 2, 3];
a.foo = 'bar';
for (const i in a) console.log(i);
for (const v of a) console.log(v);
```
- 参考要点：for-in 打印 `0 1 2 foo`；for-of 打印 `1 2 3`。**关键**：for-in 遍历**可枚举属性名**（含自定义字符串键）；for-of 走迭代器只吐元素。
- 来源：MDN；多份中文八股。

---

**4）`[,,].length` 是多少？`[,,][0]` 是什么？`[,,].map(x=>x)` 长度是多少？**
- 参考要点：length 2；`[,,][0]` undefined（读时视作 undefined，但**不是**空槽）；`[,,].map(x=>x)` **保持稀疏**，结果仍是 `[empty, empty]`、length 2 但 map 回调**没执行**。
- 来源：MDN《Holes in arrays》；ECMA-262 规范 §23.1.3。

---

**5）`reduce` 不传初始值会怎样？给一个因此翻车的真实场景。**
- 参考要点：不传 init 时 acc 从 arr[0] 开始、cur 从 arr[1] 开始；空数组抛 TypeError。**翻车场景**：字符串求和 `[1,2,3].reduce((a,b)=>a+b)` 得 6 但 `[].reduce((a,b)=>a+b)` 抛错；类型变换时（比如把 number 变 string 累加）不传 init 会跳过第一个元素。
- 来源：MDN `Array.prototype.reduce`；多份中文八股。

---

**6）以下代码结果为？**
```js
const a = [1, 2, 3, 4, 5];
for (let i = 0; i < a.length; i++) {
  if (a[i] % 2 === 0) a.splice(i, 1);
}
console.log(a);
```
- 参考要点：`[1, 3, 5]`？—— 错。实际是 `[1, 3, 5]` 但**会漏掉一个 4**：删掉 2 后数组变成 `[1,3,4,5]`，i++ 指向 4（下标 2），条件为 true 又被删，i++ 指向 5 结束——最终 `[1,3,5]` 是巧合正确。**追问**：如果删奇数怎么办？→ 会漏删。正确写法：`filter` 或**倒序 for**。
- 来源：StackOverflow《Removing array elements while iterating》；多份中文八股。

---

**7）`includes` 与 `indexOf` 有什么关键差异？为什么 includes 更适合判断 NaN？**
- 参考要点：`includes` 返回 boolean、支持第二参 fromIndex、**能识别 NaN**（用 SameValueZero 算法）；indexOf 返回下标、用 ===（`[NaN].indexOf(NaN)` = -1）。工程：只需要「在不在」一律 includes。
- 来源：MDN；TC39 Array.prototype.includes 提案。

---

**8）说出 `sort` 的稳定性与内部算法。为什么 `[10,1,5].sort()` 得 `[1, 10, 5]`？**
- 参考要点：V8 从 Chrome 70（2018）起改用 **TimSort**（merge + insertion 混合，**稳定**）；老版本用快排，**不稳定**。默认把元素转字符串按 UTF-16 码元排序——所以 10 < 5（字符串 '10' < '5'）。**追问**：多字段排序怎么做？→ 比较函数串联：`a.p - b.p || a.q - b.q`。
- 来源：v8.dev《Array.prototype.sort: coming to a browser near you》；MDN。

---

**9）现场手写：`groupBy(arr, fn)`（不用 Object.groupBy）。**
- 参考要点：
  ```js
  function groupBy(arr, keyFn) {
    return arr.reduce((m, x) => {
      const k = keyFn(x);
      (m[k] ??= []).push(x);
      return m;
    }, {});
  }
  ```
  **追问**：为什么初始值用 `{}` 而不是 `Object.create(null)`？→ 键名可能撞 `toString/constructor`；生产字典建议 `Object.create(null)` 或 `Map`。ES2024 有原生 `Object.groupBy`。
- 来源：lodash.groupBy 源码；TC39 Object.groupBy 提案。

---

**10）`flat(Infinity)` 的实现原理？递归展开会不会爆栈？**
- 参考要点：本质是递归；深度极大（>10^5 层）会栈溢出。**变通**：用栈迭代：
  ```js
  function flatten(arr) {
    const out = [], stack = [...arr];
    while (stack.length) {
      const x = stack.pop();
      if (Array.isArray(x)) stack.push(...x);
      else out.push(x);
    }
    return out.reverse();
  }
  ```
- 来源：MDN；多份中文手写题。

---

**11）如何把类数组对象（arguments / NodeList）转成真数组？给出 4 种方法。**
- 参考要点：`Array.from(x)`；`[...x]`（需要 x 可迭代）；`Array.prototype.slice.call(x)`；`[].concat(...x)`；`[].forEach.call(x, cb)`（借用遍历）。推荐 `Array.from`（意图清晰、支持 mapFn 参数）。
- 来源：MDN《Array-like objects》；StackOverflow 高票。

---

**12）`Promise.all([1,2,3])` 与 `Promise.all([...new Array(3)])` 结果分别是什么？**
- 参考要点：前者 `[1,2,3]`（非 Promise 值被 `Promise.resolve` 包装）；后者 `[undefined, undefined, undefined]`（empty slot 被迭代器视为 undefined）。**追问**：为什么稀疏数组进 Promise.all 不抛错？→ Promise.all 内部用 `ArrayIterator` 遍历，与 for-of 一致。
- 来源：MDN `Promise.all`；ECMA-262 §27.2.1.1。
