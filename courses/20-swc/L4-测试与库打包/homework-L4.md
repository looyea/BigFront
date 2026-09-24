# L4 作业：测试与库打包

## 一、知识回顾
1. @swc/jest 换引擎（transform 配置即 .swcrc）、与 Vitest 的生态分工、覆盖率优先 v8、装饰器元数据对齐。
2. 库构建「转译 vs 类型」两条正交轴，SWC 不产 d.ts；entry/external/formats；ESM+CJS exports；isolatedDeclarations 前瞻。
3. exports/typesVersions 对齐、sideEffects、source map 三选一、npm pack --dry-run、借鉴 optionalDependencies 平台分包。

## 二、代码实操
1. 给一个 Jest+babel-jest 的 TS 项目换 @swc/jest，跑 `--coverage --coverageProvider=v8`，记录冷启动前后差；注释掉 decoratorMetadata 看 Nest 测试是否失败。
2. 用极小组件库源码跑通「SWC 出 ESM+CJS 双 JS + tsc 出 d.ts」：配 external 排框架、exports 指两套产物，`npm pack --dry-run` 核对清单。
3. 补一份规范 package.json（main/module/types/exports/sideEffects/files），临时目录 `npm i ./x.tgz` 装本地包并 import/require 双验。

## 三、思考题
1. 为什么源码测试全绿仍不足以证明一个库「可发布」？
2. @swc/jest 和 Vitest 会在同一个项目同时出现吗？什么情况下并存合理？

## 四、延伸阅读
- SWC 官方：usage/jest、usage/bundling、configuration/modules
- npm 文档关于 exports 字段与条件导出

## 五、自查清单
- [ ] 会用 @swc/jest 替换 babel-jest 并配好装饰器/覆盖率
- [ ] 说清库构建里 JS 产物与 d.ts 分别谁负责
- [ ] 写得出规范的 exports/sideEffects 并知道 types 前置
- [ ] 发布前固定跑 npm pack --dry-run 且产物 import/require 双验过
