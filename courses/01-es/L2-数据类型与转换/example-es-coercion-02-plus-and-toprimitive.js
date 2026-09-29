// 示例 02：+ 运算符的双重身份 + ToPrimitive 演示
// 目的：展示 + 何时加、何时拼接，以及如何用 Symbol.toPrimitive/valueOf+toString 接管转换
// 运行：node "courses/01-es/L2-数据类型与转换/example-es-coercion-02-plus-and-toprimitive.js"

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

// ── ❌ 错误用例：对数组/对象用 + 号 ──
console.log('[] + {} =>', [] + {});   // '[object Object]'（[]→''、{}→'[object Object]'，两侧转字符串拼接）
console.log('1 + true =>', 1 + true); // 2（true ToNumber=1）
// 陷阱补充：若 {} 出现在语句开头（如 `{} + []` 作为一整行），JS 把 {} 当空代码块，结果是 0——解析位置改变语义
// ✅ 正确：数值相加前先用 Number() 显式转换；字符串拼接用模板串或 .concat
