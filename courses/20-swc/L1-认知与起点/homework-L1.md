# L1 作业：认知与起点

## 一、知识回顾
1. SWC 是什么（Rust 编译器+压缩器）、为什么快、你已经在哪里用它（Next/Rspack/@swc/jest）。
2. `.swcrc` 四区（jsc/module/env/minify）；env.targets 与 jsc.target 谁优先。
3. SWC 与 esbuild / tsc 的三角分工；本教程「只走主干、不逐条讲配置」的宗旨。

## 二、代码实操
1. `npm i -D @swc/core @swc/cli`，建 `src/app.tsx`（含 TS 泛型 + JSX），跑 `npx swc src -d dist`，肉眼看类型去哪、JSX 变成什么。
2. 给同一份 `class A { x = 1 }` 分别 target `esnext`/`es2015`/`es5` 各编一遍，diff 三份产物，记录 class fields 的三种形态。
3. 建 `.swcrc` 用 `env.targets` 写一段 browserslist，对照 `package.json` 的 browserslist 确认二者一致。

## 三、思考题
1. 为什么「SWC 编译通过」不等于「类型正确」？这对 CI 配置意味着什么？
2. 既然 esbuild 更快，为什么 Next/Rspack 选的是 SWC 而不是 esbuild？

## 四、延伸阅读
- SWC 官方：getting-started、configuration/swcrc、configuration/supported-browsers
- 官方 benchmarks 页（对 Babel/esbuild 的基准口径）

## 五、自查清单
- [ ] 能三句讲清 SWC 定位与「你已在用它」的三个场景
- [ ] 会跑 `npx swc src -d dist` 并看懂产物
- [ ] 说得出 jsc/module/env/minify 各管什么
- [ ] 明确本包不逐条讲配置、细节回 swc.rs/docs
