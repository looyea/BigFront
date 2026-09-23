// 示例 01：var 提升的三种典型形态
// 运行：node courses/01-es/examples/es-hoisting/01-var-hoisting.js

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
