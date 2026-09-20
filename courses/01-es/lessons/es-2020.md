# ES2020：可选链、空值合并与动态 import

> 目标：**掌握 `?.` / `??` 的精确语义与短路行为**；理解 `Promise.allSettled` / `globalThis` / `BigInt` / 动态 `import()` / `import.meta`；能识别 `?.` 与 `||` 组合的**语义陷阱**；知道 `Intl.*` 国际化 API 的入口。

---

## 一、ES2020 的定位

**「让 JS 更好写」的**大**年**——7 个提案里 5 个是日常写代码立刻能用的：
- 可选链（Optional Chaining）
- 空值合并（Nullish Coalescing）
- Promise.allSettled
- 动态 import()
- `import.meta` 与 `meta.property`
- globalThis
- BigInt
- `Intl.*`（Collation / NumberFormat / DateTimeFormat / ListFormat / RelativeTimeFormat）
- `String.prototype.matchAll`

---

## 二、可选链 `?.`

**语义**：如果左侧为 `null` 或 `undefined`，**短路**整个表达式返回 `undefined`。

```js
const city = user?.profile?.address?.city;
//  任一层为 null/undefined → 整表达式 → undefined，不抛错

const first = arr?.[0];
const fn = obj.method?.();           // 方法存在才调用；不存在返回 undefined
const deep = obj?.['a']?.['b']?.[1];
```

**三种形式**：
1. **属性** `a?.b`
2. **计算属性** `a?.[expr]`
3. **函数调用** `fn?.(args)`

**⚠️ 短路是**整个链**：
```js
let x = 0;
const y = null;
y?.foo(x++);   // x 不会 ++（短路整个调用表达式）
```

**⚠️ 陷阱**：
- `?.` 只判 `null` / `undefined`——**不判 0 / '' / false / NaN**（那是 falsy，不是 nullish）；
- **不能配合赋值左侧**：`a?.b = 1` ❌ SyntaxError；
- **和 `new` 组合**：`new Foo?.()` 合法（Foo 存在才 new）；`new (Foo?.Bar)()` 需要括号；
- **在**数字**上写**：`1..toString()` 才有救，`1.toString()` 报错——`1?.toString()` 合法但没意义。

---

## 三、空值合并 `??`

**语义**：左侧是 `null` 或 `undefined` 才取右侧——**不吞 0 / '' / false / NaN**。

```js
const port = config.port ?? 3000;
//  config.port = 0  → 0（|| 会给 3000，这是老 bug）
//  config.port = '' → ''
//  config.port = null → 3000
```

### `||` vs `??` 对照

| 左 | `\|\|` 右 | `??` 右 |
| --- | --- | --- |
| `0` | 走右 | **走左**（0） |
| `''` | 走右 | **走左**（''） |
| `false` | 走右 | **走左**（false） |
| `NaN` | 走右 | **走左**（NaN） |
| `null` | 走右 | 走右 |
| `undefined` | 走右 | 走右 |

**⚠️ 与 `||` / `&&` 混用** 需**加括号**（防歧义）：
```js
a || b ?? c     // ❌ SyntaxError
(a || b) ?? c   // ✅
```

### 逻辑赋值三兄弟（ES2021 但常一起讲）
```js
a ??= b;    // a = a ?? b
a ||= b;    // a = a || b
a &&= b;    // a = a && b
```

---

## 四、`?.` + `??` 黄金组合

```js
const street = user?.profile?.address?.street ?? '未知';
```
—— **深层可选 + 空值兜底**，替代以前 `((user || {}).profile || {}).address || {}` 一长串。

---

## 五、`Promise.allSettled`

```js
const results = await Promise.allSettled([p1, p2, p3]);
// [
//   { status: 'fulfilled', value: v1 },
//   { status: 'rejected',  reason: e2 },
//   { status: 'fulfilled', value: v3 },
// ]
```
**用途**：批量任务，**部分失败也要拿到其它结果**——埋点上报、并发下载、健康检查。

对比：
- `Promise.all` 一票否决；
- `Promise.allSettled` 全部 settle 才返回，**从不** reject。

---

## 六、`globalThis`

**统一**的全局对象：
```js
// 浏览器 → window；Web Worker → self；Node → global
globalThis.mySingleton ??= {};
```

以前 polyfill 库要写 `(typeof self !== 'undefined' ? self : this)`——ES2020 后直接 `globalThis`。

---

## 七、`BigInt`

**任意精度整数**——超过 `Number.MAX_SAFE_INTEGER`（2^53-1）的整数：
```js
const big = 9007199254740993n;   // 后缀 n
const another = BigInt('123456789012345678901234567890');
big + 1n;                          // 9007199254740994n
big + 1;                           // ❌ TypeError：不能混合 BigInt 与 Number
Number(big);                       // 精度丢失（除非小）
```

**用途**：数据库 ID（Snowflake / Twitter ID 都超 2^53）、加密、精确金额。

**⚠️ JSON.stringify 不支持**——要 `big.toString()` 或用 `json-bigint`。

---

## 八、动态 `import()`（提前进入 L7 详讲）

```js
// 表达式，不是声明——可用变量、条件、函数体
if (feature) {
  const { doWork } = await import('./heavy.js');
  doWork();
}
```

**四大用途**：代码分割 / 条件加载 / 运行时决定路径 / 从 CJS 加载 ESM。

---

## 九、`import.meta`

ESM 里的**元信息**对象：
- `import.meta.url`：当前模块 URL（`file://` / https）；
- 未来还有自定义字段（Vite 用 `import.meta.env.DEV` / `.MODE` 等）。

```js
// Node ESM 里的 __dirname
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

---

## 十、`String.prototype.matchAll`

**遍历所有正则匹配**——`exec` + `lastIndex` 手动循环的解药：
```js
const re = /(?<key>\w+)=(?<val>\w+)/g;
for (const m of 'a=1 b=2 c=3'.matchAll(re)) {
  console.log(m.groups.key, m.groups.val);
}
```
**注意**：正则**必须**带 `g`；`matchAll` 返回**迭代器**，不改动 `lastIndex`（每次从新开始）。

---

## 十一、`Intl.*` 全家桶

```js
new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(1234.5);
// '¥1,234.50'

new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(new Date());
// 'Sunday, September 20, 2026'

new Intl.Collator('zh-CN').compare('a', 'b');   // 本地化排序

new Intl.ListFormat('en', { type: 'conjunction' }).format(['a', 'b', 'c']);
// 'a, b, and c'

new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-1, 'day');
// 'yesterday'

new Intl.Segmenter('zh', { granularity: 'word' });   // ES2022 词切分
```

**部署影响**：Node 12 起**内置**完整 ICU；小体积 Node 发行版（Alpine、AWS Lambda）要装 `full-icu` 或用 `NODE_ICU_DATA`。

---

## 十二、自检清单

- [ ] `?.` 与 `||` 组合的行为差异？给一个「0 被 || 吞掉」的例子。
- [ ] `?.` 短路是**整个表达式**——`x++` 会不会执行？
- [ ] `??=` / `||=` / `&&=` 各是干什么的？
- [ ] `Promise.allSettled` 的返回结构？
- [ ] BigInt 能不能与 Number 直接相加？JSON.stringify 能序列化吗？
- [ ] 动态 import 与静态 import 的差别？给一个代码分割场景。
- [ ] `matchAll` 与旧的 while+exec 循环哪个更好？

---

## 🚀 部署预告（本关点到，细节在 L10）

**ES2020 与构建/部署：**

1. **可选链 / 空值合并降级**：`?.` 与 `??` 都是**语法**——Babel 会展开成一堆 `(a === null || a === void 0 ? void 0 : a.b)`；产物代码量翻 2-3 倍但无 polyfill；target 现代浏览器（Chrome 80+ / Safari 13.1+）时不转。
2. **动态 import 是**打包器的钩子****：webpack / Rollup / Vite 都识别 `import('./heavy.js')` → 拆成独立 chunk + 生成 `__webpack_require__.e` / preload helper；**部署时**要正确配 `publicPath`。
3. **`globalThis`** 需要 **polyfill**（IE、Safari <12.1）——core-js 只几百字节，但**必须在最前面**注入。
4. **BigInt 与 JSON**：`JSON.stringify(1n)` 抛错；后端 API 常见「ID > 2^53」→ **JSON 数字精度丢失** → 前端拿到错误 ID。**修法**：后端**输出字符串**，或前端 `JSON.parse(text, reviver)` 用 json-bigint 处理。
5. **`Intl.*` 的 ICU 数据**：Node 精简发行版**只有英文**——要开 `--with-intl=full-icu`；浏览器全部支持；移动端 Node 框架注意。
6. **`matchAll`** 需要 core-js polyfill（约 1KB）——target 老环境要注入。

细节 L10 展开。**你现在只需要记住**：**ES2020 让 JS 的日常表达式现代化——但 `?.` 与 `??` 的**语义**必须刻在脑子里，不然 `0 || 'x'` 之类的坑永远存在。**
