# L2 作业：类型判定与转换

> 覆盖本阶段 2 关：`es-types`、`es-coercion`。
> 提交方式：读代码题直接写答案；手写实现放 `homework/L2.answers.js`；面试简答写在本文件末尾。

---

## 一、读代码写结果（每题 2 分，共 24 分）

**A1.** `typeof null` / `typeof undefined` / `typeof Symbol()` / `typeof 42n` / `typeof class {}`

**A2.**
```js
const x = [];
console.log(x instanceof Array, x instanceof Object, Array.isArray(x));
```

**A3.** `Object.prototype.toString.call(new Map())` / `.call(new Set())` / `.call(/re/)`

**A4.**
```js
console.log(1 + '2', '1' + 2, true + true, [] + {}, [] + []);
```

**A5.** `[] == ![]` / `null == undefined` / `NaN === NaN` / `Object.is(NaN, NaN)`

**A6.**
```js
console.log(Number(''), Number(' '), Number('12px'), Number('0x10'));
console.log(parseInt(''), parseInt('12px'), parseInt('0x10'), parseInt('010'));
```

**A7.** `1n + 1` / `1n == 1` / `1n === 1` — 分别是什么？（写值或错误类型）

**A8.** `[1,2] + [3]` / `[1] + [2]` / `[[1]] + [[2]]`

**A9.** `Boolean('0')` / `Boolean(' ')` / `Boolean([])` / `Boolean([0])`

**A10.** `undefined + 1` / `null + 1` / `null == 0` / `undefined == 0`

**A11.**
```js
const o = { valueOf: () => 42, toString: () => 'hi' };
console.log(o + 1, 'x' + o, `${o}`, Number(o), String(o));
```

**A12.**
```js
const s = { [Symbol.toPrimitive](hint) { return hint === 'number' ? 1 : 'S'; } };
console.log(+s, s + 1, 'a' + s, `${s}`);
```

---

## 二、手写实现（每题 8 分，共 24 分）

**B1 · typeOf(v)**：给出 `null`、`undefined`、`'string'`、`'number'`、`'boolean'`、`'bigint'`、`'symbol'`、`'function'`、`'array'`、`'map'`、`'set'`、`'date'`、`'regexp'`、`'error'`、`'object'`、`'nan'` 共 16 种之一。（注意 `typeOf(NaN)` 应返回 `'nan'` 而不是 `'number'`。）

**B2 · isPlainObject(v)**：区分 `{}` / `Object.create(null)` 与其他 object（数组、类实例、Map、Set、Date）。

**B3 · looseEqual(a, b)**：primitive 层按值比较（能识别 NaN 相等），object 层按引用。给一个「表单 dirty 检测」用例。

---

## 三、场景改造（20 分）

后端返回的字段类型经常漂——同一个 `age` 有时是 `25`、有时是 `'25'`、有时是 `null`、有时干脆没这个字段。写一个 `safeAge(user)`：
- 输入是数字或纯数字字符串 → 返回数字；
- 是 null/undefined/'' → 返回 0；
- 是负数或 NaN → 抛 RangeError；
- 其他非数字字符串（如 '12px'） → 抛 TypeError。
**禁止**使用 `==`；只允许 `===`、`Number()`、`Number.isFinite`。

**加分**：写单元测试 6 条覆盖上面所有分支。

---

## 四、面试简答（每题 6 分，共 18 分）

**Q1**：`+`、`-`、`*`、`/` 四个运算符在隐式转换上的行为差别是什么？给一个真实项目里踩过的坑。

**Q2**：为什么 `if (arr)` 判断空数组不行？说出至少 3 种正确的写法，各自性能与可读性差别。

**Q3**：写代码时你打算在项目 ESLint 里加哪些规则来避免转换类 bug？至少列 3 条规则名并简述。

---

## 五、拓展挑战（18 分，选做）

写一个 `parse(input)` 表达式求值器，支持 `+ - * / ( )`、整数与小数、一元 `-`，能正确处理：
```js
parse('1 + 2 * 3')   // 7
parse('(1 + 2) * 3') // 9
parse('-5 + 3')      // -2
```
提示：递归下降 or shunting-yard；不允许用 `eval`。**追问**：如果输入含 `NaN`、`Infinity`、字符串字面量，你的解析器需要怎么改？

---

## 我的答案（作答区）

（待补）
