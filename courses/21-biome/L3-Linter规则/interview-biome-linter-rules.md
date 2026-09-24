# 面试题：规则分组与 recommended（biome-linter-rules）

### 1. (原理类) Biome 规则怎么命名和寻址？
**来源**：https://biomejs.dev/reference/configuration/

group/ruleName 两段，如 lint/correctness/noUnusedVariables。配置、biome-ignore 注解、CLI 过滤都按该路径寻址，精确到单条。

### 2. (实战类) recommended 和 all 到底怎么选？
**来源**：https://biomejs.dev/reference/configuration/

recommended=官方精选低噪音、适合绝大多数团队起手；all=全开含强风格/高争议、噪音大。除非明确要某条非推荐规则，否则 recommended 打底、单条增补。

### 3. (对比类) 六大 group 各自定位？
**来源**：https://biomejs.dev/reference/configuration/

correctness（大概率 bug）、suspicious（可疑未必错）、style（可读性/一致）、complexity（反模式/过度）、security（安全隐患）、performance（慢写法），外加 nursery（实验孵化）。理解定位才知该严该松。

### 4. (实战类) 怎么读懂一条规则再决定关不关？
**来源**：https://biomejs.dev/reference/diagnostics/

biome explain <rule-name>（或查规则清单）给出动机、正误案例、是否可自动修。先理解再决策，别对没读懂的规则随手 ignore。

### 5. (原理类) nursery 组能上生产吗？
**来源**：https://biomejs.dev/reference/configuration/

谨慎。nursery 是实验/孵化规则，接口和行为可能变动、误报率高。生产基线建议避开 nursery，等规则毕业进正式组再纳入。

### 6. (实战类) severity 有哪几档？
**来源**：https://biomejs.dev/reference/configuration/

off / info / warn / error。没有 fatal。可对整组或单条分别设，让「团队硬约束」用 error、「提醒类」用 warn/info。

### 7. (对比类) 怎么做到「关键组严、风格组松」？
**来源**：https://biomejs.dev/reference/configuration/

用按 group 配基线（defaultRules）：如 correctness 设 all、style 设 recommended 或逐条降档。比全 all 或全 recommended 更贴合真实诉求。

### 8. (坑类) 把 style 全设 error 会怎样？
**来源**：https://biomejs.dev/reference/configuration/

风格噪音淹没真问题，团队疲于应付红色诊断，反而降低对 linter 的信任。style 宜按需、多数降 warn 或 off。

### 9. (原理类) 为什么 recommended 默认不含全部规则？
**来源**：https://biomejs.dev/reference/configuration/

因为部分规则高度主观或与团队约定冲突，默认全开会造成「升级即爆红」。官方把低争议高价值项放 recommended，其余交团队显式采纳。

### 10. (实战类) 想把一条误报多的规则降级？
**来源**：https://biomejs.dev/reference/configuration/

linter.rules.<group>.<rule> 设 warn 或 off，并写注释说明理由。团队级配置调整比满屏行内 ignore 更可治理、可审计。

### 11. (对比类) Biome 规则集相对 ESLint 的默认？
**来源**：https://biomejs.dev/reference/configuration/

ESLint 老式配置常「一条一条显式加插件/规则」，Biome 用 recommended 给一套开箱合理基线。心智从「攒规则」变「基线 + 微调」。

### 12. (坑类) 改完 rules 但诊断没变？
**来源**：https://biomejs.dev/reference/cli/

确认改的是生效的那份 biome.json（monorepo 就近优先）、Biome 版本一致、且未被 CLI 参数或语言级配置覆盖。配置链优先级会遮蔽你的改动。

### 13. (原理类) group 与规则路径在 ignore 注解里怎么写？
**来源**：https://biomejs.dev/reference/diagnostics/

// biome-ignore <group>/<rule>: 理由，精确到单条。别用 biome-ignore-all 屏蔽整类图省事，尽量最小 scope。

### 14. (实战类) 怎么给新团队定初始 linter 策略？
**来源**：https://biomejs.dev/reference/configuration/

recommended 打底，correctness/a11y 保持 error，其余组按团队共识个别降档；把每一次「关/降」都配一行理由，形成可评审的规则基线文档。

### 15. (对比类) 为什么不建议一上来 all:true？
**来源**：https://biomejs.dev/reference/configuration/

all 会把高争议/强风格规则也变诊断，初期海量噪音让人误以为 Biome「太严」而弃用。渐进：先 recommended，遇到需要再精准开单条。
