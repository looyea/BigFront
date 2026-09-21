# ES2025：迭代器助手与几把「安全小刀」

> 目标：掌握 ECMAScript 第 **16 版（ES2025，2025-06 定稿）** 的头号特性 **Iterator Helpers（`Iterator` 全局 + `map/filter/take/drop/flatMap/toArray…`）**，以及 **`Promise.try`、`RegExp.escape`、`Math.sumPrecise`、允许同名 getter/setter**；并**厘清版本边界**——把常被媒体误挂到「ES2025」的 Set 方法、`using`、装饰器各归其位。呼应 [es-iterator](es-iterator.md)、[es-array-api](es-array-api.md)、[es-promise](es-promise.md)。

---

## 一、ES2025 的定位

**"ES2025 是『把函数式链式操作搬进语言内核』的一年"**：主角只有一个——**Iterator Helpers**；其余是几把补齐安全与精度的小刀。规模不大，但 Iterator Helpers 直接影响「大数据集 / 流式 / 生成器」的写法。

---

## 二、Iterator Helpers（本关头条）

### 1. 为什么需要：Array 方法的「急切 + 中间数组」之痛
```js
[1, 2, 3, 4, 5]
  .map(x => x * x)      // 新建数组 [1,4,9,16,25]
  .filter(x => x > 5)   // 又新建一个 [9,16,25]
  .slice(0, 1);         // 再新建 [9]
```
每一步都**遍历整个数组 + 产出一个中间数组**。对**大数组**浪费内存，对**无限生成器**（呼应 [es-iterator](es-iterator.md)）更是**根本跑不完**。

### 2. 新增全局 `Iterator` 与惰性链式操作
```js
Iterator.from(iterableOrIterator)   // 把任何可迭代对象/迭代器包成 Iterator 助手
```
原型上提供：`map / filter / take / drop / flatMap / reduce / toArray / forEach / some / every / find`。

```js
function* naturals() { let i = 1; while (true) yield i++; }   // 无限生成器

const first3 = Iterator.from(naturals())
  .map(n => n * n)          // 惰性：逐个求值，不建中间数组
  .filter(n => n % 5 === 0)
  .take(3)                  // 只取够 3 个就停 —— 对无限源也成立！
  .toArray();               // 终端操作，物化为数组
console.log(first3);        // [25, 100, 225]
```

**惰性（lazy）**：元素**逐个**流过整条链，`take(3)` 短路后源迭代器立刻停止——这是相对 `Array.map/filter` 的核心优势（大集合省内存、无限流可处理）。

### 3. 速记：各算子
| 算子 | 作用 | 终端? |
| --- | --- | --- |
| `map/filter/flatMap` | 逐元素变换/筛选/拍一层 | 否（惰性） |
| `take(n)/drop(n)` | 取前 n / 跳过 n（可短路无限源） | 否 |
| `reduce/toArray/forEach/find/some/every` | 收敛 | **是** |

### 4. 异步版：AsyncIterator Helpers
对异步可迭代对象（`for await` 的数据源，呼应 [es-2018](es-2018.md)）：
```js
const it = readLinesFromStream()[Symbol.asyncIterator]();   // 一个 AsyncIterator
for await (const line of Iterator.from(it).filter(l => l.trim())) { ... }
// 同样有 map/take/drop/flatMap，且 take 会尽早关闭上游
```

**⚠️ 陷阱**：
- 普通 `Array` **没有** `.map` 之外的这些助手——要 `Iterator.from(arr)` 包一层，或用 `.values()`：`arr.values().take(2)`（`Array.prototype.values` 返回的就是迭代器）；
- 链式对象**只能消费一次**（迭代器耗尽即空），要复用得 `toArray()` 落数组或重新 `from`。

---

## 三、`Promise.try`：不管同步异步，统一进 Promise

```js
// 痛点：parse 同步抛错，Promise.resolve().then 又太绕
const p = Promise.try(() => JSON.parse(userInput));   // 同步 throw 也会变 rejected
p.then(render).catch(showError);                       // 一个 catch 兜住同步+异步错误
```
**语义**：调用一个「可能返回 Promise、也可能同步抛错」的函数，**保证结果永远是 Promise**。省掉 `try { ... } catch { return Promise.reject(e) }` 的样板。呼应 [es-promise](es-promise.md)、[es-async](es-async.md)。

---

## 四、`RegExp.escape`：安全拼接用户输入到正则

```js
const userInput = '1+1=2?';                      // 含正则元字符
const re = new RegExp(RegExp.escape(userInput)); // 转义为 1\+1\=2\?
re.test('a 1+1=2? b');                           // true —— 按字面量匹配，不会被注入
```
**用途**：把**不可信字符串**塞进 `new RegExp` 前必须先 `escape`，否则轻则语法错、重则 ReDoS 式注入（类比 SQL 注入）。

---

## 五、`Math.sumPrecise`：浮点求和不再越加越飘

```js
const nums = [0.1, 0.2, 0.3];
nums.reduce((a, b) => a + b, 0);   // 0.6000000000000001（逐步累加误差）
Math.sumPrecise(nums);             // 0.6（精确求和后只舍入一次）
```
**规则**：接收一个可迭代对象，**内部精确累加、仅最后舍入一次**，比 `reduce(+,0)` 稳定。**注意**：结果仍是普通 `Number`（双精度），不是 BigDecimal；只解决「累加顺序误差」，不解决浮点本质表示问题（呼应 [es-coercion](es-coercion.md) 里 `0.1+0.2` 的老坑）。

---

## 六、允许「同名 getter / setter」（Duplicate prototype properties）

```js
class Box {
  get size() { return this._s; }
  set size(v) { this._s = v; }   // ES2025 起：对象字面量/class 里 get、set 同名不再报错
}
```
此前对象字面量里 `get x(){} , set x(v){}` 同键会触发早期错误；现在规范**允许 get/set 成对共享一个名字**。

---

## 七、版本边界澄清（重要，防被 listicle 带偏）

网上「ES2025 新特性」文章常混入这些**其实不属于 ES2025 语言规范定稿**的东西：

| 常被误挂到 ES2025 | 真实归属 |
| --- | --- |
| `Set` 集合方法、`Array.fromAsync`、`Object.groupBy`、`Promise.withResolvers` | **ES2024（第 15 版）** |
| `using` / `await using`（显式资源管理）、**装饰器 Decorators** | **尚未进标准**，TC39 推进中，预计更晚（业界多指向 ES2026） |
| `import ... with { type: 'json' }`（Import Attributes）、`Float16Array` | 与 2025 前后**同期成熟**、常被并入报道；**精确 edition 请以 tc39.es / 262.ecma-international.org 为准**，别背死 |

> **课程反复强调的原则**：版本归属拿不准时，一律查**官方 spec / TC39 提案仓库 / MDN**——这正是本项目的反幻觉底线。

---

## 八、时间线速记（接前三关）

| 版本 | 别名 | 招牌 |
| --- | --- | --- |
| ES2023 | ES14 | 不可变数组 `toSorted/toReversed/toSpliced/with`、`findLast` |
| ES2024 | ES15 | `Object.groupBy`、`Promise.withResolvers`、`Array.fromAsync`、**Set 方法**、`RegExp v` 标志 |
| **ES2025** | **ES16** | **Iterator Helpers**、`Promise.try`、`RegExp.escape`、`Math.sumPrecise`、同名 get/set |

---

## 九、自检清单

- [ ] `Iterator.from(gen).map(...).filter(...).take(3).toArray()` 为什么能作用在**无限生成器**上，而 `arr.map().filter().slice()` 不能？
- [ ] Iterator 助手链为什么「只能消费一次」？要复用得怎么办？
- [ ] `Promise.try` 相比 `Promise.resolve().then(fn)` 解决了什么样板？
- [ ] 为什么把用户输入拼进 `new RegExp` 前必须 `RegExp.escape`？
- [ ] `Math.sumPrecise` 能替代 `0.1 + 0.2 !== 0.3` 的问题吗？它精确的是什么？
- [ ] `using`、Set 方法分别是哪个版本的？（提示：一个还没进标准，一个是 ES2024）

---

## 🚀 部署预告（本关点到，细节在 L10）

1. **Iterator Helpers 是运行时新增（方法，非语法）**——降级要 `core-js`/`iterator-helpers` polyfill，且**惰性语义**在 polyfill 下不总等价；老环境更稳的是回到 `for...of` + 手动 `break`。
2. **`Promise.try` / `Math.sumPrecise` / `RegExp.escape`** 都能被 core-js 打补丁（都很小）；`RegExp.escape` 也可先手写 `s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` 兜底。
3. **同名 get/set** 属语法放开，旧引擎需 Babel 处理，现代 target 原生。
4. **可用性基线（截至课程编写时）**：Iterator Helpers 需 Node 22+ / Chrome 122+ / Firefox 128+ / Safari 17.4+；`Promise.try` 更宽（Node 17+）。特性检测：`typeof Iterator === 'function' && typeof Iterator.from === 'function'`。
5. **Vite `build.target`** 只转**语法**、**不 polyfill 运行时**——要支持老浏览器得配 `core-js` + `browserslist`，详见 [es-build](es-build.md)。

**你现在只需记住**：**ES2025 = Iterator Helpers 把「惰性链式流」写进语言内核**——大集合/无限流/异步源从此有一条统一且省内存的管道；其余 `Promise.try`/`RegExp.escape`/`Math.sumPrecise` 是补齐安全与精度的三把小刀。下一关 [es-modern](es-modern.md) 把 ES2015→ES2025 整条时间线收成一张选型直觉图。
