# 面试题 · ES2015-2017

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）`class` 是不是只是 `function` 的语法糖？有哪些不可绕过的差异？**
- 参考要点：大体是糖，但有三点硬差异：① **类声明有 TDZ**，定义前引用抛 ReferenceError；② **原型方法不可枚举**（`Object.keys(P)` 为空）；③ **类体永远运行在严格模式**（`this` 不隐式指向全局、无 with、octal 报错）。**追问**：不用 `new` 调用 class 会怎样？→ 抛 `TypeError: Class constructor cannot be invoked without new`。
- 来源：MDN class；Dr. Axel Rauschmayer《ES2015》系列；StackOverflow 高票。

---

**2）`extends` 之后为什么构造函数里必须先 `super()`？**
- 参考要点：派生类的 `this` 由**父类构造函数创建**，`super()` 之前 `this` 尚未初始化，访问即抛 ReferenceError。若派生类不写 constructor，会自动生成一个透传参数的默认构造器。**追问**：`super` 在方法里指向什么？→ 指向父类的原型对象（`Parent.prototype`）。
- 来源：MDN super；TC39 ES2015 规范；javascript.info。

---

**3）`2 ** 3 ** 2` 等于多少？幂运算符的结合性？**
- 参考要点：`**` 是**右结合**，等价 `2 ** (3 ** 2) = 2 ** 9 = 512`。且一元负号不能直接放在 `**` 左边操作数（`-2 ** 2` 是 SyntaxError，必须 `(-2) ** 2`）。
- 来源：MDN 运算符；TC39 exponentiation 提案(ES2016)。

---

**4）`includes` 与 `indexOf` 判存在的差别？为什么需要 includes？**
- 参考要点：① `includes` 能判 `NaN`（SameValueZero），`indexOf` 不能；② `includes` 可传第二参 as 起始索引但语义是「从该下标起」，`indexOf` 第二参同样；③ `includes` 返回 boolean 更语义化。**同类**：`Array.prototype.includes`、`String.prototype.includes`（后者 ES6 早有）。
- 来源：MDN；TC39 Array.prototype.includes(ES2016)。

---

**5）`async/await` 与 `.then()` 链的本质关系？出错怎么处理？**
- 参考要点：`async/await` 是 Promise + 生成器的语法糖，编译器把 await 拆成微任务调度。**错误处理**：`try/catch` 捕获被 await 的 rejection；不 catch 则 async 函数返回一个 rejected Promise。**追问**：`await` 后面不是 Promise 会怎样？→ 会被 `Promise.resolve` 包装，仍让出一个微任务 tick。
- 来源：MDN async function；V8 blog「async performance」；TC39(ES2017)。

---

**6）`Object.values` / `Object.entries` 与 `for...in` 遍历范围差别？**
- 参考要点：values/entries/keys 只处理**自有 + 可枚举**属性，忽略 Symbol 与非枚举；`for...in` 会**沿原型链**遍历所有可枚举字符串键——常用于对象却把继承来的方法也带出来，是经典坑。数组不建议 for...in（键是字符串）。
- 来源：MDN；javascript.info「Object keys」。

---

**7）`padStart` / `padEnd` 的用途与第二个参数限制？**
- 参考要点：`'5'.padStart(3, '0') → '005'`，用于补零对齐、卡号掩码等。**限制**：填充字符串会被**截断到刚好补齐**，多出的部分丢弃；不传第二参默认用空格。ES2017 新增。
- 来源：MDN；TC39 padStart/padEnd(ES2017)。

---

**8）`Number.isNaN` 与全局 `isNaN` 的区别？**
- 参考要点：全局 `isNaN('x')` 会先把参数转数字再判断，`Number('x')→NaN` 所以返回 true（**误判**非数字为 NaN）；`Number.isNaN` 先检查「是否 number 类型且为 NaN」，`Number.isNaN('x')→false`。同类还有 `Number.isFinite`。**追问**：`Number.isInteger(3.0)`？→ true（3.0 与 3 同一值）。
- 来源：MDN；2ality「ES2015 Number API」。

---

**9）`new.target` 能解决什么旧写法解决不了的问题？**
- 参考要点：ES5 里判断「是否用 new 调用」要靠 `this instanceof Foo`（子类会失真）或脆弱技巧；`new.target` 精确指向**被 new 的那个构造函数**，可据此实现「抽象基类禁止直接实例化」「无需 new 也能正确构造」的工厂。**追问**：箭头函数里有 `new.target` 吗？→ 没有，箭头函数无 `[[IsConstructor]]`。
- 来源：MDN new.target；TC39 ES2015。

---

**10）以下代码打印什么？**
```js
class A { static x = 1; }
class B extends A {}
A.x = 2;
console.log(B.x);
```
- 参考要点：`2`。**静态属性/方法沿原型链继承**（`B.__proto__ === A`），改父类静态值子类可见。注意：`static x = 1` 这种**类字段语法**本身是 ES2022 才标准化（旧引擎要 Babel）。
- 来源：MDN static；TC39 class fields(ES2022)。

---

**11）`Object.getOwnPropertyDescriptors` 相比 `getOwnPropertyDescriptor` 解决了什么？**
- 参考要点：前者一次返回对象**所有**自有属性的描述符，是 `Object.create(null, descs)` / `Object.defineProperties` 实现「**含 getter/setter 与不可枚举属性的完整浅拷贝**」的关键（`{...obj}` 会丢 getter、丢不可枚举、丢原型）。ES2017 新增，常与「带原型克隆」组合。
- 来源：MDN；TC39 Object.getOwnPropertyDescriptors(ES2017)。

---

**12）现场手写：用 ES2015-2017 语法把「带回调地狱的并发请求」重构为可读版本。**
- 参考要点：
  ```js
  // 旧：回调地狱
  getUser(id, (u) => getOrders(u, (os) => getTotal(os, render)));
  // 新：async/await + Promise.all
  const u  = await getUser(id);
  const os = await getOrders(u);
  const [total, count] = await Promise.all([getTotal(os), getCount(os)]);
  render(total, count);
  ```
  **追问 1**：两个 await 有依赖吗？无依赖应改 `Promise.all` 并发。**追问 2**：要「任一失败也要拿其余结果」→ 用 ES2020 `Promise.allSettled`。
- 来源：MDN async/Promise.all；GreatFrontEnd 手写题；TC39(ES2017)。
