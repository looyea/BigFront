// 示例 02：Object.prototype.toString.call 全景 + Symbol.toStringTag
// 运行：node courses/01-es/examples/es-types/02-tostring-tag.js

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
