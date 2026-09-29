// 示例：Promise.all / allSettled 并发
// 目的：演示并发等待取最快总时长，对比 all（fail-fast）与 allSettled（全收集）
// 运行：node "courses/01-es/L8-异步编程/example-es-async-02-all.js"
const delay = (ms, val) => new Promise((res) => setTimeout(() => res(val), ms));

async function main() {
  const start = Date.now();
  const [a, b, c] = await Promise.all([delay(300, 'A'), delay(200, 'B'), delay(100, 'C')]);
  console.log('并发 =>', a, b, c, Date.now() - start, 'ms'); // 约 300ms

  const results = await Promise.allSettled([delay(50, 'ok'), Promise.reject(new Error('boom'))]);
  console.log('allSettled =>', results.map((r) => r.status)); // ['fulfilled','rejected']

  // ❌ 错误用例：Promise.all 只要有一个 reject，整体立即 reject（fail-fast），其它结果全丢
  try {
    await Promise.all([delay(50, 'ok'), Promise.reject(new Error('boom'))]);
  } catch (e) {
    console.log('all 失败 =>', e.message); // 'boom'（那一路 ok 的结果被丢弃，拿不到）
  }
  // ✅ 需要“无论成败都要各自结果”时用 Promise.allSettled（见上），而不是 Promise.all
}
main();
