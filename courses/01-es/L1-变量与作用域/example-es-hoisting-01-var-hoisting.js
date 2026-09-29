// 示例 01：var 提升的几种典型形态
// 目的：理解 var 只提升声明不提升赋值、循环共享与 IIFE/let 的修法
// 运行：node "courses/01-es/L1-变量与作用域/example-es-hoisting-01-var-hoisting.js"

console.log('—— 1. 只声明未初始化 ——');
var a = 1;
(function () {
  console.log(typeof a); // 'undefined'，不是 'number'
  var a = 2;             // 声明 + 赋值：编译期只提声明
})();

console.log('—— 2. for 循环里的 var 共享 ——');
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log('var:', i)); // 全部打印 3
}

console.log('—— 3. for 循环里换成 let：per-iteration binding ——');
for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log('let:', j)); // 0, 1, 2
}

console.log('—— 4. IIFE 捕获也能修 ——');
for (var k = 0; k < 3; k++) {
  (function (captured) {
    setTimeout(() => console.log('iife:', captured));
  })(k);
}
// 预期输出：iife: 0 / 1 / 2

// ── ❌ 错误用例（不会报错，但会埋下一个难查的 bug）──────────
if (true) {
  var leaked = '我在 if 块里';   // var 忽略块级作用域，被提升到函数/全局作用域
}
console.log('var 泄漏到块外 =>', leaked); // 后果：块外竟能访问 leaked，变量意外泄露、易被同名覆盖
// ✅ 正确：需要块级隔离就用 let/const（把 var 换成 let 后，块外访问会 ReferenceError: leaked is not defined）
