# 面试题：import 整理（biome-organize-imports）

### 1. (原理类) organizeImports 到底做了什么？
**来源**：https://biomejs.dev/reference/configuration/

按自然顺序对 import 分组、组内稳定排序、去重复，把散乱的导入变成一致版式。它是 biome check 的第三件事（format+lint+organizeImports），--write 时落地。

### 2. (对比类) 和 simple-import-sort / import/order 比？
**来源**：https://biomejs.dev/reference/configuration/

基础分组、排序、去重 Biome 内置即达且更快更省事；但若你有极复杂的自定义分层（按 alias 前缀强制顺序、多层组间空行规则），ESLint 那套插件的细粒度配置目前更强。

### 3. (实战类) 怎么启用 import 整理？
**来源**：https://biomejs.dev/reference/configuration/

organizeImports:{enabled:true}，然后 biome check --write 或让编辑器保存时应用。它默认参与 check，无需额外插件。

### 4. (坑类) 整理后副作用 import 执行顺序变了？
**来源**：https://biomejs.dev/reference/configuration/

import "./polyfill.css" 这类靠顺序/位置生效的副作用导入，重排后位置可能变化。留意其是否仍在预期时机执行，必要时用注解/配置防移动，或把副作用显式化。

### 5. (对比类) CI 里怎么校验「import 没整理」？
**来源**：https://biomejs.dev/reference/cli/

跑不带 --write 的 biome check，organizeImports 发现问题会以非零退出码/diagnostic 报告。本地交给保存自动整理，CI 只做校验不落地。

### 6. (实战类) 和 IDE 的 organize imports 冲突怎么办？
**来源**：https://biomejs.dev/reference/vscode/

关掉 IDE 自己的 organize-on-save，统一由 Biome 做，保证全团队排序规则一致且 CI 可复现。留两个真源会因「谁最后写」产生无意义抖动。

### 7. (原理类) 为什么 Biome 内置整理优于外挂插件？
**来源**：https://biomejs.dev/reference/configuration/

少一个依赖、少一份配置、且和格式化/lint 共享同一次解析在原生层完成，速度远快于 JS 插件。对绝大多数项目「够用且更快」，把自定义复杂度留给真需要的团队。

### 8. (对比类) apply 与 check 模式区别？
**来源**：https://biomejs.dev/reference/cli/

check 只报「import 该整理」不落地，apply（--write）才真正重排文件。理解这层，你就知道为什么 CI 用 check、本地/提交前用 --write。

### 9. (坑类) 整理会不会删掉「看似没用实则有副作用」的 import？
**来源**：https://biomejs.dev/reference/diagnostics/

裸 import "./x" 的副作用要谨慎对待，配合 lint 的未使用检查与副作用顺序意识。别指望整理理解所有隐式依赖，重排后跑测试验证。

### 10. (实战类) 怎么让某几行 import 不被移动？
**来源**：https://biomejs.dev/reference/configuration/

用行内注解/配置标注保留位置，或调整其书写使其在自然序里本就落在期望处。核心是给「需要固定位置」的导入一个显式理由，而非默默祈祷不被整理。

### 11. (原理类) natural order 是什么排序？
**来源**：https://biomejs.dev/reference/configuration/

一种稳定、可预测的分组+排序规则（按来源模块归类、内部按自然序），目标是同项目 import 版式统一且跨机器一致。它不追求「你自定义的多层规则」，而追求「开箱即一致」。

### 12. (对比类) Biome 整理和 TypeScript 的 organizeImports？
**来源**：https://biomejs.dev/reference/configuration/

tsc/TS 服务也提供 import 整理，但那是编辑器/语言服务层、规则可配性有限且不参与 CI。Biome 把它变成团队统一、CI 可复现、Rust 快速的一等能力。

### 13. (实战类) 迁移时 import 巨量变化怎么 review？
**来源**：https://biomejs.dev/guides/big-projects/

与格式化同理：把「整理 import」放独立 commit、必要时独立 PR，用 --ignore-rev 保护 blame，让 reviewer 不必在功能改动里分辨哪些是排序噪声。

### 14. (坑类) 为什么本地整理过、CI 仍报未整理？
**来源**：https://biomejs.dev/reference/configuration/

可能本地 IDE 用了另一套整理（TS/Volar）而 CI 用 Biome 规则，或 Biome 版本不同。统一以 Biome 为 import 整理真源并对齐版本。

### 15. (选型类) 什么团队应保留 ESLint import 插件而非用 Biome？
**来源**：https://biomejs.dev/reference/configuration/

有强分层架构约束（如依赖方向、per-directory 顺序策略）并已在 ESLint 里精细编码的团队。若只是想要「import 整齐一致」，Biome 内置足矣。
