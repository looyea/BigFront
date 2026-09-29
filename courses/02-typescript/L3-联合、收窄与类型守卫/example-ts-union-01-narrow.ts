// 目的：可辨识联合（discriminated union）——用 kind 判别 + switch 收窄，各分支只能访问自己独有字段
// 运行：node courses/02-typescript/L3-联合、收窄与类型守卫/example-ts-union-01-narrow.ts
type Shape =
  | { kind: "circle"; r: number }        // kind 是判别字段（字面量类型），circle 独有 r
  | { kind: "square"; side: number };    // square 独有 side

function area(s: Shape): number {
  switch (s.kind) {                       // 按 kind 分支，s 在每个 case 内被收窄成对应成员
    case "circle": return Math.PI * s.r ** 2;   // 此分支 s 是 circle，可安全访问 s.r
    case "square": return s.side ** 2;          // 此分支 s 是 square，可访问 s.side
  }
}
console.log(area({ kind: "circle", r: 2 }));  // => 12.566370614359172
console.log(area({ kind: "square", side: 3 })); // => 9

// ❌ 错误用例（编译期）：
// area({ kind: "circle", side: 3 });   // ✗ circle 分支没有 side，且缺 r
// s.r 在 square 分支里访问             // ✗ Property 'r' does not exist（收窄后各分支只认自己的字段）
