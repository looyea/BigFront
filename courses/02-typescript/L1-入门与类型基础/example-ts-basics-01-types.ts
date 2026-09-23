// 运行：node courses/02-typescript/examples/ts-basics/01-types.ts
let name: string = "小明";
let age: number = 18;
const scores: number[] = [90, 85, 77];

function greet(n: string): string {
  return `Hi, ${n} (${age})`;
}
console.log(greet(name));
console.log("平均分:", scores.reduce((a, b) => a + b, 0) / scores.length);

// unknown 必须收窄
const raw: unknown = JSON.parse('{"ok":true}');
if (typeof raw === "object" && raw !== null && "ok" in raw) {
  console.log("收窄后访问 =>", (raw as { ok: boolean }).ok);
}
