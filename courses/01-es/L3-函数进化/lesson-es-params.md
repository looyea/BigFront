# 默认参数 / rest 参数 / 展开运算符

> 目标：**掌握函数参数三件套——默认参数、rest 参数、展开运算符**；理解「arguments 已成历史」；能识别默认参数求值时机与 TDZ 的相互作用。

---

## 一、默认参数：不是「编译期常量」，是**每次调用的表达式**

```js
let count = 0;
function inc(x = count++) { return x; }
inc(); // 0
inc(); // 1
inc(); // 2
```

**关键点**：默认值只在**实参为 undefined 或缺席**时求值；每次都可能得到不同结果。传 `null` 不触发默认值——这是与 `??` 的差别。

**为什么这样设计**：让「每次调用生成一个新对象」这种语义成为可能：

```js
function fetchUser(id, opts = { signal: new AbortController().signal }) {
  // 每次不带 opts 的调用都会新建一个 AbortController
}
```

---

## 二、默认参数**自成作用域**（**最反直觉**）

```js
let y = 100;
function f(x = y, y = 200) { return [x, y]; }
f(); // ❌ ReferenceError: Cannot access 'y' before initialization
f(1); // [1, 200]
```

规范里函数参数**是一个独立的词法作用域**（Scope for Formals），外层 y 被内层 y 遮蔽且**内层 y 已进入 TDZ**。这层作用域在函数体作用域**之外**——函数体里再读 y 会拿到外层。

```js
let z = 1;
function g(z = 2) { return z; }
g(); // 2（参数作用域）
g(3); // 3
```

---

## 三、默认参数与解构组合（**工程最常用**）

```js
function createUser(
  name,
  { age = 18, role = 'member', contact: { email = '-' } = {} } = {},
) {
  return { name, age, role, email };
}

createUser('Ann');
createUser('Bob', { age: 25 });
createUser('Cid', { contact: { email: 'x@y.z' } });
```

三层默认值：解构对象本身默认 `{}`（避免 undefined 报错）、每个 key 有默认、嵌套对象也默认 `{}`。这就是 **lodash-style options 的写法**，也是 React 组件 props 默认值的**替代 bind/merge 方案**。

**追问**：`createUser('A', { age: null })` 会用 null 而不是 18（默认值只对 undefined 生效）。要处理 null → 用 `??`：`const a = age ?? 18`。

---

## 四、rest 参数：真数组，取代 arguments

```js
function sum(...nums) { return nums.reduce((a, b) => a + b, 0); }
sum(1, 2, 3); // 6

function first(label, ...rest) { return { label, rest }; }
first('a', 1, 2, 3); // { label: 'a', rest: [1,2,3] }
```

**三条铁律**：
1. **只能有一个 rest**，且必须在**最右**：`function f(...a, b) {}` ❌ SyntaxError。
2. rest 是**真数组**：可以直接 `.map/.filter/.reduce`；arguments 是**类数组**，要先 `Array.prototype.slice.call`。
3. **箭头函数**要拿变长参数**只能**用 rest，因为箭头没 arguments。

**与展开的对称性**：rest **收集**多个值 → 数组；展开 **摊平** 数组 → 多个值。二者是同一个 `...` 语法在两个方向的用法。

```js
const arr = [1, 2, 3];
const [a, ...rest] = arr;   // rest 收集
Math.max(...arr);            // 展开
const copy = [...arr, 4];    // 展开
```

---

## 五、展开的四种典型用法

```js
// 1. 数组浅拷贝 / 拼接
const b = [...a];
const c = [...a, x, y];

// 2. 对象浅拷贝 / 覆盖（ES2018）
const merged = { ...defaults, ...user, required: true };

// 3. 类数组转数组
const nodes = [...document.querySelectorAll('p')];

// 4. 函数调用参数摊平
const p = Promise.all([...promises]);
```

**⚠️ 展开是**「一层」浅拷贝**」**：嵌套对象/数组元素与源共享引用。深拷贝走 `structuredClone`（见 es-structured 关）。

**⚠️ 展开对象的可枚举 & 自有属性**：`{...obj}` 只拷**可枚举自有属性**——原型链上的方法、Symbol 属性、getter 求值后拷贝。这一点常与 `Object.assign` 行为差异被问：
- `{...obj}` 走 [[OwnPropertyKeys]] + [[GetOwnProperty]] + [[Get]] → 触发 getter；
- `Object.assign(target, obj)` 也是 [[Get]] 触发 getter，但会写 target（覆盖）；
- `Object.create(obj)` 不拷贝，只是**把 obj 挂到原型链**。

---

## 六、展开的边界与坑

1. **可迭代协议**：数组、字符串、Map、Set、TypedArray、NodeList、arguments、自定义 `[Symbol.iterator]` 都能 `...`；**普通对象不行**（ES2018 之前）——所以 `[...obj]` 抛 TypeError。
2. **对象展开 ES2018 起支持**：`{...obj}` 与 `{...null}` 都合法（null/undefined 展开成 `{}`）——因为对象展开走的是 CopyDataProperties，规范**特例**。
3. **函数调用展开的性能**：`f(...hugeArr)` 里 hugeArr 太长（约 10^5+）会**爆调用栈**（每个实参要压栈）。改用 `Function.prototype.apply(null, hugeArr)` 或者分块。
4. **new 也支持展开**：`new Date(...[2026, 0, 1])`。

---

## 七、箭头 + rest + 默认 组合出的优雅写法

```js
const logger = (level = 'info', ...msgs) => console[level] ?? (() => {})(), ...;
// 更清晰版：
const log = (level = 'info') => (...msgs) => console[level](...msgs);
const warn = log('warn');
warn('disk full', { used: 80 });
```

**Partial Application**（偏应用）经典形态：
```js
const multiply = (a, b = 2) => a * b;
const double = (a) => multiply(a, 2);
const triple = multiply.bind(null, 3); // 用 bind 固定第一个参数
```

`bind` 也能与默认参数配合：`multiply.bind(null)` 相当于保持默认签名。

---

## 八、什么时候还要用 arguments？

几乎没有。**保留 arguments** 的两个真实场景：
1. **写透传装饰器**：`function wrap(fn) { return function () { console.time('t'); try { return fn.apply(this, arguments); } finally { console.timeEnd('t'); }; }; }`——这里 `arguments` 类数组直接 apply 到目标函数，比先 `[...arguments]` 再 apply 略省内存。
2. **区分「传了几参数」与「参数是什么」**：`arguments.length` 反映**实参数量**，rest.length 也一样；但箭头函数没 arguments 时只能靠 rest。

**新代码一律 rest**。

---

## 九、自检清单

- [ ] 说出默认参数每次调用都重新求值的例子（比如 `x = count++`、`x = {}`）。
- [ ] 画出函数参数**独立作用域**、外层 y 与内层 y 的 TDZ 关系。
- [ ] 手写一个 `createUser(name, opts = {}, contact = {})` 三层默认值。
- [ ] 说出 rest 与 arguments 的 4 个差异。
- [ ] 说出对象展开 `[...obj]` 与 ES2018 `{...obj}` 的规范依据。
- [ ] 说出 `f(...hugeArr)` 的调用栈风险。

---

## 🚀 部署预告（本关点到，细节在 L10）

**参数三件套在构建阶段会发生什么？**

1. **默认参数降级**：Babel `@babel/plugin-transform-parameters` 把 `f(a = 1)` 展开成 `function f() { var a = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1; }`——**产物体积明显变大**。target 是 ES2015+ 关掉即可。
2. **rest 降级**：同上，编译成 `Array.prototype.slice.call(arguments, 1)` 或类似代码；对性能敏感路径要注意 target。
3. **展开对象降级到 ES2015 前**：Babel 编译成 `_extends({}, obj)`（内部就是 Object.assign）；**Object.assign 不触发 getter 的语义与 spread 一致**，但注意某些 polyfill 会不复制 Symbol 属性。
4. **tree-shaking 与 rest**：`...args` 打包成真实数组会有分配；生产代码里 `f(1, 2, 3)` 的 args 只被读、不被 spread/return 时，V8 会做 escape analysis 免分配——但**跨模块调用**这种推断就没了。
5. **调用栈炸裂的兜底**：某些上传大列表的 SDK 会把 `Promise.all(arr)` 改成分块；构建时如果目标环境是移动端，尤其要 review。

细节 L10 `es-build` 展开。**你现在只需要记住**：**糖越漂亮，降级产物越胖——target 决定要不要花这份钱。**
