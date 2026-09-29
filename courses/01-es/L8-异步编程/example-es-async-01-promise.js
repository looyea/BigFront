// 示例：async/await 串行执行
// 目的：演示 await 逐个等待（串行总耗时相加），以及忘记 await 得到 Promise 的坑
// 运行：node "courses/01-es/L8-异步编程/example-es-async-01-promise.js"
const delay = (ms, val) => new Promise((res) => setTimeout(() => res(val), ms));

async function main() {
  const start = Date.now();
  const a = await delay(200, "A");
  const b = await delay(200, "B"); // 串行：共约 400ms
  console.log("串行 =>", a, b, Date.now() - start, "ms"); // 串行：a 等完才发 b，约 400ms

  // ❌ 错误用例：忘了 await，拿到的是 Promise 对象而非字符串值
  const notAwaited = delay(200, "A");
  console.log("不 await =>", notAwaited); // Promise { <pending> }（不是 'A'）
  notAwaited.then((v) => console.log("在 then 里才拿到值 =>", v)); // 'A'
}
main();
