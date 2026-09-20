# Symbol：第七种原始类型与「众神之名」

> 目标：**理解 Symbol 为什么存在**（唯一键、协议钩子）；掌握 `Symbol.iterator`、`Symbol.toPrimitive`、`Symbol.toStringTag`、`Symbol.hasInstance` 等**众神符号**（Well-known Symbols）；能区分 `Symbol()` 与 `Symbol.for()`；知道 Symbol 属性在枚举 API 里的可见性规则。

---

## 一、为什么需要 Symbol

JS 前 6 种原始类型（string / number / bigint / boolean / undefined / null）+ object 都太「公共」：
- **字符串键**可以撞车：不同库都想给对象挂 `id` / `type` 属性，会互相覆盖；
- **私有字段**（`_name`）只是**约定**，`for-in` 照样能读到。

ES6 引入 **Symbol**：**每次 `Symbol()` 都返回一个全宇宙唯一的原始值**，天然适合做「不撞车的属性键」。

```js
const a = Symbol('id');
const b = Symbol('id');
a === b;             // false —— 描述文字只是调试用
typeof a;             // 'symbol'
String(a);            // 'Symbol(id)'
a.description;        // 'id'（ES2019）
```

---

## 二、Symbol 作属性：唯一键与半私有

```js
const ID = Symbol('id');
const user = { [ID]: 42, name: 'Ann' };

user[ID];                 // 42
Object.keys(user);         // ['name'] —— Symbol 键不出现
for (const k in user) console.log(k);  // 只打印 'name'
JSON.stringify(user);      // '{"name":"Ann"}' —— Symbol 键被完全忽略

Object.getOwnPropertySymbols(user);   // [Symbol(id)]  ← 想拿到必须显式调
Reflect.ownKeys(user);                // ['name', Symbol(id)]  ← 全量
```

**结论**：Symbol 键是**「半私有」**——不是真不可访问，只是**所有默认 API 都不带你玩**。要真私有得用 ES2022 的 `#field`（见 L9）。

---

## 三、`Symbol()` vs `Symbol.for()`：注册表机制

```js
const a = Symbol('x');
const b = Symbol('x');
a === b;                          // false

const c = Symbol.for('x');         // 在全局注册表里查/建
const d = Symbol.for('x');
c === d;                          // true —— 同 key 拿同一个 Symbol

Symbol.keyFor(c);                  // 'x'
Symbol.keyFor(a);                  // undefined（a 不在注册表）
```

**用途**：**跨 realm / 跨 iframe / 跨库**共享符号。举例：Node 里 `require('util').inspect.custom` 就是 `Symbol.for('nodejs.util.inspect.custom')`——不同版本的 util 都能拿到同一个符号。

**⚠️ 注册表永不移除**：Symbol.for 一旦注册，永远占内存——只用于「协议级」固定符号。

---

## 四、**众神符号**（Well-known Symbols）总览

规范预定义了一批 `Symbol.xxx`，作为对象与语言内置行为之间的**协议钩子**。

| 符号 | 被谁调用 | 用来做什么 |
| --- | --- | --- |
| `Symbol.iterator` | `for-of`、展开、`Array.from`、解构 | 定义对象如何**按顺序迭代** |
| `Symbol.asyncIterator` | `for-await-of` | 异步迭代协议 |
| `Symbol.toPrimitive` | 隐式转换 ToPrimitive | **最高优先级**的转原始值钩子 |
| `Symbol.toStringTag` | `Object.prototype.toString.call(x)` | 自定义 `[object XXX]` 里的 XXX |
| `Symbol.hasInstance` | `x instanceof C` | 让**类**自定义匹配规则 |
| `Symbol.species` | 内置方法返回派生对象时 | 控制 map/filter 等返回哪个构造器 |
| `Symbol.isConcatSpreadable` | `Array.prototype.concat` | 决定对象是否被「摊平」进结果数组 |
| `Symbol.unscopables` | `with` 语句 | 排除某些属性不被 with 绑定 |

**本关重点讲前 4 个**（iterator 单开一关 es-iterator）。

---

## 五、`Symbol.toPrimitive`：**ToPrimitive 最高优先级**

上一关 es-coercion 提过：`+x` / `x == y` 触发 ToPrimitive，规则是 `hint: 'default'|'number'|'string'`。**在 valueOf / toString 之前，引擎先看 `Symbol.toPrimitive`**：

```js
const price = {
  amount: 100,
  currency: 'CNY',
  [Symbol.toPrimitive](hint) {
    if (hint === 'number') return this.amount;
    if (hint === 'string') return `${this.amount} ${this.currency}`;
    return `${this.currency}:${this.amount}`;   // default
  },
};

`${price}`;      // '100 CNY'          hint=string
+price;           // 100                 hint=number
price == '100 CNY'; // true              hint=default
```

**追问**：为什么 hint 有三种？—— 一元 `+` 传 number；`String(x)` 与模板字符串传 string；`==` 和二元 `+` 传 default。**default 一般走 valueOf 或 toString 由对象类型决定**（Date 例外，default 走 toString）。

---

## 六、`Symbol.toStringTag`：让 `[object Object]` 变好看

```js
class Vec {
  get [Symbol.toStringTag]() { return 'Vec'; }
}
Object.prototype.toString.call(new Vec());   // '[object Vec]'

const mapLike = { [Symbol.toStringTag]: 'MapLike' };
String(mapLike);                              // '[object MapLike]'
```

**用途**：
- 上一关 es-types 的 `typeOf` 函数就是**依赖 toStringTag** 区分 Map / Set / WeakMap；
- 自定义类想让 `Object.prototype.toString.call` 打印像内置类型一样。

**⚠️ 常见 bug**：把 `toStringTag` 写成普通属性会被 `Symbol.toStringTag` 查询绕过——必须是 Symbol 键。**getter 形式**（`get [Symbol.toStringTag]()`）能避免实例上占空间。

---

## 七、`Symbol.hasInstance`：**类**决定谁 `instanceof` 我

```js
class ArrayLike {
  static [Symbol.hasInstance](x) {
    return Array.isArray(x) || ArrayBuffer.isView(x);
  }
}
[] instanceof ArrayLike;         // true
new Uint8Array() instanceof ArrayLike; // true
'abc' instanceof ArrayLike;       // false
```

**用途**：跨 realm 的 instanceof（`Symbol.hasInstance` 里用鸭子判断）；`instanceof Promise` 判断 thenable。

---

## 八、`Symbol.species`：**派生**方法用哪个构造器

`Array.prototype.map` 内部会「new 一个和 this 相同构造器的新数组」——但**子类想改**这个行为：

```js
class MyArr extends Array {
  static get [Symbol.species]() { return Array; }   // map/filter 返回普通 Array 而不是 MyArr
}
const m = new MyArr(1, 2, 3);
m.map(x => x * 2) instanceof MyArr;   // false
m.map(x => x * 2) instanceof Array;   // true
```

**为什么**：MyArr 构造器可能要求特殊签名，`map` 内部硬 new 会崩——species 是**逃生舱**。Promise 家族、TypedArray 都用它。

---

## 九、`Symbol.isConcatSpreadable`

```js
const pseudoArr = {
  [Symbol.isConcatSpreadable]: true,
  length: 2, 0: 'a', 1: 'b',
};
['x'].concat(pseudoArr);   // ['x', 'a', 'b'] —— 被摊平
['x'].concat({ a: 1 });    // ['x', {a:1}]     —— 默认不摊平
```

**用途**：让自定义类数组进 concat 时表现得像数组。

---

## 十、Symbol 的三大应用场景

1. **协议钩子**（本关全部例子）——让对象告诉 JS「我该怎么被处理」；
2. **不撞车的元数据 key**：给 DOM 节点、给第三方对象挂扩展；
3. **模拟私有属性**（ES2022 前的过渡）：Symbol 键不进 for-in、不进 JSON。

---

## 十一、自检清单

- [ ] `Symbol()` 与 `Symbol.for()` 差别？各自场景？
- [ ] 说出 4 个众神符号的名字与作用。
- [ ] `Symbol.toPrimitive` 在 ToPrimitive 里为什么优先？hint 有哪 3 种？
- [ ] 为什么 Symbol 键的属性在 JSON.stringify 里消失？如何恢复？
- [ ] `Symbol.hasInstance` 与 `Symbol.species` 分别在什么场景下改写默认行为？

---

## 🚀 部署预告（本关点到，细节在 L10）

**Symbol 在构建/运行时会被怎样处理？**

1. **IE 完全不支持 Symbol**——需要 `core-js` 的 Symbol polyfill（约 3KB gzip）。现代 target 可省。
2. **Symbol 无法被降级**：它是**运行时值**，Babel 不能转成字符串——只能 polyfill 或放弃老浏览器。
3. **Symbol 属性被 `Object.getOwnPropertySymbols` 才可见**——打包器分析依赖时**只看字符串键**（Rollup / Webpack 都是），Symbol 键的对象**不能 tree-shake**（不会被引用也不会被摇掉）。
4. **Symbol.iterator / toPrimitive 与 V8**：V8 对没有 Well-known Symbol 的对象有**快速路径**——你的类数组对象加了 `[Symbol.iterator]` 后会走**通用迭代器协议**，比直接 `for (i=0; i<len; i++)` 略慢。热路径别过度 Symbol 化。
5. **`Symbol.for` 与 HMR**：跨模块共享符号只能用 `Symbol.for`——否则热重载后两个模块持有不同 Symbol 值，`obj[MASK]` 会读不到。

细节 L10 `es-build` 展开。**你现在只需要记住**：**Symbol 是运行时协议，不能编译期擦除——老浏览器 = 硬掏 polyfill；Symbol 键的属性 = tree-shake 盲区。**
