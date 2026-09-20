// 示例 01：模块模式与私有变量（IIFE + 闭包）
// 运行：node courses/01-es/examples/es-closure/01-module-pattern.js

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
