# L5 作业：覆盖率与工程化

## 一、知识回顾
1. 覆盖率：装 @vitest/coverage-v8（v8 vs istanbul）、coverage.include/all/thresholds(perFile)、看 branches、排除生成物；覆盖率是探针非 KPI。
2. UI/workspace：--ui 可视化；test.projects 拆多环境/monorepo；in-source；typecheck+expectTypeOf；--shard 分片、并行 fileParallelism/pool；it.debug/--inspect-brk/IDE 扩展。
3. 收官：CI 用 vitest run（禁 watch/-u）+ 缓存 + github-actions/junit reporter + retry + --changed；Jest 迁移清单；测试金字塔与选型；与 swc/biome 合成工具链全景。

## 二、代码实操
1. 给一个多 if 分支的纯函数先只测正常路径跑 `vitest run --coverage` 看 branches 未满，补边界/错误分支拉起；设 coverage.thresholds.lines 到当前值再删一条测试看退出码变红。
2. 把项目配成 projects：node 跑 `*.test.ts`、jsdom 跑 `*.dom.test.tsx`，一次 run 收两类；`vitest --ui` 打开看某条失败 diff；写一条 expectTypeOf 并开 typecheck 跑通。
3. 加一条 GitHub Actions：npm ci → vitest run --coverage（github-actions reporter + 阈值），提交一个故意失败的测试看 PR 变红；再把一段旧 jest.mock 按清单改成 vi.mock + vi.hoisted 跑通。

## 三、思考题
1. 为什么「覆盖率 100%」不等于「测好了」？你会用什么维度（四率）去判断真实缺口？
2. 一个既有多为纯逻辑、又少量组件的仓库，你会怎么设计 projects + environment 兼顾速度与正确？

## 四、延伸阅读
- vitest.dev guide/coverage、guide/projects、guide/testing-types、guide/migration/jest、guide/comparisons

## 五、自查清单
- [ ] 会开覆盖率并用 thresholds 挡 CI、不被高数字骗
- [ ] 会用 projects 拆多环境、知道 shard/并行/debug
- [ ] 说得清从 Jest 迁移的 5 个要点与坑
- [ ] 能把 SWC/Biome/Vitest 讲成一条「快」工具链故事——本包毕业
