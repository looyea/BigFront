// 运行：node courses/01-es/examples/es-async/01-promise.js
const delay = (ms, val) => new Promise((res) => setTimeout(() => res(val), ms));

async function main() {
  const start = Date.now();
  const a = await delay(200, "A");
  const b = await delay(200, "B"); // 串行：共约 400ms
  console.log("串行 =>", a, b, Date.now() - start, "ms");
}
main();
