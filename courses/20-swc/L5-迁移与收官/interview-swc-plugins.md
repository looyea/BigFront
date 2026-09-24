# 面试题：插件系统（swc-plugins）

### 1. (原理类) SWC 插件为什么走 Wasm 而不是 JS？
**来源**：https://swc.rs/docs/plugin/ecmascript/getting-started

SWC 内核是 Rust，Wasm 插件在同一原生进程里直接操作 Rust AST，无 Rust↔JS 序列化开销；JS 插件要把 AST 过边界、慢且实验性。生产路线因此是 Rust→Wasm。

### 2. (实战类) 什么时候根本不需要插件？
**来源**：https://swc.rs/docs/configuration/compilation

当需求已被内置 transform 覆盖：react runtime、styled-components/emotion、装饰器、jest、import 转换、TS 擦除等大多有开关。第一反应永远是查 jsc.transform/experimental 而非动手写插件。

### 3. (坑类) 升级 @swc/core 后插件崩了为什么？
**来源**：https://swc.rs/docs/plugin/ecmascript/compatibility

Wasm 插件按特定 AST 结构编译，core 升版 AST 可能变。v1.15 前尤其严重；即便有了 plugin_transform_v2，仍需让插件与所用 core 版本兼容。升级前查插件支持矩阵。

### 4. (实战类) 同一项目里版本为什么要统一？
**来源**：https://swc.rs/docs/plugin/selecting-swc-core

不同依赖（如 swc-loader、@swc/jest、next 内置）可能各带一份 @swc/core，多版本共存会让 Wasm 插件 ABI 对不上。selecting-swc-core 文档专门教你把全项目锁到同一 core 版本。

### 5. (对比类) JS 插件和 Wasm 插件能力谁强？
**来源**：https://swc.rs/docs/plugin/ecmascript/getting-started

理论都能改 AST，但 Wasm 能完整访问 SWC 的 Rust AST API 且高性能；JS 插件面窄、慢、实验性。要写「能上生产的自定义转换」就只有 Wasm 一条正路。

### 6. (实战类) React Compiler 需要自己写插件吗？
**来源**：https://swc.rs/docs/configuration/react-compiler

不用，SWC 提供 React Compiler 集成开关（configuration/react-compiler）。这再次说明：先找官方内置/集成，别造轮子。

### 7. (原理类) 注册多个插件的顺序重要吗？
**来源**：https://swc.rs/docs/plugin/registering-plugins

重要。插件按顺序对 AST 依次 transform，前一个的输出是后一个的输入，顺序不同结果可能不同。注册与文档会强调排列，迁移时留意原 Babel 插件顺序语义。

### 8. (对比类) 发布一个 Wasm 插件要注意什么？
**来源**：https://swc.rs/docs/plugin/publishing

要产出正确 target 的 Wasm、声明兼容的 swc_core 版本、命名符合约定（供 jsc.experimental.plugins 引用）。门槛显著高于发一个 JS Babel 插件。

### 9. (实战类) styled-components 到底内置还是插件？
**来源**：https://swc.rs/docs/configuration/compilation

早期靠插件、后转为内置 transform 选项。结论是：这类高频需求 SWC 倾向内置化，配 jsc.transform 相关项即可，不必再挂 Wasm 插件。

### 10. (坑类) 「实验性」标签意味着什么？
**来源**：https://swc.rs/docs/plugin/ecmascript/compatibility

接口/行为可能破坏性变更、不承诺兼容。选插件要避开实验项用于生产关键路径；对内置但标注 experimental 的开关也要在升级时重点回归测试。

### 11. (原理类) 为什么插件 ABI 是个问题？
**来源**：https://swc.rs/docs/plugin/ecmascript/getting-started

Wasm 无稳定 ABI 时，插件与宿主对内存布局/函数签名的假设一旦随 core 变化就错位、崩溃。plugin_transform_v2 通过约定稳定接口缓解，本质是版本契约问题。

### 12. (实战类) 一个只有 Babel 插件的冷门语法怎么迁？
**来源**：https://swc.rs/docs/plugin/ecmascript/getting-started

三条路：找社区等价 SWC 插件；把该转换用等价写法在设计层规避；或对该模块保留 Babel 做混合管线。这是迁移长尾，别硬写 Wasm 除非 ROI 划算。

### 13. (对比类) SWC 插件生态 vs Babel 插件生态？
**来源**：https://swc.rs/docs/roadmap

Babel 胜在十几年 JS 插件数量与广度；SWC 插件少但增长中，且高频场景已内置化弥补生态差距。评估「能不能换」本质是评估「需求是否已被内置/社区覆盖」。

### 14. (原理类) 写一个最小 Wasm 插件要会什么？
**来源**：https://swc.rs/docs/references/wasm-typescript

会 Rust、理解 SWC AST 节点、用 StructVisitor/ast_tools 派生遍历、编成 wasm32-wasi 目标、按约定导出 plugin_transform。门槛决定它适合工具库作者而非普通业务。

### 15. (实战类) 怎么判断某插件该不该进生产？
**来源**：https://swc.rs/docs/plugin/ecmascript/compatibility

看三点：是否标注稳定（非 experimental）、与你的 @swc/core 版本兼容矩阵是否覆盖、维护活跃度。任一存疑就用集成测试在产物上验证行为，别只信 README。
