# 面试题：SWC 定位与覆盖边界（swc-overview）

### 1. (原理类) SWC 为什么比 Babel 快？
**来源**：https://swc.rs/docs/benchmarks

核心逻辑用 Rust 编译成原生二进制，无 Node/V8 启动与 GC 开销，并行度好；Babel 的转译跑在 JS 单线程 AST 上。SWC 官方持续跑对 Babel/esbuild 的基准。

### 2. (原理类) SWC 与 esbuild 怎么选？
**来源**：https://swc.rs/docs/benchmarks

esbuild(Go) 极致快但语法特性是子集、插件用 JS、以转译+打包为主；SWC(Rust) 特性覆盖更全（装饰器等）、有 Wasm 插件、以编译器库形态嵌入各家工具。很多项目里两者各司其职而非二选一。

### 3. (对比类) SWC 会做 TypeScript 类型检查吗？
**来源**：https://swc.rs/docs/migrating-from-tsc

不会。SWC 逐文件擦除类型（isolatedModules 式），类型正确性仍靠 tsc/vue-tsc。SWC 编译通过不代表类型没问题，CI 里 --noEmit 那步不能省。

### 4. (生态类) 举三个默认使用 SWC 的场景。
**来源**：https://swc.rs/docs/getting-started

Next.js v12+ 默认编译与 minify；Rspack 的 transform 内核；@swc/jest 替换 babel-jest。此外 Deno、Parcel 等也用其编译能力。

### 5. (定位类) 本教程为什么不逐条讲配置项？
**来源**：https://swc.rs/docs/configuration/swcrc

因为文档会变、配置项极多，背字段没有迁移价值。课程锁定转译-集成-迁移-选型的主干流程，细节教你回官方 swcrc 页按需查，培养的是排错能力而非记忆。

### 6. (对比类) SWC 相对 Babel 的插件模型差异？
**来源**：https://swc.rs/docs/plugin/ecmascript/getting-started

Babel 用 JS 插件改写 AST、生态极丰富但慢；SWC 用 Rust→Wasm 插件在原生层跑、快但编写门槛高且历史版本兼容性差（v1.15 起才缓解）。迁移时常卡在「只有 Babel 插件」的语法。

### 7. (实战类) 什么项目该认真考虑引入 SWC？
**来源**：https://swc.rs/docs/getting-started

webpack 大仓（babel-loader 成瓶颈）、Next/Rspack 用户（本就在用）、自建构建脚本想要统一转译+压缩层。纯 Vite 项目一般不必，esbuild 已占位。

### 8. (原理类) SWC 是打包器吗？
**来源**：https://swc.rs/docs/usage/bundling

它早期有 spack/swcpack，但官方明确「请用专门的打包器」——SWC 的定位是编译器/压缩器库，被 webpack/Rspack/Next 等组合使用，而非自己当 bundler 主打。

### 9. (对比类) 和 tsc 的 transpileModule 比呢？
**来源**：https://swc.rs/docs/migrating-from-tsc

同为「擦类型」思路，但 SWC 快一个数量级且顺带做 JSX/语法降级/压缩。tsc 的优势是类型系统与语言服务，两者互补：SWC 出产物、tsc 出类型与校验。

### 10. (生态类) 怎么看待 Oxc 这类新竞争者？
**来源**：https://swc.rs/docs/roadmap

Oxc（Rust，含 parser/linter/minifier 与 oxlint/oxfmt）是另一条 Rust 工具链路线。SWC 稳在生态与集成度（Next/Rspack 背书），Oxc 冲在解析器通用性与 lint 场景。本包收官关会做四方对照。

### 11. (实战类) 引入 SWC 后 CI 突然挂了，第一反应查什么？
**来源**：https://swc.rs/docs/usage/core

平台二进制：本地 mac 生成的 lockfile 缺 linux 的 optionalDependencies。先 CI 重装/更新 lockfile，再排查配置。跨机器 native 缺失是最高频「本地好好的」故障。

### 12. (定位类) 「SWC 擦除的类型语义」有坑吗？
**来源**：https://swc.rs/docs/migrating-from-tsc

有：const enum 跨文件、仅类型使用的导入需可被判定（isolatedModules/verbatimModuleSyntax）、装饰器元数据。这些 tsc 能理解而 SWC 因逐文件处理会忽略，迁移须显式对齐。

### 13. (原理类) 为什么 minify 也归编译器管？
**来源**：https://swc.rs/docs/configuration/minification

压缩需要 AST 与转译共享同一份解析结果，同趟完成省一次重新解析，且能做常量折叠、死代码删除等结构化优化。SWC 把转译与 minify 统一在一个 Rust 内核里。

### 14. (选型类) 团队从没听过 SWC，你 30 秒怎么讲清价值？
**来源**：https://swc.rs/docs/benchmarks

一句话：把 Next 已经在用的那层 Rust 编译器搬进你的 webpack/jest，转译提速数十倍、配置形状就是 .swcrc，风险点是平台二进制和少量 Babel-only 插件。用官方基准数字兜底。

### 15. (生态类) SWC 是什么团队在维护？
**来源**：https://swc.rs/docs/team

社区驱动，核心由 kdy1 等维护，被 Vercel、ByteDance、Tencent、Shopify 等公司用于生产并有赞助。评估可继续性时看它的 commit 频率与大厂采用面。
