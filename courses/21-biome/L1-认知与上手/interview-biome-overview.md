# 面试题：Biome 定位与覆盖边界（biome-overview）

### 1. (原理类) Biome 为什么能比 Prettier+ESLint 快一个数量级？
**来源**：https://biomejs.dev/guides/getting-started/

Rust 编译成原生二进制、多线程并行处理文件、无 Node/V8 冷启动与插件系统开销；格式化与 lint 共享同一份解析结果，一趟完成。三者叠加带来数量级差距。

### 2. (对比类) Biome 和 Rome 什么关系？
**来源**：https://biomejs.dev/blog/biome-v2/

Biome 是 Rome 项目（曾试图做一体化前端工具链）搁浅后由社区延续而来，保留其单二进制 formatter+linter 愿景并持续推进， Rome 停滞后大量贡献者转投 Biome。

### 3. (选型类) Biome 能完全取代 ESLint 吗？
**来源**：https://biomejs.dev/guides/migrate-eslint-prettier/

主干规则能，插件长尾常不能。Biome 覆盖常用 correctness/suspicious/style/complexity，但依赖特定框架插件的定制规则 ESLint 生态仍更全。现实多为 Biome 接管主干 + ESLint 保留个别插件共存。

### 4. (对比类) 对 Prettier 呢？
**来源**：https://biomejs.dev/guides/getting-started/

格式化层面 Biome 对 JS/TS/JSON/CSS/GraphQL 是接近超集的提速替代，绝大多数排版一致；极少数边角输出可能不同。迁移前要 diff 一遍确认团队可接受。

### 5. (定位类) 本教程为什么不逐条讲规则？
**来源**：https://biomejs.dev/reference/configuration/

规则会变、200+ 条背不完也没价值。课程锁定初始化-格式化-lint-迁移-CI 主干，细节教你回官方规则清单按需查，培养排错与迁移能力而非记忆。

### 6. (实战类) 什么团队最适合立刻上 Biome？
**来源**：https://biomejs.dev/guides/getting-started/

新项目、受够了 Prettier+ESLint 双配置与慢 CI 的 TS/JS 团队、monorepo 想要统一格式规范者。重度依赖冷门 ESLint 插件的团队则要评估共存成本。

### 7. (生态类) Biome 支持哪些语言？
**来源**：https://biomejs.dev/reference/configuration/

JS/TS/JSX/TSX、JSON(C)、CSS、GraphQL 等，其中部分语言格式化仍在向稳定推进。核心成熟区是 JS/TS 生态，多语言覆盖是加分但要看成熟度。

### 8. (原理类) 为什么说「一个配置文件」是卖点？
**来源**：https://biomejs.dev/guides/configure-biome/

以前格式规范在 .prettierrc、规则在 .eslintrc、还要协调二者打架。Biome 把 formatter+linter+organizeImports 收进单个 biome.json，消除工具间冲突与配置冗余。

### 9. (实战类) Biome 会做类型检查吗？
**来源**：https://biomejs.dev/guides/getting-started/

不会。Biome 是格式化+linter，不替代 tsc 的类型系统。它和 tsc 互补：类型归 tsc，风格与常见错误归 Biome，别指望它报类型错。

### 10. (生态类) 怎么看待 oxlint 这类同赛道竞争者？
**来源**：https://biomejs.dev/blog/biome-v2/

oxlint（Rust lint）与 Biome 都吃 Rust 性能红利，但 Biome 是 formatter+linter 一体、oxlint 主打 lint 快。选型看你是否需要格式化一起接管。本包收官关会做四方对照。

### 11. (对比类) Biome 是打包器/编译器吗？
**来源**：https://biomejs.dev/guides/getting-started/

都不是。它不改语法、不降级、不打包，只做格式化与静态检查。它和 20-swc（编译）是工具链不同环节，可共存。

### 12. (定位类) Biome 的「零配置起手」指什么？
**来源**：https://biomejs.dev/reference/configuration/

不写任何 biome.json 也有合理默认：格式化默认开、linter 走 recommended。init 只是给你一份可编辑的样板，很多小项目几乎不用改就能用。

### 13. (实战类) 引入 Biome 的第一条命令是什么？
**来源**：https://biomejs.dev/guides/getting-started/

npm i -D @biomejs/biome，然后 npx biome check ./src 看它一次性报出的格式+lint+import 问题。先跑不改（无 --write）评估冲击面。

### 14. (原理类) 为什么说「快」会改变工程习惯？
**来源**：https://biomejs.dev/guides/big-projects/

因为快，保存即格式化、pre-commit 全量秒过、CI 检查从分钟到秒都可行。慢工具逼你「只在改动上跑」，快工具允许你「随时全量跑」，这是隐形收益。

### 15. (生态类) Biome 是什么团队/许可在维护？
**来源**：https://biomejs.dev/blog/biome-v2/

社区驱动、开源（自 Rome 延续），有大量个人与厂商贡献者，靠赞助与社区推进版本。评估可继续性看其发布节奏与采用面（不少 Vite/新工具链项目采用）。
