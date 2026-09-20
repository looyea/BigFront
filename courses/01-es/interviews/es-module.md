# 面试题 · ES Modules：import 与 export

1. **ESM 与 CommonJS 的核心区别？**（几乎必问）
   | 维度 | ESM | CJS |
   | --- | --- | --- |
   | 语法 | import/export | require/module.exports |
   | 加载时机 | **静态**分析、编译期确定依赖 | 运行时动态 |
   | 值绑定 | **实时只读引用**（live binding） | 值拷贝（快照） |
   | this | undefined | module.exports |
   | 顶层 await | 支持 | 不支持 |
   | Tree-shaking | 可 | 难（需额外分析） |

2. **默认导出与命名导出怎么选？**
   - 命名：更明确、便于 IDE 自动导入、便于重命名重构、鼓励一个模块暴露多能力。
   - 默认：适合「一个模块就是一个东西」（如 React 组件类）。现代工程**优先命名**。

3. **import 是值拷贝还是引用？**
   **只读引用的活绑定**。导出方重新赋值 `let counter`，导入方能立即看到最新值。但你**不能**在导入方修改（会 TypeError）。

4. **循环依赖怎么办？**
   ESM 通过「活绑定 + 编译期提升」能处理一部分循环，但仍可能拿到 undefined（TDZ）。工程做法：重构模块层级、把公共部分抽到第三个模块。

5. **什么是 tree-shaking？为什么 ESM 更适合？**
   删掉未使用的导出。ESM 的 import/export 在**编译期就固定**，工具可以静态分析「谁没被用到」。CJS 的 require 是运行时表达式，工具难以确证。

6. **动态 import() 有什么用？**
   返回 Promise，可按需加载模块（懒加载、路由分割、条件加载 polyfill）。是 ESM 中唯一能「运行时决定路径」的入口。

7. **package.json 里 "type": "module" 的作用？**
   告诉 Node：本包内 `.js` 文件按 ESM 解析。不加则按 CJS，除非用 `.mjs` 后缀。
