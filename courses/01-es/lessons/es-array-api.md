# Array 方法全家桶

> 目标：**把 40 个数组方法分成 5 组**记牢——**变更类 / 迭代类 / 查找类 / 合并切片类 / 新增（flat、flatMap、at、includes、fill、copyWithin）**；理解**遍历时修改数组的坑**；能说出 for/for-in/for-of/forEach 四者的关键差异。

---

## 一、方法分类：**变更 vs 非变更**

**会改原数组**（Mutators）——8 个：
`push` / `pop` / `shift` / `unshift` / `splice` / `sort` / `reverse` / `fill` / `copyWithin`

**不改原数组**——其余全部：
`concat` / `slice` / `join` / `map` / `filter` / `reduce` / `forEach` / `find` / `findIndex` / `includes` / `indexOf` / `some` / `every` / `flat` / `flatMap` / `at` / `keys/values/entries`

**⚠️ React 里 state 更新必须走非变更类**——`setState(state.sort())` 会**污染**旧 state。正确写法：`[...state].sort()` 或 `state.toSorted?.()`（ES2023）。

---

## 二、四种遍历：**能 break 与不能 break 的差异**

| 方式 | 能 break/return | 遍历属性范围 | this 参数 | 迭代器协议 |
| --- | --- | --- | --- | --- |
| `for (let i=0; i<arr.length; i++)` | ✅ | 下标 0..length-1 | - | 否 |
| `for (const x of arr)` | ✅ | 迭代器 next() | - | ✅ |
| `for (const i in arr)` | ✅ 但拿的是**字符串下标** | **可枚举**属性（含字符串键、原型链） | - | 否 |
| `arr.forEach(fn)` | ❌（只能靠异常跳出） | 0..length-1，**跳过 empty slot** | 可传 thisArg | 否 |

**⚠️ 稀疏数组坑**：
```js
const arr = [1, , 3];       // length=3, index 1 是 empty slot
arr.forEach(x => console.log('F', x));   // 只打印 1 和 3
for (const x of arr) console.log('O', x); // 打印 1 undefined 3
arr.map(x => x + 1);        // [2, empty, 4]（保留洞！）
```
`forEach / map / filter` **跳过 empty slot**；`for-of` 把它们当 undefined。要**归一化**用 `Array.from` 或 `[...arr]`。

**⚠️ for-in 用在数组上是 bug**：会枚举原型扩展、会枚举字符串键。永远用 `for-of` 或 `forEach`。

---

## 三、查找与判断

```js
arr.includes(v)         // ES2016：值存在？支持 NaN（=== 不支持）
arr.indexOf(v)          // 不支持 NaN（===）；找不到返回 -1
arr.find(fn)            // 返回**第一个满足的元素**或 undefined
arr.findIndex(fn)       // 返回下标或 -1
arr.at(i)               // ES2022：支持负下标 arr.at(-1) === arr[arr.length-1]
arr.some(fn)            // 存在？短路版「或」
arr.every(fn)           // 全部？短路版「且」
```

**`includes` vs `indexOf` 选择**：只需要「在不在」→ `includes`（能识别 NaN，可读性高）。需要下标 → `indexOf` 或 `findIndex`（找对象）。

**`find` vs `filter`**：只要一个 → `find` 短路；要全部 → `filter`。

**`some/every` 空数组**：`[].some(...)` **false**、`[].every(...)` **true**（数学「空真」）。**⚠️ 空数组 every 是 true 常引发 bug**——校验场景要先判 length。

---

## 四、map / filter / reduce 三剑客

### `reduce` 万能心法

**签名**：`arr.reduce((acc, cur, idx, src) => newAcc, init)`

**4 种经典用法**：
```js
// 1. 求和/积
[1,2,3].reduce((a,b) => a+b, 0);          // 6

// 2. 分组 groupBy
const byType = list.reduce((m, x) => {
  (m[x.type] ??= []).push(x);
  return m;
}, {});

// 3. 展平
[[1,2],[3,4]].reduce((a, b) => a.concat(b), []);

// 4. 组合函数（见 es-currying）
fns.reduce((acc, f) => f(acc), init);
```

**⚠️ 不传 init 的坑**：`[].reduce(fn)` 抛 TypeError；`[1].reduce(fn)` 返回 1（不调用回调）；两元素时 acc = arr[0], cur = arr[1]——**永远传 init**。

### `map` vs `forEach`
- `map` 返回**新数组**，语义是「一对一变换」；
- `forEach` 返回 undefined，语义是「执行副作用」。
- **不要**用 map 只为了遍历——会被 ESLint `no-return-assign` / `unicorn/no-array-callback-reference` 挑刺。

### `filter` 陷阱
```js
[1,2,3].filter(Boolean);   // ✅ 去 falsy（含 0、''、null、undefined、NaN、false）
[1,,3].filter(Boolean);    // 结果 [1, 3]（empty 被跳过，不会被传进回调）
```

---

## 五、扁平化：flat / flatMap（ES2019）

```js
[1, [2, [3, [4]]]].flat();          // [1, 2, [3, [4]]]（默认深度 1）
[1, [2, [3, [4]]]].flat(Infinity);  // [1, 2, 3, 4]
[1, [2, [3]]].flat(2);              // [1, 2, 3]
[[1,2],[3,4]].flatMap(([a,b]) => [a+b]);   // [3, 7]
```

**flatMap 只能扁平一层**——是「map + flat(1)」的组合，性能优于 map().flat()。

**⚠️ flat 会**丢掉 empty slot**：`[1,,2].flat()` → `[1, 2]`。

**用途**：树结构展平、Promise 结果合并、日志扁平化。

---

## 六、切片与拼接

```js
arr.slice(start, end)       // 不修改；负数从尾；end 不含
arr.splice(start, deleteN, ...insert)   // **修改**！返回**被删的元素**数组
arr.concat(...)             // ES6 之后不推荐（不处理 Symbol.isConcatSpreadable）
[...a, ...b]                // 推荐替代
```

**splice 是双刃剑**：既删又插又返回被删数组——**面试高频**：
```js
const a = [1,2,3,4,5];
const removed = a.splice(1, 2, 'x');  // a = [1,'x',4,5], removed = [2,3]
```

---

## 七、排序

```js
[10, 1, 5].sort();                              // ⚠️ [1, 10, 5]（默认字符串排序）
[10, 1, 5].sort((a, b) => a - b);              // ✅ [1, 5, 10]
users.sort((a, b) => a.age - b.age);           // 按字段
users.sort((a, b) => a.name.localeCompare(b.name, 'zh'));   // 中文按拼音
```

**⚠️ sort 是**原地**且**不稳定？——V8 从 Chrome 70 起改为 TimSort，**稳定**。**⚠️ 比较函数返回 NaN 会造成未定义行为**（比如 `a.x - b.x` 时 a.x undefined）——加防御：`(a.x ?? 0) - (b.x ?? 0)`。

**ES2023 新增非变异版**：`toSorted` / `toReversed` / `with(i, v)` / `toSpliced`——React 状态管理神器。

---

## 八、`Array.from` 与 `of`

```js
Array.from('abc');                    // ['a','b','c']（可迭代或类数组）
Array.from({ length: 3 }, (_, i) => i * i);   // [0,1,4]
Array.from(new Set([1,2,3]));          // [1,2,3]
Array.of(7);                          // [7]（vs new Array(7) → 7 个 empty）
new Array(3);                          // [empty × 3]
new Array(1, 2, 3);                   // [1,2,3]
```

**⚠️ 单数字构造函数的坑**：`new Array(3)` 是长度 3 稀疏数组，`new Array(3.5)` 抛 RangeError。**永远用 `Array.of` 或字面量**。

---

## 九、`fill` / `copyWithin`

```js
new Array(5).fill(0);              // [0,0,0,0,0]（**归一化**稀疏数组的常用套路）
[1,2,3,4,5].fill('x', 1, 3);       // [1,'x','x',4,5]
[1,2,3,4,5].copyWithin(0, 3);      // [4,5,3,4,5]（把 index 3 起拷到 index 0）
```

**fill 的陷阱**：填充对象引用会**共享同一对象**：
```js
const m = new Array(3).fill({});
m[0].x = 1;
console.log(m);   // [{x:1}, {x:1}, {x:1}] ❌ 同一引用
// 正确：Array.from({length:3}, () => ({}))
```

---

## 十、自检清单

- [ ] 默写「会改原数组」的 9 个方法。
- [ ] 说出 forEach / for-of / for-in / for 四种遍历的差异。
- [ ] 手写「groupBy」和「flat(Infinity)」。
- [ ] 解释 `[1,,2].map(x => x+1)` 得到 `[2, empty, 3]` 的原因。
- [ ] `new Array(3).fill({})` 有什么问题？如何正确初始化对象数组？
- [ ] 说出 `sort` 默认按字符串排序的原因与稳定性。

---

## 🚀 部署预告（本关点到，细节在 L10）

**Array 方法在构建/运行时会被怎样处理？**

1. **新 API 需要 polyfill**：`flat / flatMap / at / includes / fill / copyWithin` 都是 ES2019 之前的 IE/老安卓不支持——core-js 会注入。target 越老，polyfill 越大（Array 系列约占 core-js 15KB gzip）。
2. **链式调用的隐藏开销**：`arr.map(f).filter(g).reduce(h)` 每一步都新建中间数组。生产上对**热路径**建议改成单次 `for` 或 `reduce`——**RxJS / Lodash chain / Immutable.js** 都是为了消除这类中间数组而生。
3. **V8 的迭代器逃逸分析**：`arr.map(x => x * 2)` 如果结果数组**只被消费一次**（比如紧接 `.reduce`），V8 有 fusion 优化会消除中间数组——但**跨函数边界就没了**。
4. **`for-of` 降级到 ES5**：Babel 会展开成 `try { var _iterator = arr[Symbol.iterator](); ... }`——比 `for` 慢很多。target 老时代码 sensitive 的路径要手写 `for (let i=0;...)`。
5. **ES2023 `toSorted/toReversed/with`**：非变异版是**未来的 React 主流**；现在打包时靠 polyfill 或 `browserslist` 决定是否降级。

细节 L10 `es-build` 展开。**你现在只需要记住**：**Array API 好用，但链式调用的每一次 map 都在悄悄新建数组——火焰图能救你。**
