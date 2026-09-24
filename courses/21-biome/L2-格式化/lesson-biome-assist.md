# 辅助动作与注解控制

## 一、assist 是什么

Biome 的 **assist**（v1.9+ 逐步成型）是「非纯 lint、非纯格式」的一类自动化动作，最典型就是 organizeImports 与某些 source 操作被归到 assist/actions 之下。它强调「安全地改写代码结构」，在 `biome check`/`--write` 时一并按配置应用。配置里对应 `assist.actions.*`，可逐项开关。

## 二、// biome-ignore 系列

和 ESLint 的 `eslint-disable` 对应，Biome 用行内注解抑制诊断：

```js
// biome-ignore lint/suspicious/noExplicitAny: 迁移期临时容忍
function legacy(x: any) { /* ... */ }
```

**语法要求：冒号后必须写理由。** 无「裸 ignore」——这是 Biome 刻意的纪律：每次压制诊断都得交代「为什么」，避免像 disable 那样沦为藏问题的垃圾桶。

## 三、biome-ignore-all 与 suppress

文件级用 `// biome-ignore-all <规则>: <理由>` 顶置豁免整类诊断。更正式的是 **suppress 机制**：在注释里带 `--biome-ignore-all=<规则>: 说明` 的 suppression comment，Biome 会把它当「已记账的豁免」，配合 CI 让每次压制都可追溯、可搜索、可到期清理。

## 四、注解与 action 的关系

action（安全自动修复）能修的直接修，不需要你 ignore；ignore 只用于「Biome 报了你故意保留的写法」。别把 ignore 当格式化/修复的替代品——能 auto-fix 的问题该修，该修的不该被压制。

## 五、纪律：别用注解掩盖真问题

`// biome-ignore` 是最容易滥用的口子。团队约定：**每条 ignore 必须有理由、有 scope（尽量精确到单规则单行）、可被搜索统计**。定期 grep `biome-ignore` 看有没有变成「常年豁免区」。用注解绕过误报是合理的，用它绕过「这规则我不想守」则要把决策写进配置而非散落代码里。

## 小结
assist=安全改写代码结构的动作类（含 import 整理等），check/--write 时按 assist.actions 应用；// biome-ignore 强制写理由、无裸 ignore；文件级用 biome-ignore-all、正式豁免用 suppress 机制；action 能修的就别 ignore；ignore 要精确/有理由/可审计，别拿它掩盖该写进配置的真实分歧。

## 部署预告
故意触发一条你不认同的规则，用 `// biome-ignore <规则>: <理由>` 抑制它，验证「不写理由会报格式错误」；再全局 grep 项目里的 biome-ignore 数量，体会为什么团队要定期审计这些豁免。
