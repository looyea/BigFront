// 示例 02：+ 运算符的双重身份 + ToPrimitive 演示
// 运行：node courses/01-es/examples/es-coercion/02-plus-and-toprimitive.js

console.log('—— + 表达式矩阵 ——');
const rows = [
  [1, 2], ['1', 2], [1, '2'], [true, false], [[], []], [[], {}], [[], 1],
  [[1, 2], [3]], [null, 1], [undefined, 1], [{}, 'a'],
];
for (const [a, b] of rows) {
  let r;
  try { r = JSON.stringify(a) + ' + ' + JSON.stringify(b) + ' = ' + (a + b); }
  catch { r = 'circular'; }
  console.log(r);
}

console.log('\n—— 自定义 Symbol.toPrimitive 完全接管 ——');
const Temperature = (celsius) => ({
  [Symbol.toPrimitive](hint) {
    if (hint === 'number') return celsius;
    if (hint === 'string') return `${celsius}°C`;
    return celsius;  // default 走 number 语义
  },
});
const t = Temperature(25);
console.log(`${t}`, '  // 模板字符串 hint=string');
console.log(t + 5,  '   // 算术 hint=number');
console.log(+t, '       // 一元 + hint=number');

console.log('\n—— valueOf 与 toString 的经典配合 ——');
const Money = (cents) => ({
  valueOf: () => cents / 100,
  toString: () => `¥${(cents / 100).toFixed(2)}`,
});
const m = Money(1999);
console.log(m + 10);        // 29.99 (hint=number → valueOf)
console.log('price=' + m);  // 'price=¥19.99' (string 侧 → toString)
console.log(`${m}`);          // '¥19.99' (hint=string)
