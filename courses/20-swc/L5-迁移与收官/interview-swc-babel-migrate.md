# 面试题：从 Babel 迁移（swc-babel-migrate）

### 1. (实战类) preset-env 怎么直译到 SWC？
**来源**：https://swc.rs/docs/migrating-from-babel

targets→env.targets（browserslist）或 jsc.target；corejs/useBuiltIns→env.coreJs+env.mode；loose→jsc.loose。preset-env 的「一个插件全家桶」在 SWC 是几组正交 env/jsc 开关。

### 2. (对比类) preset-react 的对应关系？
**来源**：https://swc.rs/docs/configuration/compilation

runtime:automatic→jsc.transform.react.runtime=automatic；pragma→classic runtime + react.pragma；development→react.development/runtime.refresh。多数 react 相关 babel 插件在 SWC 是内联配置而非插件。

### 3. (实战类) preset-typescript 换过来要做什么？
**来源**：https://swc.rs/docs/migrating-from-tsc

设 jsc.parser.syntax=typescript 即可（自动擦类型），配合 decorator 相关开关。但记住 SWC 不查类型，迁移同时要在别处保留 tsc --noEmit。

### 4. (原理类) 为什么迁移后行为可能变？
**来源**：https://swc.rs/docs/migrating-from-babel

不同实现、helper 策略、模块 interop、装饰器展开都有细微差异。官方不保证与 Babel 逐字节一致，只保证语义等价场景。故验收要 diff 产物而非只看「能编」。

### 5. (实战类) 迁移验收的两步是什么？
**来源**：https://swc.rs/docs/migrating-from-babel

① 典型模块两边各编、并排 diff 产物（看 helper/interop/decorator）；② 针对编译产物跑完整测试。全绿+diff 无意外才算迁完，缺一不可。

### 6. (坑类) 只有 babel 插件、SWC 无对等怎么办？
**来源**：https://swc.rs/docs/plugin/ecmascript/getting-started

优先换等价写法；不行则保留混合管线（SWC 主转译 + 少数文件走 Babel）；最后才考虑写 Wasm 插件。别为一个冷门插件卡住整个迁移。

### 7. (对比类) 能一半 Babel 一半 SWC 吗？
**来源**：https://swc.rs/docs/migrating-from-babel

可以。monorepo 里各包独立选、或同项目按 rule 对不同文件分派 loader。渐进迁移正是靠这点降低风险：先迁瓶颈大、插件需求少的模块。

### 8. (实战类) 迁移顺序怎么定最稳？
**来源**：https://swc.rs/docs/benchmarks

先转译是瓶颈且 Babel 插件需求少的模块（收益大风险小），把重度依赖冷门插件、interop 敏感的库放最后。就近 .swcrc 让各包独立切换。

### 9. (原理类) 为什么类型检查在迁移前后都不能丢？
**来源**：https://swc.rs/docs/migrating-from-tsc

Babel(preset-typescript) 和 SWC 都只擦类型不查。迁移只是换了「谁擦类型、以多快速率」，类型权威始终是 tsc。甩 Babel≠甩类型。

### 10. (坑类) 迁移后测试源码全绿但线上出事？
**来源**：https://swc.rs/docs/migrating-from-babel

因为你测的是源码不是产物。行为差异（interop/helper/decorator）只在编译产物暴露。务必针对产物测，并把产物 diff 纳入 review。

### 11. (实战类) 装饰器项目在迁移里有何特别？
**来源**：https://swc.rs/docs/configuration/compilation

要显式对齐 legacy/标准两套语义：legacyDecorator+decoratorMetadata（Nest/Angular）与 tsconfig 的 experimentalDecorators 一致，否则 DI 元数据在产物里丢失，测试/运行才暴露。

### 12. (对比类) Babel 的 .browserslistrc 能复用吗？
**来源**：https://swc.rs/docs/configuration/supported-browsers

能。SWC 的 env.targets 可留空回退读 browserslist 配置，与 autoprefixer/stylelint 共享同一份目标，迁移时目标声明无需重造。

### 13. (原理类) 迁移的心智转变是什么？
**来源**：https://swc.rs/docs/migrating-from-babel

从「安装并组合插件」转向「配置一组正交开关」（parser/transform/env/module/minify）。理解每个开关作用域，比记 preset 名更能应对差异排查。

### 14. (实战类) 怎么向团队证明迁移是安全的？
**来源**：https://swc.rs/docs/benchmarks

拿真实模块做 A/B：Babel/SWC 各编、并排 diff 关键产物片段、跑同一套针对产物的测试、给出前后构建耗时。用数据+差异清单说话，而非「听说更快」。

### 15. (坑类) 迁移完还留着 babel.config 会怎样？
**来源**：https://swc.rs/docs/migrating-from-babel

在 Next 等框架里，检测到自定义 Babel 配置会把 SWC 旁路回 Babel（呼应 L2）。迁完要清理残留 babel 配置，否则以为在用 SWC 其实没有。
