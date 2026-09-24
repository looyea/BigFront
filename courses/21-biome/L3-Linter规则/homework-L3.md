# L3 作业：Linter 规则

## 一、知识回顾
1. group/ruleName 命名寻址、recommended/all/逐条 off 三档、六大 group 定位、biome explain、按组配基线。
2. correctness 整组常开、noFloatingPromises/useAwaited 的三条出路、与 tsc 互补。
3. style 主观需降档、complexity 阈值按现实、a11y 是产品缺陷应常开、ESLint 风格规则映射。

## 二、代码实操
1. 跑 `biome check ./src` 把诊断按 group 归类统计；挑一条不认同的 style 用 `biome explain` 读动机后在配置里降为 off/warn。
2. 在 src 故意制造未用变量、漏 await 的 Promise、对 const 赋值，看 correctness 各报一条；给漏 await 处分别用 await/.catch()/void 消警。
3. 把 useImportType 设 error，让一处普通 import 引纯类型报错并 `--write` 自动改成 import type；再关掉一条团队不守的命名规范并写理由注释。

## 三、思考题
1. 为什么 correctness 适合整组常开而 style 不适合？
2. no-floating-promises 抓的静默失败，靠 code review 为什么难以每次拦住？

## 四、延伸阅读
- reference/configuration（linter.rules 分组与 severity）
- reference/diagnostics（biome explain 与规则文档）

## 五、自查清单
- [ ] 说清六大 group 各自定位
- [ ] 明白 correctness 整组常开、与 tsc 互补
- [ ] 会按组配基线做「关键组严、风格组松」
- [ ] 用 explain 读懂规则后再决定关/降，别无脑 ignore
