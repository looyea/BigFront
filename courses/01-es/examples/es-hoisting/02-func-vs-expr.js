// 示例 02：函数声明 vs 函数表达式 vs 箭头 + let 的提升差异
// 运行：node courses/01-es/examples/es-hoisting/02-func-vs-expr.js

console.log('—— function 声明：可以在最上方调用 ——');
sayHi();
function sayHi() { console.log('hi from declaration'); }

console.log('—— var + 函数表达式：调用发生在赋值之前 ——');
try {
  badExpr(); // ❌ TypeError: badExpr is not a function
} catch (e) {
  console.log('caught:', e.constructor.name, '-', e.message);
}
var badExpr = function () { console.log('never'); };

console.log('—— let + 箭头函数：调用发生在 TDZ 之内 ——');
try {
  arrowFn(); // ❌ ReferenceError: Cannot access 'arrowFn' before initialization
} catch (e) {
  console.log('caught:', e.constructor.name, '-', e.message);
}
let arrowFn = () => console.log('never');
