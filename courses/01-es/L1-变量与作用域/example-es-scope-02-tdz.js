// 示例 02：暂时性死区 TDZ 与 const 的「锁绑定不锁内容」
// 目的：对比 var（提升读到 undefined）与 let/const（声明前访问报 ReferenceError）；并展示 const 只锁定引用
// 运行：node "courses/01-es/L1-变量与作用域/example-es-scope-02-tdz.js"

// 1) var 提升：读到 undefined，不报错
console.log('var a =>', typeof a); // undefined
var a = 10;

// 2) let/const 在声明前访问 = ReferenceError（去掉下行注释即可看到报错）
// console.log(b); // ❌ Cannot access 'b' before initialization
let b = 20;

// 3) const 锁的是绑定不是内容
const user = { name: '小明' };
user.name = '小红'; // ✅ 修改内部允许
console.log('const 对象内部可改 =>', user.name);
// user = {}; // ❌ 若取消注释会 TypeError: Assignment to constant variable.
