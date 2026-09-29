// 目的：泛型函数——用类型参数 T 把"入参元素类型"与"返回类型"关联起来，一套实现适配任意元素类型
// 运行：node courses/02-typescript/L4-泛型/example-ts-generic-01-generic.ts

// <T> 是类型参数；调用时 TS 根据实参自动推断 T（无需手写 first<number>(...)）
function first<T>(arr: T[]): T | undefined { return arr[0]; }   // 返回首元素，空数组则 undefined

const n = first([1, 2, 3]);      // T 推断为 number → n: number | undefined
const s = first(['a', 'b']);     // T 推断为 string → s: string | undefined
console.log(n, s);               // => 1 'a'

// ❌ 错误用例（编译期）：元素类型不一致，T 被推成联合或报错
// first([1, 'a', true]);         // T 推成 number|string|boolean，结果类型变混合联合（通常非所愿）
// const bad: number = first([1,2,3]); // ✗ 可能是 undefined，不能直接赋给 number（strict 下）
const safe: number = first([1, 2, 3]) ?? 0;  // ✅ 用 ?? 兜底 undefined → 0
