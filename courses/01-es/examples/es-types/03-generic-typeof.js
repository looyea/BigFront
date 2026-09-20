// 示例 03：通用 typeOf 函数（面试手写高频）+ isPlainObject
// 运行：node courses/01-es/examples/es-types/03-generic-typeof.js

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
