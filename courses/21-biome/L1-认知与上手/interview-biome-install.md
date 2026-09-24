# 面试题：安装与第一条命令（biome-install）

### 1. (实战类) 从零接入 Biome 的最小步骤？
**来源**：https://biomejs.dev/guides/getting-started/

npm i -D @biomejs/biome → npx biome init 生成 biome.json → npx biome check ./src 看诊断 → 满意后 check --write 落地。装完即有合理默认。

### 2. (对比类) biome check / format / lint 三者区别？
**来源**：https://biomejs.dev/reference/cli/

format 只查/改格式，lint 只跑规则诊断，check 是 format+lint+organizeImports 的聚合。日常与 CI 用 check 一条即可，除非你只想跑其中一类。

### 3. (实战类) --write 和 --unsafe 分别什么时候用？
**来源**：https://biomejs.dev/reference/cli/

--write 应用安全修复（格式化、import 排序、明确 autofix）。--unsafe 允许带潜在语义风险的修复，需人工确认结果。默认永远偏保守，防自动改坏代码。

### 4. (原理类) Biome 二进制怎么按平台装到位？
**来源**：https://biomejs.dev/guides/manual-installation/

npm 包用 optionalDependencies 分发各 os/cpu 的预编译二进制，装时命中对应平台包，思路同 @swc/core。跨平台 lockfile 也可能遇到「本地有、CI 缺」的情况。

### 5. (坑类) VS Code 里和 Prettier 扩展打架怎么办？
**来源**：https://biomejs.dev/reference/vscode/

把默认格式化器设为 Biome，或对该工作区禁用 Prettier 扩展；确保只有一个是 active formatter。否则保存时被 Prettier 抢走、Biome 格式化不生效。

### 6. (实战类) CI 里怎么配才不会因 warning 静默通过？
**来源**：https://biomejs.dev/reference/cli/

用 biome ci（或 check --error-on-warnings）把 warning 也视作失败、退出码非零挡住 PR。Biome 还提供 GitHub Action 模板做评论模式反馈。

### 7. (原理类) 为什么没写配置也报了一堆格式问题？
**来源**：https://biomejs.dev/reference/configuration/

Biome 默认就开格式化并套用内置风格，且 linter 默认 recommended 集。「零配置即有意义」，biome.json 是用来微调而非从零开启。

### 8. (对比类) 退出码只有 0 和 1 吗？
**来源**：https://biomejs.dev/reference/cli/

0 表示无诊断、非 0 表示有诊断或错误，供 CI 判断。配合 --error-on-warnings 可把 warning 也归入失败。别把 Biome 退出码当纯错误信号，它编码了「有诊断」。

### 9. (实战类) 只想先接管格式化、暂不动 lint 怎么配？
**来源**：https://biomejs.dev/reference/configuration/

linter.enabled:false（或把 CI 命令换成 biome format --check），保留 formatter 开。但更推荐两者一起上——lint 主干规则通常低成本高收益。

### 10. (坑类) check 报「无法解析某文件」怎么办？
**来源**：https://biomejs.dev/reference/diagnostics/

多半是该文件类型/语法超出当前 parser 支持或是产物文件。用 files.ignore 排除 dist/生成物，或确认扩展名受支持；必要时 ignoreUnknown 避免未知文件报错。

### 11. (对比类) biome ci 和 biome check 有何不同？
**来源**：https://biomejs.dev/reference/cli/

biome ci 是面向持续集成的模式（更适合非交互、输出便于机器消费）。本地用 check，流水线用 ci（或 check 加严格 flag），核心诊断能力一致。

### 12. (原理类) 保存即格式化为什么不卡？
**来源**：https://biomejs.dev/reference/daemon/

Biome 扩展经 daemon/LSP 常驻进程工作，避免每次保存冷启动 Node 工具，几乎零延迟。这是「Rust + 常驻」带来的体验，不是普通 JS 格式化器能达到的手感。

### 13. (实战类) 怎么评估全量 check 的冲击面？
**来源**：https://biomejs.dev/guides/getting-started/

先跑不带 --write 的 biome check . 统计诊断数量与分布，判断哪些规则/格式与现有代码风格冲突最大，再决定是「一次性 --write 归零」还是「只对改动文件渐进」。

### 14. (坑类) 第一次 --write 改动巨多想回退？
**来源**：https://biomejs.dev/reference/cli/

在干净 git 状态跑，--write 后先 git diff 审阅再提交；不满意 git checkout 回退。给全量落地单独开一个「纯格式化」commit，与功能改动隔离，方便 review 与 blame。

### 15. (对比类) 要不要在 init 后就手写完整配置？
**来源**：https://biomejs.dev/reference/configuration/

不必。init 的最小 biome.json 常够起手，按需增量加 files.include、formatter 选项、linter 微调即可。一次抄满配往往带进不理解的规则、增噪音。
