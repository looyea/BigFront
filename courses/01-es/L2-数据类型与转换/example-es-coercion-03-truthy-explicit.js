// 示例 03：truthy/falsy + Object.is + 显式转换的工程写法
// 运行：node courses/01-es/examples/es-coercion/03-truthy-explicit.js

// —— 8 个 falsy 值 ——
const values = [false, 0, -0, 0n, '', null, undefined, NaN, [], {}, '0', ' ', [0]];
console.log('—— falsy 列表 ——');
for (const v of values) {
  console.log(String(v).padEnd(10), '=> Boolean =', Boolean(v));
}

// —— Object.is vs === ——
console.log('\n—— Object.is 的两个特殊修正 ——');
console.log('===   :', NaN === NaN, 0 === -0);       // false, true
console.log('is()  :', Object.is(NaN, NaN), Object.is(0, -0)); // true, false

// —— Number.isNaN vs 全局 isNaN ——
console.log('\n—— 判 NaN 的正确姿势 ——');
console.log('isNaN("foo")       =', isNaN('foo'));         // true（先 ToNumber=NaN）
console.log('Number.isNaN("foo")=', Number.isNaN('foo'));  // false（严格：只有真 NaN）
console.log('Number.isNaN(NaN)  =', Number.isNaN(NaN));    // true

// —— 显式转换工程写法（对比） ——
console.log('\n—— 显式转换 vs 隐式转换 ——');
const fromForm = '42';
const a = Number(fromForm);   // ✅ 42
const b = fromForm * 1;        //  42（能跑但可读差）
const c = +fromForm;           //  42（terser 风格）
const d = parseInt(fromForm);  // ⚠️ 得传基数：parseInt(fromForm, 10)
console.log(a, b, c, d);

const maybe = '';
console.log('\n—— 空值兜底 ——');
console.log('Number("")       =', Number(''));        // 0，容易踩坑
console.log('"" ? "" : "空"  =', '' || '空');         // '空'
console.log('0 ?? "零值"     =', 0 ?? '零值');        // 0（?? 只在 null/undefined 才走右侧）
console.log('0 || "假值"     =', 0 || '假值');        // '假值'（|| 会吃掉 0）
