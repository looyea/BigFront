// 示例 01：var 与 let 在「循环 + 异步回调」中的作用域差异
// 目的：同一个 for+setTimeout，var（函数作用域、共享同一个 i）与 let（每轮独立绑定）输出天差地别
// 运行：node "courses/01-es/L1-变量与作用域/example-es-scope-01-var-vs-let.js"

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
// 预期输出：IIFE 捕获的 copy = 0 / 1 / 2（每轮把 k 的当前值作为实参传入，形成独立副本）

// ── ❌ 错误用例（记住它到底会报什么）────────────────────────
// 错误：想用 let「重复声明」来复用同一个循环变量
//   let i = 0;
//   let i = 1;   // SyntaxError: Identifier 'i' has already been declared
// 后果：这是「早期错误」（解析阶段就报），try/catch 也拦不住，整个脚本不会执行。
// ✅ 正确：需要一个新的独立绑定就换变量名，或写进块作用域 { let i = 1; } 里。
