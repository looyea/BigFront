# 选型收官：SWC / esbuild / Babel / tsc / Oxc

## 一、五方对照表

| 工具 | 语言 | 速度 | 正确性/语义严格 | 可编程性/生态 | 主用途 |
|---|---|---|---|---|---|
| SWC | Rust | 极快 | 高（含装饰器等完整语法） | Wasm 插件（Rust） | 转译+压缩，嵌 Next/Rspack/jest |
| esbuild | Go | 极快 | 中（语法子集） | JS 插件 | 打包/转译，Vite dev |
| Babel | JS | 慢 | 高（最保守） | JS 插件（生态最大） | 转译、冷门语法 |
| tsc | TS | 最慢（转译） | 唯一类型权威 | API 完善 | 类型检查 + d.ts |
| Oxc | Rust | 极快 | 上升中 | Rust（parser/linter） | 解析+lint（oxlint）+ 转型中 |

## 二、当下真实现状（怎么选）

- **在 Next.js / Rspack**：SWC 已在底下，配它≈配框架，顺势即可。
- **在 Vite**：esbuild 已占转译位，别硬塞 SWC（呼应 L2、10-vite）。
- **webpack 大仓嫌 babel 慢**：换 swc-loader，保留 webpack 生态拿速度。
- **重度依赖冷门 babel 插件**：留 Babel，或混合管线，别为快丢正确性。
- **类型检查/d.ts**：永远 tsc（vue-tsc），谁都不能替。

一句话：**转译层按打包器/框架的默认最优解走，别逆着生态硬选**。

## 三、Oxc 与 Biome 的关系前瞻

Oxc（Rust 的 parser/linter/minifier，含 oxlint/oxfmt）和 **Biome（本包 21）** 是 Rust 工具链里的「lint/format」路线代表，和 SWC 的「compile」路线**互补而非替代**——它们共享 Rust 高性能解析的底层思路，但面向的是「代码质量/格式」而非「语法降级」。SWC 专注编译器，Oxc 已把重心移到解析器与 lint。选型时别把它们放同一格里比。

## 四、毕业自查 12 条

1. 能三句讲清 SWC 是什么、为什么快、你在哪些工具里已经在用它。
2. 会写 `.swcrc` 的 jsc/module/env/minify 四区，说清 env.targets 与 jsc.target 谁优先。
3. 知道 SWC 只擦类型不查，类型归 tsc。
4. 会配 automatic/classic JSX 与 importSource。
5. 会用 transform/transformSync/transformFile 并正确落 source map。
6. 能诊断 optionalDependencies 平台二进制的跨机器故障。
7. 知道 webpack/Rspack/Next/Vite 各自转译层归属。
8. 会开 minify 并理解 compress/mangle/format 与假设清单。
9. 装饰器能按 legacy/标准正确配、对齐 tsconfig。
10. 明白 loose/interop 的正确性边界，会做产物 diff 排错。
11. 能用 @swc/jest 换测试引擎、配 decoratorMetadata、选 v8 覆盖率。
12. 会打库（SWC 出 JS + tsc 出 d.ts）、按 exports/sideEffects 规范发包。

## 五、本包没讲、但你该知道（回文档入口）

按宗旨，我们刻意没展开：**Wasm 插件深水区**（Rust AST 改写、StructVisitor）、**swc_css**（实验性 CSS 解析/压缩）、**@swc/ast / types 包**（自建工具才碰）、Flow 完整支持、spack 打包器现状。需要时去 `swc.rs/docs` —— 尤其 `plugin/ecmascript/getting-started`、`references/wasm-typescript`、`configuration/compilation` 三页。你已经掌握主干，细节只是按需查阅的事。

## 小结
五方对照：SWC 快且语法全、esbuild 快但子集、Babel 保守生态大、tsc 类型权威、Oxc 走 lint/parse；转译层按框架默认最优选、别逆生态；Oxc/Biome 是质量路线与 SWC 编译路线互补；毕业自查 12 条覆盖配置-API-集成-正确性-测试-发包；未讲的插件/css/ast 深水区回 swc.rs/docs 按需查。

## 部署预告
给自己出一份「选型决策卡」：正面写上面 12 条自查，反面写「什么栈选什么转译层」的判断树。然后用它向一位同事 5 分钟讲清「我们要不要在 webpack 项目里引入 SWC、风险是什么」，讲不清的地方就是你还得回文档补的点。
