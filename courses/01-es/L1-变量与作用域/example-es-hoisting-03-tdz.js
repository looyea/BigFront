// 示例 03：TDZ 的三种真实踩坑场景
// 运行：node courses/01-es/examples/es-hoisting/03-tdz.js

function safe(label, fn) {
  try { fn(); console.log(label, 'OK'); }
  catch (e) { console.log(label, '=>', e.constructor.name + ':', e.message); }
}

// 1. 块内 let 遮蔽全局同名变量
var name = 'global';
safe('case-1', () => {
  console.log(name); // 若下面没有 let，这里读到 global
  let name = 'local'; // 这一行让整个块内 name 进入 TDZ
});

// 2. 参数默认值引用后位参数
safe('case-2', () => {
  function f(a = b, b = 1) { return [a, b]; }
  f(); // ❌ ReferenceError: Cannot access 'b' before initialization
});

// 3. class 也走 TDZ
safe('case-3', () => {
  new Foo(); // ❌ ReferenceError（Foo 尚未初始化）
  class Foo {}
});
