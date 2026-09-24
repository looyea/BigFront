# L5 作业：迁移与收官

## 一、知识回顾
1. 插件第一原则「内置开关能解决就别写」；JS 插件实验、生产走 Wasm；插件与 core 版本耦合（v1.15 ABI）。
2. Babel→SWC 三大预设直译；plugin 按「内置/社区/无对等」三层处理；验收=产物 diff+针对产物跑测试。
3. 五方对照（SWC/esbuild/Babel/tsc/Oxc）；Oxc/Biome 是质量路线与编译路线互补；毕业自查 12 条。

## 二、代码实操
1. 把项目 `babel.config` 每个插件做成「Babel 插件 → SWC 内置 / 需 Wasm 插件 / 无对等」三分类表（迁移输入）。
2. 挑一个用了 preset-env+react+typescript 的 Babel 项目，写等价 `.swcrc`，先只迁一个子模块：两边各编 diff 产物、跑全量测试。
3. 出一份「选型决策卡」：正面 12 条自查，反面「什么栈选什么转译层」判断树，用它向同事 5 分钟讲清「要不要在 webpack 里上 SWC、风险是什么」。

## 三、思考题
1. 为什么迁移完必须清理残留的 `babel.config`（尤其 Next 项目）？
2. 「转译层按框架默认走」这句话，能替你挡掉哪些常见的错误决策？

## 四、延伸阅读
- SWC 官方：migrating-from-babel、plugin/ecmascript/getting-started、plugin/selecting-swc-core、configuration/react-compiler
- 预告：21-biome（Rust 格式/lint 路线）、22-vitest（esbuild 测试路线）

## 五、自查清单
- [ ] 会先盘点内置开关再考虑插件，理解 Wasm 插件的版本耦合
- [ ] 能做 Babel→SWC 的预设直译并做产物 diff + 产物测试双验收
- [ ] 能从速度/正确性/生态/可编程性/可继续性五维做转译层选型
- [ ] 清楚本包没讲的深水区（Wasm 插件/css/ast）与回文档入口
