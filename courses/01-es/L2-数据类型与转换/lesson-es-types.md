# 7 种类型与类型判定

> 目标：**说得清 JavaScript 到底有哪几种类型、typeof/instanceof/Object.prototype.toString 各自能判到哪一层、工程上如何选**。这关不写代码就过不去——每种判定都要亲手踩坑才记得牢。

---

## 一、JavaScript 的类型系统全景

**ECMAScript 规范里，值只有两大类**：

1. **Primitive（原始值）**：不属于 Object 的任何值。共 **7 种**：
   - `undefined`（未定义）
   - `null`（有意为空）
   - `Boolean`（true / false）
   - `Number`（IEEE-754 双精度浮点，含 NaN、±Infinity）
   - `BigInt`（任意精度整数，ES2020）
   - `String`
   - `Symbol`（唯一标识，ES2015）
2. **Object**：属性集合，包括 Function、Array、Date、RegExp、Map、Set…（都是 object 的扩展）。

**关键洞察**：**primitive 与 object 之间的鸿沟**，比「int 与 string 之间的鸿沟」大得多。primitive 是不可变的、按值比较；object 是可变的、按引用比较。所有「隐式转换」的坑几乎都发生在两者的交界处。

---

## 二、typeof：最日常也最坑

| 表达式 | 返回 |
| --- | --- |
| `typeof undefined` | `'undefined'` |
| `typeof null` | **`'object'`** ← 历史 bug，永不修 |
| `typeof true` | `'boolean'` |
| `typeof 42` | `'number'` |
| `typeof 42n` | `'bigint'` |
| `typeof 'hi'` | `'string'` |
| `typeof Symbol()` | `'symbol'` |
| `typeof {}` | `'object'` |
| `typeof []` | `'object'`（不区分 array） |
| `typeof new Date()` | `'object'` |
| `typeof function(){}` | `'function'` |

**三条实用要点**：

1. **typeof 是唯一能安全探测未声明变量的运算符**：`typeof nope === 'undefined'` 不抛 ReferenceError。
2. **typeof null === 'object' 是 TS 与所有 JS 库都要单独处理**的特例。
3. **typeof 不能区分 object 家族**——{} / [] / new Date() 全是 'object'。

---

## 三、instanceof：原型链上的向下匹配

```js
// 目的：演示 instanceof 沿原型链向上匹配；末尾给出它的两处误用
class Animal {}
class Dog extends Animal {}
const d = new Dog();
d instanceof Dog;    // true（d 的原型链上有 Dog.prototype）
d instanceof Animal; // true（继续向上，Animal.prototype 也在链上）
d instanceof Object; // true（链顶端是 Object.prototype）

[] instanceof Array;   // true
[] instanceof Object;  // true
(function(){}) instanceof Function; // true

// ❌ 错误用例 1：拿 instanceof 判基本类型——primitive 一律 false
'hi' instanceof String;   // false（不是 String 实例，只是原始值）
// ❌ 错误用例 2：跨 realm 判数组失效
// iframe 里创建的数组 arr，在主 realm 执行 arr instanceof Array 得 false（Array 构造器不是同一个）
// ✅ 正确：判数组用 Array.isArray(arr)，它对跨 realm 也可靠
```

**原理**：`x instanceof C` 沿 `x.__proto__` 向上找，看有没有 `C.prototype`。

**三大坑**：

1. **跨 realm 失效**：iframe 里创建的数组，在主 realm `arr instanceof Array` 是 false（Array 构造器不是同一个）。→ 用 `Array.isArray`。
2. **primitive 一律 false**：`'hi' instanceof String` 是 false。
3. **Symbol.hasInstance 可劫持**：`class X { static [Symbol.hasInstance]() { return true } }` 之后 `anything instanceof X` 都是 true。React 生态用它做过 fake polymorphism。

---

## 四、Object.prototype.toString.call：最准的运行时判定

```js
// 目的：用 Object.prototype.toString.call 得到精确的内部 [[Class]] 标签
const t = (v) => Object.prototype.toString.call(v);
t(undefined);          // '[object Undefined]'
t(null);               // '[object Null]'          ← 与 typeof 联手破除 null 陷阱
t(42n);                // '[object BigInt]'
t([]);                 // '[object Array]'
t({});                 // '[object Object]'
t(new Map());          // '[object Map]'
t(new Date());         // '[object Date]'
t(/re/);               // '[object RegExp]'
t(function(){});       // '[object Function]'
t(Symbol());           // '[object Symbol]'
```

**注意**：ES6 后规范给 Map/Set 打了内部标签 `[[Class]]` → 输出 `[object Map]`；但**自定义 class 不会自动带上**：

```js
class Foo {}
Object.prototype.toString.call(new Foo()); // '[object Object]'
// 想让它返回 [object Foo]，需要挂 Symbol.toStringTag：
class Bar { get [Symbol.toStringTag]() { return 'Bar'; } }
Object.prototype.toString.call(new Bar()); // '[object Bar]'
```

**工程建议**：**判定数组用 `Array.isArray`，判定 Map/Set 用 `instanceof` 或 `.size` 探测，判定 null 用 `x === null`——不要把 toString 当万能钥匙**。

---

## 五、判定组合拳（面试高频）

```js
// 目的：通用类型判定——typeof 处理 primitive，toString.call 处理 object 家族
function typeOf(v) {
  if (v === null) return 'null';                 // 先单独破除 typeof null === 'object'
  const t = typeof v;
  if (t !== 'object' && t !== 'function') return t;  // 基本类型直接拿到 typeof 结果
  const tag = Object.prototype.toString.call(v).slice(8, -1); // '[object Array]' → 'Array'
  return tag.toLowerCase();  // 'array' / 'map' / 'set' / 'date' / 'regexp' / 'object' ...
}

// ✅ 应用：真正拿它来判类型（别只定义不使用）
typeOf(null);            // 'null'
typeOf(undefined);       // 'undefined'
typeOf(42);              // 'number'
typeOf([1, 2]);          // 'array'
typeOf(new Map());       // 'map'
typeOf(new Date());      // 'date'
typeOf(() => {});        // 'function'

// ❌ 反面：只用 typeof 判数组/Map，会把它们都误判为 'object'
typeof [];               // 'object'（区分不出 array）→ 应改用 typeOf([]) 得 'array'
```

上面这个 6 行的函数就是 **jQuery.type / lodash.isXxx 家族的公共内核**。

**lodash 的做法**：为每种类型出一个谓词，如 `_.isArray` / `_.isPlainObject` / `_.isFunction` / `_.isTypedArray`。这些谓词内部还是上面这套 + 若干针对性修正（比如 isPlainObject 会额外检查 constructor 是不是 Object.prototype）。

---

## 六、null vs undefined：语义差异

- `undefined`：**引擎默认的「没有值」**——未初始化变量、函数无 return、缺失参数、对象上不存在的属性。
- `null`：**程序员主动写的「这里空着」**——数据库无结果、DOM getElementById 未命中。

**规则**：
- 函数返回值区分「空」与「失败不存在」时，用 `null` 表意空，`undefined` 表意没定义；
- JSON 里没有 undefined，序列化会丢；用 null 占位。
- `x == null` 是 `x === null || x === undefined` 的**唯一值得写的双等号**（ESLint `eqeqeq` 允许 `== null`）。

---

## 七、判断「对象是不是普通对象」的三条硬题

```js
// 目的：判定「普通对象」——要同时排除 null 与“有原型的类实例”
const isPlainObject = (v) => {
  if (v === null || typeof v !== 'object') return false; // 先挡住 null / 基本类型
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;   // 原型是 Object.prototype 或 null 才算“纯对象”
};

isPlainObject({});                  // true
isPlainObject(Object.create(null)); // true（无原型对象）
isPlainObject([]);                  // false（原型是 Array.prototype）
isPlainObject(new Date());          // false（原型是 Date.prototype）

// ❌ 反面（旧写法有运算符优先级陷阱）：
//   v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null
// 因为 && 比 || 更紧密，末尾的 `|| ...` 分支绕过了前面的 null/类型守卫；
// 后果：传入 null 时，&& 短路为 false 后仍会执行 Object.getPrototypeOf(null) → TypeError。
```

- `{}`、`Object.create(null)` → true
- `[]`、`new Date()`、`class X{}` 的实例 → false
- **跨 realm 的 {}** → false（原型不等）；lodash 用 toString 兜底

---

## 八、自检清单

- [ ] 说出 JavaScript 7 种 primitive 与 object 的分界。
- [ ] 说出 `typeof null === 'object'` 的历史缘由（早期实现把类型 tag 存指针低位，null 是空指针）。
- [ ] 手写 6 行的 `typeOf(v)` 通用判定函数。
- [ ] 说出 instanceof 跨 realm 失败的原因与解法。
- [ ] 说出 `Symbol.toStringTag` 的作用。
- [ ] 说出 null 与 undefined 的语义分工。

---

## 🚀 部署预告（本关点到，细节在 L10）

**运行时类型判定与打包/类型擦除的关系**：

1. **TypeScript 的类型只存在于编译期**——产物里 `string`、`number` 这些都不存在；运行时判断仍得靠上面的 `typeof` / `instanceof`。**这是新手最容易混淆的**：TS 里 `x: unknown` 通过 `if (typeof x === 'string')` 收窄，本质上是让 TS 相信你的**运行时判断**。
2. **Babel 的 `@babel/plugin-transform-runtime`** 会把 `Symbol`、`WeakMap` 等构造器改成从 `@babel/runtime-corejs3` 引入的别名，避免污染全局；这会让 `x instanceof Symbol` 类判断**跨构建产物可能失败**。
3. **polyfill 与判定冲突**：core-js 给旧浏览器加了 `Map`，`toString.call(new Map())` 依然返回 `[object Map]`；但某些非常规 polyfill 只加了类名而没设 toStringTag，会露馅——所以生产依赖请用主流 polyfill（core-js / polyfill.io）。

细节在 L10 `es-build` 展开。**你现在只需要记住**：**你的运行时类型判断，最终要与构建产物的类型擦除协同工作**。
