# 选型收官：Biome vs ESLint+Prettier vs dprint

## 一、四方能力矩阵

| 维度 | Biome | ESLint+Prettier | dprint | oxlint |
|---|---|---|---|---|
| 格式化 | 内置、极快、多语言 | Prettier（成熟标杆） | 专精（多语言插件） | 无 |
| Lint | 主干内置、快 | 插件生态最全 | 无 | 快、规则增长中 |
| 性能 | 数量级快 | 慢 | 快 | 数量级快 |
| 规则生态/可定制 | 中（插件弱） | 最强 | 少（专注格式） | 中 |
| 配置成本 | 单文件零配置起手 | 双工具协调 | 中 | 低 |

## 二、什么团队怎么选

- **该全切 Biome**：新项目、受够双配置与慢 CI、以 JS/TS 为主、不依赖冷门 ESLint 插件的团队。
- **该共存（Biome 主干 + ESLint 补插件）**：重度使用框架专属/定制 lint 规则、又想要 Biome 的格式化与主干速度。
- **该留在 ESLint+Prettier**：依赖大量仅 ESLint 才有的插件、或组织已深度绑定其规则生态、迁移成本大于收益。
- **dprint**：只在意「多语言统一格式化」且不需要 lint 时的轻量选择。

## 三、Rust/TS 新工具链全景

把本专题三包连起来看：**20-swc 管编译（转译+压缩）**、**21-biome 管代码质量（格式+lint）**、**22-vitest 管测试**。它们共享「Rust/原生 + 快」的底层哲学，正分别蚕食 Babel、ESLint+Prettier、Jest 的地盘。oxlint 则是「只做 lint 的快工具」，与 Biome 在 lint 维度竞争。选型时把它们当一张图，而非孤立工具。

## 四、毕业自查 12 条

1. 讲清 Biome 是什么、快在哪、和 Rome 关系。
2. 会 init + 第一条 biome check 并解释退出码。
3. 写得出 biome.json 四大分区与 files 范围控制。
4. 能把 Prettier 选项逐项映射到 formatter。
5. 会开 organizeImports 并处理与 IDE 的冲突。
6. 懂 // biome-ignore 强制理由与可审计纪律。
7. 说清六大规则 group 定位、recommended vs all。
8. 明白 correctness 整组常开、与 tsc 互补。
9. 会用 @biomejs/migrate 并诚实评估覆盖度/共存。
10. 会配 CI（biome ci + --error-on-warnings）与 lint-staged。
11. 能做 monorepo 分层配置 + overrides。
12. 能画四方矩阵并给团队给出全切/共存/留守的建议。

## 五、本包没讲、但你该知道（回文档入口）

按宗旨刻意没展开：**每条规则的完整清单与细则**（回官方规则索引逐条查）、**vcs 集成深挖**、**LSP/编辑器协议细节**、**即将成型的插件 API**。需要时去 `biomejs.dev`：getting-started、reference/configuration、reference/cli、guides/migrate-eslint-prettier 四页是你最常回的地方。主干已通，剩下的都是按需查阅。

## 小结
四方矩阵：Biome 单文件快覆盖主干但插件弱、ESLint+Prettier 生态最全但慢、dprint 专注格式、oxlint 快 lint；按「是否依赖冷门插件/是否新起项目」定全切/共存/留守；Biome(质量)+SWC(编译)+Vitest(测试)构成 Rust/TS 新工具链全景；毕业自查 12 条覆盖认知到选型；未展开的规则清单/vcs/插件回 biomejs.dev 按需查。

## 部署预告
用一页纸给你的团队写一份「Biome 采纳决策」：贴四方矩阵、标出你们现在 ESLint/Prettier 的痛点、列出「必须保留的 ESLint 插件」、给出「全切 / 共存 / 留守」结论与迁移步骤。讲不清的那格，就是你还要回文档补的点。
