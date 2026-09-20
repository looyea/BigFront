# 面试题 · 箭头函数与 this

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）箭头函数与普通函数有哪 5 个硬差异？为什么说箭头是「lambda」而不是「简写」？**
- 参考要点：this 词法绑定；无 arguments；无 super/new.target；无 .prototype；不能 new。它是规范里另一类函数对象。
- 来源：MDN《Arrow function expressions》；dmitripavlutin.com《Arrow functions considerated harmful》；javascript.info《Arrow functions》。

---

**2）以下代码分别打印什么？**
```js
const obj = { name: 'Ann', normal() { return this?.name; }, arrow: () => this?.name };
console.log(obj.normal());
console.log(obj.arrow());
const lost = obj.normal;
console.log(lost());
```
- 参考要点：`'Ann'` / `undefined`（模块环境） / `undefined`。normal 有隐式绑定；arrow 捕获模块外层；lost 丢了隐式绑定走默认（严格模式 undefined）。
- 来源：BuiltIn《55 Top JS Interview Questions》this 段；GreatFrontEnd《50+》this 段。

---

**3）`(() => this)().call({a:1})` 结果是什么？为什么 call/bind 都改不了箭头的 this？**
- 参考要点：外层 this（严格模式 undefined）。规范里箭头没有 [[ThisMode]] = 'lexical'，call/bind 只对有 [[ThisMode]] = 'this' 的普通函数生效。
- 来源：ECMA-262 规范 ArrowFunction Evaluation；StackOverflow 高票答案。

---

**4）`const f = () => { a: 1 };` 返回 undefined，为什么？如何正确返回对象？**
- 参考要点：`{}` 被解析为**函数体的块语句**，`a:` 是**标签语句**（labels 允许出现在任何语句前，是 JS 最冷僻的特性之一）；表达式 1 被求值但丢弃；函数无 return → undefined。写 `() => ({ a: 1 })` 用括号强制**表达式上下文**。
- 来源：dmitripavlutin.com《Arrow functions considerated harmful》；StackOverflow 高票答案。

---

**5）箭头函数没有 arguments。想读变长实参怎么办？箭头读 arguments 时会发生什么？**
- 参考要点：用 **rest 参数** `(...args) => args.map(...)`。箭头内部读 `arguments` 会沿作用域链向外找最近**普通函数**的 arguments；若一路没有普通函数则 ReferenceError。
- 来源：MDN `arguments`；javascript.info《Rest parameters》。

---

**6）class 字段箭头 vs 原型方法：什么时候用哪个？各有什么代价？**
- 参考要点：字段箭头（`onClick = () => ...`）——this 不丢，可以传给事件；每实例新建函数、内存/初始化时间稍高、无法 super。原型方法（`onClick() {}`）——共享节省内存、可 super、需要 bind 才能传引用。React 类组件历史上曾流行 constructor 里 bind，就是为解决这个矛盾；字段箭头是更简洁的方案。
- 来源：React 官方 FAQ《Do I need to bind methods in components》；Axel Rauschmayer《ES2022 class fields》。

---

**7）以下代码打印什么？为什么？**
```js
class Counter {
  constructor() { this.count = 0; }
  incProto() { this.count++; return this.count; }
  incArrow = () => { this.count++; return this.count; };
}
const a = new Counter(), b = new Counter();
const f1 = a.incProto, f2 = a.incArrow;
console.log(f1?.(), f2());
```
- 参考要点：f1() 严格模式下抛 TypeError（this 为 undefined 时 `this.count` 报错）；f2() 打印 1（箭头 this 定死是 a）。这是字段箭头最大的实用价值。
- 来源：多份中文八股；TypeScript playground 演示。

---

**8）以下 DOM 事件绑定哪几行**能**给按钮加上红色背景？为什么？**
```js
const btn = document.querySelector('#b');
btn.style.background = ''; // 假定按钮原本没红色
btn.addEventListener('click', function () { this.style.background = 'red'; });        // ①
btn.addEventListener('click', () => this.style.background = 'red');                     // ②
btn.addEventListener('click', (e) => e.currentTarget.style.background = 'red');          // ③
btn.addEventListener('click', (e) => e.target.style.background = 'red');                 // ④
```
- 参考要点：① 能（this 由事件系统 bind 成元素）；② 不能（this 是模块外层，通常 undefined 会抛错）；③ 能（currentTarget 就是绑定元素）；④ 大多数能，但如果按钮内有子元素，target 会是子元素（事件冒泡）。
- 来源：MDN `EventTarget.addEventListener`；Smashing Magazine 事件对象专题。

---

**9）箭头函数能被 new 吗？为什么？**
- 参考要点：不能，抛 `TypeError: not a constructor`。规范里箭头没有 [[Construct]] 内部方法，也没有 .prototype。设计动机：箭头是 lambda，语义上就不参与 OOP 构造协议。
- 来源：ECMA-262 规范；StackOverflow 高票。

---

**10）箭头函数的 name 属性是什么？调试时有何影响？**
- 参考要点：匿名箭头无名 → `''`；`const foo = () => {}` 会被引擎**推断 name = 'foo'**（NamedEvaluation）；`const foo = bar(() => {})` 里的箭头 name 是 `''`。栈追踪里 `<anonymous>` 出现频率高，多半是这类无名箭头。工程：给关键回调用具名 function 或先赋值给变量。
- 来源：MDN《Function.name》；v8.dev《Function name inference》。

---

**11）以下代码打印什么？为什么？**
```js
const obj = {
  nums: [1, 2, 3],
  sum: 0,
  total() { this.nums.forEach((n) => { this.sum += n; }); return this.sum; },
};
console.log(obj.total());
```
- 参考要点：6。forEach 回调用箭头，箭头里的 this 来自 total() 方法调用，绑定是 obj；这正是**箭头函数最漂亮的用法**——老代码得写 `var self = this`，箭头解决了。
- 来源：javascript.info《Arrow functions revisited》；dmitripavlutin.com。

---

**12）如果把上面这行 `forEach((n) => { this.sum += n })` 改成 `forEach(function(n) { this.sum += n })`，结果是什么？**
- 参考要点：NaN 或抛错。function 版本的 this 由 forEach 决定（默认 undefined 或 globalThis），`this.sum` 变 undefined + number = NaN；若 globalThis 存在则污染全局。
- 来源：同上，是社区教程中「为什么 forEach 里推荐箭头」的标准演示。
