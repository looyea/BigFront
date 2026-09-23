# 面试题 · ES2019

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）`flat` 与 `flatMap` 的区别？各自典型场景？**
- 参考要点：`flat(depth)` 只负责把嵌套数组拍平（默认 1 层）；`flatMap(fn)` = `map(fn)` 后 `flat(1)`，**只拍一层**。典型：flatMap 做「一进多出 / 过滤式映射」（返回 `[]` 即丢弃该元素）；flat 处理接口返回的多层嵌套。
- 来源：MDN Array.prototype.flat；TC39 flat/flatMap(ES2019)。

---

**2）`[1, , 3].flat()` 与 `[1, undefined, 3].flat()` 结果为何不同？**
- 参考要点：前者 `[1, 3]`（flat **剔除空洞 hole**），后者 `[1, undefined, 3]`（undefined 是**真实元素**，不剔除）。**追问**：怎么造 hole？→ 稀疏字面量 `[1,,3]`、`new Array(3)`；`delete arr[0]` 也会留洞。
- 来源：MDN；javascript.info「Arrays, methods」。

---

**3）`flatMap` 能拍平多于 1 层的结构吗？怎么做到？**
- 参考要点：不能，flatMap 恒定 `flat(1)`。要更深得组合：`arr.flatMap(x => [[x, x]]).flat(2)` 或直接 `map + flat(Infinity)`。面试常拿这个考「你是否真懂 flatMap 只一层」。
- 来源：MDN；StackOverflow 高票。

---

**4）`Object.fromEntries` 解决了什么？和 `Object.entries` 关系？**
- 参考要点：它是 `Object.entries` 的**逆运算**，把 `[ [k,v], ... ]`（或任意产出键值对的 iterable，如 Map）还原成对象。使得「对象 → entries → 过滤/映射 → 回对象」的函数式管道成为可能。
- 来源：MDN；TC39 Object.fromEntries(ES2019)。

---

**5）可选 `catch {}` 省略的是什么？能省 `catch(e)` 里用到 e 的情况吗？**
- 参考要点：省略的是**catch 的参数与圆括号**，仅在你不需要错误对象时使用。**不能**在 catch 体里再引用被省略的变量（会 ReferenceError）。价值：避免 `catch (unusedErr)` 触发 ESLint `no-unused-vars`。
- 来源：MDN try...catch；TC39 optional-catch-binding(ES2019)。

---

**6）ES2019 为什么强制 `Array.prototype.sort` 稳定？举个不稳定翻车的例子。**
- 参考要点：稳定=相等键保持原相对顺序。典型翻车：先按成绩排好，再按 `score` 二次排序时，同分学生顺序被打乱（旧 V8 对 >10 元素用快排不稳定）。ES2019 起规定必须稳定，V8 改用 TimSort。
- 来源：MDN Array.sort；V8 blog「Array.sort() becoming stable」(ES2019)。

---

**7）`Symbol.description` 与 `String(symbol)` / `symbol.toString()` 的差别？**
- 参考要点：`description` 返回创建时传入的**原始字符串**（`'abc'`）或 undefined；`String(sym)`/`toString()` 返回 `"Symbol(abc)"` 整串。做日志、按名字匹配符号时 description 更干净。**注意**：`description` 可写？→ 只读（getter）。
- 来源：MDN Symbol.prototype.description；TC39(ES2019)。

---

**8）`JSON.stringify` 在 ES2019 的「well-formed」修复解决了什么 bug？**
- 参考要点：此前对**孤立代理项**（lone surrogate，如半个 emoji `'\uD800'`）会原样输出，产出的字符串**不是合法 JSON/UTF-16**。ES2019 起把这些非法码点转义为 `\udXXX`，保证输出是合法良构。跨语言/严格解析器场景重要。
- 来源：TC39 JSON superset(ES2019)；MDN JSON.stringify；mathiasbynens 相关文章。

---

**9）`trimStart/trimEnd` 与 `trimLeft/trimRight` 什么关系？**
- 参考要点：**完全同义**，`trimStart===trimLeft`（同一函数对象的规范新名）。ES2019 只是给出与 `padStart/padEnd` 一致的新命名，旧名保留兼容。**追问**：`trim()` 两端都去空白（ES3 就有）。
- 来源：MDN；TC39(ES2019)。

---

**10）以下代码打印什么？**
```js
const arr = [1, 2, 3];
arr.sort(() => 0);          // 比较函数恒返回 0
console.log(arr);
```
- 参考要点：现代（ES2019+ 稳定 sort）输出 `[1, 2, 3]`——相等判定保持原序。老引擎可能因不稳定实现给出不同结果。**追问**：`sort()` 不传比较函数会按什么排？→ 按元素**字符串的 UTF-16 码元**升序（`[10,9]` → `[10,9]` 因 '1'<'9'）。
- 来源：MDN；TC39(ES2019)；StackOverflow。

---

**11）`Function.prototype.toString` 在 ES2019 被规范化，改了什么？**
- 参考要点：ES2019 前各引擎可能返回**编译后的中间形态**或省略注释/空格；规范后要求**尽可能逐字符返回原始源码**（class、方法、箭头、含注释）。这让代码高亮/序列化/热更新更可靠。
- 来源：MDN Function.prototype.toString；TC39 Function.prototype.toString revision(ES2019)。

---

**12）现场手写：把一个对象所有值翻倍（用 ES2019 的三件套组合）。**
- 参考要点：
  ```js
  const src = { a: 1, b: 2, c: 3 };
  const doubled = Object.fromEntries(
    Object.entries(src).map(([k, v]) => [k, v * 2])
  );   // { a: 2, b: 4, c: 6 }
  ```
  **追问 1**：只保留 value 为偶数的键？→ 在 map 前加 `.filter(([, v]) => v % 2 === 0)`。**追问 2**：这套「entries → 变换 → fromEntries」为什么优于 for 循环？→ 可组合、无中间可变对象、契合函数式风格。
- 来源：MDN Object.fromEntries/entries；GreatFrontEnd 手写题；TC39(ES2019)。

---

**13）Array#sort 稳定性在 ES2019 被强制，之前的世界什么样？V8 做了什么？**
- 参考要点：旧规范只要求「排序正确」不承诺相等元素相对顺序——各引擎对 >10 长度数组用不稳定快排，「按分数排完名字乱序」的 bug 无法复现修复。ES2019 起必须稳定：V8 把 Array#sort 从 QuickSort 整体换成 **TimSort**（归并+二分插入，O(n log n) 且稳定，小数组插入排序），代价是额外内存。前端意义：多级排序 = 先排次要键再排主键即可（稳定保证前键次序）。
- 来源：v8.dev《Array.prototype.sort() has a new home: TimSort》；ECMA-262 ES2019 SortCompare 稳定条款。

---

**14）Object.fromEntries 解决什么问题？和 Map 的键值转换管线怎么写？**
- 参考要点：entries 迭代器/Map 回填对象：`Object.fromEntries(map)`、过滤键值对 `Object.fromEntries(Object.entries(o).filter(([,v]) => v))`。对象「不适合做字典」的历史问题（键只能字符串、无顺序保证语义、原型链污染）让 Map 成为首选，fromEntries/entries 是两种结构的转换闸门。注意遍历序：Object 系 API 整数键永远排在最前按数值序，字符串键按插入序——Map 则严格插入序，混用时这是经典错位。
- 来源：MDN《Object.fromEntries》；ECMA-262 OrdinaryOwnPropertyKeys 键序规定。

---

**15）可选 catch 绑定只是省变量名吗？well-formed JSON 解决了什么真实事故？**
- 参考要点：catch {}：不消费异常时省掉 unused 参数，也避免 `catch (e)` 意外遮蔽外层同名变量；引擎侧少创建一个绑定对象。well-formed JSON.stringify 的事故原型：字符串按 UTF-16 code unit 截断（分页/分片上传切断 emoji 代理对）产生孤立 surrogate，stringify 后 JSON 里带 `�` 裸代理——下游 JSON.parse 在严格环境直接炸；修复后 stringify 输出替换符 U+FFFD，保证「stringify→parse」往返无损。配套：`isWellFormed/toWellFormed`（ES2024）做显式清洗。
- 来源：tc39/proposal-json-superset 动机章节；MDN JSON.stringify「well-formed」说明。
