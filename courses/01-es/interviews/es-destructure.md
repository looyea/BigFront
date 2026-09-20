# 面试题 · 解构

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）数组解构与对象解构的底层机制分别是什么？为什么 Set/字符串可以数组解构但不能对象解构（除非用下标）？**
- 参考要点：数组解构走迭代器协议 `[Symbol.iterator]`（依次 next()）；对象解构走 [[Get]]（按 key 读）。Set/字符串都有 iterator，所以数组解构 OK；对象解构只能读**属性名对应的键**——Set 没有具名属性所以拿不到值。
- 来源：MDN《Destructuring assignment》；javascript.info《Destructuring assignment》。

---

**2）以下代码打印什么？为什么？**
```js
const obj = { a: 1, b: 2, c: 3 };
const { a, ...rest } = obj;
console.log(rest);
console.log('c' in rest, Object.keys(rest));
```
- 参考要点：`rest = { b: 2, c: 3 }`。**关键**：rest 是**新对象**（浅拷贝），不包含 a。`'c' in rest` true。
- 来源：dmitripavlutin.com《JavaScript object destructuring》；TC39 rest-spread-properties 提案。

---

**3）如何交换两个变量？说出 3 种，指出优劣。**
- 参考要点：
  - `[a, b] = [b, a]` — 解构，最优雅。
  - `a ^= b; b ^= a; a ^= b;` — 位运算，仅整数。
  - `let t = a; a = b; b = t;` — 临时变量，最兼容。
  解构方案要**注意 TDZ**（`let [a, b] = [1, 2]; [a, b] = [b, a];` 里右侧的 a/b 在左侧未初始化前不存在）。
- 来源：StackOverflow《How to swap variables by destructuring》；MDN。

---

**4）以下代码结果为：`const { x, x: y, x: z = 10 } = { x: 1 };` 分别得到什么？**
- 参考要点：`x = 1`；`y = 1`；`z = 1`（源里的 x 是 1，不是 undefined，所以默认值不生效）。**追问**：一个 key 能被解构多次到不同变量，各自独立。
- 来源：MDN 解构页；StackOverflow 高票。

---

**5）解构一个 getter 属性会发生什么？**
- 参考要点：触发一次 [[Get]]，即**求值** getter，取到的值存进变量——**结果属性是普通数据**，不再是 getter。用 `Object.getOwnPropertyDescriptor` 可验证。
- 来源：MDN 解构页；StackOverflow《Destructuring and getters》。

---

**6）说出下面 3 行代码各自的语义：**
```js
function f(a) {}
function f({ a }) {}
function f({ a } = {}) {}
function f({ a = 1 } = {}) {}
```
- 参考要点：
  - `f({a})`：要求实参必须是对象，且读 `.a`；`f()` 抛 TypeError。
  - `f({a} = {})`：`f()` 不传时用 `{}` 兜底，a 是 undefined。
  - `f({a=1} = {})`：既不传参、也没 `.a` 时都用 1。
- 来源：javascript.info；dmitripavlutin.com。

---

**7）React 自定义 Hook 为什么返回数组而不是对象？两种各自适合什么场景？**
- 参考要点：**数组**——按位置约定，消费方**重命名自由**（`const [count, setCount] = useCounter()`），适合「一个主值 + 操作函数」这类**语义顺序清晰**的返回；**对象**——按名字约定，扩展新字段不破坏消费方，适合返回值多、语义复杂。**追问**：Vue 的 `useQuasar()` 类组合式 API 大多返回对象。
- 来源：React 官方 FAQ《Why do React Hooks return arrays》；Dan Abramov overreacted.io《Why are React Hooks a good API》。

---

**8）解构性能如何？为什么 V8 团队建议**热路径**慎用嵌套解构？**
- 参考要点：嵌套解构编译成多次 [[Get]] + 检查 undefined + 触发迭代器协议——**在极热循环里比直接 `obj.a.b` 略慢**。Babel 降级后差距更大（多个中间变量、slice 调用）。工程上：一次解构多个属性通常更快（局部变量缓存），复杂嵌套在热点里建议展开写。
- 来源：v8.dev 相关博客；StackOverflow《Destructuring performance》。

---

**9）以下代码结果为？**
```js
const [a = 1, b = a + 1] = [];
console.log(a, b);
```
- 参考要点：`1, 2`。数组解构里的默认值**从左到右**求值，可以引用**左边已确定的变量**。对象解构同理。
- 来源：MDN 解构页。

---

**10）如何用解构优雅地做「忽略某些敏感字段」？**
```js
const user = { id: 1, name: 'Ann', password: 'secret', salt: 'x' };
```
请写一行代码，得到**剔除 password 与 salt**的新对象。
- 参考要点：`const { password, salt, ...safe } = user;` —— rest 收集剩余。ESLint 里 `no-unused-vars` 会告警，用 `ignoreRestSiblings: true` 关闭。
- 来源：ESLint `no-unused-vars` 文档；lodash.omit 讨论。

---

**11）嵌套解构的两层 `= {}` 分别兜住什么？给一个真实 API 返回的例子。**
```js
const { data: { list = [] } = {} } = response;
```
- 参考要点：内层 `list = []` 兜住 `data.list` 为 undefined 的情况；外层 `= {}` 兜住 `response.data` 为 undefined 的情况——若没这层，`data` 为 undefined 时读 `.list` 会 TypeError。**典型场景**：接口未加载、后端返回 `{ data: null }`、错误响应没 data 字段。
- 来源：React Query / SWR 社区常见问答；MDN。

---

**12）以下代码为什么 SyntaxError？如何修？**
```js
const { a } = obj
const { b } = obj
```
- 参考要点：其实**不**会报错——两行独立 const 声明合法。经典错在：
  ```js
  let x;
  { x } = { x: 1 };   // SyntaxError 或者被解析成块 + label
  ```
  修：用括号 `({ x } = { x: 1 })`。**追问**：为什么 `const { x } = obj` 不报错但赋值解构要括号？—— const 语句以 `const` 关键字开头，编译器已知是声明；单独一行的 `{ x } = ...` 编译器会把 `{` 解析成块语句开始。
- 来源：MDN；StackOverflow《Why wrap object destructuring in parens》。
