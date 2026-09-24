# 格式化器：选项与 Prettier 对照

## 一、常用选项逐项对照

Biome formatter 的核心选项与 Prettier 几乎同名同义，迁移心智负担小：

| 选项 | 含义 | Prettier 对应 |
|---|---|---|
| `indentStyle` | tab / space | `useTabs` |
| `indentWidth` | 缩进宽度 | `tabWidth` |
| `lineWidth` | 每行最大宽度 | `printWidth` |
| `lineEnding` | lf / crlf | `endOfLine` |
| `quoteStyle` | 单/双引号 | 结合 `singleQuote` |
| `bracketSpacing` | 对象花括号空格 | `bracketSpacing` |
| `trailingCommas` | 尾逗号 | `trailingComma` |

多数团队能一一对应过去，排版结果高度一致。

## 二、缩进与 EditorConfig

`indentStyle:"tab" + indentWidth` 对应 Prettier 的 `useTabs+tabWidth`。注意与 `.editorconfig` 的 `indent_style/indent_size` 尽量对齐——否则你编辑器按 editorconfig 缩、Biome 保存后按 biome.json 重排，会反复打架。以 `biome.json` 为格式真源、editorconfig 向其看齐最省心。

## 三、范围控制：formatter.include 与关闭

想「全局格式化但个别目录不动」，用 `files.include`/formatter 级 include 划定，或对某语言 `<lang>.formatter.enabled:false`。也可在 CLI 层临时 `--formatter-enabled=false` 只跑 lint。**别用 ignore 掩盖本该统一格式的代码**——那是格式化该发挥作用的地方。

## 四、全量落地的心法

从 Prettier 迁来，第一次 `biome format --write .` 会产生一个「纯格式化 commit」。规矩做法：单独一个 commit、不与功能改动混、commit message 明确「chore: format with biome」，并让 git blame 策略（`--ignore-rev`）跳过它，免得历史被格式化噪声污染。

## 五、对 Prettier 用户的心理预期

**99% 一致，别期待 100% 字节相同。** 个别长链式调用、复杂 JSX、模板字符串换行的断行点 Biome 与 Prettier 可能不同。迁移前对典型文件 diff 一遍，团队接受就直接切；真有不可接受的排版，再评估该文件是否需要保留 Prettier（少见）。

## 小结
Biome formatter 选项与 Prettier 几乎同名同义（indentStyle/lineWidth/quoteStyle/trailingCommas…）可对照迁移；缩进与 EditorConfig 要对齐、以 biome.json 为真源；用 include/语言级 enabled 控范围但别拿 ignore 掩盖该统一的代码；全量 --write 走独立纯格式化 commit + blame 忽略；对 Prettier 预期是 99% 一致非逐字节。

## 部署预告
把你现有 `.prettierrc` 的每一条翻译成 `biome.json` 的 formatter 字段，对 3~5 个典型文件（含长链式调用、JSX、对象字面量）跑 `biome format` 并与 Prettier 输出 diff，记录哪些地方排版不同、团队能否接受。
