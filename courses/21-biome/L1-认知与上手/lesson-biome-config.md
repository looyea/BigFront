# biome.json 结构速览

## 一、顶层骨架

`biome init` 生成的 `biome.json` 顶层带 `$schema`（编辑器据此补全/校验），主要四大区：

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.x/schema.json",
  "files": { "include": ["src"], "ignore": ["dist", "node_modules"] },
  "formatter": { "enabled": true, "indentStyle": "space", "lineWidth": 100 },
  "linter":    { "enabled": true, "rules": { "recommended": true } },
  "organizeImports": { "enabled": true }
}
```

`$schema` 让你写错字段名时编辑器立刻提示，等于免费的配置文档。

## 二、files：谁被管

`files.include` 划定处理范围（monorepo 尤其重要），`files.ignore` 排除产物/依赖。Biome 默认忽略 `node_modules` 等；`ignoreUnknown` 控制遇到不认识的文件类型是否跳过而非报错。

## 三、四大功能区

- `formatter`：全局格式化开关与选项（也可被 `javascript.formatter` 等语言级覆盖）。
- `linter`：`enabled` + `rules`；`rules.recommended: true`（或 `all`）决定基线，再逐组/逐条微调。
- `organizeImports`：import 自动整理开关。
- `javascript`（`typescript` 同源）：语言级选项（JSX runtime、formatter/linter 覆盖）。

## 四、defaultRules 与 extends

`linter.rules` 里 `recommended: true` 只开官方推荐集（低噪音起手）；`all: true` 全开（激进）。也可用 `extends` 继承预设配置，团队里把公共 biome.json 做成一个包、各子项目 extends 它。

## 五、优先级与最小团队配置

配置优先级：**CLI 参数 > biome.json 显式设置 > 默认值**。一个能直接上线的最小团队配置：`files.include` 圈定 src、formatter 设好 indentStyle/lineWidth 对齐团队旧风格、linter recommended、organizeImports 开——其余等团队踩到再补，别一上来抄满配。

## 小结
biome.json 顶层 $schema + files(圈范围)+formatter+linter+organizeImports+javascript 分区；files.include/ignore 定处理对象；linter.rules.recommended/all 定基线再逐条微调、extends 继承预设；优先级 CLI>文件>默认；起手用最小可用配置、按需增长。

## 部署预告
手写一份 `biome.json`：include 你的 src、排除 dist、formatter 用 4 空格 lineWidth 100、linter recommended、organizeImports 开。把 `$schema` 指对版本，故意把一个字段名写错，看编辑器是否因 schema 立刻标红。
