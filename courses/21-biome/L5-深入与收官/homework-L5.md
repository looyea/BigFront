# L5 作业：深入与收官

## 一、知识回顾
1. 快的四来源（Rust/共享解析/并行/daemon）、万级仓数量级差、速度改变工程习惯、变慢先查范围与 I/O。
2. 自定义插件 experimental 别指望、配置即策略、真实缺口用确认→ESLint 补丁→codemod 绕、CSS/GraphQL 成熟度、盯 nursery/v2。
3. 四方能力矩阵、全切/共存/留守判断、Biome+SWC+Vitest 工具链全景、毕业自查 12 条、回文档入口。

## 二、代码实操
1. 在最大仓库分别计时 `eslint .` + `prettier --check .` 与 `biome check .` 做前后对比表；去掉一个 ignore 扫 dist 观察耗时飙升。
2. 列「希望有但 Biome 没有」的规则清单，逐条查证是换名/真缺/该用 codemod，对真缺的写明「保留哪个 ESLint 插件」，画出终态蓝图。
3. 写一页「Biome 采纳决策」：贴四方矩阵、标现有 ESLint/Prettier 痛点、列必须保留的插件、给出全切/共存/留守结论与步骤。

## 三、思考题
1. 「速度改变行为」具体改变了你团队哪些回避检查的习惯？
2. 为什么「等 Biome 全支持再迁」往往是陷阱？

## 四、延伸阅读
- guides/investigate-slowness、blog/biome-v2、reference/environment-variables
- 预告全景：20-swc（编译）、22-vitest（测试）

## 五、自查清单
- [ ] 能讲清 Biome 快的四个来源并做一次真实前后计时
- [ ] 对自定义插件/CSS 成熟度有诚实预期、用补丁思路处理缺口
- [ ] 能从四方矩阵给出全切/共存/留守的团队建议
- [ ] 清楚本包没讲的规则清单/vcs/LSP/插件回 biomejs.dev 查
