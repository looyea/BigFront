# L1 作业：认知与起跑

## 一、知识回顾
1. Vitest 定位：复用 Vite 管线的快测试框架、Jest 兼容 API 但原生 ESM/TS 免 Babel、watch 即时重跑相关用例。
2. 安装与配置：npm i -D vitest、三条 scripts（watch/run/ui）、独立 vitest.config.ts vs vite.config 的 test 字段、默认 environment:node、include/exclude、globals + tsconfig types。
3. 第一个测试：describe/it(test)/expect 三件套；核心 matcher（toBe/toEqual/toThrow/toBeCloseTo/.not）；文件放置约定；watch 开发、run 给退出码。

## 二、代码实操
1. 在 Vite 或纯 TS 项目 `npm i -D vitest`，加 script `"test":"vitest"`，写 `sum.test.ts`（`expect(sum(1,2)).toBe(3)`）跑通，进 watch 改实现看秒级重跑。
2. 建 `vitest.config.ts`：include 限 `src/**/*.test.ts`、exclude dist/e2e；先 node 环境测纯逻辑，再一个文件顶部加 `// @vitest-environment jsdom` 写一条 document 断言。
3. 用显式 import 与 globals 两种姿势各写一条用例；配好 tsconfig types 消除「找不到 expect」。

## 三、思考题
1. 为什么 Vitest 对 Vite 项目几乎零配置就能测 TS/JSX？（从「复用同一套解析转换」角度答）
2. 本包明确不求逐条讲 matcher/config，那遇到不会断言的东西你该怎么办？

## 四、延伸阅读
- vitest.dev 官方 guide/features、guide/comparisons、config/environment
- 呼应本仓 10-vite 的 vite-vitest 入门关（同一技术两视角）

## 五、自查清单
- [ ] 能三句讲清 Vitest 是什么、快在哪、和 Jest 关系
- [ ] 会装 + 配 scripts + 写并跑通第一条测试
- [ ] 说得清 environment:node 与 jsdom 区别、include/exclude 作用
- [ ] 记住「主干用熟、细节回 vitest.dev 查」的姿势
