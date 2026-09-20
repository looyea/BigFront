# 作用域：全局 / 函数 / 块（Scope & Scope Chain）

> 目标：**说清 JS 有哪三种作用域、var/let/const 各自归属哪一种、给定任意一段代码能在纸上画出作用域链**。作用域是闭包、模块、this、原型链等一系列话题的地基，务必先夯实。

---

## 一、三种作用域，一张图看懂

| 类型 | 边界 | 谁能声明 | 什么时候销毁 |
| --- | --- | --- | --- |
| 全局作用域 | 脚本 / 模块文件外层的「大盒子」 | var/let/const/function/class（模块顶层作用域其实是「模块作用域」，也归到这层） | 页面关闭前 / 进程退出 |
| 函数作用域 | `function () { ... }` 内 | var/function（严格模式下块内 function 只归块，见下） | 函数返回后若无引用则回收 |
| 块作用域 | `{ ... }`、`if`/`for`/`while`/`try` 的 `{}` | let/const/class（+ 严格模式下块内 function 声明） | 块执行结束（若无闭包捕获） |

**ES6 之前的世界只有前两种**；ES6 引入 let/const 才补上第三种。今天写代码，你应该**默认把块作用域当主战场**。

---

## 二、var 的三大问题

1. **穿透块**：`if (true) { var x = 1; }` 之后 x 在外面还在。
2. **同名可重复声明**：`var a = 1; var a = 2;` 不报错，静默覆盖，跨文件同名冲突源头。
3. **提升到函数/全局顶部**：给读代码带来「先使用后声明」的隐蔽 bug（详见 es-hoisting 关）。

```js
if (true) {
  var legacy = 'old';
}
console.log(legacy); // 'old' —— var 不属于块，属于最近函数/全局
```

**唯一还值得写 var 的场景**：需要「函数外不可见、函数内共享」的老代码维护。新代码请一律 `let/const`。

---

## 三、let / const 的块作用域

```js
{
  let a = 1;
  const b = 2;
}
console.log(a, b); // ❌ ReferenceError: a is not defined
```

`const` 与 `let` 的作用域规则**完全相同**；差别只在「绑定不可重新赋值」这一条。

### 3.1 `const` 不等于不可变

```js
const user = { name: 'Ann' };
user.name = 'Bob';         // ✅ 允许：改的是对象内部
user = {};                  // ❌ TypeError: Assignment to constant variable.
Object.freeze(user);        // 浅冻结，让属性也不可改（数组仍可 push）
```

记住三层：**绑定不变 → 值可以变；要值也不变用 Object.freeze；要深度不变需要递归 freeze 或 Immutable.js**。

### 3.2 for 循环的 per-iteration binding

```js
for (let i = 0; i < 3; i++) setTimeout(() => console.log(i)); // 0 1 2
```

规范在每次迭代**新建**一个 i 绑定，把上一轮的值 copy 进去，然后再进入循环体。这不是常规块作用域的行为，是 for+let 的**特例**（`for..in` / `for..of` 同理）。

---

## 四、作用域链（Scope Chain）与自由变量查找

函数被创建时，会带上它的**外部词法环境引用**（[[Environment]]）。查找一个变量：

1. 看当前作用域有没有；
2. 没有就去外层（[[Environment]] 指向的那层）；
3. 一层层往上，直到全局；
4. 还没有：读操作 → `ReferenceError`；写操作（非严格模式）→ 悄悄在全局创建一个。

```js
const outer = 1;
function foo() {
  const inner = 2;
  function bar() {
    const local = 3;
    console.log(outer + inner + local); // 6
  }
  bar();
}
foo();
```

`bar` 的定义位置在 foo 里，所以它能通过作用域链看到 `inner` 和 `outer`。**跟 bar 从哪被调用无关**（这就是「词法作用域」）。

---

## 五、遮蔽（Shadowing）与同名变量

内层的 `let x` 会让外层同名 x **在块内暂时不可见**。

```js
const x = 'global';
function f() {
  const x = 'func';
  if (true) {
    const x = 'block';
    console.log(x);      // 'block'
  }
  console.log(x);        // 'func'
}
f();
console.log(x);          // 'global'
```

遮蔽是合法的、有时也很有用（把长名字参数就地重命名）；但**跨多层同名**会让代码难读。ESLint 的 `no-shadow` 规则建议至少在重要标识上禁用。

---

## 六、块内函数声明：唯一还在被问到的历史遗留

```js
if (false) {
  function foo() {}      // 现代规范：foo 只在块内可见
}
typeof foo;              // 严格模式 'undefined'；sloppy 模式因 Annex B 会 var-like 化到函数/全局
```

**结论**：想按条件定义函数，请用 `let foo = function(){}` 或提到块外。

---

## 七、模块作用域：ESM 天生自带

一个 `.mjs` / `type:module` 的 `.js` 文件的**顶层就是块作用域**：

```js
// a.mjs
const secret = 'top secret';
export const pub = 'public';
```

外部 `import` 只能拿到显式 export 的名字；未 export 的顶层变量**天然私有**——不再需要 IIFE。

**Node CJS 的模块作用域**由 `(function (exports, require, module, __filename, __dirname) { /* 你的代码 */ })` 包出来，行为类似，但 `var` 会挂到那个函数作用域，跨文件仍不共享，只有 `global` 例外。

---

## 八、工程守则（写代码 5 条军规）

1. **默认 const；需要重新赋值才换 let；彻底禁用 var**（ESLint `no-var`）。
2. **变量作用域越窄越好**：能写在块里就写在块里，别在函数顶部声明一大堆。
3. **同名不跨层**：至少保证「全局 / 模块 / 函数」三层里名字互不冲突。
4. **`for` 循环里默认 `let`**——需要跨轮保留才用 `var` 是极罕见场景。
5. **不开 `with` / `eval`**——它们把作用域链变成运行时可变结构，V8 会放弃大量优化。

---

## 九、自检清单

- [ ] 说出 JS 三种作用域与各自适用的声明关键字。
- [ ] 手写：一段嵌套三层的代码，把每层可见的变量名列全。
- [ ] 说出 `const` 与 `Object.freeze` 的边界。
- [ ] 说出 for 循环里 let 为什么能打印 0 1 2，是「规范特例」还是「块作用域的自然结果」？
- [ ] 说出作用域链查找的顺序，以及自由变量与全局变量的区分。
- [ ] 说出模块作用域与 IIFE 的等价关系，并说明 ESM 未 export 变量为何天然私有。

---

## 🚀 部署预告（本关点到，细节在 L10）

**你写的作用域代码，构建工具到底怎么处理？**

1. **Babel 的 `@babel/plugin-transform-block-scoping`**：把 `let/const` 降级到 `var`。为了让块作用域语义不变，它会：
   - 给同名变量按块唯一化重命名（`_x`, `_x2` ...）；
   - 若块内变量被闭包捕获且跨块读写，退化为「外提为对象属性」的写法（比如 `_temp_x = { value: ... }`）。
2. **打包器 scope hoisting**（Rollup、webpack 5 的 `optimization.concatenateModules`）：把多个 ESM 模块拼成一个函数作用域——前提是每个模块的顶层作用域都足够严格（let/const + 无名字冲突），否则只能退回 IIFE 包装。
3. **Tree-shaking 依赖「模块顶层未 export 就是私有」**这个语义。用了 `var` + 全局污染，摇树会失效。

细节 L10 `es-build`、`es-publish` 展开。**你现在只需要记住**：**严格的作用域 = 更小的产物 + 更准的 tree-shaking。**
