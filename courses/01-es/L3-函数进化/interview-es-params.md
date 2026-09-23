# 面试题 · 参数三件套

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）默认参数是「编译期常量」还是「每次调用求值」？举例说明。**
- 参考要点：每次调用求值。经典例：`f(a = {})` 每次得到新对象；`f(x = count++)` 每次不同。
- 来源：MDN《Default parameters》；javascript.info《Default parameters》。

---

**2）`function f(x = y, y = 2) {}` 会怎样？说明参数独立作用域与 TDZ 的关系。**
- 参考要点：调用 `f()` → ReferenceError。规范里**参数列表自成 Scope for Formals**，独立于函数体作用域；y 已进入 TDZ，x=y 在初始化前读 y 就抛。
- 来源：StackOverflow《Function arguments and scope》；ECMA-262 规范 26.7.1。

---

**3）rest 参数与 arguments 的 4 个差异是什么？**
- 参考要点：rest 是真数组（可用 .map/.filter）；rest 只在指定位置开始收集；箭头函数没有 arguments 但能用 rest；rest 让签名自文档化（参数名 + 数量）。
- 来源：MDN《Rest parameters》；dmitripavlutin.com《Rest vs arguments》。

---

**4）`Math.max(...arr)` 在 arr 有 20 万个元素时会怎样？为什么？给出替代方案。**
- 参考要点：抛 `RangeError: Maximum call stack size exceeded`。原因：展开把每个元素当独立实参压栈，超过栈容量。替代：`arr.reduce((m, x) => m > x ? m : x, -Infinity)` 或 `Function.prototype.apply(null, arr)`（同样爆栈，但某些引擎阈值不同）。
- 来源：StackOverflow《RangeError: Maximum call stack size exceeded, using spread operator》；MDN 警告段。

---

**5）`{...obj}` 与 `Object.assign({}, obj)` 语义一致吗？说说差异。**
- 参考要点：都拷贝可枚举自有属性（含 Symbol）；都触发 getter；两者**都是浅拷贝**。差别：Object.assign 会**写入 target**（可覆盖已有属性、可传入多个源），spread 每次都新建对象。另外 Object.assign(target, ...) 里 target 的 setter 会被触发（spread 无此副作用）。
- 来源：MDN《Object.assign》；dmitripavlutin.com《Object spread vs Object.assign》。

---

**6）以下代码打印什么？**
```js
const a = { x: 1, get y() { return this.x + 1 } };
const b = { ...a };
const c = Object.assign({}, a);
console.log(b.x, b.y, a.y);
console.log(Object.getOwnPropertySymbols({ ...a, [Symbol('k')]: 1 }).length);
```
- 参考要点：`b.x` 1，`b.y` 2（**getter 求值后的普通属性**，不是 getter 本身）；Symbol 数量 1。**关键**：spread 触发 getter 求值，结果属性变成**普通数据属性**。
- 来源：MDN《Spread syntax》；StackOverflow《Object spread getter behavior》。

---

**7）默认参数只对 undefined 生效，null 不生效。团队里如何避免这坑？**
- 参考要点：① 默认值 + `??` 组合：`function f(a) { a = a ?? default; }`；② 强制解构 + 兜底：`function f({ a = 1 } = {})`；③ 参数校验函数（比如 zod / io-ts）；④ 团队约定「接口空值一律 undefined」+ 后端契约测试。
- 来源：Google Style Guide；Type-First 讨论。

---

**8）如何用 rest 与 spread 优雅实现「合并多个默认配置」？**
- 参考要点：
  ```js
  const defaults = { host: 'localhost', port: 5432, opts: { ssl: false } };
  function connect({ host, port, opts } = {}, ...rest) {
    return { ...defaults, ...(host && { host }), ...(port && { port }), ...(opts && { opts }) };
  }
  ```
  或更清晰：`function connect(cfg = {}) { return { ...defaults, ...cfg, opts: { ...defaults.opts, ...(cfg.opts || {}) } }; }`。**追问**：为什么不能对嵌套直接 spread？→ 浅拷贝，嵌套对象整个覆盖。
- 来源：Smashing Magazine 配置合并专题；lodash.merge 源码。

---

**9）`arguments` 有什么历史坑？**
- 参考要点：① 类数组，不能 .map；② 严格模式下与形参**解绑**（sloppy 模式下修改形参会影响 arguments，反之亦然）；③ 在 for 循环里 arguments.callee 严格模式禁用；④ 不能被箭头函数使用；⑤ `arguments.length` 反映实参数量、`fn.length` 反映形参数量（不含默认/rest）。
- 来源：MDN `arguments`；StackOverflow《Why is arguments.callee deprecated》。

---

**10）以下代码 `fn.length` 是多少？**
```js
function fn(a, b = 2, ...rest) {}
console.log(fn.length);
```
- 参考要点：**1**。fn.length 只计算**第一个有默认值之前**的形式参数个数。rest 参数不计。这是老 API，工程上少用；主要用来做**函数元数（arity）检测**。
- 来源：MDN《Function.length》。

---

**11）说出至少 3 种「浅拷贝一个对象」的写法，与它们的差异。**
- 参考要点：`{...obj}`（可枚举自有 + 触发 getter + 支持 Symbol）；`Object.assign({}, obj)`（同上但会触发 target setter）；`Object.freeze(Object.assign({}, obj))`（加冻结）；`structuredClone(obj)`（**深**拷贝，但函数、Symbol、原型链不可复制）。**追问**：如何拷贝 getter 保持 getter 语义？→ `Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyDescriptors(obj))`。
- 来源：MDN《Object.getOwnPropertyDescriptors》；lodash.cloneDeep 文档。

---

**12）现场手写：一个 `merge(...sources)`，实现**深合并**（对象递归合并，数组直接替换）。**
- 参考要点：递归；两侧都是 plain object 才递归；数组、Date、Map 都视为叶子；Symbol 键也要拷。追问：lodash.merge 行为差异（数组是 index 合并而不是替换）。
- 来源：lodash.merge 源码；多份中文手写题。

---

**13）函数的「参数作用域」是什么？为什么参数默认值读不到函数体里的同名变量？**
- 参考要点：规范上参数默认值在函数体之前、于一个**独立的参数作域**求值；默认值能看到外层变量与已先前参数，但看不到函数体的 var/let（函数声明实例化时参数作域已固定）。经典题：`function f(x = y) { let y = 2; return x; }` 中 x 拿外层 y 而非函数体的 y。
- 来源：2ality《Parameter scope in ECMAScript》经典博文；ECMAScript 规范 FunctionDeclarationInstantiation 一节的转述。

---

**14）多层可选 + 深度默认值的解构怎么写才不会报错？`{a:{b}= {}} = obj` 能挡住 null 吗？**
- 参考要点：逐层给默认 `const { a: { b = 1 } = {} } = obj;` 只在 a 为 **undefined** 时生效；若 a 是 null，解构 null 会 TypeError。生产代码配 `obj?.a?.b ?? 1` 更稳。**追问**：解构默认值与 ?? 的适用边界（区分 null/undefined 时）。
- 来源：MDN《解构赋值 > 默认值 / 嵌套默认》；社区 null 解构翻车贴的转述。

---

**15）为什么 rest 参数比 arguments 强？仅语法糖吗？**
- 参考要点：rest 是**真数组**（直接 map/filter/slice），arguments 是类数组需转；rest 只捕获尾部、可与命名参数共存；箭头函数无 arguments，rest 是唯一途径。且引用 arguments 会阻碍部分引擎优化。arguments 仅剩与 callee 等历史场景。
- 来源：MDN《Rest 参数 > 使用 rest 参数 vs arguments》；v8.dev 关于 arguments 优化影响的转述。
