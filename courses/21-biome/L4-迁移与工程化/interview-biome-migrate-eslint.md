# 面试题：从 ESLint+Prettier 迁移（biome-migrate-eslint）

### 1. (实战类) 用官方工具怎么开始迁移？
**来源**：https://biomejs.dev/guides/migrate-eslint-prettier/

npx @biomejs/migrate 读 .eslintrc/.prettierrc 产出近似 biome.json。它做最大近似翻译，跑完必须逐行 review、标注哪些规则无对等需保留 ESLint。

### 2. (对比类) Prettier 和 ESLint 谁更容易被 Biome 接管？
**来源**：https://biomejs.dev/guides/migrate-eslint-prettier/

Prettier 更容易——格式化近乎全吃，仅少数排版边角可能不同。ESLint 主干规则能覆盖，但基于插件的框架/冷门规则常无对等，这部分多要保留 ESLint。

### 3. (实战类) 插件类 ESLint 规则怎么办？
**来源**：https://biomejs.dev/guides/migrate-eslint-prettier/

保留 ESLint 与 Biome 共存：ESLint 只配 Biome 未覆盖的插件规则，并关掉与 Biome 重叠的格式化/通用 lint，避免同一行两工具按不同标准反复改。

### 4. (坑类) migrate 产出能直接 commit 吗？
**来源**：https://biomejs.dev/guides/migrate-eslint-prettier/

不能。它是近似翻译，可能漏映射或语义不等价。必须人工 review：核对 formatter 选项对齐旧风格、确认被略过的 ESLint 规则要不要另安置。

### 5. (对比类) 共存时怎么防两个工具打架？
**来源**：https://biomejs.dev/guides/migrate-eslint-prettier/

职责切分：Biome 管 formatter + 它的 lint 主干，ESLint 只留插件规则；ESLint 里禁用格式化类与已被 Biome 覆盖的诊断。CI 两个都跑、本地保存交 Biome。

### 6. (实战类) 全接管要清理哪些东西？
**来源**：https://biomejs.dev/guides/migrate-eslint-prettier/

删 prettier 依赖、.prettierrc、eslint-config-prettier、编辑器里 Prettier 默认格式化器设置；把 biome formatter 对齐旧风格，再全量 biome format --write 归一。

### 7. (原理类) 为什么说迁移终态多是「主干+共存」？
**来源**：https://biomejs.dev/guides/migrate-eslint-prettier/

因为 ESLint 十几年插件生态广度非 Biome 短期可替。理性终态：Biome 吃下格式化+通用 lint 拿性能与统一，个别框架专属/冷门规则留 ESLint，各扬所长。

### 8. (实战类) 大仓该渐进还是一次性？
**来源**：https://biomejs.dev/guides/big-projects/

大仓/monorepo 渐进：先一个包或 app 上 Biome，验证无回归、团队适应后推广；小项目可一次性（migrate→全量 write→一个 adopt commit→加 CI）。

### 9. (坑类) 迁移后同一文件每次保存都被两个工具来回改？
**来源**：https://biomejs.dev/reference/vscode/

说明 Biome 与残留 Prettier/ESLint auto-fix 都在改。确定唯一格式真源（通常 Biome），禁用其他 formatter、清理 ESLint 重叠 fix 规则。

### 10. (对比类) 排版差异会不会破坏历史 blame？
**来源**：https://biomejs.dev/guides/migrate-eslint-prettier/

全量格式化会产生一个「纯格式化 commit」污染 blame。对策：独立 commit + git blame.ignoreRevsFile 跳过它，让真实作者归属穿透到格式化前。

### 11. (实战类) 迁移怎么验收才算完成？
**来源**：https://biomejs.dev/guides/migrate-eslint-prettier/

以「针对产物的测试/构建全绿 + 团队能接受排版」为准，而非「migrate 跑完」。跑全量 check、CI 接上、lint-staged 就位，再宣告完成。

### 12. (原理类) Biome 吃下 Prettier 为什么顺理成章？
**来源**：https://biomejs.dev/guides/migrate-eslint-prettier/

格式化是确定性排版、规则集相对收敛，Biome 用 Rust 实现覆盖主流场景不难；难的是 ESLint 那种依赖类型/框架上下文的插件长尾，两者难度天然不同。

### 13. (对比类) 要不要把 ESLint 的 --fix 也保留？
**来源**：https://biomejs.dev/reference/configuration/

取决于共存范围。若某规则只在 ESLint、其 --fix 又安全，可保留；但要避免与 Biome --write 在提交钩子里抢同一文件，明确谁先谁后。

### 14. (坑类) migrate 漏掉某 ESLint 规则导致静默少检？
**来源**：https://biomejs.dev/guides/migrate-eslint-prettier/

迁移后对照旧 .eslintrc 逐条盘点：哪些被 Biome 对等接管、哪些无对等需保留 ESLint、哪些团队本就打算弃用。别默认 migrate 覆盖一切。

### 15. (实战类) 怎么向团队解释「为什么先别急着删 ESLint」？
**来源**：https://biomejs.dev/guides/migrate-eslint-prettier/

用数据：列出你项目 ESLint 用到的插件规则，标出 Biome 有/无对等的比例。有对等的交给 Biome，无对等的诚实保留，等其毕业再删，避免为「纯洁」丢检查。
