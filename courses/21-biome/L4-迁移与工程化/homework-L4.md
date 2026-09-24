# L4 作业：迁移与工程化

## 一、知识回顾
1. @biomejs/migrate 近似翻译、覆盖度现实（Prettier 全、ESLint 主干、插件无对等）、职责切分共存、清理 Prettier 清单。
2. 官方 ci.yml 用 biome ci + --error-on-warnings、CI 永不 --write、husky+lint-staged、--changed --since 增量、退出码是可靠信号。
3. 根配置+子包 extends/overrides、files.include/vcs.useIgnoreFile、多语言格式化、与 Turborepo/pnpm 正交。

## 二、代码实操
1. 在有 ESLint+Prettier 的项目跑 `npx @biomejs/migrate`，逐行 review 产出、标出「被 Biome 吃下 / 无对等需保留 ESLint」，画出共存边界表。
2. 加一份基于官方模板的 Workflow：PR 跑 `biome ci --error-on-warnings`；再配 husky+lint-staged 本地提交前 check --write 改动；故意提交含未用变量的文件看哪道先拦。
3. 在 pnpm monorepo 根建 biome.json（vcs.useIgnoreFile:true + 公共），给一子包 extends 覆写一条规则、用 overrides 对 **/*.test.ts 关掉某 complexity 规则，跑 check 验证分层生效。

## 三、思考题
1. 为什么 CI 里绝不该带 --write？改仓库应发生在哪个环节？
2. 迁移为什么以「针对产物的测试全绿」而非「migrate 跑完」为完成标准？

## 四、延伸阅读
- guides/migrate-eslint-prettier、guides/integrate-in-vcs、guides/big-projects
- reference/cli（ci/check/--changed 等）

## 五、自查清单
- [ ] 会用 @biomejs/migrate 并诚实评估覆盖度/共存
- [ ] 会配 CI（biome ci + error-on-warnings）与 lint-staged
- [ ] 能做 monorepo 分层配置 + overrides
- [ ] 迁移以产物测试全绿收尾，职责切分防双工具打架
