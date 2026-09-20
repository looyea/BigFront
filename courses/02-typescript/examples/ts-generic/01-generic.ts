// 运行：node courses/02-typescript/examples/ts-generic/01-generic.ts
function first<T>(arr: T[]): T | undefined { return arr[0]; }
const n = first([1, 2, 3]);      // number | undefined
const s = first(['a', 'b']);     // string | undefined
console.log(n, s);

interface Box<T> { value: T }
const b: Box<string> = { value: "typed" };
console.log(b.value.toUpperCase());

function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}
console.log(longest('abc', 'fo'));
