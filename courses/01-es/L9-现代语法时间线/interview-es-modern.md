# 面试题 · 现代 JS 全景

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）说出 ES2020 → ES2025 每年最重要的一个特性。**
- 参考要点：ES2020（`?.` + `??`）、ES2021（`??=` / `replaceAll`）、ES2022（Class `#field` / Top-level await）、ES2023（`toSorted` / `with` 不可变数组）、ES2024（`Object.groupBy` / `Promise.withResolvers`）、ES2025（Iterator Helpers）。
- 来源：TC39 proposals 仓库；2ality 年度总结；Node.js changelog。

---

**2）`structuredClone` 能不能完全替代 `_.cloneDeep`？**
- 参考要点：**大部分能**——纯 JSON 类数据完美。但**不支持**：函数、DOM 节点、Symbol、WeakMap/WeakSet、Error（保留 message/stack，丢自定义字段）、类实例（变普通对象）、Proxy。lodash `cloneDeep` 可配 `_.cloneWith` 处理特殊类型。
- 来源：MDN structuredClone；lodash 文档；StackOverflow。

---

**3）`Object.groupBy` 与手写 `reduce` 分组相比优势是什么？**
- 参考要点：① 可读性（语义直接）；② **返回值原型 null**（避免 proto 污染）；③ 引擎内部优化（单遍历）；④ 不需要手写 `acc[key] ??= []`。
- 来源：TC39 groupBy 提案动机；MDN。

---

**4）ES2025 Iterator Helpers 能解决什么性能问题？**
- 参考要点：`arr.filter(fn1).map(fn2).slice(0, 2)` 创建 **3 个中间数组**——数据量大时 GC 压力大；迭代器 `.filter(fn1).map(fn2).take(2).toArray()` **惰性**——每个元素只处理一次、只分配最终数组。
- 来源：TC39 Iterator Helpers 提案；MDN；V8 blog。

---

**5）`browserslist` 配的是什么？对产物有什么影响？**
- 参考要点：**告诉 Babel / PostCSS / core-js / autoprefixer 你的目标环境**——"需要降级/注入哪些东西"。影响：target 越老 → 降级越多 → 产物越大；target 现代 → 几乎 pass-through。例：`last 2 versions, > 0.5%, not dead` vs `chrome >= 80` 体积差 30-50%。
- 来源：browserslist GitHub；web.dev 性能指南。

---

**6）哪些 lodash 函数已经能 100% 被原生替代？列 5 个。**
- 参考要点：`_.flatten` → `flat`；`_.toPairs` → `Object.entries`；`_.fromPairs` → `Object.fromEntries`；`_.assign` → `Object.assign`；`_.get(obj, path)` → `?.`（静态路径）；`_.has` → `Object.hasOwn`；`_.uniq` → `[...new Set()]`；`_.sortBy` → `toSorted`。
- 来源：MDN；es.dev；You-Dont-Need-Lodash-Underscore GitHub。

---

**7）`Promise.try`（ES2025）解决什么问题？**
- 参考要点：`Promise.resolve().then(fn)` 太绕、`new Promise(r => r(fn()))` 同步抛错不进 catch；`Promise.try(fn)` **一行**——不管 fn 同步 throw 还是返回 rejected Promise，都统一变成 rejected Promise。
- 来源：TC39 promise-try 提案；MDN；Vite 源码使用。

---

**8）什么是 `toSorted` / `with`（ES2023）？为什么需要？**
- 参考要点：`sort / reverse / splice` **原地改变**数组——在 Redux reducer 里得 `[...arr].sort()` 麻烦。ES2023 给了**不改变原数组**的版本：`toSorted` / `toReversed` / `toSpliced` / `with(index, val)`。函数式编程 + 不可变更新友好。
- 来源：TC39 change-array-by-copy 提案；MDN。

---

**9）Top-Level Await 与 `Promise.try` 能一起用吗？target 要求？**
- 参考要点：可以——TLA 需要 ESM + target esnext；Promise.try 需要 Node 17+ / Chrome 94+ / Firefox 93+。两者一起用要确认打包 target 支持；webpack 5 `experiments.topLevelAwait: true`。
- 来源：Node.js；webpack 文档。

---

**10）`globalThis` / `Object.hasOwn` / `Array.at` 这些「小 API」为什么也需要 polyfill？**
- 参考要点：它们是**运行时 API**（不是语法），Babel 无法降级——只能靠 core-js 注入 polyfill。老环境没有它们 → `TypeError: Object.hasOwn is not a function`。体积代价：每个几百字节，但需要逐个检测。
- 来源：MDN；core-js GitHub；@babel/preset-env 文档。

---

**11）如何在不引 lodash 的项目里实现 `debounce`？写 5 行以内。**
- 参考要点：
  ```js
  function debounce(fn, ms) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }
  ```
  **追问**：`throttle` 呢？加 flag + 时间戳。
- 来源：MDN；多份中文八股；You-Dont-Need-Lodash。

---

**12）ES2015 → ES2025，语法演进对构建工具产生了什么连锁影响？**
- 参考要点：① **ESM 标准化** → Rollup / Vite 诞生（基于 ESM 静态分析 tree-shake）；② **可选链 / 类字段** → 旧工具（browserify）跟不上 → esbuild / SWC 崛起（快 10-100 倍）；③ **迭代器助手** → 不需要 Babel 转 → 产物更小；④ **TLA + 动态 import** → 打包器必须处理异步 chunk 加载。
- 来源：vite.dev；esbuild 博客；Rollup 文档；TC39 时间线。

---

**13）现代项目里 polyfill 和 transpile 的边界怎么划？谁负责「新内置对象」？**
- 参考要点：语法级（?.、TLA、class fields）只能靠 **transpile**（esbuild/SWC/babel 按 browserslist 降级）；内置对象/方法级（Promise、at、structuredClone、iterator helpers）才是 **polyfill**（core-js/polyfill.io 自建；ES2015+ 新 Symbol.iterator 挂载点 polyfill 可行，Proxy 无法模拟语言行为——它改对象语义）。构建器分工：Vite 用 esbuild 打语法糖、browserslist+`optimizeDeps`，老机型兜底靠 `@vitejs/plugin-legacy` 双 bundle。运行时检测优先 feature detect（caniuse 数据源）而非 UA。
- 来源：Vite 文档《Build Target / legacy plugin》；MDN polyfill 定义 + tc39-shims（es-shims）工作组 README。

---

**14）ES6 之后标准演化流程变了什么？「每年一版」对开发者意味着什么？**
- 参考要点：2015 大版后转 **ES2016 起年度定版**：TC39 五阶段（提案→文档→评审→Stage-4 入册）+ 「shipped first」——浏览器先实现、spec 后固化，特性以「年份包」发布（ES2020 可选链...ES2025 迭代器助手）。影响：查兼容不再「ES几支持吗」而是 **按特性查 caniuse**；构建 target 按实际用户基线而不是「最新」；库发布用 exports/engines 声明下限。面试点：能报出每年代表特性 + 说清 stage 流程即可。
- 来源：TC39《Adding languages features》流程文档；ecma-international ES2016-2025 版本公告。

---

**15）团队要「原生化去 lodash」，你的落地审计流程是什么？**
- 参考要点：1) browserslist 定基线 + eslint（ecmaVersion/targets、unicorn 插件）硬约束语法层；2) 扫描替代映射表：debounce/throttle→自写 15 行、cloneDeep→structuredClone、groupBy→Object.groupBy、get→?.+??、isEqual→按需（无原生全等，保留或用 fast-deep-equal）；3) bundle 分析（rollup-plugin-visualizer/size-limit）量化体积收益，按包入口 `lodash-es` 摇树先止血；4) polyfill 兜底（core-js 对应方法白名单）+ 兼容测试（BrowserStack 最低版本）；5) codemod（jscodeshift）批量改写 + 回归。产出是 checklist 不是信仰。
- 来源：You-Dont-Need-Lodash-Underscore 仓库对照表；esbuild/size-limit 文档。
