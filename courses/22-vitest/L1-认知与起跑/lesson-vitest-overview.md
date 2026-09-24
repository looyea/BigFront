# Vitest 是什么：本教程的覆盖边界

## 一、一句话定位

Vitest 是**面向 Vite 生态、以「快」和「即时反馈」为核心的测试框架**：它直接复用你项目里已有的 Vite 配置与转换管线（插件、别名、TS/JSX），无需 Babel/额外 transform 就能测 TS/JSX/Vue/Svelte；watch 模式下像 HMR 一样「改一行自动重跑相关用例」。它是当下前端（尤其 Vite 项目）单元测试的默认选择。

## 二、和 Jest 的关系

Vitest 有意做成 **Jest 兼容 API**（describe/it/expect/vi.mock 对应 jest.*），从 Jest 迁移成本很低；但它**原生支持 ESM 与 TS**（走 Vite/esbuild，不需 babel-jest），启动与增量都快得多。可以理解为「享受 Jest 生态熟悉度、又拿 Vite 原生速度」。呼应 **10-vite** 里的 vite-vitest 入门关。

## 三、能力全景（主干，非全部）

单元测试、异步/定时器测试、参数化、快照、函数/模块 mock、组件测试（Vue/React）、网络层 mock（MSW）、覆盖率、UI 模式、workspace 多项目、类型测试（typecheck）。这些是我们要走的「主流测试流程」。

## 四、本教程覆盖什么、不覆盖什么（重要）

**这不是一份 API 逐条手册。** Vitest 有几十条 expect 匹配器、上百个 config 项、尚在发展的 browser mode、各类 reporter 细节——我们**不逐一展开**。我们只锁定主干：**单元测试、mock、异步、组件测试、覆盖率、CI 接入**六条线走通。学完十五关你要能**独立给一个 Vite 项目搭起完整测试体系并接进 CI**，而不是背下每个 matcher。细节永远回 vitest.dev 查——我们保证你知道**该去哪查、什么时候需要**。

## 五、怎么学

每关课文 + 10 题小测 + 15 道带来源面试题，简明为主。强烈建议边读边跑：`npm i -D vitest` 后开 watch 模式，把「写断言→看即时红绿灯」的反馈回路建起来。它和 **20-swc（编译）、21-biome（质量）** 共同构成本专题的 Rust/TS 新工具链全景。

## 小结
Vitest=复用 Vite 管线的快测试框架、Jest 兼容 API 但原生 ESM/TS 免 Babel、watch 即时反馈；本包不求逐条讲 matcher/config，只求走通单元-mock-异步-组件-覆盖率-CI 主干，细节回 vitest.dev 查，与 SWC/Biome 合成工具链全景。

## 部署预告
在一个 Vite（或纯 TS）项目 `npm i -D vitest`，package.json 加 `"test": "vitest"` script，写一个 `sum.test.ts`（`expect(sum(1,2)).toBe(3)`），跑 `npm test` 进 watch 模式，改一下 sum 的实现看它如何秒级重跑——这就是你和 Vitest 的第一次照面。
