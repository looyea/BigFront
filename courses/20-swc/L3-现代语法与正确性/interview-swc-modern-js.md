# 面试题：装饰器与现代语法（swc-modern-js）

### 1. (实战类) NestJS 项目迁 SWC 装饰器怎么配？
**来源**：https://swc.rs/docs/configuration/compilation

jsc.parser.syntax=typescript + decorators:true，再开 transform.legacyDecorator:true 与 decoratorMetadata:true。三件套缺一不可，尤其 decoratorMetadata 关系到 DI 运行时读取 paramtypes。

### 2. (原理类) legacyDecorator 与 decoratorMetadata 区别？
**来源**：https://swc.rs/docs/configuration/compilation

前者决定用 2017-08 那套装饰器展开语义，后者决定是否发射 design:type/design:paramtypes 等反射元数据。Nest 需要两者都开；纯标准装饰器项目两个都别开。

### 3. (坑类) 忘开 decoratorMetadata 会怎样？
**来源**：https://swc.rs/docs/configuration/compilation

编译不报错、装饰器照样展开，但依赖 Reflect.getMetadata 的 DI/AOP 在运行时拿不到类型信息，表现为注入失败或拿到 undefined。属于「编译过、运行崩」的静默坑。

### 4. (对比类) TS 5 标准装饰器和 legacy 能混用吗？
**来源**：https://swc.rs/docs/configuration/compilation

不应混用。标准装饰器是新语义、签名不同；SWC 里开 legacyDecorator 走老路径，关之走新路径。要与 tsconfig 的 experimentalDecorators 保持一致，否则类型端与产物端语义分叉。

### 5. (实战类) 顶层 await 报错了怎么办？
**来源**：https://swc.rs/docs/configuration/supported-browsers

确认产物是 ESM（module.type=es6）且 target≥es2017；若你其实在发 CJS，顶层 await 无解，改成包在 async IIFE 里。这是语义限制不是配置能绕过。

### 6. (原理类) 私有字段 #x 在低 target 怎么实现？
**来源**：https://swc.rs/docs/configuration/compilation

SWC 用 WeakMap（或 _weakMapGet/_classPrivateField 系列 helper）模拟真私有语义；高 target 直接保留原生语法。降级带来体积与微量性能差异，故别盲目定太低。

### 7. (实战类) polyfill 到底谁来注？
**来源**：https://swc.rs/docs/configuration/supported-browsers

设 env.coreJs:3 + env.mode:usage 让 SWC 按用到的 API 注入 core-js 片段；或自己在入口引 polyfill。SWC 不会凭空补运行时全局，它是「按语法/API 目标」工作。

### 8. (坑类) env.mode:usage 和 entry 差别？
**来源**：https://swc.rs/docs/configuration/supported-browsers

usage=分析每个文件用到哪些特性按需引；entry=假定你在入口手动 import core-js（全量按 targets）。usage 更省体积但依赖静态分析，动态用法可能漏注。

### 9. (对比类) import attributes 支持到什么程度？
**来源**：https://swc.rs/docs/configuration/compilation

SWC 跟踪较新提案，合适 target 下解析/保留，过低目标可能报错或转兼容形式。这类前沿语法一律以 supported-browsers/compilation 文档与实测产物为准，不靠记忆。

### 10. (原理类) decoratorsBeforeExport 是干什么的？
**来源**：https://swc.rs/docs/configuration/compilation

控制装饰器与 export 的相对书写位置解析（@dec export class vs export @dec class）。老/新提案默认不同，跨代码风格时按需设置以免解析失败。

### 11. (实战类) 怎么确认装饰器真的按预期展开了？
**来源**：https://swc.rs/docs/configuration/compilation

编译后打开产物搜 Reflect.decorate / _decorate / __decorate 之类调用与 metadata 发射，比对 tsc 产物结构。行为存疑永远看产物。

### 12. (对比类) class properties 的 define 与 set 语义？
**来源**：https://swc.rs/docs/configuration/compilation

loose/配置影响字段是用 Object.defineProperty（[[Define]]）还是赋值（[[Set]]）写入，对带 setter 的原型链行为不同。迁自 Babel 且依赖该细节时要对齐。

### 13. (坑类) Flow 项目能用这套装饰器配置吗？
**来源**：https://swc.rs/docs/usage/flow

Flow 与 TS 语法解析路径不同，装饰器/类型处理各走各的。SWC 支持 Flow parser，但装饰器元数据语义按 TS/legacy 那一套，Flow 项目迁移要单独验证。

### 14. (实战类) 怎么同时支持两套装饰器项目共存？
**来源**：https://swc.rs/docs/configuration/swcrc

用不同 .swcrc 作用域（monorepo 各子包就近配置）或构建脚本传不同 opts，让 Nest 包开 legacy、新库包走标准，互不干扰。

### 15. (原理类) 为什么低 target 产物 helper 爆炸？
**来源**：https://swc.rs/docs/configuration/compilation

每个降级点（async、可选链、class field、decorator）都可能内联一份小 helper。目标越旧、用到的新语法越多，注入的 helper 越多，包越大——降级深度与体积直接挂钩。
