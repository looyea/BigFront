# L1 作业：作用域 · 提升 · 闭包

> 覆盖本阶段 3 关：`es-scope`、`es-hoisting`、`es-closure`。
> 提交方式：把答案写进 `homework/L1.answers.js`（自己新建），跑 `node homework/L1.answers.js`，控制台输出与题目「预期」完全一致即通过；面试简答题写进 `homework/L1.md` 末尾「我的答案」段。

---

## 一、读代码写输出（每题 3 分，共 12 分）

**A1.**
```js
var a = 1;
function f() {
  console.log(a);
  var a = 2;
  console.log(a);
}
f();
```
预期：`___` / `___`

**A2.**
```js
foo();
var foo;
function foo() { console.log('decl'); }
foo = function () { console.log('expr'); };
foo();
```
预期：`___` / `___`

**A3.**
```js
const funcs = [];
for (var i = 0; i < 3; i++) funcs.push(() => i);
funcs.forEach((f) => console.log(f()));
```
预期：`___` / `___` / `___`

**A4.**
```js
let x = 'g';
{
  console.log(x);
  let x = 'b';
  console.log(x);
}
```
预期：`___`（第一行是值 or 错误？请写具体错误名）

---

## 二、手写实现（每题 8 分，共 24 分）

**B1 · debounce**：`debounce(fn, wait)` — 频繁调用只在最后一次后 `wait` 毫秒执行一次。
要求：不捕获大对象；提供 `.cancel()` 方法。

**B2 · memoize**：`memoize(fn)` — 相同参数第二次直接返回缓存；提供 `.cache`（一个 Map）与 `.clear()`。
追问：如果参数是对象会怎样？改写一版用 WeakMap 处理**单参数为对象**的场景。

**B3 · curry**：`curry(fn)` — 根据 `fn.length` 判断是否凑齐；支持任意顺序部分应用。
测试：
```js
const add3 = curry((a, b, c) => a + b + c);
add3(1)(2)(3) === 6;
add3(1, 2)(3) === 6;
add3(1)(2, 3) === 6;
```

---

## 三、现场改造（20 分）

下面这段「计数器」代码，请**分别**用三种方式改写成外部**不能直接改 n**：

```js
// 原代码（有 bug，外部能改）
let n = 0;
function inc() { n++; }
function get() { return n; }
globalThis.n = 100; // 破防
```

改写：
1. **IIFE 闭包版**
2. **ESM 模块版**（假设文件名 `counter.mjs`）
3. **class + #field 版**

每种都请给出「外部拿不到 n」的验证代码。

---

## 四、面试简答（每题 8 分，共 24 分）

**Q1**：一位面试官问你「JS 里 `x = 5` 和 `var x = 5` 有什么不同」，你怎么回答？（提示：严格模式、全局污染、`delete` 能力、属性描述符 enumerable）

**Q2**：为什么 React Hooks 里 `useEffect(() => { ... }, [])` 会「捕获旧值」？给出 3 种修法并各说一个适用场景。

**Q3**：`const arr = [1, 2, 3]; Object.freeze(arr); arr.push(4);` 会发生什么？为什么？你如何真正「锁死」一个数组？

---

## 五、拓展挑战（20 分，选做）

写一个 `once(fn)`：函数只能被调用一次，之后所有调用返回第一次的结果。
追问：
- 如何支持 this 与参数透传？
- 如果 fn 抛异常，`once` 应该保留「已调用」状态还是允许重试？为什么？

---

## 我的答案（作答区）

> 把答案写在下面。改这栏不会影响判分，只是把你手写的思路留在同一个文件里方便复习。

（待补）
