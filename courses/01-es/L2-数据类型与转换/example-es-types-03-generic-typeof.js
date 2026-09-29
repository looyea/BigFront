// 示例 03：通用 typeOf 函数（面试手写高频）+ isPlainObject
// 目的：结合 typeof 与 toString.call 写一个能区分所有内建类型的 typeOf，再用原型链判纯对象
// 运行：node "courses/01-es/L2-数据类型与转换/example-es-types-03-generic-typeof.js"

function typeOf(v) {
  if (v === null) return 'null';
  const t = typeof v;
  if (t !== 'object' && t !== 'function') return t;
  return Object.prototype.toString.call(v).slice(8, -1).toLowerCase();
}

const cases = [
  null, undefined, true, 1, 1n, 'a', Symbol(),
  {}, [], new Map(), new Set(), new Date(), /re/, new Error(),
  () => {}, function () {}, class Foo {},
];
for (const c of cases) console.log(typeOf(c).padEnd(10), '<-', String(c));

// isPlainObject：区分「普通对象」与「有原型的类实例」
function isPlainObject(v) {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}
console.log('\n—— isPlainObject ——');
console.log(isPlainObject({}));                 // true
console.log(isPlainObject(Object.create(null)));// true
console.log(isPlainObject([]));                 // false
console.log(isPlainObject(new Date()));         // false
class Foo {}
console.log(isPlainObject(new Foo()));          // false

// ── ❌ 错误用例：想用 toString 区分「普通对象 vs 类实例」──
class Bar {}
console.log('toString 分不清 =>', Object.prototype.toString.call(new Bar())); // [object Object]
// 后果：{} 与 new Bar() 都返回 [object Object]，toString 无法判定“是不是纯对象”
// ✅ 正确：isPlainObject 要比原型（见上）——class 实例原型 ≠ Object.prototype，故返回 false
