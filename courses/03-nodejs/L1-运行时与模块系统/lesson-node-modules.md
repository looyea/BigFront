# CommonJS 模块：require、导出与加载缓存

> 目标：彻底搞懂 Node 用了十几年的默认模块系统 **CommonJS（CJS）**——`require`/`module.exports` 到底做了什么、为什么每个文件变量互不干扰（模块包装函数）、`require` 的**解析算法**与**缓存机制**、`exports` 与 `module.exports` 的经典陷阱、循环依赖会发生什么。这是理解下一关 ESM、以及"为什么 `require('./x')` 不用写扩展名"的地基（呼应 node-basics 第九题、node-esm-cjs、ts-modules）。

---

## 一、模块 = 一个被函数包起来的文件

上一关说过：Node 把你的文件源码塞进这样一个函数再执行（"模块包装函数"）：

```js
(function (exports, require, module, __filename, __dirname) {
  // 你的代码写在这里
});
```

所以你在文件顶层写的 `const`/`function` 都是**这个函数的局部变量**，天然隔离、不外泄（呼应 node-basics 第九题）。而 `require`、`module`、`exports`、`__dirname` 这些"好像全局"的东西，其实是**被当作参数传进来的**。理解这一点，下面所有机制都是自然推论。

---

## 二、导出的两个写法与那个著名陷阱

一个模块的对外接口就是 `module.exports` 这个对象。`exports` 只是 `module.exports` 的**引用别名**：

```js
// 等价关系（Node 内部）
var module = { exports: {} };
var exports = module.exports;   // 初始时两者指向同一对象
```

因此：

```js
// ✓ 正确：往 exports 上加属性（还是 module.exports 那个对象）
exports.add = (a, b) => a + b;

// ✓ 正确：整体替换 exports 对象
module.exports = { add(a, b) { return a + b; } };

// ✗ 经典陷阱：给 exports 重新赋值！
exports = { add() {} };   // 只是让局部变量 exports 指向新对象，module.exports 没变 → 导出为空！
```

**铁律**：要"整体替换导出"必须写 `module.exports = ...`，不能写 `exports = ...`。这是 CJS 面试第一大坑（呼应下一节 quiz）。

---

## 三、require 干了什么：解析 + 加载 + 缓存

`require('./foo')` 的完整流程：

```
1. 解析路径 RESOLVE：把 "./foo" 定位到一个真实文件/目录
2. 查缓存 CACHE：加载过就直接返回 module.exports（不再执行第二次！）
3. 加载 LOAD：新建 module 对象、包成函数执行、把 module.exports 存进缓存
```

### 解析算法（"为什么不写 .js 也能 require"）

`require(X)` 的候选顺序（简化）：

- `X` 是内置模块（`fs`、`path`、带 `node:` 前缀的）→ 直接返回；
- `X` 以 `/`（绝对）、`./`、`../` 开头，按文件解析：
  1. `X.js` → 2. `X.json`（自动 `JSON.parse`）→ 3. `X.node`（编译插件）；
- 若 `X` 是**目录**：找 `X/package.json` 的 `main` 字段 → 没有则 `X/index.js` → `X/index.json` …；
- 逐级向上找 `node_modules`：`./node_modules`、`../node_modules`、直到根（这是"依赖提升/幽灵依赖"的根源，呼应 node-npm）。

**`node:` 前缀**（`require('node:fs')`）是显式声明"用内置模块"，避免与同名 npm 包冲突——新代码推荐（呼应 node-npm）。

### 缓存：同一模块只执行一次

```js
const a = require('./counter');
const b = require('./counter');
a === b;                 // true —— 同一个 module.exports 引用
a.inc(); console.log(a.count); // 1（第二次 require 不会重新初始化）
```

缓存解释了两件事：① 模块顶层代码（副作用、单例初始化）只跑一次——所以 CJS 模块常被当**单例**用；② 想"重置一个模块的状态"在测试里要用 `delete require.cache[require.resolve('./counter')]`（呼应 node-testing 的 mock）。

---

## 四、动态与同步：CJS 的性格

`require` 是**同步、运行时**的，还能放条件里：

```js
let adapter;
if (process.env.DB === 'pg') adapter = require('./adapters/pg');
else adapter = require('./adapters/mysql');   // ✓ CJS 允许条件 require（ESM 不行，见下一关）

const name = 'pg';
require('./adapters/' + name);   // ✓ 完全动态路径（代价：打包器难以静态分析/摇树）
```

这份"灵活"正是 CJS 的优点，也是它的缺点：**因为可以动态，工具无法静态确定依赖图**，tree-shaking 难做（对比 ESM 的静态结构，呼应 10-vite 摇树、ts-modules barrel）。

---

## 五、循环依赖：CJS 的真实表现

A require B、B 又 require A 时，Node **不会死锁**，而是：先开始加载 A，A 执行到 `require('./b')` 时去加载 B，B 里 `require('./a')` 拿到的是 **A 当前"尚未执行完"的 `module.exports` 快照**（可能是不完整的 `{}`）：

```js
// a.js
exports.done = false;
require('./b');            // 去执行 b
exports.done = true;       // 回来才补上
// b.js
const a = require('./a');
console.log('b 看到 a.done =', a.done);   // false —— 拿到的是半成品 A！
```

启示：**不要在模块顶层依赖"另一个循环模块的完整导出"**；要么打破环（提取公共模块），要么把使用推迟到函数调用时（那时 A 已加载完）。ESM 的循环依赖处理不同（live binding，见下一关）。

---

## 六、CJS vs ESM 的"一眼对照"（为下一关铺垫）

| 维度 | CommonJS | ESM |
|---|---|---|
| 语法 | `require` / `module.exports` | `import` / `export` |
| 加载 | 同步、运行时 | 异步、编译期静态解析 |
| 导出 | 值的**拷贝**（快照） | 绑定的**引用**（live binding） |
| 顶层 await | ✗ | ✓ |
| `__dirname` | ✓ | ✗（需 `import.meta.url`） |
| tree-shaking | 难 | 易（结构静态） |

细节留给 **node-esm-cjs**（呼应 ts-modules 对两套系统的讲解）。

---

## 七、自检清单

- [ ] 模块包装函数的参数有哪些？为什么顶层变量不污染全局？
- [ ] `exports = {...}` 为什么会导致导出为空？正确整体替换怎么写？
- [ ] `require('./x')` 依次尝试哪些候选路径？目录怎么解析？
- [ ] 为什么 CJS 模块能当单例用？测试里想重置缓存怎么办？
- [ ] 循环依赖时后加载方拿到的是什么？如何规避？
- [ ] CJS 的"动态 require"带来什么灵活性、又牺牲了什么？

---

## 🚀 部署预告

- 本关把 node-basics 第四节"模块包装"彻底讲透；下一关 **node-esm-cjs** 讲另一套系统 ESM，以及两者混用的所有坑（`import` 一个 CJS、`require` 一个 ESM、`type:module` 切换）；
- 模块解析/`node_modules` 向上查找与"幽灵依赖"会在 **node-npm** 展开；
- "顶层副作用只跑一次 / 单例"与 **node-config** 的配置加载、**node-testing** 的 mock 缓存密切相关；
- CJS 的同步动态 vs ESM 的静态可摇树，直接连到 **10-vite** 的 tree-shaking 与 ts-modules。

下一关进入 **node-esm-cjs**：两套模块系统并存的现实。
