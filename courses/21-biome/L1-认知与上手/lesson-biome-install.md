# 安装与第一条 biome check

## 一、装 + 初始化

```bash
# 目的：装 Biome 单二进制并 init——生成带 $schema 的最小 biome.json
npm i -D @biomejs/biome     # 或 pnpm add -D / yarn add -D；按平台分发预编译二进制
npx biome init              # 在项目根生成最小 biome.json（含 $schema 供编辑器补全/校验）
# ✅ 装完即 npx biome 可用，无需插件加载器——Rust 原生二进制无 Node 冷启动
# ❌ 跨机器锁文件没带全平台二进制（同 20-swc optionalDependencies 坑）→ CI 报找不到对应 @biomejs/cli-*
```

Biome 是单个二进制，npm 包按平台分发（和 20-swc 的 optionalDependencies 思路一致），装完即可用 `npx biome`。

## 二、一把梭：biome check

`biome check` 是**聚合命令**，一趟跑三件事：**format 检查 + lint + organize imports**。

```bash
# 目的：biome check 聚合命令——一趟跑 format 检查 + lint + organize imports
npx biome check ./src              # 只报告不改（CI 里常配 --error-on-warnings）
npx biome check --write ./src      # 落盘“安全修复”：格式化/import 整理/明确的 lint autofix
# ✅ 日常本地与 CI 一个 check 就够；退出码 0 无问题、1 有诊断，能直接挡住 PR
# ❌ 指望 --write 修掉一切→破坏性 lint 修复默认不做，须显式 --unsafe，否则防改坏的那类仍留着
```

记住三命令边界：

| 命令 | 干什么 |
|---|---|
| `biome format` | 只管格式化（不动 lint） |
| `biome lint` | 只管规则诊断（可 --write 应用 safe fix） |
| `biome check` | format + lint + organize imports 全做 |

日常本地/CI 里，**一个 `check` 就够**。

## 三、--write 与退出码

`--write` 应用「安全修复」（格式化、import 排序、明确的 lint autofix）。有些破坏性的 lint 修复要靠 `--unsafe`（默认不开，防改坏）。退出码：0 无问题、1 有诊断——这决定了它在 CI 里能否挡住 PR。CI 常加 `--error-on-warnings` 让 warning 也算失败。

## 四、VS Code：设为默认格式化器

装 Biome VS Code 扩展，把工作区默认格式化器设为 Biome，保存即格式化。要点：把 `editor.formatOnSave` 打开、并让 Biome 扩展接管（它内部走 LSP/daemon，几乎零延迟）。这样 `biome.json` 就成了「团队格式规范 + 编辑器实时执行」的单一来源。

## 五、第一条命令的常见困惑

「为什么 check 报了 format 问题我却没配 format？」——因为 Biome **默认就开**格式化与 recommended 规则集，零配置即有意义。 `biome.json` 用来微调，不用来「从零开启」。这正是它相对 ESLint 的起手体验优势。

## 小结
装=单包按平台分发、init 生带 schema 的 biome.json；check 是 format+lint+organize imports 的聚合、--write 落安全修复（--unsafe 才做破坏性）；退出码挡 CI、--error-on-warnings 更严；VS Code 扩展设默认格式化器+保存即格式化；Biome 默认即开 recommended，零配置就有意义。

## 部署预告
在你刚 init 的项目里分别跑 `biome format ./src`、`biome lint ./src`、`biome check ./src`，比较三者输出条数，体会 check=另两者之和+import 整理；再 `check --write` 前后 git diff 看它到底改了哪些，最后给 VS Code 配好保存即用 Biome 格式化。
