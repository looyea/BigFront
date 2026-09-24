# 面试题：CI 与提交前（biome-ci）

### 1. (实战类) GitHub Actions 里怎么跑 Biome？
**来源**：https://biomejs.dev/guides/integrate-in-vcs/

用官方 ci.yml 模板：checkout → 装依赖 → biome ci（或 biome check 加 --error-on-warnings）；失败置非零退出码挡 PR。可选评论模式把诊断贴成 PR comment。

### 2. (对比类) biome ci 和 biome check 用在 CI 有区别吗？
**来源**：https://biomejs.dev/reference/cli/

诊断能力一致；ci 模式针对无人值守/机器消费优化。两者 CI 里都不该带 --write——CI 的职责是校验，不是改仓库代码。

### 3. (原理类) 为什么 CI 永远不加 --write？
**来源**：https://biomejs.dev/reference/cli/

CI 改仓库会造成「流水线偷偷格式化、和开发本地不一致」的混乱。--write 属于本地/提交前的动作，CI 只做「有问题就红」。

### 4. (实战类) 提交前怎么只检改动文件？
**来源**：https://biomejs.dev/guides/integrate-in-vcs/

husky pre-commit + lint-staged：对 staged 的受支持文件跑 biome check --write 并重新暂存。Biome 极快，即便全量也不卡，增量只是更聚焦。

### 5. (对比类) 大仓怎么避免每次全量 check？
**来源**：https://biomejs.dev/reference/cli/

用 --changed --since=<基线分支>（或 PR 事件只对本 PR 触及文件跑）做增量。vcs.useIgnoreFile 复用 .gitignore 缩小扫描面。

### 6. (原理类) 流水线凭什么判断 Biome 检查通过？
**来源**：https://biomejs.dev/reference/cli/

凭退出码：0=无诊断、非0=有。别去 grep 日志文本判断成败，日志格式会变、退出码才是稳定契约。

### 7. (实战类) 需要给 Biome 加构建缓存吗？
**来源**：https://biomejs.dev/guides/big-projects/

通常不必——单二进制本就快。真要提效可缓存上次诊断快照做增量对比，或在 Turborepo 里把 check 做成可缓存 task，而非给 Biome 本身造缓存。

### 8. (坑类) PR 是绿的但实际有 warning？
**来源**：https://biomejs.dev/reference/cli/

默认 warning 不让 CI 失败。加 --error-on-warnings 把 warning 升为失败，或在 biome.json 把团队在意的规则设 error，避免「绿着过」。

### 9. (对比类) 评论模式 vs 直接挡 PR？
**来源**：https://biomejs.dev/reference/cli/

直接挡（非零退出码）保证不合规就合不进；评论模式把诊断贴成 comment 帮开发者看清该修什么。常配合用：既挡又评，体验最好。

### 10. (实战类) lint-staged 配 Biome 的完整命令？
**来源**：https://biomejs.dev/guides/integrate-in-vcs/

如 biome check --write --no-errors-on-unmatched，对匹配文件应用 safe fix 并让 lint-staged 重新 add。--no-errors-on-unmatched 避免没有匹配文件时报错。

### 11. (原理类) 为什么本地全量也不卡、CI 却强调增量？
**来源**：https://biomejs.dev/guides/big-projects/

本地交互式开发强调反馈即时、增量减少噪声与等待；Biome 快使「本地全量」也可行。CI 是并发资源、增量能加速并只关注本 PR 相关诊断。

### 12. (对比类) 把 Biome 放 pre-commit 还是 pre-push？
**来源**：https://biomejs.dev/guides/integrate-in-vcs/

pre-commit 跑快检（格式化+主干 lint，反正 Biome 快）拦在最早；重活/全量/跨包检查可放 pre-push 或 CI。分层让快反馈前置。

### 13. (坑类) CI 报找不到 Biome 二进制（呼应 L1 安装）？
**来源**：https://biomejs.dev/guides/manual-installation/

跨平台 lockfile 缺对应平台二进制，或依赖未装。CI 里干净 install、确保 lockfile 覆盖 CI 的 os/cpu。与 @swc/core 同类问题。

### 14. (实战类) 怎么让 CI 反馈「该修什么」而非只红？
**来源**：https://biomejs.dev/reference/diagnostics/

开启 Action 的评论模式，把 Biome 诊断（含规则名、位置、可修性）作为 PR 评论呈现；开发者直接在 review 里看到 biome explain 可查的具体问题。

### 15. (原理类) 退出码 + 增量 + 快三者如何改变习惯？
**来源**：https://biomejs.dev/guides/big-projects/

因为快、可靠退出码增量，你可以「每次提交都全量放心跑」而不必牺牲检查换速度。这改变了慢时代「为省时间只检一点点」的妥协。
