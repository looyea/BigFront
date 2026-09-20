# L4 · ES Modules：import 与 export

> 🎯 目标：理解「一个文件就是一个模块」，分清默认导出与命名导出，看懂本项目 `package.json` 里 `"type": "module"` 的意义。

## 一、模块化的意义

模块化 = 把代码拆成**高内聚、可复用、互不污染**的文件。每个模块有自己的作用域，只有显式 `export` 的东西才能被外界 `import`。这解决了早期脚本"全局变量满天飞"的问题。

## 二、三种导出 / 导入写法

`math.js`：

```js
export const PI = 3.14159;              // 命名导出
export function area(r) {               // 命名导出
  return PI * r * r;
}
export default class Circle {}          // 默认导出（每文件最多一个）
```

`app.js`：

```js
import Circle, { PI, area } from './math.js'; // 默认导出可随意命名
import { PI as pie } from './math.js';        // 重命名避免冲突
import * as math from './math.js';            // 整体作为命名空间对象
```

## 三、默认导出 vs 命名导出，用哪个？

- **命名导出**更推荐：IDE 能自动补全、重构安全、导入名一致。
- **默认导出**适合"一个模块就一个主角"（如一个 React/Vue 组件文件）。

## 四、ESM vs CommonJS（历史包袱，务必分清）

Node 世界有两套模块系统：

| | ESM（新） | CommonJS（旧） |
| --- | --- | --- |
| 导出 | `export` / `export default` | `module.exports` / `exports.x` |
| 导入 | `import` | `require()` |
| 后缀 | `.mjs` 或 `"type":"module"` 下的 `.js` | `.cjs` 或默认 `.js` |

本项目后端 `package.json` 写了 `"type": "module"`，所以可以直接用 `import`。老项目里你会经常看到 `require`，二者不能混用同一套语法。

## 五、模块是单例

同一个模块无论被 `import` 多少次，只初始化一次，共享同一份状态：

```js
// counter.js
export let count = 0;
export const inc = () => ++count;

// a.js 和 b.js 都 import { count, inc }
// 它们看到的是【同一个】 count
```

这也是 Vuex/Pinia、Redux 等状态库能"全局共享一份状态"的底层原理。

## 六、动手示例

- `es-module/main.js` + `es-module/logger.js` —— 一个可运行的双模块示例

```bash
node courses/01-es/examples/es-module/main.js
```

完成「本关小测」+ `homework/L4.md`，L5 异步马上到。
