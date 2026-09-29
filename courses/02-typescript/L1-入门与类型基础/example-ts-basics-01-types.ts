// 目的：演示 TS 最基础的类型标注——基本类型、数组、函数签名，以及 unknown 必须先收窄再用
// 运行：node courses/02-typescript/L1-入门与类型基础/example-ts-basics-01-types.ts

// —— 基本类型标注：变量右侧的值必须与冒号后的类型一致 ——
let userName: string = "小明";         // 限定为 string（不叫 name 是为了避开 DOM 全局 name）
let age: number = 18;                 // age 被限定为 number
const scores: number[] = [90, 85, 77]; // 数字数组（等价写法 Array<number>）

// —— 函数签名：参数与返回值都可标注 ——
function greet(n: string): string {   // 入参 n 必须是 string，返回值必须是 string
  return `Hi, ${n} (${age})`;         // 模板字面量返回 string，符合返回类型
}
console.log(greet(userName));          // => Hi, 小明 (18)
console.log("平均分:", scores.reduce((a, b) => a + b, 0) / scores.length); // => 平均分: 84

// —— unknown：比 any 安全的顶层类型，用前必须先收窄 ——
const raw: unknown = JSON.parse('{"ok":true}'); // unknown 不能直接取属性
// ❌ 错误用例（类型错误，tsc 直接拒绝）：
//    raw.ok;                       // Error: 'raw' is of type 'unknown'
//    (raw as any).nope;            // 能过编译但失去类型保护——违背用 unknown 的初衷
// ✅ 正确用例：先 typeof / in 收窄，再断言具体形状访问
if (typeof raw === "object" && raw !== null && "ok" in raw) {
  console.log("收窄后访问 =>", (raw as { ok: boolean }).ok); // => 收窄后访问 => true
}
