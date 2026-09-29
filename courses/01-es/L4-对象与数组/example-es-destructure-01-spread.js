// 示例：浅拷贝 vs 深拷贝 + 解构默认值
// 目的：对比展开运算符（只拷一层）与 structuredClone（深拷），并演示解构重命名/默认值
// 运行：node "courses/01-es/L4-对象与数组/example-es-destructure-01-spread.js"
const base = { name: "k", meta: { level: 1 } };

// 浅拷贝：展开只复制第一层，嵌套 meta 仍是同一引用
const shallow = { ...base, name: "k2" };
shallow.meta.level = 999;
console.log("浅拷贝影响原对象 =>", base.meta.level); // 999

// 深拷贝：structuredClone（Node 17+ 内置）
const deep = structuredClone(base);
deep.meta.level = 1;
console.log("深拷贝互不影响 =>", base.meta.level, deep.meta.level);

// 解构 + 重命名 + 默认值
const { name: userName, role = "guest" } = base;
console.log("解构 =>", userName, role); // 'k' 'guest'（base 无 role 字段 → 走默认值）

// ❌ 错误用例：structuredClone 无法克隆函数/DOM/原型方法，会抛 DataCloneError
try {
  structuredClone({ fn: () => {} });
} catch (e) {
  console.log("克隆含函数的对象 =>", e.name); // DataCloneError（结构化克隆算法不受理函数）
}
// ✅ 需要拷函数时：手写递归拷贝或用库（如 lodash.cloneDeep，它能拷函数引用但不会重建闭包）
