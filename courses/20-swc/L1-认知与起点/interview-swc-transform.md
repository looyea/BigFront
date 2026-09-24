# 面试题：转译内核（swc-transform）

### 1. (原理类) SWC 一个文件从头到尾经历什么？
**来源**：https://swc.rs/docs/getting-started

按 parser 建 AST → TS 类型擦除 → 语法 transform（JSX/class fields/装饰器/降级）→ 可选压缩 → 打印 code+map。类型只删不查贯穿始终。

### 2. (原理类) automatic 与 classic JSX runtime 产物差在哪？
**来源**：https://swc.rs/docs/configuration/compilation

classic 编译成 React.createElement(组件,props,children) 且要求作用域里有 React；automatic 编译成 import {jsx,jsxs} from react/jsx-runtime 并自动注入，免 import React、对多 children 用 jsxs。

### 3. (实战类) 不用 React 能编 JSX 吗？
**来源**：https://swc.rs/docs/configuration/compilation

能。设 react.runtime=automatic + importSource 指到 preact/compat、solid-js 等，SWC 会把 jsx 工厂指向该来源。JSX 只是语法糖，框架是另一回事。

### 4. (对比类) class fields 降级为什么产物差异这么大？
**来源**：https://swc.rs/docs/configuration/compilation

esnext 原样保留（公开 class fields 语义）；es2015/es5 需把字段搬进构造函数或用 defineProperty helper，因为老运行时没有该语法。降级越深注入 helper 越多。

### 5. (坑类) async/await 降到 es5 需要注意什么？
**来源**：https://swc.rs/docs/configuration/compilation

会变成 regenerator 式生成器 + _asyncToGenerator helper，体积和可读性都下降；且需要 regenerator-runtime（靠 core-js/env 注入）。现代目标尽量 es2017+ 保留原生 async。

### 6. (原理类) 为什么 SWC 能跳过类型检查还安全地转译？
**来源**：https://swc.rs/docs/migrating-from-tsc

因为类型只是给编译器的提示，运行时不存在。擦除类型不影响值语义——前提是代码本身类型正确。类型错但值合法时 SWC 照编，运行期才可能出问题。

### 7. (实战类) sourceMaps 三个取值怎么用？
**来源**：https://swc.rs/docs/configuration/swcrc

false 不产、true 产外链 .map、inline 把 map 以 dataURI 塞进产物尾部。库发布多用 true 并把 .map 随包；要单文件分发用 inline（但变大）。

### 8. (坑类) 顶层 await 谁能用？
**来源**：https://swc.rs/docs/configuration/compilation

需 target es2017 以上且模块是 ESM，CJS 没有顶层 await 语义。降级到不支持的目标会报错。别在要发 CJS 的包里写顶层 await。

### 9. (对比类) import attributes / assertions 支持吗？
**来源**：https://swc.rs/docs/configuration/compilation

SWC 跟随较新 ECMAScript 提案，多数新语法在合适 target 下可解析或原样保留；太新或不稳定的语法要么需高 target 要么走 Wasm 插件。查 supported-browsers 与 compilation 文档确认边界。

### 10. (原理类) SWC 的 helper 注入会重复膨胀吗？
**来源**：https://swc.rs/docs/configuration/compilation

每个降级点到可能内联小 helper。多文件同种降级会各带一份。可配合外部打包器的 tree-shaking 或 runtime 库缓解；这也是别盲目降 es5 的原因之一。

### 11. (坑类) optional chaining 与 nullish 会被改语义吗？
**来源**：https://swc.rs/docs/configuration/compilation

正确降级保持短路语义。但若你依赖 ?. 的极细行为（如对 getter 的调用次数），降级成三元判空后可能多读一次属性——对带副作用 getter 有差异，属边缘坑。

### 12. (实战类) decorators 用哪种？
**来源**：https://swc.rs/docs/configuration/compilation

jsc.parser.decorators 走旧 legacy 装饰器，decoratorsBeforeExport 控制位置；TS 装饰器另有 parser.syntax=typescript+decorators 组合。NestJS/Angular 多用 legacy，版本要对齐否则元数据丢失。

### 13. (对比类) SWC 转译会保留 enum 吗？
**来源**：https://swc.rs/docs/migrating-from-tsc

普通 enum 会被编译成运行时的双向映射对象（不是纯类型擦除）。const enum 跨文件场景因逐文件处理有坑，建议改用普通对象或 as const。

### 14. (原理类) jsx pragma 老写法还认吗？
**来源**：https://swc.rs/docs/configuration/compilation

classic runtime + 注释 pragma 仍可用于自定义工厂（如 h）。但新项目一律推荐 automatic runtime，pragma 是可退役的历史包袱。

### 15. (实战类) 如何验证某个语法到底会不会被降级？
**来源**：https://swc.rs/docs/configuration/supported-browsers

最可靠的方法是看产物：固定一段含目标语法的源码，在你实际配置的 target/env.targets 下编一次，肉眼比对输出。supported-browsers 页能查具体语法在哪个基线被支持，避免凭直觉猜测。
