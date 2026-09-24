# 面试题：Vitest 定位与覆盖边界（vitest-overview）

### 1. (原理类) Vitest 为什么对 Vite 项目几乎零配置？
**来源**：https://vitest.dev/guide/features.html

它直接复用项目的 Vite 配置与转换管线——插件、resolve.alias、TS/JSX 处理全都现成，无需再为测试单独搭一套 transform。测试代码走的就是应用同一套解析。

### 2. (对比类) Vitest 和 Jest 的关系与差异？
**来源**：https://vitest.dev/guide/comparisons.html

API 有意做成 Jest 兼容（describe/it/expect/jest→vi），迁移成本低；但 Vitest 原生 ESM/TS 走 Vite/esbuild 免 babel-jest、启动与增量更快、与 Vite 生态一体。可理解为「Jest 熟悉度 + Vite 速度」。

### 3. (选型类) 什么样的项目该选 Vitest？
**来源**：https://vitest.dev/guide/comparisons.html

已在 Vite 生态（含 Vue/Svelte/React+Vite）的项目几乎是不二之选。纯 Node/webpack 老项目也能用，但收益最大的是本来就有 vite.config 的团队。

### 4. (原理类) watch 模式为什么能「只重跑相关用例」？
**来源**：https://vitest.dev/guide/features.html

Vitest 基于 Vite 模块图分析依赖关系，改动一个模块后只重新运行受其影响的测试文件。这是复用模块图带来的精准增量，而非全量重跑。

### 5. (定位类) 本教程为什么不逐个讲 matcher？
**来源**：https://vitest.dev/api/expect.html

matcher 几十条、背了没迁移价值且会更新。课程锁定单元测试-mock-异步-组件-覆盖率-CI 主干，细节教你回 vitest.dev/api/expect 按需查，培养写测试的能力而非记忆。

### 6. (生态类) Vitest 能测哪些层面？
**来源**：https://vitest.dev/guide/features.html

纯函数单元测试、异步/定时器、快照、组件（Vue/React via test-utils/RTL）、网络层（配 MSW）、甚至类型测试（typecheck）与 browser mode。本包覆盖主流几条线。

### 7. (对比类) Vitest 需要 Babel 吗？
**来源**：https://vitest.dev/guide/why.html

不需要。转译交给 Vite/esbuild，TS/JSX/新语法开箱即测，免 babel-jest 及其配置地狱。这正是它比 Jest 起手更快更顺的原因之一。

### 8. (实战类) 团队从没听过 Vitest，30 秒讲清价值？
**来源**：https://vitest.dev/guide/comparisons.html

一句话：Vite 项目自带的测试框架，Jest 那套 API 但你不用配 Babel、TS 直接测、改一行秒级重跑、组件/快照/mock/覆盖率全有。用官方 comparisons 页兜底细节。

### 9. (原理类) Vitest 的「快」来自哪里？
**来源**：https://vitest.dev/guide/features.html

原生 ESM + esbuild/Vite 转译、常驻 worker 池、基于模块图的精准重跑、并行执行文件。多层叠加使它相对 Jest 尤其增量场景明显更快。

### 10. (生态类) 怎么看待 browser mode 这类新能力？
**来源**：https://vitest.dev/guide/browser.html

browser mode 让你在真实浏览器里跑组件/交互测试，是 Vitest 向「测试运行器全家桶」演进的方向。本包以 Node/jsdom 主干为主，browser mode 属收官关「没讲但知道去哪查」。

### 11. (对比类) Vitest 会做类型检查吗？
**来源**：https://vitest.dev/guide/testing-types.html

默认不做——它测运行时行为。但提供 typecheck 能力（expectTypeOf/assertType）可写「类型测试」。类型正确性主责仍是 tsc，这与 20-swc「擦类型不查」一脉相承。

### 12. (实战类) 什么情况下不该用 Vitest 而用别的？
**来源**：https://vitest.dev/guide/comparisons.html

需要跨浏览器真实端到端流程时该上 Playwright/Cypress（E2E 层），Vitest 主打单元/组件/集成。测试金字塔里各司其职，不是取代关系。

### 13. (原理类) Jest 迁移到 Vitest 通常顺不顺？
**来源**：https://vitest.dev/guide/migration/jest.html

多数很顺：globals 从 jest 换 vi、配置换 vitest.config、快照/断言 API 基本兼容。坑多在 jsdom 环境声明、部分 jest 专属 API、mock 提升语义差异。有官方迁移指南。

### 14. (定位类) 本包和 10-vite 的测试关怎么配合？
**来源**：https://vitest.dev/guide/features.html

10-vite 从 Vite 工程角度点了一句 vite-vitest 入门；本包从测试框架角度深入。同一技术、两个视角互补，学完本包能反哺你在 Vite 项目里把测试体系搭全。

### 15. (生态类) Vitest 是谁在维护、可信度？
**来源**：https://vitest.dev/guide/comparisons.html

由 Vite 核心团队（Anthony Fu 等发起）维护、随 Vite 生态演进、社区极活跃、被大量前端项目采用。评估可继续性看其发布节奏与 Vite 绑定度。
