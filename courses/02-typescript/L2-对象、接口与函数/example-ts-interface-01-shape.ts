// 目的：用 interface 描述对象形状——readonly 只读、? 可选，配合函数当参数类型
// 运行：node courses/02-typescript/L2-对象、接口与函数/example-ts-interface-01-shape.ts
interface Lesson {
  readonly id: string;   // 只读：初始化后不可再改
  title: string;         // 必填
  done?: boolean;        // 可选：可给可不给
}
function render(l: Lesson): string {          // 参数必须是 Lesson 形状
  return `${l.done ? "✅" : "⬜"} ${l.title}`; // done 为真打 ✅，否则打 ⬜
}
const l1: Lesson = { id: "ts-1", title: "类型基础", done: true }; // ✅ 字段齐全
console.log(render(l1));                        // => ✅ 类型基础

// ❌ 错误用例（均为编译期错）：
// l1.id = "ts-2";                 // ✗ 只读：Cannot assign to 'id' because it is a read-only property
// const l2: Lesson = { id: "x" }; // ✗ 缺必填 title：Property 'title' is missing
// const l3: Lesson = { id: "x", title: "y", extra: 1 }; // ✗ 过剩属性：'extra' does not exist in type 'Lesson'
