# 模块系统深入：加载生命周期、互操作、打包

> 目标：**看懂模块从磁盘到运行时的完整生命周期**（Parsing → Linking → Evaluation）；掌握 `exports` 字段的**条件式解析**；理解 **dual-package hazard** 与 `sideEffects` 标志；会写真正 tree-shakable 的库；知道 top-level await 与 import map 的定位。

---

## 一、模块加载的三阶段生命周期

ESM 与 CJS 最本质的差别在**加载模型**。ESM 明确分三步：

```
[1] Parsing   解析：读文件、AST、收集 import/export 声明
[2] Linking   链接：沿 import 图递归加载所有依赖，把「导出」和「import 的槽位」绑定
[3] Evaluation 求值：按依赖顺序执行模块顶层代码，填充实例值
```

**关键点**：**Parsing 与 Evaluation 分离**——这就是为什么 import 会**提升**：
```js
console.log(x);   // ReferenceError（TDZ），因为 x 在链接阶段就建立了但未求值
import { x } from './m.js';   // 语法上合法（会被提升）
```

CJS 是**执行到 require 时才递归**——所以循环依赖、条件加载更常见但也更难排查。

---

## 二、循环依赖的真实行为

**ESM 通过链接阶段解决大部分循环**：a.js ↔ b.js，两个模块都能建立对方的绑定；求值时按入口 DFS，谁先求值谁就看到对方「TDZ 中」的绑定。

```js
// a.js
import { b } from './b.js';
export const a = 'A';
console.log('a 里读到 b:', b);

// b.js
import { a } from './a.js';
export const b = 'B';
console.log('b 里读到 a:', a);

// main.js: import './a.js';
```

**执行路径**：main → 链接 a → 链接 b → b 依赖 a（已链接）→ 开始求值 b（因为 a 里 first-statement 是 import b，b 是叶子先求值）→ **b 里的 `a` 是 TDZ** → **ReferenceError**。

**改成函数就没事**：
```js
// b.js
import { a } from './a.js';
export const b = () => a;   // 运行时才读，届时 a 已求值
```

**⚠️ 最佳实践**：**循环依赖不是设计**——把共享部分抽到第三个模块。TypeScript 的 `import type` 可以纯粹打破类型层的循环。

---

## 三、`exports` 字段的**条件式解析**

现代发布包的骨架：
```json
{
  "name": "my-lib",
  "type": "module",
  "exports": {
    ".": {
      "types":    "./dist/index.d.ts",       // TS 编译期
      "node":     "./dist/index.node.mjs",   // Node 环境
      "browser":  "./dist/index.browser.mjs",// 打包器
      "import":   "./dist/index.mjs",        // 通用 ESM
      "require":  "./dist/index.cjs",        // 通用 CJS
      "default":  "./dist/index.mjs"
    },
    "./package.json": "./package.json",
    "./utils": "./dist/utils.mjs"
  }
}
```

**规则**：
1. **顺序敏感**——`exports` 里字段按**从上到下**匹配，第一个命中的赢。`types` 必须放最上。
2. **未列的子路径** 消费者**不能 import**（防内部文件被误用）。
3. `node` / `browser` / `import` / `require` / `default` 是**条件（conditions）**——运行时或打包器决定用哪个。
4. **子路径导出**可以做「包内别名」：`"./utils/*": "./dist/utils/*.mjs"`。

**⚠️ 兼容老 Node**：只读 `main`——所以 `main` + `exports` 双份常见。Node 12 以下没有 exports 支持。

---

## 四、**Dual-package hazard**：同一份代码被加载两次

**症状**：库同时发布 ESM 与 CJS 版本；消费者从两条路径引入 → Node 视作**两个不同实例** → 单例状态分裂。

```js
// app.mjs
import store from 'my-lib';   // 加载 my-lib 的 ESM 版本
store.add(1);

// app.cjs
const store = require('my-lib'); // 加载 my-lib 的 CJS 版本
store.add(2);

// 结果：两个 store，各自的数组、事件监听器**独立**
```

**为什么会这样**：ESM 与 CJS 有**独立缓存**——即使 exports 都指向同一份源代码，Node 会**分别**包装一次。

**修复**：
1. **只发 ESM**（现代趋势：`type: module` 的纯 ESM 包）；
2. 只发 CJS（保守）；
3. 双发但内部再 require 到同一份「真身」（复杂）；
4. 通过 `exports` 保证两条路径解析到**同一份** `.mjs`（Node 允许 CJS 里 `await import()` ESM）。

---

## 五、`sideEffects` 字段：告诉打包器「哪些文件可安全摇光」

```json
{
  "sideEffects": false
}
```
或
```json
{
  "sideEffects": ["*.css", "./src/polyfill.js"]
}
```

**含义**：
- `false`：所有文件**无副作用**——未被 import 使用的模块可以整个跳过求值。
- 数组：列出的文件**有**副作用（CSS 加载、polyfill 注册），必须保留。

**为什么重要**：Rollup / webpack 5 光靠「未使用导出」判定 tree-shaking 不够——如果**顶层代码有 console.log / 全局赋值 / addEventListener**，摇掉就破坏行为。`sideEffects: false` 明确给打包器**许可**大胆摇。

**⚠️ 别乱标 `false`**：CSS import 被摇没了 是这个字段的经典事故。

---

## 六、`cjs-module-lexer`：ESM 静态导入 CJS 的具名是怎么识别的？

Node 在 ESM 里 `import { readFile } from 'fs'` 时——fs 是 CJS——**它怎么知道具名叫 readFile**？答案是 **`cjs-module-lexer`**：

1. Node 加载 CJS 时**静态扫描源码**（不执行）——识别 `exports.foo = ...` / `module.exports = { foo, bar }` 等**已知模式**；
2. 生成**具名导出列表**，暴露给 ESM 层；
3. 匹配不到就**只暴露 default**——`import fs from 'fs'` 总行得通。

**⚠️ 反例**：`Object.assign(exports, dynamicObj)` 认不出——只能 `import * as fs` 或 default。

---

## 七、`createRequire`：ESM 里过渡性地用 require

```js
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const pkg = require('./config.json');           // ESM 加载 JSON 要 import attributes，走 require 更省事
const legacy = require('some-old-cjs-package'); // 有些包只有 CJS 且**同步**用法
```

**适用场景**：过渡期、加载 JSON / .node 二进制模块。**新代码不推荐**——用 `import ... with { type: 'json' }` 或 `fs.readFileSync`。

---

## 八、**Import Attributes**（`with`）与 Import Maps

**Import Attributes**（ES2025 落地，Node 20.10+ 支持）：
```js
import config from './config.json' with { type: 'json' };
import data from './data.txt' with { type: 'text' };
import css from './styles.css' with { type: 'css' };   // 浏览器实验
```
——给 import 加**元信息**，告诉运行时**怎么解析这个非 JS 资源**。老写法 `assert { type: 'json' }` 已废弃。

**Import Maps**（浏览器原生，Node 通过 `--import` / `--experimental-loader`）：
```html
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18",
    "@app/": "/src/"
  }
}
</script>
<script type="module">
  import React from 'react';        // 通过 map 解析
  import util from '@app/util.js';   // 前缀映射
</script>
```
——**浏览器里裸导入**（bare specifier）的官方解药；不再需要打包器也能用 `import 'react'`。

---

## 九、顶层 `await`（ES2022）

```js
// config.js
export const config = await fetch('/api/config').then(r => r.json());

// main.js
import { config } from './config.js';
console.log(config.theme);   // 已就绪，不用 await
```

**能力**：模块**顶层**直接 await——依赖它的模块**自动等它完成**。

**⚠️ 陷阱**：
1. **阻塞**整个依赖链——一个网络请求卡住 → 全站卡；
2. 打包器与部分运行时需要 target 支持（Node 14.8+，Safari 15+）；
3. **循环依赖 + TLA** = 死锁风险。

**适合**：polyfill、feature flag 探测、WASM 加载。**不适合**：普通业务数据。

---

## 十、写 tree-shakable 库的**六条军规**

1. **具名导出**，不要 default——`export { a, b }` 让摇得动；`export default { a, b }` 一个整体。
2. **顶层无副作用**：不要 `window.X = ...` / 全局注册；副作用文件单独走 `./register` 子路径。
3. **`sideEffects: false`**（或列白名单）——给打包器许可。
4. **`exports` 字段齐全**：`import` / `require` / `types`。
5. **别用 `export * from`**（除非确认下游 Rollup 能摇）——用**明确** `export { a, b } from './inner.js'`。
6. **每个 API 独立文件**（lodash-es 风格）——让「用户只用 debounce」的场景能摇掉 90% 代码。

---

## 十一、自检清单

- [ ] 说出模块加载三阶段，各自做什么。
- [ ] 解释为什么 ESM 允许部分循环依赖，但 CJS 常常炸得莫名其妙。
- [ ] 什么是 dual-package hazard？给一个复现方式。
- [ ] `sideEffects: false` 敢不敢随手加？为什么？
- [ ] `import config from './c.json' with { type: 'json' }` 与 `require('./c.json')` 的取舍。
- [ ] 用 exports 字段配置一个「Node 用 fs/promises，浏览器用 IndexedDB」的库。

---

## 🚀 部署预告（本关点到，细节在 L10）

**这一关**就是**部署关的预备役**——把每一层的构建/部署含义串起来：

1. **tree-shaking 的**成败**决定**产物体积**：`exports` + `sideEffects` + 静态 ESM → Rollup 摇得干净；配 CJS 或含副作用的顶层代码 → 全部保留。**同一份源码，配置差异让 bundle 大小差 3-5 倍**很常见。
2. **代码分割**依赖**动态 import**：Vite / webpack 把 `import()` 目标切成**独立 chunk**，配合 `<link rel="modulepreload">` 与 HTTP/2 服务器推送。**部署时**：chunk 命名带 hash（`[name].[contenthash].js`）→ 长期缓存 → 版本上线只替换 index.html。
3. **sourcemap 与 chunk**：分割越碎，`sources` 路径映射越复杂；构建时 `sourcesContent` 内嵌源码 or 上传 `.map` 到 Sentry 都要**保证相对路径**与产物一致。
4. **polyfill 加载策略**：`core-js` 通过 `browserslist` + `@babel/preset-env` 的 `useBuiltIns: 'usage'` **按需注入**——部署时是**独立 chunk** 还是打入 vendor 要权衡。
5. **CDN 与 import map**：现代静态站可以**不用打包**——`<script type="module">` + import map + CDN（esm.sh / unpkg / jsDelivr）直接跑，**部署 = 上传静态文件**；这是**无构建**（build-less）方向。
6. **发布协议**：npm 包的 `exports` 是**给消费者 Node / 打包器读**的——发布前一定要跑 `publint`（`npx publint`）验证，否则消费者装完发现 `Cannot find module` 就晚了。

细节 L10 `es-build` 与 `es-publish` 全面展开。**你现在只需要记住**：**模块系统是「源码」与「产物」之间的桥梁——理解了 exports / sideEffects / 动态 import，就理解了打包器的世界观。**
