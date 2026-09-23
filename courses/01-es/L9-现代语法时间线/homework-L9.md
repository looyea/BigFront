# L9 作业：现代语法巡礼

> 覆盖本阶段 8 关：`es-2015-2017`、`es-2018`、`es-2019`、`es-2020`、`es-2021`、`es-2022`、`es-2024`、`es-modern`。
> 提交方式：读代码题直接答；手写实现放 `homework/L9.answers.js`。
> 第六节专门覆盖本次补全的三年（ES2015-2017 / ES2019 / ES2021）。

---

## 一、读代码写结果（每题 2 分，共 20 分）

**A1.** `Object.groupBy([1,2,3,4], n => n % 2 ? 'odd' : 'even')` 返回值？原型是什么？

**A2.** `const x = 0; console.log(x || 'a', x ?? 'b', x?.toString())` 打印什么？

**A3.** `'\uD83D\uDE00'.isWellFormed()` → true/false？`'\uD83D'.toWellFormed()` → 什么？

**A4.**
```js
class Foo { static { this.bar = 42; } }
console.log(Foo.bar);
```

**A5.** `Promise.withResolvers()` 返回的结构？解构出什么？

**A6.** `[1,2,3,4,5].filter(x=>x>2).map(x=>x*10).slice(0,2)` 用 Iterator Helpers 怎么写？

**A7.** `new Error('A', {cause: new Error('B')})` 的 `.cause.message` 是什么？

**A8.** `[10,20,30].toSorted((a,b)=>b-a)` 后原数组变了吗？

**A9.** `const buf = new ArrayBuffer(8); const t = buf.transfer(); buf.byteLength;` 是什么？

**A10.** `/(?<h>\d{2}):(?<m>\d{2})/d.exec('12:34').indices.groups.h` 是什么？

---

## 二、手写实现（每题 6 分，共 30 分）

**B1 · `groupBy` polyfill**：不用 `Object.groupBy`——用 `reduce` 手写一份，返回 **null-proto** 对象。

**B2 · 用 ES2022 Class 重写一个 `Stack`**：公有 `#items`、`push/pop/peek/size`；私有 `#underflow()`；`static [Symbol.iterator]` 让类**可迭代**。

**B3 · `safeParseJSON(str)`**：用 `toWellFormed` 清洗字符串后再 JSON.parse；失败返回 `{ error, cause }`（ES2022 error.cause 风格）。

**B4 · 用 `Promise.withResolvers` 写一个 `Deferred<T>`** 类：`.resolve()` / `.reject()` / `.promise`。

**B5 · 用 Iterator Helpers**：`numbers().filter(isPrime).take(10).toArray()` → 前 10 个质数。

---

## 三、场景改造（20 分）

**把一段 lodash-heavy 的代码改成纯原生**（假设 browserslist = last 2 Chrome）：
```js
import _ from 'lodash';
const result = _(users)
  .filter(u => u.age > 18)
  .groupBy('dept')
  .mapValues(list => _.sortBy(list, 'name'))
  .value();
```
→ **不用 lodash**，用 `Object.groupBy` + `toSorted` + `Object.fromEntries`。

---

## 四、面试简答（每题 6 分，共 18 分）

**Q1**：ES2023 `toSorted` 解决了什么以前 `[...arr].sort()` 的痛点？性能差异？

**Q2**：`Object.groupBy` 返回值的原型为什么是 null？这避免了什么经典 bug？

**Q3**：如果项目 browserslist 含 IE 11，ES2020 的 `?.` / `??` / `BigInt` 分别怎么处理？

---

## 五、拓展挑战（12 分，选做）

写一个 **`toNative()`** codemod 规则（伪代码即可）：输入 `_.chain(arr).map(f).filter(g).sortBy(h).value()` → 输出 `arr.map(f).filter(g).toSorted(h)`。说明哪些 lodash 链可以机械替换，哪些不行。

---

## 六、新增关补充：ES2015-2017 / ES2019 / ES2021

**C1 · 读代码写结果**：
```js
let a = 0; a ??= 5; let b = 0; b ||= 6;
console.log(a, b);
```

**C2 · 读代码写结果**：`[[1,[2]],[3]].flatMap(x => x).flat()` 结果？`[1,,3].flat()` 结果？

**C3 · 读代码写结果**：`'a-b-c'.replaceAll('-', '_')` 与 `'-a-b-c'.replace(/-/, '#')`（注意没 g）分别是什么？

**C4 · 辨析**：`class` 相对手写构造函数有哪三点差异？`-2 ** 2` 为什么报错？

**C5 · 手写**：用 `Object.fromEntries` + `Object.entries` 写一个 `mapValues(obj, fn)`，把对象每个值用 fn 变换，返回**新对象**。

**C6 · 手写**：用 ES2021 的 `Promise.any` 实现「向 3 个镜像域名请求同一资源，取最先成功者，全失败则回退默认值」，并说明为何不用 `Promise.race`。

**C7 · 场景**：缓存一个大对象但又不想阻止它被 GC，用 ES2021 的什么原语？写出 `deref()` 的安全用法。

---

## 我的答案（作答区）

（待补）
