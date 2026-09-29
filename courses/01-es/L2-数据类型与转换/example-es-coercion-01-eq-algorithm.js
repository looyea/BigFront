// 示例 01：== 完整算法演示（现场可背）
// 目的：逐条展示抽象相等（==）的隐式转换规则，证明为什么生产代码该用 ===
// 运行：node "courses/01-es/L2-数据类型与转换/example-es-coercion-01-eq-algorithm.js"

const eq = (a, b) => a == b;
const show = (a, b) => console.log(String(a).padEnd(10), '==', String(b).padEnd(10), '=>', eq(a, b));

show(0, '');
show(0, '0');
show(false, '0');
show(false, null);
show(false, []);
show('', []);
show('', {});
show([], []);
show(1, [1]);
show([1], [1]);
show([], ![]);   // 经典：true
show(null, undefined); // true
show(null, false);     // false
show(NaN, NaN);        // false

// ── ❌ 错误用例：用 == 比较“看起来不相等”的值 ──
console.log('[] == false =>', [] == false);                        // true（[]→''→0，false→0）
console.log('{} == "[object Object]" =>', {} == '[object Object]'); // true（对象 ToPrimitive 成字符串）
// 后果：== 触发一长串隐式转换规则，极易得出反直觉的 true，埋下隐蔽 bug
// ✅ 正确：业务比较一律用 ===（需处理 NaN/-0 时配合 Object.is）
