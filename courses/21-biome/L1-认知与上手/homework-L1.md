# L1 作业：认知与上手

## 一、知识回顾
1. Biome 是什么（Rust 单二进制=formatter+linter、Rome 延续）、对 Prettier/ESLint 的定位与「主干+共存」现实。
2. 装/init/check 三命令边界、--write 与 --unsafe、退出码挡 CI、VS Code 设默认格式化器。
3. biome.json 四大分区（files/formatter/linter/organizeImports）、$schema、优先级 CLI>文件>默认。

## 二、代码实操
1. `npm i -D @biomejs/biome && npx biome init`，跑 `npx biome check ./src`，统计一次报出的格式/lint/import 问题分布。
2. 分别跑 `biome format`/`biome lint`/`biome check` 比较输出，体会 check=另两者+import 整理；再 `check --write` 前后 git diff。
3. 手写一份最小 biome.json：include src、排除 dist、4 空格 lineWidth 100、linter recommended、organizeImports 开；故意写错一个字段名看 $schema 是否标红。

## 三、思考题
1. 为什么 Biome 不查类型也不能替代 tsc？它和类型检查的边界在哪？
2. 什么团队适合「全切」、什么团队该「共存」？给出你的判断依据。

## 四、延伸阅读
- Biome 官方：getting-started、configure-biome、reference/configuration、reference/cli
- blog/biome-v2（了解愿景与版本演进）

## 五、自查清单
- [ ] 能三句讲清 Biome 定位、快在哪、和 Rome 关系
- [ ] 会跑 init + 第一条 check 并解释退出码
- [ ] 写得出 biome.json 四大分区各自职责
- [ ] 明确本包不逐条刷规则、细节回官方规则清单查
