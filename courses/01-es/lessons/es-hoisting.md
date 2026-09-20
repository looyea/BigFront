# 变量提升与函数提升（Hoisting）

> 目标：**能在白纸上一格一格地推出任意一段 var/let/const/function/class 代码的执行结果**；理解「提升」只是引擎编译阶段的一种心智模型，不是玄学；知道 Babel 把 `let` 转成 `var` 时如何保住语义。

---

## 一、编译期 vs 运行期：先建立正确的世界观

JavaScript 引擎（V8、SpiderMonkey、JSC）跑一段代码前会经历两步：

1. **编译阶段**：把源码解析成 AST，为当前作用域建立 **词法环境（Lexical Environment）**——具体说就是给每个声明分配一个「槽位」并绑定名字；这一步**不执行任何代码**。
2. **执行阶段**：一行一行地走，读写那些已经存在的槽位。

「提升（Hoisting）」这个词说的就是：**编译阶段，声明被提前登记了；而赋值发生在执行阶段。** 于是当你看到：

```js
console.log(a); // undefined，不是 ReferenceError
var a = 1;
```

实际发生的心智模型是：

```js
var a;            // 编译阶段：a 这个槽位提前存在，初值 undefined
console.log(a);   // 执行阶段
a = 1;            // 执行阶段
```

> ⚠️ 语言规范里其实**没有 "hoisting" 这个术语**——它只是社区用来描述「先扫声明」的一种比喻。真正定义行为的是 **Lexical Environment / Variable Environment / TDZ** 这套。理解这层，能让你避免把提升神化。

---

## 二、四种声明，四种提升规则（必须背）

| 声明 | 编译阶段做什么 | 未初始化前访问 |
| --- | --- | --- |
| `var x` | 在**函数/全局作用域**创建 `x`，值为 `undefined` | `undefined` |
| `function f(){}` | 在**函数/全局作用域**创建 `f`，**直接绑定函数对象** | 可**立即调用** |
| `let x` / `const x` | 在**块作用域**创建 `x`，但**不初始化**（进入 TDZ） | **ReferenceError** |
| `class C {}` | 类似 `let`，进入 TDZ | **ReferenceError** |

函数表达式 `var f = function(){}`：变量 `f` 按 var 规则提升，右边的函数字面量**不提升**。所以在赋值之前调用 `f()` 得到 `TypeError: f is not a function`（因为此时 `f === undefined`）。

---

## 三、同作用域重名时，谁优先？

**函数声明 > var 声明 > let/const 声明**。经典题：

```js
console.log(typeof foo); // function
var foo;                 // 与同名函数声明合并；不重置
function foo() {}
```

```js
foo();            // ❌ TypeError: foo is not a function
var foo = 1;
function foo() { console.log('decl'); }
// 等价于：
// var foo;                       // 声明合并
// function foo() { ... }         // 编译期把函数装进 foo
// foo();                          // 此刻 foo 是函数——但注意这里 foo(); 在赋值之前
// foo = 1;                        // 之后才被覆盖
```

上面这个例子，如果 `foo()` 写在 `var foo = 1;` 之后，就会得到 TypeError，因为 `foo` 已经是 1。

```js
let foo = 1;
function foo() {} // ❌ SyntaxError: Identifier 'foo' has already been declared
```

`let` 与 function 声明不能同名——编译期直接报错。

---

## 四、TDZ：暂时性死区不是玄学

**定义**：块作用域内，从块的开始到 `let/const/class` 声明那一行之前，该变量处于 **temporal dead zone**。访问它抛 `ReferenceError`。

```js
{
  console.log(x); // ❌ ReferenceError: Cannot access 'x' before initialization
  let x = 10;
}
```

三个高频踩坑场景：

### 4.1 遮蔽了外部同名变量

```js
var name = 'global';
function greet() {
  console.log(name); // ❌ ReferenceError，不是 'global'！
  var name = 'local';   // 这里其实是 var，走提升规则；上面这行是合法 undefined
}
```

把 `var` 换成 `let`：
```js
function greet() {
  console.log(name); // ❌ ReferenceError（TDZ）
  let name = 'local';
}
```

### 4.2 参数默认值引用后位参数

```js
function f(a = b, b = 1) {}   // ❌ ReferenceError（b 在 TDZ）
function g(a = 1, b = a) {}   // ✅ OK（a 已初始化）
```

### 4.3 循环体内 `let` 的 per-iteration binding

```js
for (let i = 0; i < 3; i++) setTimeout(() => console.log(i)); // 0 1 2
```

规范里每次迭代都会新建一个 `i` 的绑定并从上一轮的值拷贝——这是**特例**，不是常规块作用域行为。var 版本得到 3 3 3。

---

## 五、函数提升的三档

```js
hoist1(); // ✅ function declaration 全量提升
function hoist1() { console.log('decl'); }

hoist2(); // ❌ TypeError: hoist2 is not a function
var hoist2 = function () { console.log('expr'); };

hoist3(); // ❌ ReferenceError（TDZ，因为 let）
let hoist3 = () => console.log('arrow');
```

- **函数声明**：整个函数体都提升，可以在任意位置之前调用。
- **函数表达式（var + anonymous）**：只提升变量名（undefined），赋值在执行时才发生。
- **箭头函数 + let/const**：连名字都进 TDZ。

---

## 六、块、函数、module 里的作用域差异

```js
if (true) {
  function inner() { return 1; }
}
inner(); // ✅ 大多数引擎允许（Annex B 语义），但严格模式下会报错
```

现代规范：块内函数声明的作用域是**块本身**；但在 sloppy mode 下，Web 兼容（Annex B）会在外层函数/全局作用域也创建一个 var-like 绑定。**别写这种代码**。用 `let inner = function(){}` 表达清晰意图。

**模块**里，`import` 语句在编译阶段被处理，因此绑定在整模块内可见（但仍受 TDZ 约束——即你不能在 import 声明之前访问，因为「声明位置」在物理上就是文件的顶部，编译器会做链接）。

---

## 七、写代码时的三条硬规矩

1. **默认用 `const`；需要重新赋值再改 `let`；杜绝 `var`**。让 ESLint 的 `no-var` 强制。
2. **ESLint 规则**：`no-use-before-define`（含函数）、`no-shadow-restricted-names`、`block-scoped-var`（如果必须用 var）。
3. **别写块内函数声明**（用 `let f = () => {}` 或提到块外）。

---

## 八、自检清单（合上文档能默写就过关）

- [ ] 说出「编译期做提升、执行期做赋值」两阶段，并解释为什么 `console.log(a); var a = 1` 打印 undefined 而不是 ReferenceError。
- [ ] 说出函数声明与函数表达式在提升上的具体差别。
- [ ] 手写 3 秒内答出：`f(); var f = () => 1; function f() { console.log('decl') }` 输出什么？为什么？
- [ ] 解释 TDZ，并列出至少 3 个日常代码里会踩到 TDZ 的场景。
- [ ] 说出同名情况下 function / var / let 的优先级。
- [ ] 用 ESLint 规则名说清楚你如何防止提升类 bug。

---

## 🚀 部署预告（本关只点到，细节在 L10）

**Babel 转 `let` 到 `var` 时怎么保住语义？** 打开 `@babel/preset-env`，target 老浏览器时，`let` 会被降级。但降级必须保住两件事：
1. **块作用域**：把变量重命名成 `_block-scoping` 风格的唯一名，或者用 IIFE 包块。
2. **TDZ**：Babel 通过 `_getRequire`/`_typeof`/直接内联检查在**读点前**插入 `if (typeof x === 'undefined') throw new ReferenceError(...)` 的替代方案。更常见的是让引用**保持在原地**——因为降级后的 var 已经在文件顶部声明，只需把「使用位置」保持在原地，就自然形成 TDZ 效果。

**打包器的 scope hoisting**（webpack `optimization.moduleIds`、Rollup 默认、esbuild `--bundle`）：跨模块提升变量到同一函数作用域、消除闭包包装。它**要求**模块没有循环依赖或名字冲突，这也是**为什么现代 ESM 更适合 tree-shaking**——名字与块作用域规则严格，编译器可以静态推导。

这些细节会在 L10 的 `es-build`、`es-publish` 里展开。**你现在只需要记住**：**你写的每段作用域代码，都会在构建阶段被工具重新解读一遍——规范越严格，工具越好办，产物越小。**
