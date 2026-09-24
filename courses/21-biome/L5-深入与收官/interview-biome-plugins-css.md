# 面试题：自定义与扩展（biome-plugins-css）

### 1. (原理类) Biome 自定义插件现在能上生产吗？
**来源**：https://biomejs.dev/blog/biome-v2/

别指望。走 Wasm 的自定义规则系统长期 experimental、在演进，接口与稳定性不足以作为生产依赖。应视为路线图能力，今日需求用其他手段满足。

### 2. (对比类) 和 20-swc 的 Wasm 插件比呢？
**来源**：https://biomejs.dev/reference/configuration/

SWC 的 Wasm 插件是成熟生产件（编译期自定义 AST 变换），Biome 的还在路上。同是 Rust→Wasm，一个已成体系、一个尚未定稳，故「自定义 lint 规则」今天仍主要靠 ESLint。

### 3. (实战类) 某规则 Biome 确实没有怎么办？
**来源**：https://biomejs.dev/guides/migrate-eslint-prettier/

先查官方规则清单确认是真缺还是改名；确缺则让个别 ESLint 插件继续跑那一条（共存），别为单条缺口放弃 Biome 的整体收益。

### 4. (原理类) 为什么说「配置即策略」？
**来源**：https://biomejs.dev/reference/configuration/

你能用 biome.json 表达「开哪些组、什么严重级别、管哪些文件」，但改不了规则集本身。团队约定靠配置显式落地，而非各自写自定义规则——一致性优先于可定制性。

### 5. (对比类) 把「不能任意自定义」当缺陷错在哪？
**来源**：https://biomejs.dev/reference/configuration/

Biome 的取舍是「快+覆盖主流+零配置合理」优先，不做无所不能的插件化。对多数团队这消除了「自定义 lint 无人维护、规则漂移」的经典痛点，是优点。

### 6. (实战类) 批量代码模式重构用什么？
**来源**：https://biomejs.dev/reference/configuration/

那是 codemod 的活（如 jscodeshift/专用 transform），不是 linter。linter 报问题、偶尔能 fix 单点；跨文件语义批量改写要专门的 AST 变换工具，各司其职。

### 7. (坑类) 用 Biome 格式化 CSS 前该做什么？
**来源**：https://biomejs.dev/reference/configuration/

CSS/GraphQL formatter 成熟度低于 JS、部分 experimental。在你真实的样式文件上先跑一遍看输出可接受、再纳入统一；依赖深度 CSS 处理的仍用 lightningcss/postcss。

### 8. (对比类) Biome 全语言统一排版 vs 各装专用工具？
**来源**：https://biomejs.dev/reference/configuration/

统一排版（json/css/gql 一个工具）省事且规范一致是 Biome 的价值；但专用工具在各自领域覆盖更深。取舍看你要「一个够用且快」还是「每个极致」。

### 9. (原理类) 为什么插件化对 Biome 更难？
**来源**：https://biomejs.dev/reference/configuration/

要保持原生性能、跨语言稳定 ABI、又开放第三方改写 AST，工程量大且易碎。团队选择先把内核与主流规则做扎实，插件 API 谨慎推进，故慢。

### 10. (实战类) 怎么跟踪「今天没有明天可能有」？
**来源**：https://biomejs.dev/blog/biome-v2/

盯 nursery 组、release notes、官方博客与路线图（如 v2 扩展）。把「等它毕业」纳入规划，需要时先用 ESLint 补丁顶替，长出来再收回。

### 11. (对比类) 团队确实需要一条私有规则怎么办？
**来源**：https://biomejs.dev/reference/gritql/

短期用 ESLint 私有插件承载；关注 Biome 的 codemod/查询能力（如 gritql 方向）能否表达模式检测。别把「私有规则」当拒绝 Biome 的理由——主干交给它、私有留 ESLint。

### 12. (坑类) 「等 Biome 全支持再迁」的陷阱？
**来源**：https://biomejs.dev/guides/migrate-eslint-prettier/

可能永远等不到、白白损失已有的格式化+主干 lint 提速。正确是现在就迁主干、缺的插件继续用 ESLint 共存，随覆盖度提升逐步收编。

### 13. (原理类) Biome 的 fix 与自定义规则的关系？
**来源**：https://biomejs.dev/reference/diagnostics/

内置规则提供 safe/unsafe fix，但这不等于你能自定义 fix。缺自定义能力时，能自动修的用 --write、语义批量改写用 codemod、私有约束用 ESLint——三者分明。

### 14. (实战类) gritql 在 Biome 里能干什么？
**来源**：https://biomejs.dev/reference/gritql/

Biome 集成 GritQL 相关能力用于模式化代码查询/变换方向，是官方对「超出固定规则集」需求的一种回应。评估它能否覆盖你的模式检测，再决定要不要 ESLint。

### 15. (对比类) CSS 交给 Biome 还是保留 stylelint？
**来源**：https://biomejs.dev/reference/configuration/

简单统一排版交给 Biome 省一个工具；深度 CSS 质量规则（兼容性、架构约束）stylelint 更全。看团队对 CSS 治理深度定，别为工具数最少牺牲必要覆盖。
