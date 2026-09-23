// 示例 03：作用域链 + 遮蔽 + 模块顶层作用域
// 运行：node courses/01-es/examples/es-scope/03-scope-chain.js

const outer = 'I am outer';

function level1() {
  const mid = 'I am mid';
  function level2() {
    const inner = 'I am inner';
    // 作用域链：inner -> mid -> outer -> global
    console.log(inner, '|', mid, '|', outer);
  }
  level2();
}
level1();

// 遮蔽 + TDZ 双料陷阱
const x = 'global';
function trap() {
  try {
    console.log(x); // ❌ ReferenceError（下面 const x 让整个函数体内 x 都归它，进入 TDZ）
    const x = 'local';
  } catch (e) {
    console.log('caught:', e.constructor.name);
  }
}
trap();

// for 循环 per-iteration binding
const funcs = [];
for (let i = 0; i < 3; i++) funcs.push(() => i);
console.log('per-iteration:', funcs.map((f) => f())); // [0, 1, 2]

// 普通块作用域做不到这件事（对照）
const funcs2 = [];
let k = 0;
for (; k < 3; k++) {
  funcs2.push(() => k);     // 共享外层 k
}
console.log('shared binding:', funcs2.map((f) => f())); // [3, 3, 3]

// const 只锁 binding
const user = { name: 'Ann' };
user.name = 'Bob';             // ✅
try { user = {}; } catch (e) { console.log('const reassign:', e.constructor.name); }
Object.freeze(user);
user.name = 'Cindy';
console.log('after freeze, name still:', user.name); // 'Bob'（浅冻结生效）
