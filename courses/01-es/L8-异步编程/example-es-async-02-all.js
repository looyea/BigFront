// 运行：node courses/01-es/examples/es-async/02-all.js
const delay = (ms, val) => new Promise((res) => setTimeout(() => res(val), ms));

async function main() {
  const start = Date.now();
  const [a, b, c] = await Promise.all([delay(300, 'A'), delay(200, 'B'), delay(100, 'C')]);
  console.log('并发 =>', a, b, c, Date.now() - start, 'ms'); // 约 300ms

  const results = await Promise.allSettled([delay(50, 'ok'), Promise.reject(new Error('boom'))]);
  console.log('allSettled =>', results.map((r) => r.status)); // ['fulfilled','rejected']
}
main();
