# 面试题 · 类型与类型判定

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源（点击可读原文）。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）JavaScript 里有几种数据类型？primitive 与 object 的分界线是什么？**
- 参考要点：7 种 primitive（undefined/null/boolean/number/bigint/string/symbol）+ object（含 function/array/Date…）。primitive 按值、不可变；object 按引用、可变。
- 来源：MDN《JavaScript data types and data structures》；GreatFrontEnd《50+ Must-know JS Interview Questions》类型段。

---

**2）`typeof null === 'object'` 是 bug 吗？为什么一直没修？**
- 参考要点：是历史 bug（1995 Brendan Eich 10 天写 JS 时，值以 32 位存储，前 1-3 位是类型 tag，object tag = 0；NULL 指针全 0 → 误判 object）。TC39 曾提案 `typeof null === 'null'`，因破坏太多现网代码被否。
- 来源：ECMA-262 规范历史备注；StackOverflow《Why is typeof null 'object'?》；Derek BR 视频《typeof null === "object", here's why》。

---

**3）如何判定一个值是数组？跨 iframe 呢？说说 4 种方法**。
- 参考要点：`Array.isArray(x)`（推荐、跨 realm 安全）、`x instanceof Array`（跨 realm 失效）、`Object.prototype.toString.call(x) === '[object Array]'`（跨 realm 也 OK，因为看的是 [[Class]] 内部标签）、`x.constructor === Array`（跨 realm 也失效）。
- 来源：MDN `Array.isArray`；InterviewBit 题集。

---

**4）instanceof 的原理是什么？能否自己实现一个？**
- 参考要点：沿 `x.__proto__` 向上找是否存在 `C.prototype`。手写：
  ```js
  function myInstanceof(x, C) {
    let p = Object.getPrototypeOf(x);
    while (p) { if (p === C.prototype) return true; p = Object.getPrototypeOf(p); }
    return false;
  }
  ```
  追问：Symbol.hasInstance 会短路——规范先查 `C[Symbol.hasInstance](x)`。
- 来源：javascript.info《instanceof, Symbol.hasInstance》；GreatFrontEnd 手写题。

---

**5）Object.prototype.toString.call 与 typeof、instanceof 的关系？分别在什么时候用？**
- 参考要点：typeof 判 primitive + 分出 function；toString.call 判 object 家族细分（Array/Map/Set/Date/RegExp/…）；instanceof 判「是不是某个类的实例」，跨 realm 会失效。三者互补。
- 来源：MDN `Object.prototype.toString()`；BuiltIn《55 Top JS Interview Questions》题 15。

---

**6）`null` 与 `undefined` 有什么区别？你的项目里如何约定？**
- 参考要点：undefined 是「引擎默认的没有值」；null 是「程序员主动的空」。JSON 里 undefined 会被丢；数组里 undefined 序列化为 null。团队约定：接口无返回用 null；参数缺省用 undefined；未初始化用 undefined。
- 来源：StackOverflow《Difference between null and undefined》；Google JavaScript Style Guide。

---

**7）以下代码打印什么？**
```js
console.log(typeof undefined);
console.log(typeof Symbol());
console.log(typeof 42n);
console.log(typeof (() => {}));
console.log(typeof class {});
```
- 参考要点：`'undefined'`, `'symbol'`, `'bigint'`, `'function'`, `'function'`（class 是特殊函数，typeof 得 function）。
- 来源：dmitripavlutin.com《JavaScript types guide》；InterviewBit 类型段。

---

**8）Symbol.toStringTag 是什么？给一个真实用例。**
- 参考要点：挂在对象上（自有属性或 getter），`Object.prototype.toString` 会优先读它，用于自定义 `[object XXX]` 中的 XXX。真实用例：库作者给自定义数据结构一个可读 tag（`class Vector { get [Symbol.toStringTag]() { return 'Vector' } }`）；调试时 console 更清晰；一些库用 toStringTag 做鸭子类型判定。
- 来源：MDN `Symbol.toStringTag`；2ality《Private property syntax》。

---

**9）如何判定一个对象是不是「普通对象」（plain object）？**
- 参考要点：`v !== null && typeof v === 'object'` 不够——array / Date / Map 都通过。要看原型：`Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null`。**追问**：`{ __proto__: null }` 与 `Object.create(null)` 是不是 plain？——是的；lodash 里 isPlainObject 也把它们算 plain。
- 来源：lodash 源码 `isPlainObject`；BuiltIn《55 Top》题 18。

---

**10）TypeScript 里的 `typeof x === 'string'` 与 JavaScript 里的 `typeof` 是同一件事吗？**
- 参考要点：运行时是同一件事；TS 复用了这个表达式做**类型收窄**（narrowing），让编译器在 if 分支内相信 x 是 string。这属于**编译期**行为，运行时 nothing changes。
- 来源：TypeScript Handbook《Narrowing > typeof guards》。

---

**11）为什么不能用 `x instanceof Object` 判定 null？**
- 参考要点：null 没有原型链，instanceof 检查会返回 false；typeof null 又是 'object' 这个 bug。正确判定：`x !== null && typeof x === 'object'`；或者 `Object(x) === x`（后者能区分 primitive 与 object 但可读性差）。
- 来源：MDN `typeof`；StackOverflow《How to check if a value is an object in JavaScript》。

---

**12）什么是 realm？跨 realm 场景你遇到过吗？**
- 参考要点：一个 realm = 一套独立的全局对象 + 内置构造器。iframe / vm / worker / shadow-realm 都会产生新 realm。跨 realm 时 `x instanceof X` 失效；Symbol、Promise 等**跨 realm 也不相等**。解法：用鸭子类型（`x && x.then`）或者规范级 API（`Array.isArray`、`Promise.resolve` 有跨 realm 检查）。
- 来源：MDN《JavaScript/Reference/Glossary > Realm》；Axel Rauschmayer《Realm》博文。
