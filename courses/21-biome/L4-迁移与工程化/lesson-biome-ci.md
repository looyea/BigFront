# CI 与提交前检查

## 一、官方 CI 模板

Biome 提供 GitHub Action 模板（`biomejs/ci.yml`），核心是 `biome ci` 子命令：非交互、输出便于机器消费、失败置退出码挡 PR。常见加固：`--error-on-warnings` 让 warning 也失败，避免「绿着过但其实有诊断」。

## 二、check vs ci 在流水线里

本地用 `biome check`（或 `--write` 修）；CI 用 `biome ci`（或 `biome check` 加严格 flag）——二者诊断能力一致，ci 模式针对无人值守环境优化。CI 里**永远不带 --write**：CI 应校验而非偷偷改仓库。

## 三、提交前：husky + lint-staged

只检改动文件、快且聚焦：

```js
// .lintstagedrc
{ '*.{js,ts,jsx,tsx,json,css}': 'biome check --write --no-errors-on-unmatched' }
```

husky 的 pre-commit 调 lint-staged，把 Biome 的 safe fix 落盘并暂存。因为 Biome 快，提交前跑全量或增量都不卡。

## 四、增量：只检本次改动

大仓别每次全量。`biome check --changed --since=main`（或结合 vcs 配置）只检相对基线分支改动的文件；GitHub Action 的 PR 事件里对「本 PR 触及的文件」跑 check，反馈更聚焦。vcs.useIgnoreFile 让它复用 .gitignore 划范围。

## 五、缓存与退出码

Biome 单二进制本身极快，通常不需额外缓存层；真要提速就缓存「上一次诊断快照」做增量对比。退出码（0/非0）是流水线判断的唯一可靠信号，别去 parse 日志文本。评论模式（Action 把诊断贴成 PR comment）则帮开发者在 review 里直接看到该修什么。

## 小结
官方 ci.yml 模板用 biome ci 子命令（非交互、退出码挡 PR）+ --error-on-warnings 收紧；本地 check、CI 永不 --write（只校验不改仓库）；husky+lint-staged 提交前只检改动并 safe fix；大仓用 --changed --since=main 增量；退出码是流水线唯一可靠信号、评论模式帮 review。

## 部署预告
给项目加一份基于 Biome 官方模板的 GitHub Workflow：PR 时跑 biome ci --error-on-warnings；再加 husky pre-commit + lint-staged 让本地提交前自动 biome check --write 改动文件。故意提交一个含未用变量的文件，看两道关卡谁先拦住。
