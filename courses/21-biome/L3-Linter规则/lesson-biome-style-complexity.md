# style / complexity / 可访问性

## 一、style 组：偏主观、要按需

style 管可读性与一致性：`useConst`（能用 const 就别 let）、`useTemplate`（拼串用模板字符串）、`useImportType`（纯类型导入用 `import type`）、命名规范等。它**主观性强、易引战**，团队应对齐「哪些 style 规则真要开」，其余降到 warn 或 off，别让格式化的风格洁癖淹没真问题。

## 二、complexity 组：反模式与过度

complexity 抓「能用更简单写法却写复杂了」：`useWhile`（该用 while 却绕 for）、多余嵌套、过度复杂的条件等，还有 `noExcessiveCognitiveComplexity` 这类认知复杂度阈值。它帮你挡住「越写越绕」的滑坡，但阈值要按团队现实设，别一上来卡太死到处报。

## 三、a11y：可访问性别忘

Biome 有 accessibility 规则（部分归在 recommended）：`useAltText`（img 缺 alt）、`useKeyWithClickEvents`（可点击元素缺键盘事件）等。它们本质是「正确性的一种」——可访问性是产品缺陷不是风格偏好。这组建议保持 error，尤其做面向公众的前端。

## 四、从 ESLint 风格规则迁移映射

你 `.eslintrc` 里的 `no-var`→useConst/noVar 类、`prefer-const`→useConst、`prefer-template`→useTemplate、`@typescript-eslint/consistent-type-imports`→useImportType。多数经典风格规则 Biome 有对等；少数带框架语义的要查迁移映射，没有的保留 ESLint。

## 五、如何优雅地关风格噪音

在 biome.json 里 `linter.rules.style` 可整组降档、或逐条 `"off"`。策略：**correctness/a11y 常开、suspicious/complexity 按团队、style 只留真有共识的**。把「我们不接受某 style 规则」这个决策写进配置（可见、可评审），而不是让每人各自 ignore。

## 小结
style 主观易战、只留团队有共识的其余降档；complexity 挡「越写越绕」但阈值按现实设；a11y 是产品缺陷（useAltText/useKeyWithClickEvents）应常开；经典 ESLint 风格规则多能映射到 Biome（no-var→useConst、prefer-template→useTemplate 等）；关噪音的正确姿势是写进配置分组降档、而非各自 ignore。

## 部署预告
把 `useImportType` 开成 error，找一个用普通 import 引纯类型的文件让 Biome 报错，再 `--write` 让它自动改成 `import type`；然后挑一条你团队不想守的 style 规则（如某命名规范）在 biome.json 里降为 off，并写一行注释说明理由。
