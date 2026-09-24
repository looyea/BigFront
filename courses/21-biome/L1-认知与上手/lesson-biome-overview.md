# Biome 是什么：本教程的覆盖边界

## 一、一个二进制干两件事

Biome（读作 /biˈoʊm/）是用 Rust 写的**单个可执行文件**，同时提供 **formatter（格式化）+ linter（代码检查）**，目标是一举替代你工具链里的 Prettier 和（大部分）ESLint。它是已搁浅的 Rome 项目的社区延续。核心卖点：快（原生二进制、无 Node 冷启动）、零配置起手、**一个配置文件**同时管格式与规则。

## 二、和 Prettier / ESLint 的定位差异

- **对比 Prettier**：Biome 格式化器对 JS/TS/JSX/JSON/CSS/GraphQL 支持主流排版，性能高出一个数量级；极少数 Prettier 边角排版可能不完全一致。
- **对比 ESLint**：Biome linter 覆盖最常用的correctness/suspicious/style/complexity 等规则，快得离谱；但**基于插件的长尾规则**（很多框架专属规则）ESLint 生态仍更全。所以现实是「Biome 接管主干 + 必要时 ESLint 补插件」共存。

## 三、本教程覆盖什么、不覆盖什么（重要）

**这不是一份规则手册的逐条翻译。** Biome 有 200+ 条 lint 规则、完整的 CLI 子命令矩阵、尚在演进的插件系统、多语言（CSS/GraphQL）的实验格式化——我们**不逐一展开**。我们只锁定主流应用必经的主干：

1. 初始化 + 第一条 `biome check`；
2. `biome.json` 四分区与格式化选项；
3. 规则分组与 recommended 起手；
4. 从 ESLint + Prettier 迁移与共存；
5. CI / monorepo 工程化接入。

学完十五关你要能**独立把一个项目从 Prettier+ESLint 切到 Biome（或共存）并接进 CI**，而不是背下每条规则。规则细节永远回官方规则清单查——我们保证你知道**该去哪查、什么时候需要**。

## 四、怎么学 + 与前后的呼应

每关课文 + 10 题小测 + 15 道带来源面试题，风格以简明为主。Biome 属于工程化一环：它和 **20-swc（编译）、22-vitest（测试）** 一起构成 Rust/TS 新工具链全景，收官关会把它们串起来。呼应 **10-vite**：很多 Vite 项目正把 Biome 设为默认格式化器。

## 小结
Biome=Rust 单二进制=formatter+linter，是 Rome 延续，主打快/零配置/单配置；对 Prettier 是超集式提速替代、对 ESLint 是主干覆盖+插件共存；本包不求逐条刷规则，只求走通初始化-格式化-lint-迁移-CI 主干，细节回官方规则清单查。

## 部署预告
先在任意一个 TS 项目 `npm i -D @biomejs/biome && npx biome init`，跑一次 `npx biome check ./src`，看它一次性报出多少「格式 + lint + import 顺序」问题——先感受一下「一个命令接管日常」是什么体验。
