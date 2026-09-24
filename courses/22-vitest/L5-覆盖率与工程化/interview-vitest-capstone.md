# 面试题：CI 与 Jest 迁移收官（vitest-capstone）

### 1. (实战类) GitHub Actions 跑 Vitest 的最小步骤？
**来源**：https://vitest.dev/guide/reporters.html

actions/checkout → setup-node（cache:npm）→ npm ci → npx vitest run --coverage。用 --reporter=github-actions 把失败贴进 PR diff、或 junit + upload-artifact。关键是 CI 里永远 run、不 watch、不 -u。

### 2. (实战类) CI 里怎么给 Vitest 提速？
**来源**：https://vitest.dev/config/changed.html

缓存依赖（setup-node cache）；--changed 只跑受影响用例；过大套件用 --shard 分到多机矩阵并行；配 pool/maxWorkers 榨本机 CPU。同时开 github-actions reporter 让失败一眼定位。

### 3. (对比类) Vitest、Jest、Playwright 怎么分工？
**来源**：https://vitest.dev/guide/comparisons.html

Vitest：Vite 生态的单元/组件/集成（快、TS 原生）。Jest：非 Vite 老 Node/webpack 项目仍稳、生态成熟。Playwright/Cypress：跨浏览器端到端真实用户流程。三者按测试金字塔分层、不是互相取代。

### 4. (实战类) 从 Jest 迁移的核心清单？
**来源**：https://vitest.dev/guide/migration/jest.html

jest.* → vi.*（mock/fn/spyOn/timers）；jest.config → vitest.config（testEnvironment → environment）；删 babel-jest/ts-jest 交给 Vite；jest.mock 工厂外部引用改配 vi.hoisted；快照本地跑一次重建基线并 review。

### 5. (坑类) 全局 jest→vi 替换最容易漏什么？
**来源**：https://vitest.dev/guide/migration/jest.html

漏掉 jest.fn/jest.spyOn 之外的冷门 API、以及 mock 提升语义差异（vi.mock 引用顶层变量要用 vi.hoisted，否则 undefined）。globals 声明、setupFiles 路径、environment 也要一并改，别只 sed 替换 jest.。

### 6. (对比类) mock 语义在迁移里要注意什么？
**来源**：https://vitest.dev/guide/mocking/modules.html

jest.mock 与 vi.mock 都自动提升，但 Vitest 原生 ESM：默认导出写成 default、工厂引外部变量必须 vi.hoisted、路径必须可解析。jest 里一些 CJS 习惯（随意 mock 未装模块）在 Vitest 会报错。

### 7. (坑类) 快照迁移过来会掉坑吗？
**来源**：https://vitest.dev/guide/learn/snapshots.html

多数兼容、重跑 -u 建新基线即可。坑在：序列化细节（DOM/自定义对象格式）可能有出入、内联快照位置、以及 CI 禁更新。迁移后务必人工核对新 .snap，别一把梭 -u 把回归当基线。

### 8. (原理类) transform/babel 配置迁移后怎么处理？
**来源**：https://vitest.dev/guide/migration.html

大多可直接删——Vitest 用 Vite/esbuild 转译 TS/JSX/新语法，不再需要 babel-jest 或 ts-jest 及一堆 transform 映射。若原本靠 babel 插件做特殊转换，需用等价的 Vite 插件替代。

### 9. (实战类) 失败重跑(retry)和 bail 分别何时用？
**来源**：https://vitest.dev/config/retry.html

retry 给偶发 flaky 用例自动重跑次数、避免一次抖动就红整条流水线；bail 是「失败 N 个就整体停」快速止损。retry 是止血带、别用它长期掩盖真 flaky，要根因修。

### 10. (实战类) CI 用哪个 reporter 让 PR 最好读？
**来源**：https://vitest.dev/config/reporters.html

github-actions reporter 直接把失败以注解落在出错的代码行；或 junit reporter 产出 XML 传给测试报告/PR 评论插件。搭配 coverage 的 text/lcov，红在哪、掉多少一目了然。

### 11. (对比类) 测试金字塔该怎么排这三层工具？
**来源**：https://vitest.dev/guide/comparisons.html

底层海量「单元」（纯逻辑，Vitest node，最快最多）→ 中层「组件/集成」（Vitest+jsdom+RTL/MSW）→ 顶层少量「E2E」（Playwright 真浏览器关键流程）。越往上越少越慢越脆，比例别倒过来。

### 12. (实战类) 怎么只跑变更相关用例来加快 CI？
**来源**：https://vitest.dev/config/changed.html

vitest run --changed=origin/main 基于 diff + 模块依赖图只跑受影响测试，PR 门禁阶段用它秒级反馈；合并前或夜间仍跑全量 + 覆盖率阈值兜底，别用增量代替全量门。

### 13. (坑类) 迁移后报 document is not defined / 全局找不到？
**来源**：https://vitest.dev/guide/migration/jest.html

多半是把 Jest 的 testEnvironment:jsdom 习惯漏了——Vitest 默认 node，组件测试要设 environment:jsdom（或 per-file 注解）。用了 globals 又漏配 tsconfig types 则 expect/describe 类型报错。

### 14. (定位类) 本包没讲但你毕业该知道去哪查？
**来源**：https://vitest.dev/guide/features.html

browser mode（真浏览器跑组件/交互）、快照解析器全表、自定义 reporter、benchmark、extending-matchers 等。核心是「主干流程已通、剩余按官方文档按需查」，本包刻意不求全。

### 15. (实战类) 怎么把 20-swc/21-biome/22-vitest 讲成一条工具链故事？
**来源**：https://vitest.dev/guide/why.html

编译层 SWC 把 TS/JSX 快速变 JS，质量层 Biome 一把梭格式化+Lint，测试层 Vitest 复用同样的转换管线跑即时测试。三者 Rust/TS 新工具链，共同点是一个字——快，且都吃 Vite/ESM 生态红利。
