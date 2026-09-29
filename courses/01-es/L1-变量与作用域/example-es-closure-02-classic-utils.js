// 示例 02：debounce / throttle / memoize 三个经典闭包工具
// 目的：闭包保存 timer/last/cache 等“跨调用状态”，实现防抖/节流/缓存
// 运行：node "courses/01-es/L1-变量与作用域/example-es-closure-02-classic-utils.js"

function debounce(fn, wait = 200) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

function throttle(fn, wait = 200) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= wait) { last = now; fn.apply(this, args); }
  };
}

function memoize(fn) {
  const cache = new Map();
  function memoized(...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const v = fn.apply(this, args);
    cache.set(key, v);
    return v;
  }
  memoized.cache = cache;
  memoized.clear = () => cache.clear();
  return memoized;
}

// 快速自测 memoize
let calls = 0;
const slowAdd = memoize((a, b) => { calls++; return a + b; });
slowAdd(1, 2); slowAdd(1, 2); slowAdd(1, 2);
console.log('memoize: 3 次调用，实际执行次数 =', calls); // 1
slowAdd.clear();
slowAdd(1, 2);
console.log('clear 后再次执行 =', calls);                // 2

// debounce/throttle 用一小段模拟
const log = (tag) => console.log(tag, Date.now() % 1000);
const d = debounce(() => log('debounced'), 50);
const t = throttle(() => log('throttled'), 50);
for (let i = 0; i < 10; i++) { d(); t(); }
setTimeout(() => log('--- 100ms 后 ---'), 100);
// 预期：debounced 只输出 1 次（最后一击）；throttled 按间隔多次；--- 100ms 后 --- 最后输出

// ── ❌ 错误用例：每次调用都现场新建 debounce 实例 ──────────
for (let i = 0; i < 10; i++) {
  debounce(() => log('新实例'))();  // 每轮都创建一个全新的 debounce，各自有独立 timer
}
// 后果：10 个独立 debounce 各只被调用一次，定时器互不干扰→全部会触发，完全没起到“合并高频调用”的作用
// ✅ 正确：debounce/throttle/memoize 实例必须只创建一次、反复复用同一个（如上面的 const d = debounce(...)）
