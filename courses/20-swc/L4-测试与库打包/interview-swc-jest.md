# 面试题：swc-jest（swc-jest）

### 1. (实战类) 五分钟给 Jest 换 SWC 引擎怎么做？
**来源**：https://swc.rs/docs/usage/jest

装 @swc/jest，jest.config 的 transform 把匹配 TS/JSX 的规则指向 ['@swc/jest', {jsc:...}]，删掉 babel-jest 相关配置。配置对象即 .swcrc 形状。

### 2. (对比类) @swc/jest 和 babel-jest 的本质区别？
**来源**：https://swc.rs/docs/usage/jest

转译内核从 Babel(JS) 换成 SWC(Rust 原生)。速度快、配置心智不同；但依赖 babel 插件的特殊 transform 需找 SWC 对等物或另处理。

### 3. (对比类) 既然有 Vitest 为什么还用 swc-jest？
**来源**：https://swc.rs/docs/usage/jest

Jest 存量项目只想提速、又不想整体迁到 Vite/Vitest，@swc/jest 是低风险替换。新 Vite 项目则直接 Vitest(esbuild) 更统一。二者按生态选、不必同项目并存两套。

### 4. (坑类) Nest 项目换 @swc/jest 后测试报 provider 找不到？
**来源**：https://swc.rs/docs/usage/jest

多半没在 transform 配置里开 legacyDecorator+decoratorMetadata，DI 元数据没发射。补上即与构建端对齐。

### 5. (实战类) 覆盖率还用 babel-plugin-istanbul 吗？
**来源**：https://swc.rs/docs/usage/jest

转译不经 Babel 了，istanbul 那条注入链要重验。更省心是 coverageProvider:'v8' 采原生 V8 覆盖率，与转译器解耦。

### 6. (坑类) Cannot use import outside a module 怎么办？
**来源**：https://swc.rs/docs/usage/jest

文件没进 transform 或 ESM/CJS 格式不匹配：确认 transform 正则覆盖、必要时配 module.type 让产物与 Jest 运行格式一致。

### 7. (原理类) @swc/jest 会读项目的 .swcrc 吗？
**来源**：https://swc.rs/docs/usage/jest

它按传入的 transform 选项转译；行为与 @swc/core 一致——是否读 .swcrc 取决于是否显式让其读。稳妥是把关键 jsc 选项写进 jest 配置，别依赖隐式发现。

### 8. (实战类) snapshot 在换引擎后大面积变化？
**来源**：https://swc.rs/docs/migrating-from-babel

转译可能改变对象结构/键顺序导致序列化差异。换引擎前先在旧引擎录一份基线，换后 diff，区分「无害格式变化」与「真回归」再重录。

### 9. (对比类) 测试端和构建端配置该一致吗？
**来源**：https://swc.rs/docs/usage/jest

关键项（target、装饰器、JSX runtime、module）应一致，否则「编译过但测试行为不同」或反之。理想是同一份 .swcrc 两处共享。

### 10. (原理类) @swc/jest 会做类型检查吗？
**来源**：https://swc.rs/docs/migrating-from-tsc

不会，和构建端一样只擦类型。类型问题由编辑器/tsc 单独管，测试跑得快正因为它跳过了类型检查。

### 11. (实战类) 如何量化换 swc-jest 的收益？
**来源**：https://swc.rs/docs/benchmarks

同一套测试分别用 babel-jest / @swc/jest 各跑，记录冷启动与全量运行时间（多次取中位）。多数 TS 大仓转译阶段大幅下降。

### 12. (坑类) 某些 babel 插件的 transform 没了导致测试挂？
**来源**：https://swc.rs/docs/plugin/ecmascript/getting-started

先找 SWC 内置对等（react/ts 类多内置）、再找社区 Wasm 插件、都没有则该测试保留走 babel，或改写不依赖该插件的写法。迁移长尾。

### 13. (对比类) ESM 项目里 jest 该怎么配合？
**来源**：https://swc.rs/docs/usage/jest

Jest 的 ESM 支持本身有成本；用 @swc/jest 把测试码转成 Jest 舒适消费的格式（常转 CJS）最省事，除非你已完整跑通 Jest ESM 模式。

### 14. (实战类) mock 模块和 swc-jest 有冲突吗？
**来源**：https://swc.rs/docs/usage/jest

没有，jest.mock 是运行时注入 mock，与转译层正交。但涉及 hoisting/transform 顺序的边角可对比 babel 插件版行为验证。

### 15. (原理类) 为什么换引擎后测试文件解析更快？
**来源**：https://swc.rs/docs/usage/jest

SWC 把每个测试文件的 TS/JSX 转译交给原生二进制、无 Babel 的 JS AST 开销与插件遍历，冷启动大量文件的解析成本被压平。
