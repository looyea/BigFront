# L1 · let、const 与块级作用域

> 🎯 本关目标：说清 `var` / `let` / `const` 三者的区别，理解「块级作用域」和「暂时性死区」，并第一次接触到闭包的雏形。

## 一、为什么要有这一关？

在 ES6（2015 年）之前，JavaScript 声明变量**只有 `var`**，而 `var` 的行为非常反直觉，制造了无数 bug。ES6 引入了 `let` 和 `const`，是现代 JS 的默认写法。你在后面学 Vue、React 时会发现：**它们几乎 100% 使用 `const` 和 `let`，见不到 `var`**。所以这一关是地基中的地基。

## 二、三个关键字对比

| 特性 | `var` | `let` | `const` |
| --- | --- | --- | --- |
| 作用域 | 函数级 | **块级** `{}` | **块级** `{}` |
| 能否重复声明 | 能 | 否 | 否 |
| 变量提升 | 提升且初始化 `undefined` | 提升但**不初始化**（TDZ） | 同 let |
| 能否重新赋值 | 能 | 能 | **不能** |

## 三、深入讲解

### 1. 函数作用域 vs 块级作用域

`var` 只认「函数」这个边界，不认 `{}`；`let/const` 认一切 `{}`。

```js
function demo() {
  if (true) {
    var a = 1;   // 逃出 if 块
    let b = 2;   // 只在 if 块内活着
  }
  console.log(a); // 1  ✅
  console.log(b); // ReferenceError ❌
}
```

经典陷阱题——用 `var` 写循环：

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// 输出 3 3 3，而不是 0 1 2！
// 因为只有一个全局 i，回调执行时循环早结束了，i 已经是 3。
```

把 `var` 换成 `let`，每一轮循环都会**新建一个独立的 i**，输出 `0 1 2`。这就是块级作用域的威力，也是闭包的入口。

### 2. 暂时性死区（TDZ）

`let/const` 声明之前的那段「已提升但未初始化」的区域叫暂时性死区，访问它会报错，而不会像 `var` 那样给你 `undefined`。

```js
console.log(x); // undefined（var 提升）
var x = 10;

console.log(y); // ❌ ReferenceError: Cannot access 'y' before initialization
let y = 20;
```

这是好事——它把「用了还没声明的变量」这种隐蔽错误，变成了立刻暴露的显式错误。

### 3. const 真的「不可变」吗？

`const` 锁定的是**绑定关系（内存地址）**，不是值的内容。对对象/数组而言，其内部依然可改：

```js
const user = { name: '小明' };
user.name = '小红';     // ✅ 允许，改的是对象内部
user = {};             // ❌ TypeError，重新赋值绑定才报错
```

想真正冻结要用 `Object.freeze(obj)`（浅冻结）。

## 四、实践铁律

1. **默认用 `const`**；只有确定要重新赋值（如循环计数器、累加器）才用 `let`。
2. **彻底不用 `var`**。
3. 函数内部尽量避免修改外部变量，减少闭包陷阱。

## 五、动手示例

👉 本关附带示例文件（在关卡右侧「本关示例」面板可点开 / 复制运行）：

- `es-scope/01-var-vs-let.js` —— 亲眼看看循环里 var 与 let 的输出差异
- `es-scope/02-tdz.js` —— 复现暂时性死区报错

运行方式（在项目根目录）：

```bash
node courses/01-es/examples/es-scope/01-var-vs-let.js
```

## 六、自检清单

学完这关，你应该能不查资料回答：

- [ ] 为什么 `for (var ...)` 配合 `setTimeout` 会输出重复值？
- [ ] `const arr = []` 之后 `arr.push(1)` 合法吗？为什么？
- [ ] 什么是暂时性死区？它和 `var` 的 `undefined` 有何本质不同？

答完去下方做「本关小测」，≥60% 才能通关，然后完成作业勾选，即可解锁 L2。加油，打完这六关你的 JS 语言底子就稳了。💪
