# 面试题 · Symbol

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）Symbol 是什么？为什么需要它？**
- 参考要点：JS 第 7 种原始类型；每次 `Symbol()` 返回**全宇宙唯一**值。**动机**：① 避免多库属性键撞车；② 提供**协议钩子**（内置方法的行为可通过挂 Symbol 属性覆盖）；③ 「半私有」属性（默认 API 不带你玩）。
- 来源：MDN《Symbol》；2ality《Symbols in ES6》；TC39 提案。

---

**2）`Symbol()` 与 `Symbol.for()` 有什么区别？给一个 `Symbol.for` 的必要场景。**
- 参考要点：`Symbol()` 每次新值；`Symbol.for(key)` 查/建**全局注册表**，同 key 同值。场景：① 跨 realm（iframe、Worker）共享符号；② Node `util.inspect.custom = Symbol.for('nodejs.util.inspect.custom')`——不同 util 版本都能拿到同一个符号；③ 库 A 与库 B 想协作识别「这个对象是可 xxx 的」协议。
- 来源：MDN `Symbol.for`；Node.js 文档。

---

**3）`Symbol` 上挂属性会怎样？为什么 `new Symbol()` 会抛错？**
- 参考要点：Symbol 是 primitive，**规范里没有 Symbol 包装对象**——`s.x = 1` 抛 TypeError（严格模式）或静默失败（sloppy 下也是 TypeError）。`new Symbol()` 抛 TypeError：Symbol 不是构造函数（[[Construct]] 内部方法缺失）；要造 symbol 只能 `Symbol()` 调用。
- 来源：ECMA-262 规范；MDN；StackOverflow。

---

**4）说出 5 个 Well-known Symbols 与它们的钩子语义。**
- 参考要点：`iterator`（for-of 协议）、`asyncIterator`（for-await-of）、`toPrimitive`（隐式转换）、`toStringTag`（`Object.prototype.toString`）、`hasInstance`（instanceof）、`species`（派生构造器）、`isConcatSpreadable`（concat 摊平）、`unscopables`（with 排除）。
- 来源：MDN《Well-known symbols》；javascript.info；ECMA-262 §7.11。

---

**5）`Symbol.toPrimitive` 与 `valueOf` / `toString` 的优先级？**
- 参考要点：**toPrimitive 最高**——引擎做 ToPrimitive 时先查它；没有才走 valueOf / toString（顺序取决于 hint）。传 hint：'number' | 'string' | 'default'。**Date 特殊**：default hint 走 toString 而不是 valueOf。
- 来源：ECMA-262 ToPrimitive；MDN；javascript.info《Symbol.toPrimitive》。

---

**6）以下代码打印什么？**
```js
const obj = {
  [Symbol.toPrimitive](hint) {
    return hint === 'number' ? 42 : 'str';
  },
};
console.log(+obj, `${obj}`, obj + 0);
```
- 参考要点：`42 'str' 'str0'`。`+obj` hint=number 得 42；模板字符串 hint=string 得 'str'；`obj + 0` 二元 + 走 default hint 得 'str'，然后 `+0` 拼字符串 → 'str0'。
- 来源：MDN；dmitripavlutin.com《Symbol.toPrimitive》。

---

**7）Symbol 键在哪些遍历 API 里可见、哪些不可见？**
- 参考要点：**不可见**：`Object.keys`、`for-in`、`JSON.stringify`、`Object.assign`（❌ 其实 assign 会拷 Symbol！修正：Object.assign **会**拷贝可枚举 Symbol）；**可见**：`Object.getOwnPropertySymbols`、`Reflect.ownKeys`、`Object.getOwnPropertyDescriptors`。
- 来源：MDN；StackOverflow《Does Object.assign copy symbol keys》（答案：会，如果可枚举）。

---

**8）如何用 Symbol 模拟「私有属性」？与 ES2022 `#field` 相比差在哪？**
- 参考要点：`const _x = Symbol('x'); class C { constructor() { this[_x] = 1; } }`——**默认 API 不暴露**、`for-in` / `JSON.stringify` 都看不到。差：① 通过 `Object.getOwnPropertySymbols` 能拿到（不是真私有）；② 符号本身可以被外部持有，就能读；③ 无法在类里做 `#x in obj` 检查。**#field** 是**语言层真私有**，外部拿不到——通过反射都失败。
- 来源：MDN；2ality《ES2015 private data via symbols》；TC39 class-fields 提案。

---

**9）什么是 `Symbol.species`？给一个真实例子。**
- 参考要点：**派生构造器**钩子——`Array.prototype.map/filter/slice/concat` 内部要 new 一个「和 this 同类」的新对象时，用的是 `this.constructor[Symbol.species]` 而不是 `this.constructor` 本身。**用途**：子类构造器签名特殊时（比如 `MyArr(len, initial)`），让 map 返回普通 Array。Promise 家族、TypedArray、RegExp 都靠它。
- 来源：MDN《Symbol.species》；ECMA-262 §7.3.23；javascript.info。

---

**10）以下代码结果为？**
```js
const arr = [1, 2, 3];
console.log(Object.getOwnPropertyNames(arr));
console.log(typeof arr[Symbol.iterator]);
```
- 参考要点：`['0','1','2','length']`（getOwnPropertyNames 返回字符串键，**不含 Symbol**）；`'function'`——Array.prototype 上挂了 `[Symbol.iterator]`，走原型链能找到。
- 来源：MDN；StackOverflow。

---

**11）Symbol 与字符串键的**性能**差异？**
- 参考要点：**基本无差异**——V8 内部两者都是 hash + inline cache；Symbol 属性稍慢一丁点（每次读要经过 `Symbol.toPrimitive` 检查的分支），实际工程测不出。**Symbol 真正的成本**是「不能通过字符串猜」——所以反射式代码（如 JSON 序列化）会**跳过** Symbol。
- 来源：v8.dev；MDN。

---

**12）现场手写：一个 `Seq` 类，实例能被 `for-of` 遍历出 1..n，且 `+seq` 得 n*(n+1)/2（等差数列和）。**
- 参考要点：
  ```js
  class Seq {
    constructor(n) { this.n = n; }
    *[Symbol.iterator]() { for (let i = 1; i <= this.n; i++) yield i; }
    [Symbol.toPrimitive](hint) { return this.n * (this.n + 1) / 2; }
  }
  +new Seq(100);            // 5050
  [...new Seq(5)];           // [1,2,3,4,5]
  ```
- 来源：javascript.info《Iterable objects》；MDN Symbol.iterator。
