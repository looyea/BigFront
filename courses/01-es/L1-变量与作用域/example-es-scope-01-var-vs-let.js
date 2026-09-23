// 运行：node courses/01-es/examples/es-scope/01-var-vs-let.js
// 观察：同样是循环 + setTimeout，var 与 let 的输出天差地别。

console.log('--- 使用 var（函数作用域，共享同一个 i）---');
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log('var 回调里的 i =', i), 100);
}
// 预期输出：var 回调里的 i = 3  (打印三次)

console.log('--- 使用 let（块级作用域，每轮循环新建独立 i）---');
for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log('let 回调里的 j =', j), 100);
}
// 预期输出：let 回调里的 j = 0 / 1 / 2

// 补充：如果非要用 var 得到 0 1 2，需要 IIFE 手动造一个作用域：
console.log('--- var + IIFE 补救 ---');
for (var k = 0; k < 3; k++) {
  ((copy) => setTimeout(() => console.log('IIFE 捕获的 copy =', copy), 100))(k);
}
