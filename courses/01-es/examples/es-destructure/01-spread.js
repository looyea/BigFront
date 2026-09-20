// 运行：node courses/01-es/examples/es-destructure/01-spread.js
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
console.log("解构 =>", userName, role);
