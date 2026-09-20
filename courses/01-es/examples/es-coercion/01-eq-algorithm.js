// 示例 01：== 完整算法演示（现场可背）
// 运行：node courses/01-es/examples/es-coercion/01-eq-algorithm.js

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
