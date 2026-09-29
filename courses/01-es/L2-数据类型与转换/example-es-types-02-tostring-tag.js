// 示例 02：Object.prototype.toString.call 全景 + Symbol.toStringTag
// 目的：用 toString.call 区分 typeof 分不清的类型，并展示自定义 toStringTag
// 运行：node "courses/01-es/L2-数据类型与转换/example-es-types-02-tostring-tag.js"

const t = (v) => Object.prototype.toString.call(v);
console.log('—— toString.call 能区分 typeof 区分不出的一切 ——');
console.log(t(undefined));    // [object Undefined]
console.log(t(null));         // [object Null]
console.log(t(42n));          // [object BigInt]
console.log(t(Symbol('x')));  // [object Symbol]
console.log(t([]));           // [object Array]
console.log(t(new Map()));    // [object Map]
console.log(t(new Set()));    // [object Set]
console.log(t(new Date()));   // [object Date]
console.log(t(/re/));         // [object RegExp]
console.log(t(new Error()));  // [object Error]

// 自定义 toStringTag
class Vector {
  constructor(x, y) { this.x = x; this.y = y; }
  get [Symbol.toStringTag]() { return 'Vector'; }
}
console.log('\n—— 自定义 toStringTag ——');
console.log(t(new Vector(1, 2))); // [object Vector]

// 未加 toStringTag 的 class：默认还是 [object Object]
class Foo {}
console.log(t(new Foo()));         // [object Object]

// instanceof 与跨 realm 陷阱演示
console.log('\n—— instanceof 的三条边界 ——');
class Animal {}
class Dog extends Animal {}
console.log(new Dog() instanceof Dog);      // true
console.log(new Dog() instanceof Animal);   // true
console.log(new Dog() instanceof Object);   // true
console.log('hi' instanceof String);        // false（primitive 一律 false）
console.log(new String('hi') instanceof String); // true

// ── ❌ 错误用例：拿 constructor / instanceof 当万能类型判定 ──────
try {
  null.constructor; // ❌ 对 null 取 constructor
} catch (e) {
  console.log('对 null 取 constructor =>', e.constructor.name); // 后果：TypeError: Cannot read properties of null (reading 'constructor')
}
// 后果：x.constructor / x instanceof X 在 x 为 null、undefined 时直接崩
// ✅ 正确：Object.prototype.toString.call(x)（本例的 t()）对任意值都安全，连 null/undefined 都能区分
