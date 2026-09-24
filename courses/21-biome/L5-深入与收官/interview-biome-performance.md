# 面试题：性能与大仓实测（biome-performance）

### 1. (原理类) Biome 为什么比 Prettier+ESLint 快一个数量级？
**来源**：https://biomejs.dev/guides/getting-started/

四叠加：Rust 原生二进制无 Node/V8 冷启动与 GC 停顿；formatter+linter 共享一次解析的 AST；多核并行处理不同文件；编辑器经常驻 daemon/LSP 免重启。ESLint+Prettier 则要各自解析、跑在 JS 单线程上。

### 2. (实战类) 怎么科学地做前后耗时对比？
**来源**：https://biomejs.dev/reference/cli/

同仓库、同机器、同热/冷状态下，分别计时 eslint . + prettier --check . 与 biome check .，取多次墙钟中位数。别混不同输入或单次数噪声下结论。

### 3. (原理类) 为什么「共享 AST」能省这么多？
**来源**：https://biomejs.dev/guides/getting-started/

ESLint parse 一遍、Prettier parse 一遍、可能还有类型工具再来一遍。Biome 单二进制一次解析出树，格式化与 lint 都在同一棵树上跑，省掉重复解析这一大额固定成本。

### 4. (对比类) 常驻 daemon 相比每次 CLI 启动的优势？
**来源**：https://biomejs.dev/reference/daemon/

编辑器保存触发的是高频小任务，若每次冷启动进程开销巨大；Biome daemon/LSP 常驻、进程不重启，把「启动成本」摊掉，故保存即检近乎零延迟。

### 5. (实战类) 快会改变哪些工程习惯？
**来源**：https://biomejs.dev/guides/big-projects/

保存即格式化、pre-commit 敢跑全量、CI 里 lint 快到可忽略、重构后随手全量 check。慢工具逼你「只检改动、省着用」，快工具让「一直跑」成为默认。

### 6. (对比类) 什么时候速度是必需而非锦上添花？
**来源**：https://biomejs.dev/guides/big-projects/

超大 monorepo、高频小 PR 团队、把 lint/format 塞进每个 commit 的严格流程。此时慢工具的时间乘以海量次数变真实成本，快直接决定这些检查能否常驻开发循环。

### 7. (坑类) 感觉 Biome 变慢第一步查什么？
**来源**：https://biomejs.dev/guides/investigate-slowness/

先查扫描范围是否失控（忘了 ignore 产物、把 dist/node_modules 纳入）与单文件异常大、磁盘 I/O，而非怀疑内核。用 files.include/vcs.useIgnoreFile 收窄再测。

### 8. (原理类) 官方有专门排查慢的指南吗、思路？
**来源**：https://biomejs.dev/guides/investigate-slowness/

有 investigate-slowness 指南。核心是定位「是范围太大、还是个别文件、还是环境 I/O」，逐项排除，而不是盲目换工具。多数「慢」其实是配错了扫描面。

### 9. (对比类) Biome 快会不会牺牲正确性？
**来源**：https://biomejs.dev/reference/configuration/

格式化确定性高、lint 走语义分析，速度快主要靠原生+并行+共享解析，而非偷工。极个别排版/规则覆盖度差异与「快」无因果，别把两件事混谈。

### 10. (实战类) 并行会不会反而更慢？
**来源**：https://biomejs.dev/reference/environment-variables/

文件极少或有环境变量限制线程时并行收益不明显甚至开销倒挂。可用相关环境变量约束线程数做对照。大仓并行几乎总是净收益。

### 11. (原理类) 内存占用与快的关系？
**来源**：https://biomejs.dev/guides/big-projects/

Rust 无 GC 堆膨胀、解析后即释放，内存通常低于长跑的 JS 工具。低内存 + 快启动共同支撑「随手全量跑」的体验，不是单看 CPU。

### 12. (对比类) 既然快，还需要缓存/增量吗？
**来源**：https://biomejs.dev/reference/configuration/

大仓仍可做增量（--changed）或 Turborepo task 缓存以进一步降延迟与噪声；但 Biome 的基线快意味着「不优化也够用」，缓存是锦上添花而非必需。

### 13. (实战类) 怎么向老板量化引入 Biome 的收益？
**来源**：https://biomejs.dev/guides/big-projects/

拿真实仓测：CI 里 lint/format 步骤的分钟数 × 每日 PR/构建次数 = 每天团队等待总时长；Biome 把该步骤压到秒级即省出这些工程时。用墙钟×次数说话。

### 14. (坑类) 本地快、CI 慢的反差原因？
**来源**：https://biomejs.dev/reference/environment-variables/

CI 资源受限（CPU 少、冷缓存、并发被限线程）或每次全新 checkout。核对 CI 线程/缓存与扫描范围，别把环境差异当成工具变慢。

### 15. (原理类) 速度带来的「心理账户」转变？
**来源**：https://biomejs.dev/guides/getting-started/

慢工具让开发者把 lint/format 当「要付出等待的额外步骤」而回避；快工具把它变成「无感内建」，从而真正提升全仓长期一致性与质量下限——这是速度最被低估的价值。
