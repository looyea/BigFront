// 示例 01：typeof 全谱 + null 陷阱
// 运行：node courses/01-es/examples/es-types/01-typeof-matrix.js

const cases = [
  ['undefined', undefined],
  ['null', null],
  ['true', true],
  ['42', 42],
  ['42n', 42n],
  ["'hi'", 'hi'],
  ['Symbol()', Symbol('x')],
  ['{}', {}],
  ['[]', []],
  ['new Date()', new Date()],
  ['new Map()', new Map()],
  ['function', function () {}],
  ['arrow', () => {}],
  ['class', class Foo {}],
];
for (const [label, v] of cases) {
  console.log(label.padEnd(15), 'typeof =', typeof v);
}

// 破除 null 陷阱：三重判定
console.log('\n—— isNull / isObject 的正确写法 ——');
const isNull = (x) => x === null;
const isObjectLike = (x) => x !== null && typeof x === 'object';
console.log(isNull(null), isObjectLike(null));        // true, false
console.log(isNull(undefined), isObjectLike({}));      // false, true
console.log(isObjectLike([]), isObjectLike(new Date()));// true, true
