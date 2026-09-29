# ES2022：Class 现代化与错误链

> 目标：掌握 **Class 字段**（public / private / static / #brand）、**`static initialization block`**、**Top-Level Await**、**`Object.hasOwn`**、**`Array.at()`**、**`error.cause`**、**RegExp `d` flag**；理解这一年为什么被称为「**Class 大年**」。

---

## 一、ES2022 的定位

**Class 从「语法糖」变成「真正的模型」**：
- 2015 class 只是 prototype 的糖——没有字段、没有私有；
- 2022 给 class **加上**了**公有字段 / 私有字段（brand）/ static 块 / 私有 static**——从此 TS 里最实用的 class 特性全部原生落地。

**另外两大杀手**：Top-Level Await + Error Cause。

---

## 二、Class 字段（Public）

```js
// 目的：实例字段/静态字段——声明即初始化（不走 setter，等价 defineOwnProperty）
class User {
  name = 'anonymous';        // 实例字段（非 static）
  count = 0;
  static default = 'guest';  // 静态字段

  constructor(name) {
    this.name = name;        // 覆盖默认
    this.count++;
  }
}
// ✅ 应用：实例化后观察字段默认值与构造器覆盖
const u = new User('Ann');
u.name;          // 'Ann'（构造器覆盖了默认 'anonymous'）
u.count;         // 1（字段先初始化为 0，构造里 ++）
User.default;    // 'guest'（静态字段挂在类而非实例）
```

**与旧写法的差别**：
- **不经过 setter**（走 `[[DefineOwnProperty]]`，不触发 `set`）；
- 与 `Object.defineProperty(this, 'name', { value, writable: true, ... })` 等价；
- 子类字段声明会**覆盖**父类构造器里赋的同名值。

---

## 三、私有字段 `#`（Brand Check）

```js
// 目的：# 真私有字段/私有静态——引擎级 brand，外部无法访问
class Bank {
  #balance = 0;               // 真私有（引擎级，不是命名约定）
  static #instances = new Map();

  deposit(n) { this.#balance += n; }
  get balance() { return this.#balance; }

  static #validate(obj) {     // 私有 static
    if (!(obj instanceof Bank)) throw new TypeError('incompatible receiver');
  }
}

// ✅ 应用：只能通过公开 getter 读私有数据
const b = new Bank();
b.deposit(100);
b.balance;      // 100（get 内部读 this.#balance）
// b.#balance;   // ❌ SyntaxError（私有字段类外访问，编译时就报错，不是运行时）
```

**Symbol / `#` / WeakMap 三种私有对比**：
| 维度 | `#field` | `_x + Symbol` | WeakMap |
| --- | --- | --- | --- |
| 真正不可访问 | ✅（引擎级 brand） | ❌（Reflect.ownKeys 能拿到 Symbol） | ❌（只要 WeakMap 泄漏就能读） |
| 性能 | 最快（内联） | 中 | 最慢（哈希查找） |
| 反射 | 完全不可见 | 半可见 | 外部可查 |

**Brand Check 语义**：`this.#balance` 编译成「this 上**必须有**这个隐藏 slot」——否则 TypeError。

---

## 四、`static initialization block`

```js
// 目的：static 块—类定义时执行一次，能给静态字段做派生计算/共享局部变量
class Config {
  static env = process.env.NODE_ENV ?? 'dev';
  static isProd = false;

  static {                   // 只执行一次（类定义时）
    this.isProd = this.env === 'production';
    if (this.isProd) console.log('Running in prod');
  }
}
```

**为什么需要**：以前 static 字段**不能共享局部变量**——你得写 `static #helper = (() => { ... })()` 这种 hack；static block 里可以 `const` / `try/catch` / 多次赋值。

---

## 五、Top-Level Await（预告 L7）

```js
// 目的：模块顶层直接 await（依赖本模块的会等它完成）
// module.mjs
const data = await fetch('/api/init').then(r => r.json());
export default data;
```
—— 详见 L7 `es-module-deep`。ES2022 **正式标准化**。

---

## 六、`Object.hasOwn(obj, key)`

```js
// 目的：Object.hasOwn 静态方法——不担心对象没 hasOwnProperty / 被 shadow
const proto = { inherited: 1 };
const obj = Object.create(proto);
obj.own = 2;

obj.hasOwnProperty('inherited');   // false（自有）
'own' in obj;                       // true（含原型链）
Object.hasOwn(obj, 'own');          // true ← 推荐
```

**为什么**：`hasOwnProperty` 挂在 `Object.prototype` 上——`Object.create(null)` 的对象没这方法；直接 `obj.hasOwnProperty` 还可能被 shadow。`Object.hasOwn` 是**静态方法**，无此问题。

---

## 七、`Array.prototype.at(n)`

```js
// 目的：Array.at 支持负下标（不跳稀疏洞，越界返回 undefined 而非报错）
[1, 2, 3].at(-1);    // 3（取倒数第一个）
[1, 2, 3].at(1);     // 2
[1, 2, 3].at(99);    // undefined（不抛错）

// 以前取最后一个
arr[arr.length - 1]  // 麻烦
```

**注意**：`at` 不跳过**稀疏数组**的洞——`[1,,3].at(1)` → `undefined`。

---

## 八、`error.cause`

```js
// 目的：error.cause 保留原始错误——包一层新错也不丢内层栈
try {
  await fetch(url);
} catch (e) {
  throw new Error('加载用户数据失败', { cause: e });
}
// 错误链：外层 → cause → 内层
```

**为什么**：以前包一层新错误就**丢了原始栈**；`cause` 让错误**链式保留**——`node --stack-trace-limit=50` + 自定义打印能输出整条链。

---

## 九、RegExp `d` flag（hasIndices）

```js
// 目的：d 标志（hasIndices）——每组拿到在源串中的起止下标
const re = /(\w+)@(\w+)/d;
const m = 'user@host'.match(re);
m.index;          // 0
m.indices;        // [[0,9],[0,4],[5,9]]  ← 每组的起止位置
```

**用途**：编辑器、AST 工具需要知道匹配在字符串里的精确位置。

---

## 十、`#private` in `for-in`（Class Fields 补充）

```js
// 目的：#private 不进 for-in / Object.keys（不可枚举），只能类内访问
class Foo {
  #x = 1;
  y = 2;
}
const f = new Foo();
for (const k in f) console.log(k);    // 只打 y（#x 不在 enumerable keys）
Object.keys(f);                        // ['y']
```

---

## 十一、自检清单

- [ ] `#field` 与 `_field` + 命名约定有什么本质区别？
- [ ] `Object.hasOwn` 解决了什么 `hasOwnProperty` 的坑？
- [ ] `error.cause` 怎么用？给一个错误链例子。
- [ ] `static {}` 块解决了什么以前解决不了的问题？
- [ ] `at(-1)` 与 `arr[arr.length-1]` 对稀疏数组行为一致吗？

---

## 🚀 部署预告

1. **Class fields 降级**：Babel `@babel/plugin-proposal-class-properties` 把字段编译到构造器里；`#private` → WeakMap（老环境）。target Chrome 74+ / Node 16+ 不转。
2. **Top-level await**：打包 target esnext；Rollup 原生支持；webpack 5 需 `experiments.topLevelAwait: true`。
3. **`Object.hasOwn`**：需 core-js polyfill（几百字节）；`Array.at` 同。
4. **`error.cause`**：纯构造器选项，无需 polyfill——但 Node `util.inspect` 要到 v16.9+ 才打印 cause 链。
5. **`#private` 无法被 Proxy 拦截**（brand check 走内部 slot）——响应式系统要注意 `markRaw` 包裹含 #private 的 class 实例。
