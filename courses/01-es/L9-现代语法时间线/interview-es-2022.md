# 面试题 · ES2022

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）`#field`（私有字段）与 Symbol 键伪私有有什么本质区别？**
- 参考要点：`#field` 是**引擎级 brand check**——Reflect.ownKeys / JSON.stringify / Proxy / Object.getOwnPropertySymbols **全部不可见**；编译期语法就拒绝外部访问。Symbol 可被 `getOwnPropertySymbols` 拿到。WeakMap 方案要求 WeakMap 本身不泄漏。**#field 是唯一的真私有**。
- 来源：TC39 class-fields 提案；MDN；2ality。

---

**2）Class 字段 `x = 1` 为什么不触发 setter？**
- 参考要点：字段声明走 **[[DefineOwnProperty]]**（等同 `Object.defineProperty`），不走 [[Set]]——所以 setter 不被触发。设计动机：**避免** setter 的副作用（验证、转换）在**子类字段覆盖父类**时产生不可预测行为。
- 来源：ECMA-262 §7.3.7；TC39 class-fields；StackOverflow。

---

**3）`static { ... }` 初始化块解决了什么问题？**
- 参考要点：以前 static 字段只能赋**单个表达式**——如果多个字段需要共享局部变量或 try/catch，只能写成 IIFE hack。static block 允许 `const` / 控制流 / 多次赋值 / `return`（退出块）。
- 来源：TC39 static-class-fields-and-private-methods 提案；MDN。

---

**4）`Object.hasOwn` 相比 `hasOwnProperty` 修了哪两个问题？**
- 参考要点：① **null-proto 对象**没有继承 `hasOwnProperty` 方法（`Object.create(null).hasOwnProperty` → TypeError）；② **shadow**：`{ hasOwnProperty: false }` 会让调用崩。`Object.hasOwn` 是**静态函数**，与 prototype 无关。
- 来源：MDN；TC39 es2022 提案。

---

**5）`Array.at(n)` 与 `arr[n]` 的差别？**
- 参考要点：`at` 支持**负索引**（`arr.at(-1)` = 最后一个）；越界返回 undefined 不抛错。`arr[n]` 负索引 → undefined（不是从尾部数）。对**稀疏数组**行为一致（洞读出 undefined）。
- 来源：MDN；TC39 relative-indexing-method 提案。

---

**6）`error.cause` 在工程上有什么价值？**
- 参考要点：**保留错误链**——`try { ... } catch (e) { throw new Error('业务描述', { cause: e }) }`；日志/监控可以顺着 `.cause` 打印完整栈。**Node** 的 `util.inspect` 默认打印 cause；浏览器 DevTools 也能展开。解决了以前"包一层丢一层"的痛点。
- 来源：MDN Error；TC39 error-cause 提案；Node.js 文档。

---

**7）Top-Level Await 的三条使用限制？**
- 参考要点：① 只能在 **ESM** 模块顶层（不在函数里），CJS 不支持；② **阻塞依赖链**——下游 import 者自动等完成；③ **循环依赖 + TLA** 可能死锁。
- 来源：TC39 top-level-await 提案；Node.js 文档。

---

**8）**以下代码输出什么？**
```js
class A { x = 1; }
class B extends A { x = 2; }
console.log(new B().x);
```
- 参考要点：2。B 的字段声明 `x = 2` 在 super() 之后、构造器体之前执行——**覆盖**了 A 字段的 1。
- 来源：TC39 class-fields；MDN。

---

**9）**`#private` 方法可以被子类 `super.#foo()` 调用吗？**
- 参考要点：**不行**。私有成员（字段和方法）只**在**本类作用域内可见——子类也碰不到。设计动机：保证基类的**内部契约不被破坏**。
- 来源：TC39 提案；MDN。

---

**10）**`RegExp` 的 `d` flag 有什么用？给一个编辑器场景。**
- 参考要点：`/(\w+)@(\w+)/d` 匹配结果 `m.indices` 给出**每组起止位置**——编辑器高亮、lint 报告位置、AST 构建需要精确定位。
- 来源：MDN hasIndices flag；TC39 提案。

---

**11）**`WeakMap` 模拟私有字段与 `#field` 相比有什么劣势？**
- 参考要点：① WeakMap 的引用**必须不泄漏**——但 `Reflect.ownKeys`、调试器能遍历；② 性能：多一层哈希查找；③ 语法笨重（`wm.get(this)`）；④ 无法在序列化 / 结构化克隆中保持。**`#field` 是完胜方案**。
- 来源：MDN；2ality；StackOverflow。

---

**12）**现场手写：用 ES2022 Class 语法实现一个**单例计数器**（`Counter`），要求 `#count` 私有、`static #instance` 单例、`static getInstance()` 工厂。**
- 参考要点：
  ```js
  class Counter {
    static #instance = null;
    #count = 0;
    constructor() {
      if (Counter.#instance) return Counter.#instance;
      Counter.#instance = this;
    }
    static getInstance() { return new Counter(); }
    inc() { return ++this.#count; }
    get value() { return this.#count; }
  }
  const a = Counter.getInstance();
  a.inc(); a.inc();
  const b = Counter.getInstance();
  console.log(b.value);   // 2（同一个实例）
  ```
- 来源：多份中文八股；MDN class private。

---

**13）#私有字段与 Symbol 私隐、WeakMap 私隐、TS private 的本质差异？**
- 参考要点：TS private 编译后蒸发——运行时仍是普通属性；Symbol 键「准私有」（能 getOwnPropertySymbols 拿到，跨 realm 甚至能反射）；WeakMap 真隔离但引用即密钥、API 繁琐、实例元数据要全局表。`#field` 是**语法级**：不可枚举、外部访问 SyntaxError、`#x in obj` 唯一合法探测；性能上 V8 把 # 访问编成固定槽位（比对象属性查找更快）。代价：无法代理/反射魔改（框架做 property intercept 会卡住）。
- 来源：MDN《Private class features》；2ality《Private properties in JavaScript》四方案对比。

---

**14）Top-Level await 会造成什么死锁？为什么库作者要慎用？**
- 参考要点：模块求值图里 TLA 让「完成」延后：若存在**循环依赖**且环上任一模块用了 TLA，互相等待形成死锁（规范直接报 Dependency cycle via + top-level await）；上游 import 它的模块也要 await 传播（异步涟漪）。npm 库顶层 await 还会把 CJS 消费者全部堵死（require 同步语义无法等待）。守则：应用层 ESM 随便用，公共库最多入口延迟加载处用，且避免库内部成环。
- 来源：MDN《Top-level await》限制章节；Node.js docs「top-level await in cycles」。

---

**15）Class 字段（x = 1）为什么不用放进 constructor？历史为什么一波三折？**
- 参考要点：字段初始化发生在 **super() 返回后、构造器体执行前**，直接 `this.x = 1` 会**触发 setter**（与定义属性不同，历史大坑最终定死）；字段语法让「形状提前确定」利于 V8 hidden class 内联。历史：2016 曾被 TC39 整体回退（与装饰器耦合、this 语义争议），2022 独立回归。static 字段 + static {} 块补齐静态侧初始化与一次性异步引导（配置预取）。
- 来源：tc39/proposal-class-fields（含 reverted 时间线）；MDN《Public class fields》setter 触发说明。
