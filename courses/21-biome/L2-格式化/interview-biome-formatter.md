# 面试题：格式化与 Prettier 对照（biome-formatter）

### 1. (对比类) Biome formatter 选项怎么对应 Prettier？
**来源**：https://biomejs.dev/reference/configuration/

indentStyle↔useTabs、indentWidth↔tabWidth、lineWidth↔printWidth、lineEnding↔endOfLine、quoteStyle/bracketSpacing/trailingCommas 近同名。迁移基本能一一对齐，排版结果高度一致。

### 2. (实战类) 从 Prettier 迁格式化怎么落地最稳？
**来源**：https://biomejs.dev/guides/migrate-eslint-prettier/

先把 .prettierrc 逐条映射进 biome.json formatter，选典型文件 diff 排版差异确认团队接受，再单独开一个「纯格式化」commit 跑 biome format --write .，git blame 用 --ignore-rev 跳过它。

### 3. (原理类) 为什么强调 biome.json 是格式真源？
**来源**：https://biomejs.dev/reference/configuration/

若 .editorconfig、IDE 设置、biome.json 三者缩进/宽度不一致，会出现保存后反复重排。以 biome.json 为准并让 editorconfig 对齐，消灭「谁最后写盘」的抖动。

### 4. (坑类) indentStyle 用 tab 还是 space 有讲究吗？
**来源**：https://biomejs.dev/reference/configuration/

与团队/编辑器/无障碍设置相关：tab 利于用户自定义可视缩进、space 保证所见即一致。关键是全项目统一且与 editorconfig 一致，别混用导致 diff 噪声。

### 5. (对比类) Biome 和 Prettier 会 100% 输出一致吗？
**来源**：https://biomejs.dev/reference/configuration/

不会也不该期待。长链式、复杂 JSX、模板字符串断行点等边角可能不同。评估方式是对真实代码 diff，接受主干一致、个别差异即可切换。

### 6. (实战类) 想让某生成目录不被格式化怎么办？
**来源**：https://biomejs.dev/reference/configuration/

用 files.ignore 或 formatter.include 精确排除生成物/第三方目录。但别把「本该统一的业务代码」也 ignore 掉，那是格式化最该发挥作用的地方。

### 7. (原理类) lineWidth 调大调小的影响？
**来源**：https://biomejs.dev/reference/configuration/

lineWidth 决定每行换行阈值，越大越少换行、链式/参数更少断行、可读性依风格而定。它与 Prettier printWidth 语义一致，迁移时保持旧值可最小化 diff。

### 8. (对比类) quoteStyle 怎么和现有单引号项目对齐？
**来源**：https://biomejs.dev/reference/configuration/

Biome 用 quoteStyle 表达引号偏好，配合 JS formatter 处理把 Prettier 的 singleQuote:true 等价搬过来即可。保持与历史代码一致以免全量改引号制造巨量 diff。

### 9. (实战类) 只想 lint 暂时不动格式，CI 怎么配？
**来源**：https://biomejs.dev/reference/configuration/

用 biome lint（或 check 配 formatter.enabled:false / --formatter-enabled=false），把格式化留到团队准备好再一次性落地，分阶段降低引入摩擦。

### 10. (坑类) 格式化后 blame 全指向一个 commit 怎么破？
**来源**：https://biomejs.dev/guides/big-projects/

给「纯格式化」commit 打标记，git 配置 blame.ignoreRevsFile 或 --ignore-rev 跳过它，让真实作者归属穿透到格式化之前的 commit。

### 11. (原理类) 为什么 formatter 与 linter 能共享解析？
**来源**：https://biomejs.dev/reference/configuration/

Biome 单二进制里一次解析出 AST，格式化与 lint 都基于同一棵树上跑，省掉各自重新解析。这也是它比「Prettier parse 一遍 + ESLint parse 一遍」快的根因。

### 12. (对比类) 能同时用 Prettier 和 Biome 格式化吗？
**来源**：https://biomejs.dev/reference/configuration/

不建议——两个 formatter 会互相覆盖、提交时来回改。二选一做真源；若确需 Prettier 覆盖个别语言，就用 Biome 的该语言 formatter.enabled:false 让位，职责划分清晰。

### 13. (实战类) 怎么衡量一次全量格式化的改动面？
**来源**：https://biomejs.dev/reference/cli/

先跑 biome format（不带 --write）统计将被改的文件数与 diff 行数，评估是否可控；过大就分批（按目录 include）落地，每批独立 commit。

### 14. (坑类) 迁移后 CI 说格式不通过、本地却过了？
**来源**：https://biomejs.dev/reference/cli/

多半本地/CI 的 Biome 版本不一致或某处配置漂移导致排版差异。统一 Biome 版本、让 CI 读同一 biome.json，别依赖某端 IDE 的自动格式化。

### 15. (对比类) trailingCommas 设 all/es5/none 的差异？
**来源**：https://biomejs.dev/reference/configuration/

与 Prettier trailingComma 同义：all 给多行结构尽量加尾逗号、es5 只兼容 ES5 场景、none 不加。选一个与团队历史一致的值，避免全量尾逗号 diff。
