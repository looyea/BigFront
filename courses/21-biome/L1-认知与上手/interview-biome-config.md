# 面试题：biome.json 结构（biome-config）

### 1. (实战类) 一份能上线的最小 biome.json 长什么样？
**来源**：https://biomejs.dev/reference/configuration/

顶层 $schema + files(include/ignore 圈范围) + formatter(enabled/indentStyle/lineWidth) + linter(enabled,rules.recommended) + organizeImports(enabled)。够起手，踩到再补，别一上来抄满配。

### 2. (原理类) $schema 字段有什么用？
**来源**：https://biomejs.dev/reference/configuration/

让编辑器据 JSON Schema 提供字段补全与校验，写错字段名立刻标红，等于内置了一份可校验的配置文档。丢了它就只能靠记忆和试错配 Biome。

### 3. (对比类) recommended 和 all 该怎么选？
**来源**：https://biomejs.dev/reference/configuration/

recommended=官方精选低噪音、适合绝大多数团队起手；all=全开含高争议/风格强规则，噪音大。先 recommended，确有需要的个别规则再单开，别用 all 硬啃。

### 4. (实战类) 怎么调单条规则的严重级别？
**来源**：https://biomejs.dev/reference/configuration/

linter.rules.<group>.<rule> 设 "off"/"warn"/"error"/"info"。在 recommended 基线上按需微调单条，而不是整组关，保留推荐集的价值。

### 5. (原理类) files.include 在 monorepo 里为何关键？
**来源**：https://biomejs.dev/guides/big-projects/

根配置若不排除产物与各包 dist，会扫到海量生成文件、变慢且误报。用 files.include 精确圈定要管的源码目录，是 monorepo 性能与信噪比的第一开关。

### 6. (对比类) 语言级配置和顶层配置什么关系？
**来源**：https://biomejs.dev/reference/configuration/

javascript/typescript/css/json 等语言分区可覆盖顶层 formatter/linter 设置，做「全局默认 + 按语言例外」。优先级：更具体的语言设置 > 顶层 > 内置默认。

### 7. (实战类) 公共配置怎么给多项目复用？
**来源**：https://biomejs.dev/reference/configuration/

把团队公共 biome.json 做成一个 npm 包，各项目用 extends 引用它，只覆写自己的差异项。避免每个包复制一份配置漂移。

### 8. (坑类) 为什么改 include 后有些文件还是没被格式化？
**来源**：https://biomejs.dev/reference/configuration/

可能被更内层的 ignore、或被文件类型不被支持、或有独立的子 biome.json 覆盖了范围。检查就近配置与 ignore 链，确认目标文件确在 include 内。

### 9. (原理类) formatter.include 能干什么？
**来源**：https://biomejs.dev/reference/configuration/

限定哪些文件参与格式化（区别于整体处理范围），可让部分生成物/特殊目录只 lint 不格式化，或反过来，做细粒度控制。

### 10. (对比类) Biome 配置和 .editorconfig 什么关系？
**来源**：https://biomejs.dev/reference/configuration/

Biome 的 indentStyle/lineWidth 等是格式化真源，与 .editorConfig 若冲突应以 biome.json 为准并尽量对齐两者，避免编辑器缩进与 Biome 输出打架。

### 11. (实战类) 怎么把「不认识的文件」跳过而不是报错？
**来源**：https://biomejs.dev/reference/configuration/

设 files.ignoreUnknown（或把它加进 ignore），让 Biome 遇到无法解析/支持的文件时跳过而非中断。CI 里这能防个别怪文件全盘红。

### 12. (原理类) extends 的合并语义？
**来源**：https://biomejs.dev/reference/configuration/

被 extends 的配置作基、本地覆盖同名项做差异，逐字段合并（非整体替换）。让公共预设托管通用规则、子项目仅声明偏差，是可维护 monorepo 的基础。

### 13. (坑类) vcs 相关配置放哪、有什么用？
**来源**：https://biomejs.dev/guides/integrate-in-vcs/

vcs 区声明版本控制集成：如 useIgnoreFile 让 Biome 复用 .gitignore、clientKind 决定评论者。把「哪些文件该被管」交给 .gitignore，减少重复配置。

### 14. (实战类) 想只在 CI 上更严格、本地宽松怎么做？
**来源**：https://biomejs.dev/reference/configuration/

本地用 recommended，CI 用 biome ci / --error-on-warnings 收紧，或给 CI 单独 extends 一份更严的预设。用「同一基线 + 环境差异化开关」而非两套漂移配置。

### 15. (对比类) 为什么不建议把每条规则都手写出来？
**来源**：https://biomejs.dev/reference/configuration/

抄满配既难维护又带进不理解的规则、制造噪音且埋冲突。合理是 recommended 打底、只显式覆写团队真正有共识差异的少数规则，让配置表达「决策」而非「全量」。
