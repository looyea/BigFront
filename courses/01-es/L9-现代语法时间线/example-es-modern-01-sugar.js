// 运行：node courses/01-es/examples/es-modern/01-sugar.js
const user = { name: "k", address: null };
console.log('可选链 =>', user?.address?.city);          // undefined，不报错
console.log('空值合并 =>', user.nickname ?? '匿名');      // 匿名
console.log('|| 的坑 =>', 0 || 10, ' vs ?? =>', 0 ?? 10); // 10 vs 0

const arr = [1, 2, 3];
console.log('at(-1) =>', arr.at(-1));                    // 3

const cfg = { timeout: 0 };
cfg.timeout ??= 3000;
console.log('逻辑赋值(0 被保留) =>', cfg.timeout);         // 0

class Counter {
  count = 0;
  #secret = 42;
  inc() { return ++this.count + this.#secret; }
}
console.log('class 字段 =>', new Counter().inc());         // 43
