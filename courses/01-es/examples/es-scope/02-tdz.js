// 运行：node courses/01-es/examples/es-scope/02-tdz.js
// 暂时性死区 TDZ 演示

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
