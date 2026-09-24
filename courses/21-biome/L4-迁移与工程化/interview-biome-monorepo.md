# 面试题：monorepo 与多语言（biome-monorepo）

### 1. (原理类) monorepo 里 Biome 配置怎么分层？
**来源**：https://biomejs.dev/guides/big-projects/

根 biome.json 放公共策略，子包 extends 继承 + 局部 override 差异；就近配置对所在目录生效。原则同 20-swc 就近 .swcrc：公共托管通用、子包只声明偏差。

### 2. (实战类) 怎么防止 Biome 扫到别的包产物？
**来源**：https://biomejs.dev/guides/big-projects/

用 files.include 精确圈定源码目录、files.ignore 排 dist/node_modules/coverage，或设 vcs.useIgnoreFile:true 直接复用 .gitignore，一处声明全工具共享。

### 3. (对比类) vcs.useIgnoreFile 好在哪？
**来源**：https://biomejs.dev/guides/integrate-in-vcs/

避免「.gitignore 已排除、但 Biome 还得再列一遍 ignore」的重复与漂移。让版本控制的忽略清单成为唯一真源，Biome 跟随。

### 4. (实战类) Biome 能统一格式化哪些非 JS 文件？
**来源**：https://biomejs.dev/reference/configuration/

JSON(C)、CSS、GraphQL 等（部分仍 experimental）。价值是 package.json/tsconfig/样式/GraphQL 全用同一套排版规范，不必各装一个 formatter。用前确认语言成熟度。

### 5. (坑类) 对测试文件某些规则太苛刻怎么办？
**来源**：https://biomejs.dev/reference/configuration/

用 overrides 按 glob 差异化：对 **/*.test.ts 关掉认知复杂度/命名规范等，允许测试直白堆断言。规则跟文件类型走而非一刀切。

### 6. (原理类) Biome 与 Turborepo 谁管缓存？
**来源**：https://biomejs.dev/guides/big-projects/

正交分工：Biome 负责扫目录跑检查（本身快），Turborepo 负责把 biome check 做成一个可缓存 task、跳过未变更包。别把编排和检查混为一谈。

### 7. (对比类) pnpm workspace 里 Biome 装哪？
**来源**：https://biomejs.dev/reference/configuration/

通常根装一份、各包共享同一 biome.json（子包 extends）。避免每包各装各配造成版本与规则漂移，跨包一致正是 monorepo 采用 Biome 的收益。

### 8. (实战类) 多包规则冲突怎么解？
**来源**：https://biomejs.dev/reference/configuration/

公共放根、差异放子包 override；对某类文件用 overrides。让「冲突」变成显式的层级声明，而不是靠某包私自改根配置。

### 9. (坑类) 生成代码被 lint 报一堆怎么办？
**来源**：https://biomejs.dev/guides/big-projects/

生成物不该按人写码标准管：用 files.ignore 排除生成目录，或对生成 glob 用 overrides 大幅放宽规则，别为过 CI 去 ignore 单行或改生成模板迁就 lint。

### 10. (原理类) 为什么 monorepo 尤其吃 Biome 的速度红利？
**来源**：https://biomejs.dev/guides/big-projects/

文件基数大时 JS 工具链全量 lint/format 常成分钟级，Biome 原生并行把万文件 check 压到秒级，使「一次全仓统一格式」从奢侈变日常。这是采用 Biome 的强动机。

### 11. (对比类) 就近配置和 extends 会冲突吗？
**来源**：https://biomejs.dev/reference/configuration/

不冲突而是配合：extends 拉入公共基、就近 biome.json 对本地目录覆盖。合并逐字段生效，子包既复用又保留差异表达。

### 12. (实战类) CSS 用 Biome 还是 stylelint/lightningcss？
**来源**：https://biomejs.dev/reference/configuration/

简单统一排版可交给 Biome（省一个工具），但深度 CSS 规则/浏览器兼容处理上专用工具更全，且 Biome CSS 或仍实验。视团队对 CSS 治理深度决定，别为统一牺牲覆盖。

### 13. (坑类) 根改了 formatter 选项子包没生效？
**来源**：https://biomejs.dev/reference/configuration/

子包可能自己 override 了该语言/该项，或 Biome 版本不一致。核对就近配置的字段覆盖链与版本统一，别假设根改动无条件穿透。

### 14. (原理类) monorepo 里怎么保证「格式真源唯一」？
**来源**：https://biomejs.dev/guides/big-projects/

根 biome.json 定 formatter 真源、子包 extends 且不再重复声明格式项、清掉各包可能残留的 Prettier。让排版规则只在一处定义。

### 15. (实战类) 跨包统一 import 顺序靠什么？
**来源**：https://biomejs.dev/reference/configuration/

organizeImports 在根开启、子包共享同一配置，全仓 import 版式即一致且 CI 可复现；需局部差异时再 overrides。这正是单工具接管 vs 各包漂移的对比优势。
