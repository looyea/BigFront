# 面试题 · 变量提升与函数提升

> 本关所有面试题**均整理自公开的互联网题库与工程师访谈**，每题末尾给出来源链接（点击可读原文）。题目文本已用中文重新表述，代码示例为业界广泛流传的**通用范例**（不属于任何单一作者）。
> 建议：**先自己答，再点开来源核对**。

---

**1）用你自己的话说清楚 JavaScript 里的「提升（hoisting）」到底是什么；`var`、`function 声明`、`let/const`、`class` 四者提升行为有什么本质区别？**

- 参考要点：编译阶段登记声明槽位；var 提升到函数/全局并初始化为 undefined；函数声明**整体**提升（名字+体）；let/const/class 提升到块顶但**不初始化**，进入 TDZ。
- 来源：GreatFrontEnd《50+ Must-know JavaScript Interview Questions》第 11 题 · InterviewBit《JavaScript Interview Questions》Hoisting 段。

---

**2）以下代码输出什么？解释每一步。**
```js
console.log(foo);
foo();
var foo = function () { console.log('expr'); };
function foo() { console.log('decl'); }
```
- 参考要点：
  - 编译期先建 var foo=undefined、再把 function 声明装进 foo（函数优先）；
  - 第一行打印**函数体本身**（不是 undefined，也不是 'expr'）；
  - 第二行 `foo()` 调用的是**函数声明版本**，输出 `decl`；
  - 之后执行 `var foo = function(){...}`，把 foo 覆盖为表达式版本，但已经用完了。
- 来源：GeeksforGeeks / InterviewBit 中同一经典题型的变体。

---

**3）以下 for 循环打印什么？如何改成按 0、1、2 顺序打印？给三种不同方案。**
```js
for (var i = 0; i < 3; i++) {
  setTimeout(function () { console.log(i); }, 100);
}
```
- 参考要点：原代码打印 `3 3 3`，因为共享一个 `i`。三种修法：
  - `let i` 替代（块作用域 + per-iteration binding）；
  - **IIFE 捕获**：`setTimeout((j) => () => console.log(j))(i)` 或 `(function (j) { setTimeout(()=>console.log(j)) })(i)`；
  - 给 setTimeout 传**第三参数**：`setTimeout(function (j) { console.log(j) }, 100, i)`。
- 来源：dmitripavlutin.com《7 Interview Questions on JavaScript Closures》问题 4（该题在闭包章节出现，但根因是提升+共享绑定）。

---

**4）为什么语言规范要设计 TDZ？没有 TDZ 会怎样？**
- 参考要点：
  - 强制「先声明后使用」，把 var 类 bug 变成编译/运行期显式错误；
  - 让 `const` 的不可重新赋值语义有明确定义（若允许读未初始化的 const，语义会自相矛盾）；
  - 支持「暂时性遮蔽」的**一致**行为：块内 `let x` 时，块内的 x 从块首就是它自己，不会读到外层同名变量。
- 来源：MDN《Temporal dead zone and const cases》、2ality《A critical look at the TDZ》。

---

**5）同作用域里 `function foo(){}` 与 `var foo;` 会**共存**，但 `function foo(){}` 与 `let foo;` 会报错——为什么？**
- 参考要点：var 声明与函数声明共享一个「函数作用域槽位」，规范允许二者**合并**；let/const 建立**词法声明**（LexicalBinding），与 var 是两套登记机制，同名会 SyntaxError。
- 来源：StackOverflow《Function declaration with the same name as let/const variable》高票答案。

---

**6）以下代码运行结果是什么？把每步执行讲清。**
```js
var a = 1;
function outer() {
  console.log(a);
  var a = 2;
}
outer();
```
- 参考要点：打印 `undefined`。函数内 `var a = 2` 让 `a` 变成 outer 的局部变量（提升为 undefined），并未访问全局 a。这是**变量遮蔽 + 提升**的双料陷阱题。
- 来源：BuiltIn《55 Top JavaScript Interview Questions》题 12 及多份中文面试题库。

---

**7）什么是"块内函数声明"在 sloppy mode 下的 Web 兼容语义？为什么严格模式下不能再这样写？**
- 参考要点：
  - ES6 之前，块内 function 声明行为各引擎不统一；ES6 把块作用域作为标准，但 Annex B 允许 sloppy mode 下额外把函数名挂到外层 var-like 槽位；
  - 严格模式下，块内函数声明的作用域**仅为块本身**，块外无法访问，也不会隐式 var 化。
  - 后果：跨环境不可预测。工程实践：用 `let f = function(){}` 或提到块外。
- 来源：ECMAScript 规范 Annex B.3.3；eslint 规则 `no-inner-declarations` 文档。

---

**8）模块文件里，`import` 语句是提升的吗？为什么我可以在文件的顶部以下位置安全引用被 import 的绑定？**
- 参考要点：`import` 声明是**编译阶段处理的链接**（把外部模块绑定引入本模块词法环境），因此在源码任何位置都能引用；但真正常量仍受 TDZ 约束（例如被 import 的 `let` 变量在导出模块中若尚未初始化，则读它仍抛错——不过 ESM 的 link 步骤保证循环依赖时会走 live-binding 语义）。
- 来源：MDN `import` 文档；exploringjs.es6《ES modules: API sketch》。

---

**9）以下代码是**合法**的吗？如果有错，错在哪一行？**
```js
if (true) {
  let a = 1;
}
console.log(a);
```
- 参考要点：不合法。`a` 是块作用域，块外无法访问，`ReferenceError: a is not defined`。
- 来源：InterviewBit 题集，多份中文八股题。

---

**10）写一段代码，让 `let x` 出现在 `console.log(x)` **之前**但**仍然**抛 TDZ ReferenceError——你觉得可能吗？（提示：条件块里的 TDZ）**
- 参考要点：可能。
  ```js
  let x = 1;
  {
    console.log(x);  // ❌ ReferenceError: Cannot access 'x' before initialization
    let x = 2;       // 这行让 x 在整个块内进入 TDZ，即使源码位置在下面
  }
  ```
  编译器**在块开始时**就把 x 登记为块作用域，`console.log(x)` 已经指向块内的 x（TDZ 中），不会读到外层 x。
- 来源：2ality《JavaScript’s Temporal Dead Zone》经典例子。

---

**11）你觉得 hoisting 是 bug 还是特性？如果面试官反问，你如何给出**工程立场**的回答？**
- 参考要点：
  - **历史妥协 + 实用价值**：函数声明的完整提升让「工具函数放文件底部」这类写法可行；var 提升更多是遗留包袱。
  - 现代工程：ESLint 用 `no-var`、`block-scoped-var`、`no-use-before-define` 把风险变成静态错误；TypeScript 编译期再做一层。
  - 立场：接受它、用工具消除踩坑面、别写依赖提升的代码。
- 来源：多份社区讨论（Angular-aria、r/javascript 讨论串、Axel Rauschmayer 博文）。

---

**12）现场手写：给定任意一段含 `var/let/function/class` 的函数体，你能**在纸上按顺序**列出「编译阶段建了哪些槽位 → 执行阶段每一步读/写了哪个槽位」。**
- 参考要点：这题没有标准答案。面试官看的是你的**心智模型是否自洽**——把 Lexical Environment、变量对象（Variable Record）、TDZ、函数对象、执行栈一一说清楚即可。
- 来源：Angela Yu / Udemy 课程常见收尾题；各大厂现场题变体。
