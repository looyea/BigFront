# 面试题：选型收官（swc-capstone）

### 1. (对比类) SWC 和 esbuild 到底怎么选？
**来源**：https://swc.rs/docs/benchmarks

都极快。esbuild(Go) 更快一档但语法是子集、以转译+打包为主、JS 插件；SWC(Rust) 特性覆盖更全（装饰器等）、可嵌入、有 Wasm 插件。实操按栈默认走：Vite 用 esbuild、Next/Rspack 用 SWC。

### 2. (对比类) 既然有更快的，Babel 还有什么存在理由？
**来源**：https://swc.rs/docs/migrating-from-babel

生态与保守正确性：十几年 JS 插件覆盖冷门语法、语义最贴规范。重度依赖某冷门 babel 插件、或要极致兼容的项目仍留 Babel 是理性选择，不是落后。

### 3. (原理类) 为什么类型检查永远是 tsc？
**来源**：https://swc.rs/docs/migrating-from-tsc

SWC/esbuild/Oxc 都只擦类型不做跨文件类型推断，tsc 是唯一完整的类型系统实现。产物快慢可换工具，「类型对不对」只有 tsc 说了算，故 CI 的 --noEmit 不可省。

### 4. (对比类) Oxc 会取代 SWC 吗？
**来源**：https://swc.rs/docs/roadmap

不宜简单替代。Oxc 重心在通用 parser + lint(oxlint)/format，与 SWC 的「编译/降级」路线互补。SWC 有 Next/Rspack/jest 的深度集成背书。未来更可能是各占分工而非谁灭谁。

### 5. (实战类) 一个老 webpack+Babel 项目要不要上 SWC？
**来源**：https://swc.rs/docs/getting-started

若转译是明显瓶颈且插件需求能映射到 SWC 内置/社区→值得换 swc-loader。反之重度依赖冷门 babel 插件、interop 敏感→谨慎，可能混合管线或维持现状。先测瓶颈再决策。

### 6. (实战类) Vite 项目该引入 SWC 吗？
**来源**：https://swc.rs/docs/benchmarks

一般不该。Vite dev/build 已用 esbuild/Rollup 的最优组合，硬塞 SWC 只增复杂度。SWC 的战场是 webpack/Rspack/Next/自建构建，认清边界比「追新」重要。

### 7. (对比类) Biome 和 SWC 是什么关系？
**来源**：https://swc.rs/docs/roadmap

不同赛道：SWC 是编译器（转译+压缩），Biome 是 formatter+linter（代码质量），都吃 Rust 高性能解析的红利但面向不同环节，可共存于一个工具链。本仓库 21 包专讲 Biome。

### 8. (选型类) 「转译层按框架默认走」怎么理解？
**来源**：https://swc.rs/docs/getting-started

每个框架已为其生态选好兼顾速度与正确的转译层（Next→SWC、Vite→esbuild、webpack→可选 Babel/swc-loader）。逆着默认硬换往往付出集成与正确性代价，除非你确有被量化的瓶颈。

### 9. (原理类) 为什么不能只看「谁基准跑得快」？
**来源**：https://swc.rs/docs/benchmarks

厂商基准是理想输入。真实项目瓶颈可能在类型检查、I/O、依赖安装或打包，而非转译。用自己代码分阶段计时才知道转译值不值得优化——多数时候 SWC 已非瓶颈。

### 10. (实战类) 给团队做工具选型，你的评估维度？
**来源**：https://swc.rs/docs/roadmap

速度、语法/正确性覆盖、生态与集成度（谁在用它、和框架合不合）、可编程性（插件门槛）、可继续性（维护活跃度/大厂背书）。五维打分而非单看速度。

### 11. (对比类) SWC 的定位是打包器还是编译器？
**来源**：https://swc.rs/docs/usage/bundling

编译器/压缩器库，不是打包器。官方早期有 spack 但明确建议用专门打包器——SWC 是被 webpack/Rspack/Next 组合使用的底层件，这点定位贯穿全包。

### 12. (选型类) 「够快」之外，SWC 的护城河是什么？
**来源**：https://swc.rs/docs/customers

语法覆盖完整度（装饰器等）+ 被 Next/Rspack/Deno/Parcel 采用的生态集成度。快谁都能追，嵌进主流框架的编译层才是壁垒。

### 13. (实战类) 本包没讲的深水区，何时需要回头？
**来源**：https://swc.rs/docs/plugin/ecmascript/getting-started

要写自定义转换→Wasm 插件；要做 CSS 工具→swc_css（仍实验）；要自建代码工具→@swc/ast/types；用 Flow→其专门支持。这些回 swc.rs/docs，主干你已能自驱。

### 14. (原理类) Rust 工具链这一波（SWC/Biome/Oxc）的共同逻辑？
**来源**：https://swc.rs/docs/benchmarks

用编译型语言 + 原生二进制 + 并行，把「解析巨大 JS/TS 代码库」的成本打下来。同一底层红利分化出编译(SWC)、格式/lint(Biome)、解析/lint(Oxc) 等分工，是生态趋势而非孤立事件。

### 15. (实战类) 30 秒给 CTO 讲 SWC 的价值与风险？
**来源**：https://swc.rs/docs/customers

价值：把 Next 已在用的 Rust 编译层搬进 webpack/jest，转译提速数量级、配置就是 .swcrc。风险：平台二进制跨机器故障、少量 Babel-only 插件无对等、不查类型仍需 tsc。用官方基准+采用面兜底。
