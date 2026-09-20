# 箭头函数与 this 的词法绑定

> 目标：**说清箭头函数在语法、语义、原型、构造能力上与普通函数的 5 个差别；能背出「箭头函数没有自己的 this」到底意味着什么；知道哪些场景不能换成箭头**。

---

## 一、箭头函数不是「简写」——它是**另一类函数**

规范上叫 **ArrowFunction**，与普通 **FunctionObject** 是两种对象。5 条硬差异：

| 特性 | 普通函数 | 箭头函数 |
| --- | --- | --- |
| `this` | 调用时动态决定 | 定义时词法捕获，不可改 |
| `arguments` | 有 | 无（读会走外层或 ReferenceError） |
| `super` | 有 | 无（走外层） |
| `new.target` | 有 | 无 |
| `prototype` | 有 | **没有 prototype 属性** |
| 能否 `new` | 能 | **不能**（TypeError: is not a constructor） |
| 能否当 generator | 能（`function*`） | 不能 |

**一句话**：箭头函数是**没有 [[HomeObject]] 绑定的 lambda**，只为「把外面的 this 带进来」而生。

---

## 二、this 的四种绑定，箭头函数是第五种「不绑定」

普通函数 this 按优先级：
1. **new 绑定**：`new F()` → this 是新对象。
2. **显式绑定**：`f.call(obj)` / `f.apply(obj)` / `f.bind(obj)` → this 是 obj。
3. **隐式绑定**：`obj.f()` → this 是 obj。
4. **默认绑定**：直接 `f()` → 严格模式 undefined，非严格模式 globalThis。

**箭头函数不参与上述任何一条**。它的 this 就是**定义时外层最近一个普通函数的 this**，一路向上，最外层是模块的 `undefined`（ESM）或 `globalThis`（脚本）。

```js
const obj = {
  name: 'Ann',
  normal() { return this?.name; },
  arrow:   () => this?.name,
};
obj.normal();  // 'Ann'
obj.arrow();   // undefined（this 走模块外层）
```

想让箭头函数拿到 obj？只能在**普通函数里定义它**：
```js
const obj = {
  name: 'Ann',
  get() {
    const arrow = () => this?.name; // 这里的 this 是 obj.get 的 this，即 obj
    return arrow();
  },
};
obj.get(); // 'Ann'
```

**关键陷阱**：**bind 也改变不了箭头函数的 this**。`(() => this)().call({a:1})` 依然是外层 this。

---

## 三、箭头函数没有 prototype、不能被 new

```js
const A = () => {};
A.prototype;         // undefined
new A();             // TypeError: A is not a constructor

class B {}
B.prototype;         // { constructor: ƒ }
new B();             // ✅
```

工程后果：
- 不能把箭头函数当构造函数。
- 不能给箭头函数挂共享方法：`A.prototype.foo = ...` 直接 TypeError。
- **Object.create(箭头函数的 prototype)** 也不可用。

---

## 四、arguments 与剩余参数

箭头函数没有 `arguments` 对象。读它会拿到**外层最近普通函数的 arguments**（如果没有普通函数，直接 ReferenceError）。

**正确替代**：rest 参数。
```js
const sum = (...nums) => nums.reduce((a, b) => a + b, 0);
sum(1, 2, 3); // 6
```

rest 参数是**真数组**，arguments 是**类数组**——rest 更实用。

---

## 五、什么时候不能用箭头函数（**面试常考**）

1. **对象方法**：`{ fn: () => this }` 拿不到对象——用 `fn() {}` 或 `fn: function() {}`。
2. **原型方法**：`Foo.prototype.bar = () => {}` 会让 bar 里 this 失效。
3. **构造函数 / class 方法**：class 方法本来就是普通函数（不能改成箭头，除非你**故意**想让 this 定住）。
4. **需要 arguments 的老代码**：只能换 rest，或改回 function。
5. **DOM 事件处理器要 this === 元素**：`btn.addEventListener('click', () => this.style...)` 里的 this 不是按钮。

**适合用箭头的场景**：
- 回调 / 数组方法：`arr.map(x => x * 2)`
- 闭包工具：debounce、throttle、memoize
- **class 字段绑定 this**（React 事件处理器经典）：
  ```jsx
  class Panel extends React.Component {
    state = { n: 0 };
    onClick = () => this.setState({ n: this.state.n + 1 }); // 自动绑 this
    render() { return <button onClick={this.onClick}>+1</button>; }
  }
  ```

---

## 六、this 场景矩阵（**默写到能 3 秒反应**）

```js
function foo() { return this; }
const obj = { foo, bar: () => foo() };

foo();            // globalThis（非严格） / undefined（严格）
obj.foo();        // obj
const f = obj.foo; f();  // globalThis / undefined（丢失隐式绑定）
obj.bar();        // 严格模式下 undefined——bar 是箭头，捕获的是模块外层 this
[foo][0]();       // 非严格 globalThis；严格 undefined

class C {
  m() { return this; }
  a = () => this;
}
const c = new C();
c.m();            // c
c.a();            // c（箭头捕获构造时的 this）
const lostM = c.m; lostM();  // undefined（this 丢）
const lostA = c.a; lostA();  // c（箭头的 this 定死，不会丢）
```

**关键洞察**：class 字段箭头是「自动绑 this」的常见做法，代价是每个实例都新建一份函数（内存/性能开销）。

---

## 七、隐式返回 & 对象字面量的坑

```js
const bad = () => { a: 1 };        // 返回 undefined！{} 被解析成块，a: 是标签语句
const good = () => ({ a: 1 });    // 加括号才返回对象
```

单参数可省括号：`x => x * 2`；无参或多参必须写 `()`：`() => 1`、`(a, b) => a + b`。

---

## 八、箭头函数的性能与栈追踪

- **性能**：与同名普通函数几乎一致；V8 对箭头有专门的 fast path（少 arguments 对象分配）。
- **栈追踪**：匿名箭头在 error.stack 里显示为 `<anonymous>` 或推断名（`const f = () => {}` 里 f 会被推断）；调试时可命名：`const onClick = () => {...}`；或写成 `const onClick = function onClick() {...}` 保留具名。

---

## 九、自检清单

- [ ] 列出箭头函数与普通函数的 5 条硬差异。
- [ ] 说出箭头函数的 this 到底是什么，为什么 `bind/call/apply` 都改变不了它。
- [ ] 说出至少 4 个「不能用箭头函数」的场景。
- [ ] 手写：一个 class 里同时用「普通方法」和「字段箭头」处理事件，说明二者在传递 vs 直接调用时的行为差异。
- [ ] 解释 `const f = () => { a: 1 }` 为什么返回 undefined。

---

## 🚀 部署预告（本关点到，细节在 L10）

**箭头函数在构建/降级时怎么被处理？**

1. **Babel `@babel/plugin-transform-arrow-functions`**：把箭头降级成 `var _this = this;` + `function () { ... }`。若目标环境本来就支持箭头（现代浏览器 / Node 12+），关掉这个插件即可，产物更小、栈名更好读。
2. **`spec:true` 与 `loose` 模式**：loose 模式下，`class X { a = () => this }` 会用简单赋值而不是 `Object.defineProperty`——部署时如果混用不同 loose 模式的包，会出现字段初始化顺序不同。
3. **Tree-shaking 与箭头**：现代打包器把箭头当作「无副作用」的表达式；`const add = (a, b) => a + b; export { add };` 若 add 未被引用可被摇掉。但**箭头作为 IIFE 立即执行**会被视为副作用。
4. **栈追踪与 sourcemap**：降级成 function 后，DevTools 里的名字来自 Babel 推断的变量名；如果 sourcemap 上传不完全，报错栈会看到 `_this` 而不是 `this`——**上线时同步发布 .map 文件**是排障关键。

细节 L10 `es-build` 展开。**你现在只需要记住**：**箭头函数写起来轻，构建阶段其实一点都不轻——降级、绑 this、栈重命名都是隐性成本。**
