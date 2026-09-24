# 面试题：辅助动作与注解（biome-assist）

### 1. (原理类) assist / action 在 Biome 里指什么？
**来源**：https://biomejs.dev/reference/configuration/

assist 是「安全改写代码结构」的一类自动化（如 organizeImports 归入 assist.actions），在 check/--write 时按配置应用。它区别于纯格式化与纯 lint 诊断，强调可安全落地的结构性改动。

### 2. (实战类) 怎么正确写一条 biome-ignore？
**来源**：https://biomejs.dev/reference/diagnostics/

// biome-ignore <规则路径>: <理由>，例如 // biome-ignore lint/suspicious/noExplicitAny: 迁移期临时容忍。冒号后理由必填，Biome 不允许裸 ignore。

### 3. (坑类) 为什么 Biome 强制 ignore 写理由？
**来源**：https://biomejs.dev/reference/diagnostics/

防止 eslint-disable 式滥用变成藏问题黑洞。强制理由让每次压制都可审、可 grep、可到期清理，把「豁免」变成显式决策而非随手静音。

### 4. (对比类) biome-ignore 和 biome-ignore-all 区别？
**来源**：https://biomejs.dev/reference/diagnostics/

前者行内抑制单条诊断（精确到该处），后者文件级顶置豁免整类诊断。范围越大越应慎重——优先最小 scope，别用 all 图省事屏蔽整个文件的规则。

### 5. (原理类) suppress 机制解决什么？
**来源**：https://biomejs.dev/reference/diagnostics/

把「已知豁免」用带说明的 suppression comment 记账，使每次压制可追溯、可搜索、可到期。相比散落的 ignore，它让技术债显性、可治理。

### 6. (实战类) 能自动修的该不该 ignore？
**来源**：https://biomejs.dev/reference/configuration/

不该。action/lint safe fix 能修的直接修掉；ignore 只用于「Biome 报了但你故意保留」或误报。把可修问题 ignore 是滥用，掩盖了本可消除的技术债。

### 7. (对比类) ignore 用于误报 vs 用于逃避规则，界限？
**来源**：https://biomejs.dev/reference/diagnostics/

误报（Biome 判断确实不合场景）→ 精确 ignore + 理由，合理。逃避（「这规则我不想守」）→ 应把决策写进 biome.json 的规则配置（团队级、可见），而非散落在代码注释里各自为政。

### 8. (坑类) ignore 用多了怎么治理？
**来源**：https://biomejs.dev/guides/big-projects/

定期 grep biome-ignore / biome-ignore-all 统计数量与理由，纳入 code review 检查点；把反复出现的豁免上升为配置层的规则调整；给临时豁免设到期标记，形成「豁免要还」的纪律。

### 9. (实战类) 怎么在 VS Code 里获得 assist 动作？
**来源**：https://biomejs.dev/reference/vscode/

Biome 扩展通过 code action / source action 暴露整理 import 等动作，保存或命令面板触发。让 IDE 与 CLI 走同一 biome.json，避免「编辑器里一个样、CI 另一个样」。

### 10. (原理类) 为什么 action 强调「安全」？
**来源**：https://biomejs.dev/reference/configuration/

结构性改写若语义不等价就会改坏代码，故 action 只做可证明安全的转换，风险项要么标 unsafe 要么不做。这与 --write 默认只应用 safe fix、破坏性需 --unsafe 一脉相承。

### 11. (对比类) biome-ignore 与 TS 的 @ts-ignore 有何不同？
**来源**：https://biomejs.dev/reference/diagnostics/

对象不同：@ts-ignore 压类型错误（tsc），biome-ignore 压 Biome 的格式/lint 诊断。二者不互相替代，一个项目里可能都需要，但都该克制且写清理由。

### 12. (实战类) 一条 ignore 该覆盖多大范围？
**来源**：https://biomejs.dev/reference/diagnostics/

尽量单行、单规则。范围越大越容易连坐屏蔽掉旁边真正该暴露的问题。精确 scope 是「豁免不越权」的基本工程素养。

### 13. (原理类) assist 与 linter 的 fix 有何重叠？
**来源**：https://biomejs.dev/reference/configuration/

都属「自动改写」。区分：lint fix 针对某条规则诊断的修复，assist 针对组织性动作（如 import）。二者在 biome check --write 时协同应用，配置里各自有开关。

### 14. (坑类) 用了 ignore 但 CI 仍报同类问题？
**来源**：https://biomejs.dev/reference/diagnostics/

可能 ignore 的规则路径写错、或作用行不符、或 Biome 版本对 ignore 语义有调整。核对精确规则标识与放置行，必要时用 biome explain <rule> 确认诊断来源。

### 15. (对比类) 如何查某条被 ignore 的规则文档？
**来源**：https://biomejs.dev/reference/diagnostics/

用 biome explain <rule-name>（或查官方规则清单）看它到底检测什么、为何报。先理解规则再决定是 ignore、是修、还是团队协商改配置——别无脑屏蔽。
