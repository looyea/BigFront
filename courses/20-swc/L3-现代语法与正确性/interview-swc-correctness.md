# 面试题：正确性与 interop（swc-correctness）

### 1. (原理类) SWC 会做完整类型检查吗？和正确性何关？
**来源**：https://swc.rs/docs/migrating-from-tsc

不做，只擦类型。所以「SWC 编译过」不代表类型对，也不代表运行时无声错——类型错但值合法照样产出。正确性检查仍归 tsc/vue-tsc。

### 2. (对比类) 为什么 SWC 产物和 Babel 不一样？
**来源**：https://swc.rs/docs/migrating-from-babel

不同实现、不同 helper 策略、不同的模块互操作细节与降级写法。官方定位是编译器库而非 Babel 复刻，保证语义等价场景一致，不保证逐字节。

### 3. (坑类) ESM 默认导出到 CJS 的经典翻车？
**来源**：https://swc.rs/docs/configuration/modules

消费方 import def 时，def 是 module.exports 还是 module.exports.default，取决于 __esModule marker 与 interop helper。SWC/Babel/Node 三者默认策略历史上不同，混用易拿到多包一层的 default。

### 4. (实战类) 怎么让跨模块格式互操作稳定？
**来源**：https://swc.rs/docs/configuration/modules

尽量统一产物格式与运行时；需要混用时用 module.strict / importInterop 显式声明策略，并在集成测试里真跑一遍 require/import 验证 default 与具名都能取到。

### 5. (原理类) loose 具体改了 class 的什么？
**来源**：https://swc.rs/docs/configuration/compilation

loose 下 class 用更朴素的原型赋值展开、跳过部分 ES 规范的内部方法定义语义，产物更小更可读但破坏严格的方法可枚举性/configurability 等细节。

### 6. (对比类) loose 什么时候该开？
**来源**：https://swc.rs/docs/configuration/compilation

明确不在意严格 class 语义、且想向 Babel loose 输出对齐、或追求更小产物时。库默认别开以免下游期望落空；应用且历史依赖 loose 行为时可开。

### 7. (实战类) 如何定位一个「换 SWC 才出现」的 bug？
**来源**：https://swc.rs/docs/migrating-from-babel

最小复现 → 同入口 Babel/SWC 各编 → diff 产物 → 对照官方差异清单 → 判定是配置可解（关 loose/调 interop）还是真边界。别凭猜改一堆配置。

### 8. (坑类) 循环依赖下产物顺序差异会造成什么？
**来源**：https://swc.rs/docs/configuration/modules

不同编译器对模块求值顺序/提升的处理细微不同，循环 import 时可能一个能跑一个拿到 undefined。SWC 对某些极端循环顺序与 Babel 有已知差异，重循环依赖的库要重点测。

### 9. (原理类) __esModule marker 谁加、有什么用？
**来源**：https://swc.rs/docs/configuration/modules

由把 ESM 转 CJS 的编译器加，告诉互操作层「这是转译来的 ES 模块」，从而在 import default 时正确解包 .default。缺失或误判就会 default 多包一层。

### 10. (对比类) TS 的 isolatedModules 和 SWC 的关系？
**来源**：https://swc.rs/docs/migrating-from-tsc

SWC 本质按 isolatedModules 心智逐文件处理。开 verbatimModuleSyntax / 遵守 const enum 跨文件等约束，能让 tsc 与 SWC 对「纯类型导入」判定一致，避免 SWC 删多/删少 import。

### 11. (坑类) 纯类型 import 被误删/误留怎么办？
**来源**：https://swc.rs/docs/migrating-from-tsc

用 import type 显式标注纯类型导入，并开 verbatimModuleSyntax，让「哪些 import 该消失」的判定在 tsc 与 SWC 间一致。这是擦除式编译器共同的前提纪律。

### 12. (实战类) 有 sideEffects 的 import 被 tree-shake 掉了？
**来源**：https://swc.rs/docs/configuration/modules

检查 package.json sideEffects 与模块格式；SWC 只负责转译，tree-shaking 在打包器。别把打包器行为和 SWC 转译混为一谈，但产物模块格式会影响 shake 结果。

### 13. (对比类) 和 tsc 的 useDefineForClassFields 有对应吗？
**来源**：https://swc.rs/docs/configuration/compilation

有，class 字段的 [[Define]] vs [[Set]] 语义在两边都受配置影响，需对齐否则字段初始化行为在 tsc 校验与 SWC 产物间不一致。

### 14. (原理类) 为什么不能假设「编译过=没问题」？
**来源**：https://swc.rs/docs/migrating-from-babel

因为 SWC 只保证语法可转译，不校验类型、不检测 interop 误用、不发现运行期边界。正确性验证要靠 tsc + 针对产物的集成/运行时测试，三者各司其职。

### 15. (实战类) 团队里怎么沉淀「SWC 差异」知识？
**来源**：https://swc.rs/docs/migrating-from-babel

把踩过的差异（interop、装饰器元数据、循环顺序）记进项目 ADR/迁移清单，配一张「Babel 配置↔SWC 配置」对照表，新人照表迁移而非重蹈覆辙。
