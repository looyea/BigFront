# 面试题：style/complexity/a11y（biome-style-complexity）

### 1. (对比类) style 组为什么容易引战？
**来源**：https://biomejs.dev/reference/configuration/

它管可读性与一致性（useConst/useTemplate/命名等），高度主观、团队偏好各异。全开会把「你没共识的风格」也变诊断，噪音淹没真问题。策略是只留团队真正达成共识的。

### 2. (实战类) no-var / prefer-const 迁到 Biome？
**来源**：https://biomejs.dev/reference/configuration/

prefer-const→useConst、no-var→命名/var 相关 style 规则、prefer-template→useTemplate。多数经典 ESLint 风格规则在 Biome 有对等，逐条映射即可。

### 3. (原理类) a11y 规则是风格还是正确性？
**来源**：https://biomejs.dev/reference/configuration/

是可访问性正确性，不是审美。useAltText（img 无 alt）、useKeyWithClickEvents（可点元素无键盘支持）代表真实产品缺陷/合规风险，建议保持 error 尤其面向公众的前端。

### 4. (实战类) consistent-type-imports 怎么对应？
**来源**：https://biomejs.dev/reference/configuration/

→ useImportType，强制纯类型用 import type 引入。它能配合擦除式编译器（SWC/esbuild，呼应 20-swc）避免运行时多带 value import，是跨工具链的共识规则。

### 5. (坑类) 认知复杂度阈值设太低会怎样？
**来源**：https://biomejs.dev/reference/configuration/

到处报 complexity，团队为过 CI 硬拆函数或满屏 ignore，反而伤代码。阈值应贴着团队现实，渐进收紧，而非一步到位理想值。

### 6. (对比类) useWhile / complexity 组价值？
**来源**：https://biomejs.dev/reference/configuration/

挡「能简单却写复杂」的滑坡：多余嵌套、该 while 用 for、过深条件。它不报 bug、报「越来越难维护」的趋势，配合 review 防代码熵增。

### 7. (实战类) 不接受某 style 规则怎么优雅关闭？
**来源**：https://biomejs.dev/reference/configuration/

在 biome.json 的 linter.rules.style 逐条 off（或整组降 recommended 子集），配一行理由注释。团队级、可见、可评审，远胜每人各自行内 ignore。

### 8. (原理类) 为什么「能 auto-fix 的 style」优先让 --write 做？
**来源**：https://biomejs.dev/reference/configuration/

这类改动机械且安全，交给工具一次性归零最省人力。别手动逐条改、更别 ignore；--write 后配合纯格式化 commit 落地即可。

### 9. (对比类) Biome a11y 和 eslint-plugin-jsx-a11y？
**来源**：https://biomejs.dev/reference/configuration/

Biome 内置常用 a11y 规则，覆盖核心场景且快；jsx-a11y 插件规则更全更细。要求高的无障碍项目可能仍需插件补足，属「主干 Biome、长尾 ESLint」典型。

### 10. (实战类) 怎么给团队定 style 取舍清单？
**来源**：https://biomejs.dev/reference/configuration/

把争议规则列出来投票/评审，接受的开 error、不接受的显式 off 并记因，形成一份 style 决策表随代码入库。让「我们的风格」是显式契约而非各人默认。

### 11. (坑类) style 全降 info 会失去什么？
**来源**：https://biomejs.dev/reference/diagnostics/

失去可执行性——info 不挡 CI，等于放弃了对该风格的保障。应区分：真在意的用 error、无所谓的直接 off，别用 info 和稀泥。

### 12. (原理类) 为什么把 useImportType 单列强调？
**来源**：https://biomejs.dev/reference/configuration/

它不只是审美：纯类型用 import type 能在擦除式转译下确保不残留 value 依赖，和 SWC/Vitest（见 20/22 包）协同，是「风格规则也能防运行时问题」的例子。

### 13. (对比类) complexity 与性能组 performance 的区别？
**来源**：https://biomejs.dev/reference/configuration/

complexity 管「人类可读的复杂度/反模式」，performance 管「运行时慢写法」。前者关乎可维护性、后者关乎速度，都是「非 bug 但会腐化」的守护。

### 14. (实战类) 新项目 a11y 一开始就开还是后补？
**来源**：https://biomejs.dev/reference/configuration/

一开始就开 error。可访问性后补成本极高（要重构 DOM/事件模型），Biome 在写的时候就提示 useAltText 等，是最低成本的 a11y 保障。

### 15. (坑类) style/complexity 报错太多压不住怎么办？
**来源**：https://biomejs.dev/reference/configuration/

回退到 recommended、把非共识 style 逐条 off、complexity 阈值放宽，先让 linter 可信、噪音可控，再随团队成熟度渐进加严。宁少而稳，不可多而废。
