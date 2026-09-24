# L2 作业：格式化

## 一、知识回顾
1. formatter 选项与 Prettier 逐项对照、缩进与 EditorConfig 对齐、全量 --write 走独立 commit、99% 非逐字节一致。
2. organizeImports 自然序整理、与 simple-import-sort 的强弱对照、副作用 import 位置、与 IDE 择一真源。
3. assist/action 定位、// biome-ignore 强制理由、biome-ignore-all/suppress、别拿 ignore 掩盖该进配置的分歧。

## 二、代码实操
1. 把 `.prettierrc` 每条翻译进 biome.json formatter，对 3~5 个典型文件 diff Biome vs Prettier 输出，记录不可接受的差异。
2. 开 organizeImports.enabled，找一个乱序文件 `check --write` 看整理；再写 `import './x.css'` 副作用导入确认位置符合预期。
3. 用 `// biome-ignore <规则>: <理由>` 抑制一条不认同的规则（故意省略理由看是否报错），再全局 grep biome-ignore 数量做审计。

## 三、思考题
1. 为什么格式化落地要独立 commit 并配 blame 忽略？
2. 能被 action 自动修的问题，为什么不该用 ignore 掩盖？

## 四、延伸阅读
- reference/configuration（formatter / organizeImports / assist 字段）
- reference/diagnostics（ignore 与 suppression 机制）

## 五、自查清单
- [ ] 能把 Prettier 选项逐项映射到 formatter
- [ ] 会开 organizeImports 并处理与 IDE 的冲突
- [ ] 懂 // biome-ignore 强制理由与精确 scope
- [ ] 格式化/import 整理都走独立可审计的落地方式
