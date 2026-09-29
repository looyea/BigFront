// 示例 01：typeof 全谱 + null 陷阱
// 目的：列出 typeof 对各类型的返回值，并演示 null 误判与未声明变量的行为差异
// 运行：node "courses/01-es/L2-数据类型与转换/example-es-types-01-typeof-matrix.js"

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

// ── ❌ 错误用例（记住它到底会报什么）──────────────
// 错误 A：用 typeof 判 null
const isObj = (x) => typeof x === 'object';          // 对 null 也返回 true（历史遗留：typeof null === 'object'）
console.log('typeof null 误判为对象 =>', isObj(null)); // true
// 后果：把 null 当对象继续访问属性 → TypeError: Cannot read properties of null
// ✅ 正确：判 null 必须显式 x === null

// 错误 B：typeof 对「未声明标识符」返回 'undefined' 不报错，但对 let/const 的 TDZ 访问会抛 ReferenceError
console.log('typeof 未声明变量 =>', typeof notDeclared); // 'undefined'（安全，不抛）
// console.log(notDeclared);                            // ❌ 直接读未声明变量 → ReferenceError: notDeclared is not defined
