// 运行：node courses/02-typescript/examples/ts-interface/01-shape.ts
interface Lesson {
  readonly id: string;
  title: string;
  done?: boolean;
}
function render(l: Lesson): string {
  return `${l.done ? "✅" : "⬜"} ${l.title}`;
}
const l1: Lesson = { id: "ts-1", title: "类型基础", done: true };
console.log(render(l1));
