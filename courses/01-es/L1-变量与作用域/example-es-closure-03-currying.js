// 示例 03：柯里化与函数组合（闭包最漂亮的用法）
// 目的：用闭包逐层捕获已传参数，实现部分应用与 pipe 组合
// 运行：node "courses/01-es/L1-变量与作用域/example-es-closure-03-currying.js"

// 通用柯里化工具：根据 fn.length 判断是否凑齐参数
const curry = (fn) =>
  function curried(...args) {
    if (args.length >= fn.length) return fn.apply(this, args);
    return (...more) => curried.apply(this, args.concat(more));
  };

const add3 = curry((a, b, c) => a + b + c);
console.log(add3(1)(2)(3));      // 6
console.log(add3(1, 2)(3));      // 6
console.log(add3(1)(2, 3));      // 6

// 偏应用（partial application）：预先固定一部分参数
const log = (level, time, msg) => `[${level}] ${time.toISOString().slice(11, 19)} ${msg}`;
const info = log.bind(null, 'INFO');
const warn = log.bind(null, 'WARN');
const now = new Date();
info(now, 'server started');
warn(now, 'disk 80%');

// 函数组合 pipe：闭包保留中间值
const pipe = (...fns) => (x) => fns.reduce((acc, f) => f(acc), x);
const double = (n) => n * 2;
const inc = (n) => n + 1;
const square = (n) => n * n;
const calc = pipe(double, inc, square);
console.log(calc(3)); // ((3*2+1)^2) = 49

// 追问：curry 里的 curried 与内层箭头分别捕获了什么？
// curried 捕获外层 fn；内层箭头 (...more) => ... 捕获 curried 自身的 args。
// 三层闭包环环相扣，这就是柯里化能"部分应用"的全部秘密。

// ── ❌ 错误用例：对“不定参数”函数做柯里化 ──────────────
const sumAll = curry((...nums) => nums.reduce((a, b) => a + b, 0));
console.log('不定参数被 curry =>', sumAll(1)); // 直接返回 1，而不是等你 (1)(2)(3) 逐个累加
// 后果：(...nums) 的 fn.length === 0，curry 判定“参数已凑齐”→第一次调用就执行，柯里化彻底失效
// ✅ 正确：柯里化只适用于“参数个数固定”的函数（如 (a,b,c)=>...），其 length 才大于 0
