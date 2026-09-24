# 规则分组与 recommended

## 一、规则的命名与寻址

Biome 规则用 **`group/ruleName`** 两段命名，例如 `lint/correctness/noUnusedVariables`、`lint/suspicious/noExplicitAny`。配置、ignore 注解、CLI 过滤都按这个路径寻址。理解命名，就知道去哪关、去哪查。

## 二、recommended / all / disabled 三档基线

`linter.rules` 里用一个开关定基线：

- `recommended: true`：官方精选低噪音集，绝大多数团队的起手。
- `all: true`：全开含强风格/高争议规则，噪音大，除非你知道自己在做什么。
- 逐组/逐条 `"off"`：在基线上关具体的。

起手永远 recommended，再按需**单条**微调，别用 all 硬啃。

## 三、六大 group 的定位

| group | 管什么 | 例 |
|---|---|---|
| correctness | 几乎肯定是 bug | noUnusedVariables、noConstAssign |
| suspicious | 可疑但未必错 | noExplicitAny、doubleEquals |
| style | 风格/可读性 | useConst、noVarFunction、useImportType |
| complexity | 复杂度/反模式 | useWhile、noExcessiveNestedTestSuites |
| security | 安全隐患 | 危险 API、注入类 |
| performance | 性能反模式 | 已知慢写法 |
| nursery | 实验/孵化中 | 未稳定的新规则 |

## 四、severity 微调 + biome explain

单条规则可设 `"off" | "info" | "warn" | "error"`。想知道某规则到底检测什么，用 `biome explain <rule>`（或查官方规则清单）——它给出动机、案例、是否可自动修。别对没读懂的规则随意 ignore。

## 五、defaultRules：整组起手策略

`linter.rules` 也支持按 group 配 `recommended/all`，例如只把 correctness 设 all、其余 recommended。这样能「关键组严格、风格组宽松」，比全局 all 或全局 recommended 更贴合团队诉求。

## 小结
规则以 group/ruleName 两段命名可精确寻址；recommended（低噪音起手）/all（激进）/逐条 off 三档基线；六大 group correctness/suspicious/style/complexity/security/performance 加 nursery 各自定位；单条可设 off/info/warn/error、用 biome explain 读懂再决策；defaultRules 支持按组配基线做「关键组严、风格组松」。

## 部署预告
跑 `npx biome check ./src`，把报出的诊断按 group 归类统计（correctness 几条、style 几条…），再挑一条你不认同的 style 规则，用 `biome explain` 读它动机，然后在 biome.json 里把它从 error 降到 off 或 warn，观察诊断变化。
