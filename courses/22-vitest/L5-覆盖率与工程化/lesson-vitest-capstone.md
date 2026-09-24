# CI 与从 Jest 迁移：收官

## 一、GitHub Actions 跑 Vitest

```yml
- run: npm ci
- run: npx vitest run --coverage
```

要点：**CI 永远用 `vitest run`（不给 watch、不给 -u 更新快照）**；`actions/setup-node` 的 `cache: npm` 缓存依赖；用 `--reporter=default --reporter=github-actions`（或 junit + 上传 artifact）让 PR 里直接看红；偶发不稳定用 `retry` 配置，但**别拿重跑掩盖真 flaky**。想只跑受影响用例用 `--changed`。

## 二、从 Jest 迁移清单

1. **全局**：`jest.*` → `vi.*`（`vi.mock/vi.fn/vi.spyOn/vi.useFakeTimers`）；globals 配 `test.globals` 或显式 import。
2. **配置**：`jest.config.js` → `vitest.config.ts`；环境用 `environment: 'jsdom'`（Jest 的 `testEnvironment`）。
3. **transform**：删掉 `babel-jest`/ts-jest 那套，交给 Vite/esbuild。
4. **mock 提升**：`jest.mock` 与 `vi.mock` 都提升，但工厂引用外部变量要用 `vi.hoisted`。
5. **快照**：格式基本兼容，迁移后本地跑一次 `-u` 建基线并 review diff。
官方有 `guides/migration` 对照页兜底细节。

## 三、测试金字塔与选型

- **Vitest**：单元 / 组件 / 配 MSW 的集成——快、多、覆盖逻辑主干。
- **Playwright / Cypress**：端到端、跨浏览器真实用户流程——少而关键。
- **Jest**：非 Vite 生态（重 Node/webpack 老项目）仍稳，团队熟悉即可。三者不是取代，是分层。

## 四、工具链全景（呼应 20 / 21）

至此 Rust/TS 新工具链三件套齐了：**20-swc**（编译转译）、**21-biome**（格式化 + Lint）、**22-vitest**（测试）。Vitest 甚至能借 SWC/esbuild 思路理解「快从哪来」，与 Biome 一起守「质量门 + 测试门」。

## 五、毕业自查（节选）

会搭配置并跑绿第一条；能测异步/定时器、函数/模块 mock、钩子隔离；会给 Vue/React 组件配 jsdom + RTL/test-utils 测交互、用 MSW 打接口；会开覆盖率并用 thresholds 挡 CI；能讲清从 Jest 迁移要点与本包边界。**没讲但你该知道**：browser mode、快照解析器全表、自定义 reporter——回 vitest.dev 查。

## 小结
CI 用 vitest run（禁 watch/-u）+ setup-node 缓存 + github-actions/junit reporter + retry（勿掩 flaky）+ --changed；Jest 迁移：jest→vi、jest.config→vitest.config、删 babel-jest、vi.mock 配 hoisted、快照重建基线 review；Vitest 主单元/组件/集成、E2E 交给 Playwright；与 swc/biome 合成编译-质量-测试全景；细节（browser mode 等）回官方查。

## 部署预告
给你的项目加一条 GitHub Actions：npm ci → vitest run --coverage（带 github-actions reporter 与覆盖率阈值），提交一个故意失败的测试看 PR 是否变红；再把一段旧 `jest.mock` 代码按清单改成 `vi.mock` + `vi.hoisted` 跑通，作为本包毕业礼。
