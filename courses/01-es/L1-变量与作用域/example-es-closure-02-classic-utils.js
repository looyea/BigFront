// 示例 02：debounce / throttle / memoize 三个经典闭包工具
// 运行：node courses/01-es/examples/es-closure/02-classic-utils.js

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
