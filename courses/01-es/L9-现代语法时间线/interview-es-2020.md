# 面试题 · ES2020

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）可选链 `?.` 与逻辑与 `&&` 的短路有什么本质不同？**
- 参考要点：`a && a.b` 只判 **truthy**——`a = 0` 时短路；`a?.b` 只判 **null/undefined**——`a = 0` 不短路（`0?.b` → undefined 因为 number 没有 b）。**关键**：`?.` 只保护「对象可能不存在」的场景，不改变真值判断语义。
- 来源：MDN Optional chaining；TC39 提案；StackOverflow 高票。

---

**2）`??` 与 `||` 分别在什么场景下用？**
- 参考要点：`||` 走**真值判断**（falsy 都走右），适合「默认值兜底 + 空字符串/0 都视为无效」的场景；`??` 走**空值判断**（只有 null/undefined 走右），适合「0 / '' / false 是**有效值**」的场景。**现代默认**：优先 `??`（更安全）。
- 来源：TC39 nullish-coalescing 提案；MDN；2ality。

---

**3）`a?.b = 1` 会发生什么？**
- 参考要点：**SyntaxError** — `?.` 不能作为赋值左侧。规范禁止这种写法（歧义：a 是 null 时该赋值给谁？）。**追问**：`a?.b.c = 1` 合法吗？— 不合法，`?.` 之后的整个链都短路；且 c 也不是 `?.`。
- 来源：ECMA-262；MDN。

---

**4）`Promise.allSettled` 与 `Promise.any` 的区别？**
- 参考要点：allSettled **等全部 settle**，返回每项状态数组，**从不 reject**；any **只要一个 fulfilled 就 resolve**，全部 reject 才抛 AggregateError。工程场景：allSettled 用于批量上报/健康检查；any 用于多 CDN 备援。
- 来源：MDN；TC39 promise-any 提案。

---

**5）BigInt 与 Number 的主要差异？**
- 参考要点：① 任意精度整数 vs IEEE 754 双精度（含小数）；② **不能混合运算**（`1n + 1` TypeError）；③ 字面量后缀 `n` 或 `BigInt(str)`；④ `typeof 1n === 'bigint'`；⑤ **不能 JSON.stringify**（要 replacer）；⑥ `Math.*` 不支持 BigInt。
- 来源：MDN BigInt；TC39 提案；Node.js 文档。

---

**6）`globalThis` 为什么需要？之前怎么跨环境？**
- 参考要点：三个环境（window / self / global）没统一入口——polyfill 库要 `(typeof self !== 'undefined' ? self : this)` 判断。**ES2020 统一**为 globalThis。**兼容性**：Chrome 71+、Node 12+；老环境靠 core-js 打补丁。
- 来源：MDN；TC39 提案；Node.js 文档。

---

**7）动态 `import()` 的返回值是什么？与静态 import 有什么本质区别？**
- 参考要点：返回 **Promise**（解析出 namespace 对象）。**本质区别**：静态 import 是**声明**（编译期分析），动态是**表达式**（运行时决定）——可以放在 if / function / 用变量拼接；打包器看到动态 import 会切**独立 chunk**。
- 来源：MDN；Node.js；webpack/Rollup 文档。

---

**8）`String.prototype.matchAll` 与旧的 while+exec 循环的差别？**
- 参考要点：
  ```js
  // 旧写法
  let m; const re = /x/g;
  while ((m = re.exec(str))) { ... }   // ⚠️ 忘记 g / lastIndex 泄漏
  // 新写法
  for (const m of str.matchAll(/x/g)) { ... }  // 返回迭代器，**不**改 lastIndex
  ```
  matchAll **必须**带 g；每次从 0 开始；支持命名捕获组。
- 来源：MDN；TC39 提案。

---

**9）`Intl.NumberFormat` 与 `toLocaleString` 的取舍？**
- 参考要点：`toLocaleString` 简单但**选项少**、结果**因浏览器差异**大；`Intl.*` 更**显式**（能配 style / currency / unit / notation 等），可缓存 formatter 复用性能更好。**生产建议**：**优先 Intl**，SSR 时确认 Node ICU 版本一致。
- 来源：MDN Intl；Node.js ICU 文档；web.dev。

---

**10）以下代码打印什么？**
```js
const user = { profile: null };
console.log(user?.profile?.name ?? '默认');
```
- 参考要点：`默认`。`user.profile` 是 null → `?.name` 短路返回 undefined → `?? '默认'` → '默认'。**追问**：换成 `||` 结果一样；但换成 `name: ''` → `??` 返回 ''（保留空串），`||` 返回 '默认'。
- 来源：MDN；StackOverflow。

---

**11）如何检测 `BigInt` 支持？**
- 参考要点：`typeof BigInt === 'function'`；**不能用** `try { BigInt(1) } catch` — 因为 BigInt **是**语法层面**存在**的（typeof 就是 'bigint'），SyntaxError 只在使用 `1n` 字面量时触发。**修**：动态 `eval('1n')` 才检测字面量支持。
- 来源：MDN；TC39 提案；caniuse。

---

**12）现场手写：用 `?.` + `??` 重写一段嵌套判空代码。**
- 参考要点：
  ```js
  // 旧
  var city = (user && user.profile && user.profile.address && user.profile.address.city) || '未知';
  // 新
  const city = user?.profile?.address?.city ?? '未知';
  ```
  **追问 1**：如果 city = 0 或 ''，旧代码会**吞**为 '未知'，新代码保留——**语义更精确**。
  **追问 2**：`user?.profile ?? defaultProfile` 与 `user?.profile || defaultProfile` 的区别？—— ?? 只在 nullish 时兜底。
- 来源：MDN；TC39 提案；StackOverflow 高票。

---

**13）dynamic import() 在工程里有哪些标准用法？它返回什么？**
- 参考要点：返回 `Promise<Module Namespace>`——静态 import 的一切（命名导出、live binding、default）都能从 ns 拿到。四大用法：① 路由/组件懒加载（框架层 split chunk）；② 条件加载（`if (needsPolyfill) await import(...)`，按 feature detect 少传字节）；③ 构建工具插件系统（运行时加载用户插件）；④ 打破循环依赖。区别于静态：不参与构建期摇树判定、可写任意 specifier（打包器会警告动态路径），副作用缓存（同 URL 只执行一次）。
- 来源：MDN《dynamic import》；web.dev《Loading code with dynamic imports》。

---

**14）Intl API 能替你干什么？为什么直接 toLocaleString 可能慢？**
- 参考要点：Intl 是标准库本地化引擎：NumberFormat/DateTimeFormat/PluralRules/RelativeTimeFormat/ListFormat/Collator（排序）/Segmenter（ES2022 分词）。坑：每次调用 `toLocaleString` 都新建 formatter——循环里格式化一万个金额会重；正解 **创建一次 NumberFormat 实例复用**（内部 ICU 查表才快）。复数规则（PluralRules select + 文案模板）是国际化文案正确性核心，字符串拼接式 i18n 在俄语/阿语必翻车。
- 来源：MDN《Intl》；Mozilla Hacks《Internationalizing numbers with Intl.NumberFormat》性能建议。

---

**15）BigInt 的现实边界：哪些地方会把它打回原形？序列化怎么办？**
- 参考要点：typeof "bigint"；与 Number 混合运算 TypeError（`1n + 1` 抛）、Math 方法全拒、JSON.stringify 直接 TypeError。序列化三选一：字符串化（`.toString()` + 解析端 BigInt()）、lossless-json 类库（按 token 拦截）、或干脆别用 BigInt 而是 decimal.js（小数场景 BigInt 也做不了除法原生精度）。适用面就是整数：雪花 ID、金额分、位运算大数；需要小数精度请上 decimal 方案。
- 来源：MDN《BigInt》"Mixed operations" 限制表；tc39/proposal-bigint FAQ 序列化讨论。
