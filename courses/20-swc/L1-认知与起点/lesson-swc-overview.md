# SWC 是什么：本教程的覆盖边界

## 一、一句话定位

SWC（Speedy Web Compiler）是用 Rust 写的 JavaScript/TypeScript **编译器 + 压缩器**：把 TS/JSX/新语法转成目标 JS，再把产物 minify。它的卖点是一个字——**快**：官方基准里单文件转译比 Babel 快数十倍、比 tsc 的 transpile 快约二十倍，因为核心逻辑没有跑在 Node 上，而是编译成原生二进制。

## 二、你其实早就在用它

即便从没直接 `npm i @swc/core`，你多半已经在用 SWC：Next.js 从 v12 起默认用它替换 Babel；Rspack 的 transform 内核就是 SWC；`@swc/jest` 让 Jest 甩掉 babel-jest。理解 SWC = 理解这一整条 Rust 工具链的地基。

## 三、SWC 与 esbuild / tsc 的三角

- **esbuild**（Go）：更快但特性子集小、插件是 JS——Vite 的 dev 预构建/TS 转译用它（呼应 10-vite）。
- **tsc**（JS）：类型检查唯一权威，transpile 慢。
- **SWC**（Rust）：转译 + 压缩 + 更完整的语法覆盖 + Wasm 插件，正确性介于两者与 Babel 之间。

## 四、本教程覆盖什么、不覆盖什么（重要）

**这不是一份文档的逐页翻译。** SWC 官方文档有几十页配置项、完整的 AST 包、Wasm 插件深水区、尚在实验的 CSS 解析器等——我们**不展开**这些。我们只锁定主流应用必经的**主干流程**：

1. `.swcrc` + CLI 把一段 TS/JSX 编出来；
2. 程序化 API 与打包器/框架集成；
3. 装饰器等现代语法的正确姿势；
4. 从 Babel 迁移与排错；
5. 选型视角（SWC/esbuild/Babel/Oxc 各站什么位）。

学完十五关，你要能**独立把一个新项目的转译/压缩/测试链路搭起来并排错**，而不是背下每个配置字段。细节永远回官方文档查——我们只保证你**知道该去哪查、什么时候需要它**。

## 五、怎么学这份课

每关配课文 + 10 题小测 + 15 道带来源的面试题。以简明为主：能三句说清的不写五句。建议边读边跑 `npx @swc/cli` 的实例，把「改配置→看产物」的反馈回路建立起来。

## 小结
SWC 是 Rust 写的高速编译器+压缩器，潜伏在 Next/Rspack/jest 背后；本包不求覆盖全部文档，只求走通转译-集成-迁移-选型的主干流程——细节回官方查，但你要知道入口在哪。

## 部署预告
装一次三件套跑通最小闭环：`npm i -D @swc/core @swc/cli`，建一个含 TS + JSX 的 `src/app.tsx`，用 `npx swc src -d dist` 编出来，打开 dist 肉眼看类型去哪了、JSX 变成了什么——这就是你与 SWC 的第一次照面。
