# 现代 JS 全景：从 ES6 到 ES2024 的一张表

> 目标：把 ES2015→ES2024 **每年最关键的改动**串成一张时间线表；理解「**哪些 lodash 功能已被原生取代**」；建立「**browserslist + core-js** 的选型心智模型」。

---

## 一、年度速查表

| 年份 | 关键特性 | 一句话总结 |
| --- | --- | --- |
| **ES2015** | let/const/class/module/Promise/Map/Set/Symbol/Iterator/Proxy/Reflect/模板字面量/解构/箭头函数/for-of | 语言的**大爆炸**年 |
| **ES2016** | `Array.includes`、`**` 幂运算符 | 两颗小糖 |
| **ES2017** | `async/await`、`Object.values/entries`、`padStart/padEnd`、`Atomics`、`SharedArrayBuffer`、trailing commas | 异步**语法舒适区** |
| **ES2018** | 对象 rest/spread、`for-await-of`、`Promise.finally`、正则命名捕获组/`s` flag/lookbehind | async 补票 |
| **ES2019** | `Array.flat/flatMap`、`Object.fromEntries`、`String.trimStart/End`、`try` 无参数 catch、`Array.sort` 稳定性、`Symbol.description` | 数组/对象工具大丰 |
| **ES2020** | `?.`、`??`、`Promise.allSettled`、`globalThis`、`BigInt`、动态 `import()`、`matchAll`、`import.meta` | **最好写**的一年 |
| **ES2021** | `&&=`/`||=`/`??=`、`String.replaceAll`、`Array.at`（提议）、`WeakRef`、`FinalizationRegistry`、`Numeric separators`（`1_000_000`） | 逻辑赋值 + 数字美化 |
| **ES2022** | Class fields/`#private`/`static{}`、Top-level await、`Object.hasOwn`、`Array.at`、`error.cause`、RegExp `d` flag | **Class 大年** |
| **ES2023** | `Array.findLast/findLastIndex`、`toSorted/toSpliced/with/withAll`（不可变数组方法）、Hashbang（`#!/usr/bin/env node`）| **不可变数组**来了 |
| **ES2024** | `Object.groupBy/Map.groupBy`、`Promise.withResolvers`、`ArrayBuffer.transfer`、`String.isWellFormed/toWellFormed`、`Atomics.waitAsync` | 收尾与整理 |
| **ES2025**（已落） | `Iterator.prototype.map/filter/take/drop/flatMap/reduce/forEach/toArray`、`RegExp v flag`、`Promise.try`、`Duplicate prototype properties` 允许 | 迭代器助手 |

---

## 二、原生替代 lodash 对照表

| lodash 功能 | 原生替代 | 引入年份 |
| --- | --- | --- |
| `_.map / filter / reduce` | `Array.prototype.map / filter / reduce` | ES5 |
| `_.flatten(2)` | `Array.prototype.flat(2)` | ES2019 |
| `_.flatMap` | `Array.prototype.flatMap` | ES2019 |
| `_.toPairs` | `Object.entries` | ES2017 |
| `_.fromPairs` | `Object.fromEntries` | ES2019 |
| `_.keys / values` | `Object.keys / values` | ES5/ES2017 |
| `_.assign` | `Object.assign` | ES2015 |
| `_.cloneDeep` | `structuredClone` | 浏览器 2022 |
| `_.get(obj, 'a.b')` | `obj?.a?.b` | ES2020 |
| `_.isNil(v)` | `v == null`（宽松等于 null 或 undefined） | 一直 |
| `_.defaultTo(v, d)` | `v ?? d` | ES2020 |
| `_.sortBy(arr, fn)` | `arr.toSorted((a,b) => fn(a) - fn(b))` | ES2023 |
| `_.without(arr, x)` | `arr.filter(v => v !== x)` | ES5 |
| `_.uniq(arr)` | `[...new Set(arr)]` | ES2015 |
| `_.chunk(arr, n)` | 手写 `Array.from({length: Math.ceil(len/n)}, (_,i) => arr.slice(i*n, i*n+n))` | 待提案 |
| `_.groupBy(arr, fn)` | `Object.groupBy(arr, fn)` | ES2024 |
| `_.has(obj, k)` | `Object.hasOwn(obj, k)` | ES2022 |
| `_.isEmpty(obj)` | 仍无完美替代（要手写） | — |
| `_.debounce / throttle` | 仍无——需要手写 5-10 行 | — |

**结论**：**lodash 的核心功能 80% 可被原生替代**——`debounce / throttle / clone`（含循环引用）/ `isEqual`（深层比较，可用 structuredClone try 技巧但脆弱）仍需要第三方。

---

## 三、选型心智模型

```
[browserslist 配置] → 决定 target
         ↓
[@babel/preset-env] → 决定哪些**语法**降级
         ↓
[core-js useBuiltIns: 'usage'] → 决定哪些**API** 注入 polyfill
         ↓
产物体积 = 基础代码 + 降级语法 + 按需 polyfill
```

- **面向现代浏览器**（Chrome 80+ / Edge 80+ / Safari 14+ / Firefox 78+）：几乎不需要 Babel 降级与 polyfill——**产物最小**；
- **含 IE 11**：需要 Babel 全套 + core-js 3 大量注入 + regenerator——**体积翻倍**；
- **Node 服务端**（20+）：async/class/ESM/optional chaining 全原生——配置极简。

---

## 四、ES2025 前瞻（已落地的新糖）

```js
// 迭代器助手（Iterator Helpers 提案）
const nums = [1, 2, 3, 4, 5][Symbol.iterator]();
const result = nums
  .filter(x => x % 2 === 0)     // 惰性！
  .map(x => x * 10)
  .take(2)
  .toArray();                     // [20, 40]
```
—— **惰性链式**不创建中间数组，比 `arr.filter().map().slice()` 更省内存。

```js
// Promise.try
const p = Promise.try(() => JSON.parse(str));   // 同步异常也变 rejection
```

---

## 五、一张图：JS 语言进化时间线

```
ES5(2009) → ES6/2015 → 2016 → 2017 → 2018 → 2019 → 2020 → 2021 → 2022 → 2023 → 2024 → 2025
   严格       大爆炸    小糖    async   补票   flat   ?. ??    赋值    Class   不可变  groupBy  迭代器
             class     **      对象展开         解构   动态     私有     toSorted  withResolvers  助手
             Promise          for-await  正则   import  数字    #field            transfer
             Module           finally   BigInt matchAll   ...   TLA              Iterator
```

---

## 六、自检清单

- [ ] 不查资料，说出 2015→2024 每年的**一个**最标志性特性。
- [ ] `?.` / `??` 分别是哪一年？`Object.hasOwn` 呢？`Array.toSorted` 呢？
- [ ] `Object.groupBy` 能替代 lodash 的什么？
- [ ] 你的 browserslist 里有 IE——async/await / Proxy / optional chaining 分别怎么处理？
- [ ] `structuredClone` 能替代 `_.cloneDeep` 吗？差在哪？（函数 / DOM / 类实例不能）

---

## 🚀 部署预告（总结关 → 指向 L10）

**整个 L9 的部署视角归结为一句话**：

> **browserslist → Babel 降级 → core-js polyfill → 产物体积 → 加载策略 → 首屏性能**

- 用 `npx browserslist` 看你的 target 覆盖哪些浏览器；
- 用 `npx core-js-compat` 看哪些 API 需要注入；
- 用 `bundlephobia.com` 看 polyfill / lodash 体积代价；
- **决策**：如果只面向现代浏览器，**可以不用 Babel**（esbuild/SWC 直接 pass-through），**不用 core-js**，**不引 lodash**——产物极小。

L10 `es-build` 全面展开构建流程；`es-publish` 把代码变成 npm 包。
