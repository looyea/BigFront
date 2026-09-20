# 面试题 · 作用域

> 本关所有面试题**均整理自公开的互联网题库与工程师访谈**，每题末尾给出来源链接（点击可读原文）。题目文本已用中文重新表述，代码示例为业界广泛流传的**通用范例**。

---

**1）什么是「词法作用域（Lexical Scoping）」？与之对立的「动态作用域」又是什么？为什么 JS 选了词法作用域？**
- 参考要点：词法作用域由代码书写位置决定，编译阶段即可确定；动态作用域由调用链决定（Shell、早期 Lisp 属此类）。词法让工具能静态分析（tree-shaking、类型检查）；动态查找慢、易出错。
- 来源：MDN《Closures > Lexical scoping》；You Don't Know JS（Kyle Simpson）Scope & Closures 卷 第 1-3 章。

---

**2）以下代码打印什么？把作用域链画出来。**
```js
var a = 1;
function outer() {
  var b = 2;
  function inner() {
    var c = 3;
    console.log(a + b + c);
  }
  inner();
}
outer();
```
- 参考要点：打印 6。inner → outer → 全局，一层层查。自由变量 a、b 通过 [[Environment]] 找到。
- 来源：InterviewBit《JavaScript Interview Questions》Scope Chain 段；BuiltIn《55 Top JavaScript Interview Questions》题 8。

---

**3）以下代码在**严格模式**和**非严格模式**分别打印什么？**
```js
function f() {
  x = 10;      // 未声明直接赋值
  console.log(x);
}
f();
```
- 参考要点：非严格模式：x 被悄悄挂到全局，输出 10；严格模式：`ReferenceError: x is not defined`。这条差异是 ESLint `no-undef` 与「use strict」存在的重要原因。
- 来源：MDN「use strict」文档；StackOverflow《What exactly is the purpose of use strict》高票答案。

---

**4）以下代码打印什么？说明 const 的「绑定不变」与「值不可变」的区别。**
```js
const user = { name: 'Ann' };
user.name = 'Bob';
console.log(user.name);
user = {};
```
- 参考要点：前 3 行输出 'Bob'（对象内部可变），第 4 行 `TypeError: Assignment to constant variable.`。要真正值不变用 Object.freeze（浅冻结）或递归冻结。
- 来源：GreatFrontEnd《50+ Must-know JavaScript Interview Questions》const 段；dmitripavlutin.com《Guide to JavaScript const》。

---

**5）以下代码打印什么？为什么？**
```js
function f() { console.log(a); var a = 1; }
function g() { console.log(b); let b = 1; }
f(); g();
```
- 参考要点：f 打印 undefined（var 提升+遮蔽全局）；g 抛 ReferenceError（TDZ）。这题考「作用域 + 提升 + TDZ」三合一。
- 来源：BuiltIn《55 Top JavaScript Interview Questions》题 6；GeeksforGeeks Hoisting 题集。

---

**6）下面代码 `if (true)` 里定义的函数 foo 能否在 if 外面调用？严格模式呢？**
```js
if (true) {
  function foo() {}
}
typeof foo;
```
- 参考要点：现代规范里 foo 的作用域只是块本身。sloppy mode 下 Annex B 会给外层函数/全局 var-like 化一个 foo，所以 typeof 得 'function'；严格模式下块外访问 foo → ReferenceError 或 typeof 得 'undefined'（不同引擎表现有细微差别）。工程实践：不要这么写。
- 来源：ECMAScript 规范 Annex B.3.3；eslint 规则 `no-inner-declarations` 文档；StackOverflow《Are functions declared in blocks hoisted?》高票答案。

---

**7）遮蔽（shadowing）什么时候是好事、什么时候是灾难？**
- 参考要点：好——把长名字参数就地重命名（`const { length } = arr`）、循环计数器 i/j/k；灾——多层同名 outer/inner 让作用域链变复杂，配合 TDZ 与提升极易踩坑。ESLint `no-shadow` 是团队项目常用规则。
- 来源：eslint.org 文档；Crockford《How Did JavaScript Go Wrong》讨论。

---

**8）ESM 模块顶层的 `var x = 1` 会挂到全局对象吗？与 CJS 的 `var` 有何区别？**
- 参考要点：不会。ESM 顶层作用域独立于 globalThis，`var` 也不外泄。CJS 文件被包成 `(function (exports, require, module, __filename, __dirname) { ... })`，var 挂到这个函数作用域，也不会污染全局——除非显式 `global.x = 1`。这题考「模块作用域边界」的理解。
- 来源：MDN《JavaScript modules > Scope》；Node.js 官方文档 Modules 段。

---

**9）什么是「Temporal Dead Zone（TDZ）」？给两个真实工程场景会踩到的例子。**
- 参考要点：块内从起点到 let/const/class 声明前的区域。真实场景：① 参数默认值引用后位参数；② 类字段初始化顺序；③ 递归辅助函数放在 let 声明之前。
- 来源：MDN《Temporary dead zone》；2ality《JavaScript's Temporal Dead Zone》。

---

**10）以下代码打印什么？说明 for 循环的 per-iteration binding 与普通块作用域的差异。**
```js
var funcs = [];
for (let i = 0; i < 3; i++) funcs.push(() => i);
funcs.forEach(f => console.log(f()));

let j = 0;
{
  let k = j;
  j++;
  console.log(k); // 0
}
console.log(j);   // 1
```
- 参考要点：第一题打印 0 1 2（per-iteration binding）；第二块作用域是**普通块**，k 只在块内，j++ 之后 k 仍是旧的 0——**说明 per-iteration binding 是 for+let 的规范特例，不是块作用域的自然结果**。
- 来源：ECMAScript 规范 14.7.4.3 / CreatePerIterationEnvironment；StackOverflow 高票答案。

---

**11）为什么 `with (obj) { ... }` 会严重拖慢性能？**
- 参考要点：with 让作用域链在**运行时**可变，V8 无法在编译期决定一个变量是 obj 的属性还是外层变量，导致所有引用都要走通用查找；同时阻断大量 JIT 优化。严格模式禁用 with。
- 来源：MDN《with》；v8.dev《The cost with with》；Angus Croll《Celeritas》。

---

**12）现场手写：把一段用 IIFE + 闭包实现的私有变量模块，重构成 ESM + class 私有字段两种版本。**
- 参考要点：IIFE 版本用 `return { pub }`；ESM 版本用顶层 `const secret = ...` + `export function ...`；class 版本用 `#secret` 与 `get`。**追问点**：三者在测试可替换性、多实例状态、tree-shaking 上的差异。
- 来源：Angular style guide；TC39 Private class fields 提案；多份中文八股。
