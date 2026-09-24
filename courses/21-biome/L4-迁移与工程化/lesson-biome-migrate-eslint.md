# 从 ESLint + Prettier 迁移

## 一、官方迁移工具

`@biomejs/migrate` 能把 `.eslintrc*` / `.prettierrc*` 尽量翻译成 `biome.json`：

```bash
npx @biomejs/migrate            # 读现有配置，产出 biome.json
```

它做「最大近似」而非 1:1 保证——Prettier 侧几乎全覆盖，ESLint 侧覆盖主干、插件规则标出「无法映射」。跑完必须人工 review 产出，别直接 commit。

## 二、覆盖度的现实（别自我欺骗）

- **Prettier → Biome formatter**：接近全吃，排版极少数边角可能不同（呼应 L2）。
- **ESLint 内置/常用规则 → Biome linter**：主干覆盖良好。
- **依赖插件的规则（框架专属、冷门）→ 常无对等**：这部分**保留 ESLint 共存**，别硬砍。

清醒认知：多数项目是「Biome 接管格式化 + 大部分 lint，ESLint 退居少数插件」，而非「彻底删干净 ESLint」。

## 三、共存策略

让两者不打架的关键是**职责切分**：Biome 负责 formatter + 它能做的 lint；ESLint 只配「Biome 未覆盖的那些插件规则」，并在 ESLint 里关掉与 Biome 重叠的格式化类规则（避免同一行被两个工具按不同标准改）。CI 两个都跑，本地保存交给 Biome。

## 四、移除 Prettier 的清理清单

决定全接管后：删 `prettier` 依赖、`.prettierrc*`、`eslint-config-prettier`、编辑器里的 Prettier 设为默认格式化器的配置，把 `biome.json` formatter 选项对齐旧 Prettier 风格（缩进/引号/尾逗号/宽度），再跑一次全量 `biome format --write` 归一。

## 五、渐进 vs 一次性

monorepo/大仓建议**渐进**：先在一个包/一个 app 上 Biome，验证无回归、团队适应后推广。小项目可**一次性**：migrate 产出配置 → 全量 format+lint --write → 一个「chore: adopt biome」commit → 加 CI。两条路都要以「针对产物的测试/构建全绿」为收尾。

## 小结
@biomejs/migrate 近似翻译配置（Prettier 近乎全覆盖、ESLint 主干覆盖、插件常无对等）；现实多为 Biome 接管主干 + ESLint 保插件共存、职责切分防打架；全接管要清 Prettier 依赖/配置/编辑器默认并把 biome formatter 对齐旧风格；monorepo 渐进、小项目一次性，都以产物测试全绿收尾。

## 部署预告
在一个有 ESLint+Prettier 的项目跑 `npx @biomejs/migrate`，逐行 review 产出的 biome.json：标出哪些 ESLint 规则被 Biome 吃下了、哪些「无对等」需要保留 ESLint。据此画出你项目的「双工具共存边界表」。
