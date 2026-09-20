# 面试题 · 隐式转换

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）JavaScript 里的隐式转换规则是什么？ToPrimitive / ToNumber / ToString 分别在什么场景被调用？**
- 参考要点：三种抽象操作；hint（'number' / 'string' / 'default'）决定 ToPrimitive 的 valueOf/toString 顺序；Symbol.toPrimitive 最高优先级。
- 来源：javascript.info《Type Conversions》；GreatFrontEnd《50+》类型转换段。

---

**2）现场推导：以下每一行输出什么？写出 ToPrimitive 步骤。**
```js
1 + '2'          // ?
'5' - 3          // ?
true + true      // ?
[] + []          // ?
[] + {}          // ?
{} + []          // ? （说明环境差异）
null + 1         // ?
undefined + 1    // ?
[1, 2] + [3]     // ?
```
- 参考要点：`'12'` / `2` / `2` / `''` / `'[object Object]'` / 见环境差异 / `1` / `NaN` / `'1,23'`。
- 来源：BuiltIn《55 Top JS Interview Questions》题 20；dmitripavlutin.com《Guide to JavaScript equality》。

---

**3）`[] == ![]` 为什么是 true？把每一步写出。**
- 参考要点：`![]` = `!true` = `false`；`[] == false` 走规则 4（任一侧是 Boolean → 双方 ToNumber）；`Number([])` = `Number('')` = 0；`Number(false)` = 0 → true。
- 来源：StackOverflow《Comparing two arrays in JavaScript》高票答案；多数中文八股必考题。

---

**4）`{} + 1` 在不同环境为什么结果不一样？**
- 参考要点：解析歧义。Node 命令行 REPL：`{}` 当空块语句 → 剩下 `+1` 求值为 1；`console.log({} + 1)` 表达式上下文 → `'[object Object]1'`；某些浏览器 devtools：结果不同。**结论**：这是语法歧义，不是语言 bug 也不是转换 bug，工程上禁止这种裸 `{}` 起始。
- 来源：kangax 博文《The {} + [] puzzle》；StackOverflow 相关讨论。

---

**5）`==` 与 `===` 有什么差别？你的团队用哪个？给一个 == 唯一合理使用的场景。**
- 参考要点：== 走 14 步算法可能做类型转换，=== 严格。**推荐 ===** 且开 ESLint eqeqeq；== 唯一值得写的场景是 `x == null`（同时判 null 和 undefined）。
- 来源：MDN `Comparison operators`；eslint.org/rules/eqeqeq。

---

**6）NaN 有哪些「诡异行为」？如何正确判 NaN？**
- 参考要点：① `NaN === NaN` false；② 参与任何算术都是 NaN；③ ToNumber 失败会得 NaN；④ JSON.stringify(NaN) = 'null'（丢信息）。正确判：`Number.isNaN(x)`（只对真 NaN 返回 true）；不要用全局 `isNaN(x)`（会先 ToNumber 再判，误报）。
- 来源：MDN `Number.isNaN`；You Don't Know JS 类型卷。

---

**7）`+0` 与 `-0` 有什么区别？`Object.is(0, -0)` 返回什么？为什么要有 -0？**
- 参考要点：IEEE-754 允许 -0，为了保留 `1/-0 = -Infinity` 这类符号信息。`0 === -0` true（IEEE-754 语义）；`Object.is(0, -0)` false。工程上：数值可视化或金融计算里需要区分方向。
- 来源：MDN `Object.is`；TC39 讨论；2ality《Signed zero》。

---

**8）BigInt 与 Number 能混算吗？为什么？**
- 参考要点：**不能**。`1n + 1` 抛 TypeError。原因：BigInt 精度语义与 Number 完全不同（Number 是 53 位双精度浮点，BigInt 是任意精度整数），隐式转换会静默丢精度。允许比较：`1n == 1` true；`1n === 1` false（类型不同）。显式互转：`BigInt(Number('42'))` 或 `Number(42n)`（后者超过安全整数会丢精度）。
- 来源：MDN `BigInt`；javascript.info《BigInt, arbitrary-precision integers》。

---

**9）Symbol 能参与算术运算吗？为什么这么设计？**
- 参考要点：**不能**。`Symbol() + 1` 抛 TypeError。设计上：Symbol 的用途是「唯一标识」，语义上不该有算术；且强制 Symbol 显式 `String(sym)` / `sym.description` 转字符串，防止意外泄漏。唯一例外：一元 `!sym` 合法（拿 boolean），`Boolean(sym)` 合法。
- 来源：MDN `Symbol`；TC39 提案文档。

---

**10）以下代码打印什么？说明 ToNumber vs parseInt 的差别。**
```js
console.log(Number('0x10'), parseInt('0x10'), parseInt('0x10', 16));
console.log(Number('12px'), parseInt('12px'));
console.log(Number(''), Number(' '), Number('\n'));
```
- 参考要点：`16 16 16` / `NaN 12` / `0 0 0`。**Number 严格**（允许空白字符但不允许尾随非数字），**parseInt 宽松**（截到第一个非数字前）。工程：一律 `Number(x)` + 显式校验；用 parseInt 必须传基数。
- 来源：MDN `parseInt`；StackOverflow《Why is parseInt('010', 10) = 10 but parseInt('010') = 8》。

---

**11）写一个 `looseEqual(a, b)`：能像 Vue 那样在 primitive 层面按值比较，Object 层面按引用。给一个真实用例。**
- 参考要点：核心是 `a === b || (a !== a && b !== b)`（处理 NaN）+ 类型分派；对象保持引用比较。真实用例：表单 dirty 检测（值 vs 初始值）。**追问**：数组怎么办？→ 深比较，交给 lodash.isEqual。
- 来源：Vue 源码 `shared/looseEqual`；lodash 源码 isEqual。

---

**12）如果面试官问你「JS 里 `if ('0')` 与 `if (0)` 分别怎么走」，你答什么？**
- 参考要点：`'0'` 是 truthy（string 非空），进入 if；`0` 是 falsy，不进入。**关键陷阱**：后端传来字符串 `'0'` 判空，`if ('0')` 会误判为真——必须 `Number(x)` 或严格 `x !== '0' && x !== 0`。真实事故场景。
- 来源：多份中文八股；Smashing Magazine《JavaScript Type Coercion》。
