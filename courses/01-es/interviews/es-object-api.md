# 面试题 · Object 静态方法

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）`Object.keys`、`for...in`、`Object.getOwnPropertyNames`、`Reflect.ownKeys` 四者读取的属性范围分别是什么？**
- 参考要点：
  - `Object.keys`：**可枚举自有**字符串键；
  - `for...in`：**可枚举自有 + 原型链**字符串键；
  - `getOwnPropertyNames`：**全部自有**字符串键（含不可枚举）；
  - `Reflect.ownKeys`：**全部自有**，含 Symbol。
- 来源：MDN 各方法页；StackOverflow 高票。

---

**2）JS 对象的属性顺序规则是什么？为什么「对象不能保证顺序」是老谣言？**
- 参考要点：ES2015 起明确：**整数键升序 → 字符串键按插入顺序 → Symbol 键按插入顺序**。工程上「不保证顺序」的**建议**是为了避免依赖这个复杂规则。真要有序：整数键场景可依赖；混合键或纯语义映射建议走 `Map`。
- 来源：ECMA-262 [[OwnPropertyKeys]]；StackOverflow《Are JavaScript object keys ordered》高票；dmitripavlutin.com。

---

**3）`Object.freeze` 是深冻结还是浅冻结？如何实现深冻结？**
- 参考要点：**浅**冻结。深冻结：递归遍历自有属性 → 是对象且未冻结则再 freeze。**追问**：性能影响？→ V8 对 frozen 对象用**共享字典模式**，读写都变慢；深冻结大对象树在生产上一般不做，Redux DevTools 只在 dev 模式做。
- 来源：MDN `Object.freeze`；Redux 源码 `deepFreeze`（dev 环境）。

---

**4）`Object.assign` 与 `{...}` 的语义差别？至少说 3 条。**
- 参考要点：① Object.assign 会**触发 target 上的 setter**（spread 无 target 概念）；② 支持多源与顺序覆盖；③ 返回**同一个 target**（可能引发链式修改），spread 每次新建；④ Object.assign 是**运行时函数**，可被 polyfill / mock；spread 是**语法**。
- 来源：MDN 各页；dmitripavlutin.com《Object spread vs Object.assign》。

---

**5）以下代码打印什么？**
```js
const obj = {};
Object.defineProperty(obj, 'x', { value: 1 });
Object.defineProperty(obj, 'y', { value: 2, enumerable: true });
console.log(Object.keys(obj), obj.x, obj.y);
for (const k in obj) console.log(k);
```
- 参考要点：`['y']`, 1, 2；for-in 只打印 y。defineProperty 默认可枚举 false，`x` 不在 keys 里但仍可读。
- 来源：MDN `Object.defineProperty` 警告段；多份中文八股。

---

**6）`configurable: false` 有什么「不可逆」的性质？**
- 参考要点：一旦 configurable false：不能删（`delete obj.x` false）；不能改成 true；不能改 writable（除非从 true 改到 false 单向）；不能从数据属性改成访问器。**唯一可改**：writable 从 true 改 false。**追问**：为什么这么设计？→ 引擎的**形状稳定性**假设，hidden class 优化的前提。
- 来源：ECMA-262 规范 §10.1；v8.dev 相关博客。

---

**7）如何正确浅拷贝一个对象**且保留 getter/setter 与所有 flags**？**
- 参考要点：`Object.create(Object.getPrototypeOf(src), Object.getOwnPropertyDescriptors(src))`。`{...src}` 与 `Object.assign` 都会**触发 getter 求值**、丢失 flags。**追问**：为什么需要这么绕？→ spread/assign 走的是 CopyDataProperties，规范就是「读值+写值」。
- 来源：MDN `Object.getOwnPropertyDescriptors`；2ality《ES2017 getOwnPropertyDescriptors》。

---

**8）`Object.create(null)` 与 `{}` 的差别？什么时候用前者？**
- 参考要点：`Object.create(null)` 无原型链，`__proto__` 不是特殊属性。**用途**：① 纯字典/缓存（避免键名 `'toString'` 撞方法）；② 防原型污染攻击；③ 类似 lodash `__proto__` 忽略场景。**追问**：性能？→ 少了原型链一层，属性读写更快；但没有 hidden class 演化，形状变化时 V8 会退回字典模式反而更慢。
- 来源：MDN `Object.create`；Node 安全通告（原型污染 CVE）。

---

**9）`seal` 与 `freeze` 分别在什么时候用？**
- 参考要点：**seal**：结构固定但值可变——适合「对象形状即契约」的场景（比如配置模板）。**freeze**：完全不可变——适合常量、Redux action 校验、防止意外修改。**追问**：性能影响？→ seal 后属性数量固定，V8 可 better inline cache；freeze 后 V8 用**shared dict 模式**（读写更慢但内存紧凑）。
- 来源：MDN 各页；v8.dev《Hidden classes》。

---

**10）`Object.is` 相比 `===` 的两个不同点，什么时候必须用它？**
- 参考要点：`Object.is(NaN, NaN)` true；`Object.is(0, -0)` false。**用途**：① 值变化通知（Vue 3 reactive setter 内部就用 Object.is 判断是否触发）；② 数学/金融计算要区分 ±0；③ Map 键判断（Map 内部用的是 SameValueZero：只解决 NaN 但不区分 ±0）。
- 来源：MDN `Object.is`；Vue 3 源码 `reactivity/src/baseHandlers.ts`；TC39 ES6 讨论。

---

**11）React state 更新里 `setState({...state, extra: 1})` 与 `setState(Object.assign(state, { extra: 1 }))` 行为差异？**
- 参考要点：后者**直接改**了原 state 对象（Object.assign 会写入 target），React 靠引用比较判断变化 → 引用没变 → **不重渲染**，且违反 React 不可变约定。前者是**新对象**，引用变了，能触发更新。**追问**：为什么 React/Vue 都要求不可变？→ 依赖引用比较做性能优化。
- 来源：React 官方 FAQ《Why is immutability important in React》；setState 陷阱讨论。

---

**12）现场手写：`deepEqual(a, b)`，比较两个纯数据对象是否深度相等。**
- 参考要点：递归比较；处理 NaN（`Object.is` 特判）、null/undefined、Symbol 键、Date、RegExp（toString 比较）、Array（顺序敏感）、Object（顺序无关）；循环引用用 WeakSet 记录。**追问**：lodash.isEqual 的差异（函数比较、原型链）。
- 来源：lodash.isEqual 源码；多份中文手写题；MDN。
