// 示例 03：truthy/falsy + Object.is + 显式转换的工程写法
// 目的：列 falsy 值、区分 Object.is/===/isNaN，展示显式转换与空值兑底的正确写法
// 运行：node "courses/01-es/L2-数据类型与转换/example-es-coercion-03-truthy-explicit.js"

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

// ── ❌ 错误用例：parseInt 不传基数 / 拿 parseInt 当数字解析 ──
console.log('parseInt("12abc") =>', parseInt('12abc')); // 12（遇非法字符即停，静默截断！）
console.log('Number("12abc")   =>', Number('12abc'));   // NaN（Number 要么整体成功要么整体失败）
console.log('parseInt("0x10")  =>', parseInt('0x10'));   // 16（自动按十六进制）
console.log('parseInt("10", 8) =>', parseInt('10', 8));  // 8（基数传错就出错）
// 后果：parseInt 会“吃掉”尾部非法字符并按基数解释，得出看似正确实则隐蔽的错误数字
// ✅ 正确：永远传基数 parseInt(s, 10)；要“要么数字要么 NaN”用 Number(s)
