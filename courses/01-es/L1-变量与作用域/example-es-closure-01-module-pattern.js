// 示例 01：模块模式与私有变量（IIFE + 闭包）
// 目的：用 IIFE 闭包封装私有状态，只对外暴露受控的方法接口
// 运行：node "courses/01-es/L1-变量与作用域/example-es-closure-01-module-pattern.js"

const User = (() => {
  const users = new Map();
  return {
    add: (id, name) => { users.set(id, name); return users.size; },
    get: (id) => users.get(id),
    count: () => users.size,
  };
})();

console.log(User.add('u1', 'Ann'));   // 1
console.log(User.add('u2', 'Bob'));   // 2
console.log(User.get('u1'));          // 'Ann'
console.log(User.count());            // 2
// users 这个 Map 从外部完全不可见：
try { User.users; } catch (e) { /* undefined */ }
console.log('users' in User);         // false

// ── ❌ 错误用例：把内部可变引用直接交出去 ──────────────
const Bad = (() => {
  const users = new Map();
  return { users };            // 泄露：把内部 Map 的引用当作属性暴露
})();
Bad.users.set('x', '任意写入'); // 后果：外部绕过所有控制直接改内部状态，“私有”名存实亡
// ✅ 正确：只暴露函数化的受控接口（如上面的 add/get/count），内部引用绝不外泄
