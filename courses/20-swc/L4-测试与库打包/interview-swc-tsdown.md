# 面试题：库打包（swc-tsdown）

### 1. (原理类) 为什么 SWC 打库不能一条龙？
**来源**：https://swc.rs/docs/migrating-from-tsc

它只擦类型出 JS，不产 .d.ts。库还需类型声明，故必是「SWC/打包器出 JS + tsc 出 d.ts」的组合。这是 isolatedModules 心智的必然。

### 2. (实战类) 库构建的 entry/external/formats 各管什么？
**来源**：https://swc.rs/docs/usage/bundling

entry 定入口、external 定谁不打进包（peer/宿主）、formats 定出 ESM/CJS 等几套产物。三者是库打包的最小三配。

### 3. (坑类) 把 react 打进组件库的后果？
**来源**：https://swc.rs/docs/configuration/bundling

包体积暴涨、双 React 实例导致 hooks 报错。必须 external 排除宿主依赖，交给使用方的 react。external 是库体积与正确性第一开关。

### 4. (对比类) untransform / SWC / esbuild 在库转译里的角色？
**来源**：https://swc.rs/docs/benchmarks

都是「去类型/降语法」的转译层选项，快、语义擦除为主。Rolldown 生态里 tsdown 之类可挂其中一种，产出 JS 后仍单独跑 tsc 出 d.ts。

### 5. (实战类) ESM 与 CJS 双出口怎么写 package.json？
**来源**：https://swc.rs/docs/configuration/modules

exports.'' 下给 import 指 .mjs、require 指 .cjs，types 前置；配合 main/module/types 兼容老工具。两套产物用 SWC module.type 分别出。

### 6. (原理类) d.ts 为什么是库构建时间大头？
**来源**：https://swc.rs/docs/migrating-from-tsc

生成 d.ts 要全量类型信息，tsc 无法像转译那样逐文件并行跳检查。这是它比转译慢的根因，也是 isolatedDeclarations 想解决的痛点。

### 7. (对比类) isolatedDeclarations 能带来什么（前瞻）？
**来源**：https://swc.rs/docs/migrating-from-tsc

让 d.ts 也能逐文件、无需全量类型检查地生成，从而与 SWC 这类逐文件转译同速并行。是趋势，但当下工具链支持尚在铺开，别当现状依赖。

### 8. (实战类) 打完包怎么验证产物真能用？
**来源**：https://swc.rs/docs/usage/bundling

npm pack --dry-run 看清单 + 干净目录里分别 import(ESM)/require(CJS) 一次确认 default 与具名 + 针对产物跑测试。三关都过才叫「能发」。

### 9. (坑类) 源码测试过了，产物却 import 不到 default？
**来源**：https://swc.rs/docs/configuration/modules

典型 interop/exports 映射问题：源码经打包器解析，产物是裸文件由 Node 解析。要针对产物测，且核对 exports 与 __esModule 行为。

### 10. (对比类) 库要不要 ship 未压缩产物？
**来源**：https://swc.rs/docs/configuration/minification

应用库通常发未压缩 JS+map，交给下游打包器统一压缩与 shake；只有「面向浏览器直用、无打包」的库才自己 minify。压缩与否取决于消费方式。

### 11. (原理类) formats 出多套会不会行为不一致？
**来源**：https://swc.rs/docs/configuration/modules

理论上同一源码不同 module.type 产物语义应等价，但 interop/默认导出映射细节可能引入差异（呼应正确性关）。故每套产物都要单独验证。

### 12. (实战类) peerDependencies 和 external 的关系？
**来源**：https://swc.rs/docs/configuration/bundling

peerDependencies 是安装期声明「你要提供」，external 是构建期声明「别打进包」。两者要对齐：列为 peer 的就该 external，否则要么重复要么缺失。

### 13. (坑类) CSS/资源文件在库构建里怎么处理？
**来源**：https://swc.rs/docs/usage/bundling

SWC 只管 JS/TS。CSS/图片要打包器相应插件或单独拷，产物再在 exports 里给出子路径。别把 JS 编译器当成能处理一切的打包器。

### 14. (对比类) 为什么不干脆用 tsc 出 JS？
**来源**：https://swc.rs/docs/migrating-from-tsc

可以但慢、且不产 bundle（逐文件）。打包器给 bundle/external/多格式/tree-shaking，SWC 给速度。库要的是「快 + 打包 + 多格式」，组合优于 tsc 单干。

### 15. (原理类) 库的 d.ts 和 JS 产物会脱节吗？
**来源**：https://swc.rs/docs/migrating-from-tsc

会——若分别用不同来源生成又不同步。稳妥是同一份源码、一条构建管线里同时出 JS 与 d.ts，并让 types 指到与实际导出一致的声明，防类型与运行时漂移。
