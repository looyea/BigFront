# 面试题：选型收官（biome-capstone）

### 1. (对比类) 用一句话区分 Biome / ESLint+Prettier / dprint / oxlint？
**来源**：https://biomejs.dev/guides/getting-started/

Biome=单二进制快做格式+lint；ESLint+Prettier=生态最全但慢的双工具；dprint=专注多语言格式化、无 lint；oxlint=只做快 lint、不管格式。定位清楚才能选对。

### 2. (选型类) 什么团队该「全切 Biome」？
**来源**：https://biomejs.dev/guides/getting-started/

新项目、以 JS/TS 为主、不依赖冷门 ESLint 插件、受够双配置与慢 CI 的团队。这类项目 Biome 的零配置起手+数量级速度收益最大、代价最小。

### 3. (选型类) 什么时候该「共存」而非全切？
**来源**：https://biomejs.dev/guides/migrate-eslint-prettier/

重度使用框架专属/定制 lint 规则、又想要 Biome 的格式化与主干速度时。终态是 Biome 管格式化+通用 lint、ESLint 只跑未覆盖插件，各扬所长。

### 4. (选型类) 什么团队应留在 ESLint+Prettier？
**来源**：https://biomejs.dev/guides/migrate-eslint-prettier/

深度绑定仅 ESLint 才有的插件生态、或组织级规则已高度定制化、迁移成本明显大于收益的团队。留守不丢人，工具服务团队而非反过来。

### 5. (对比类) Biome 相对 ESLint+Prettier 最大的短板？
**来源**：https://biomejs.dev/reference/configuration/

规则生态广度与可定制性：ESLint 十几年插件是护城河，Biome 自定义插件仍实验。快和统一是它的长板，长尾覆盖与私有规则是短板。

### 6. (原理类) 为什么说速度会改变行为而不只是省时间？
**来源**：https://biomejs.dev/guides/big-projects/

慢让人回避全量检查、只检改动，长期一致性打折；快到无感后，保存即格式化、pre-commit 全量、CI 秒检都成默认，质量下限被抬高。这是选 Biome 的隐性理由。

### 7. (实战类) Biome/SWC/Vitest 构成怎样的全景？
**来源**：https://biomejs.dev/reference/configuration/

编译(SWC)→质量(Biome)→测试(Vitest) 三段都被 Rust/原生+快的哲学重做，分别蚕食 Babel/ESLint+Prettier/Jest。把它们当一张工具链图选，而非孤立比较。

### 8. (对比类) oxlint 会取代 Biome 吗？
**来源**：https://biomejs.dev/reference/configuration/

二者在「快 lint」维度竞争但定位不同：Biome 还带 formatter 与 organizeImports 一体化。若你只想要一个极快 linter、格式化另有其人，oxlint 是选项；要统一接管，Biome 更完整。

### 9. (选型类) 老项目上 Biome 的第一步（低风险）？
**来源**：https://biomejs.dev/guides/getting-started/

先用 Biome 只做格式化（关掉 linter 或与 ESLint 并存），一个「纯格式化 commit」落地、跑全量 check 评估噪音，验证无回归后再逐步用它的 lint 替换重叠的 ESLint 规则。

### 10. (原理类) 选型的正确评估维度有哪些？
**来源**：https://biomejs.dev/reference/configuration/

速度、覆盖度（格式+规则）、可定制/插件生态、配置成本、与现有框架/CI 集成度、可继续性。单看「快」或单看「生态全」都会误判。

### 11. (实战类) 怎么向团队解释「不全删 ESLint」？
**来源**：https://biomejs.dev/guides/migrate-eslint-prettier/

用数据盘点你们实际用到的插件规则，标出 Biome 有/无对等比例。有对等的交 Biome、无对等的诚实保留，等其毕业再收，避免为「纯洁」丢检查。

### 12. (对比类) dprint 在什么场景胜出？
**来源**：https://biomejs.dev/guides/getting-started/

你只在意「跨很多语言的统一格式化」、完全不需要 lint，且更信 dprint 的插件化多语言格式覆盖时。它专注格式，不必为不需要的 lint 买单。

### 13. (选型类) 「Rust 工具链」是万能药吗？
**来源**：https://biomejs.dev/reference/configuration/

不是。它把性能与统一做到极好，但生态广度/私有规则/特定框架深度上，JS 工具链（尤其 ESLint）仍不可替代。理性是主干用新、长尾留旧，而非无脑全换。

### 14. (实战类) 本包 12 条自查里最容易被忽略的是？
**来源**：https://biomejs.dev/guides/integrate-in-vcs/

CI/提交前接入与可审计的 ignore 纪律——很多人工具选对了却没接进流程、或把 biome-ignore 用成藏问题的洞，收益归零。选型必须落到流程与规范。

### 15. (原理类) 如何判断某新工具「该现在上还是等」？
**来源**：https://biomejs.dev/blog/biome-v2/

看你要的能力是否已稳定覆盖 + 引入收益是否大于迁移/共存成本。Biome 主干已稳可上，自定义插件等实验项则等成熟。区分「稳的立刻用、未定的观察」，别一次性押注。
