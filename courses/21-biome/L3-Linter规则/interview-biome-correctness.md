# 面试题：correctness 组（biome-correctness）

### 1. (原理类) 为什么 correctness 组建议整组常开？
**来源**：https://biomejs.dev/reference/configuration/

它报的都是「大概率是 bug」的写法（未用/未声明/const 重赋/可疑比较），误报率相对低。整组常开几乎不引战、纯收益，是引入 Biome 立竿见影价值的来源。

### 2. (实战类) noFloatingPromises 解决什么生产问题？
**来源**：https://biomejs.dev/reference/configuration/

未处理的 Promise（漏 await、.then 无 catch）导致静默失败、unhandledrejection、数据写半截。它逼你对每个 Promise 表态：await / .catch / 显式 void，把这类隐蔽 bug 挡在 lint 阶段。

### 3. (对比类) Biome correctness 和 tsc 检查重叠吗？
**来源**：https://biomejs.dev/reference/configuration/

有交集（都抓未使用/未声明）但不等价：tsc 管完整类型正确性、需跨文件；Biome correctness 管「不需类型信息就能判的浅层运行时错误」且极快、保存即报。二者互补，CI 里都要。

### 4. (坑类) noUndeclaredVariables 和「用了全局」怎么区分？
**来源**：https://biomejs.dev/reference/configuration/

它按环境/配置的已知全局清单判断。浏览器/Node 全局若没配对相应环境会被误报，需在 linter 环境/全局配置里声明，而非硬 ignore 整条规则。

### 5. (实战类) useAwaited 报了什么？
**来源**：https://biomejs.dev/reference/configuration/

对非 Promise 用 await，或 await 了可能非 Promise 的值。它保证 await 语义正确。修法是让被 await 的确实返回 Promise，或去掉多余 await。

### 6. (原理类) 为什么 Biome 能在保存瞬间就报而 tsc 慢？
**来源**：https://biomejs.dev/reference/daemon/

Biome 是常驻 daemon/LSP + Rust 单文件解析，不需全量类型图；tsc 的很多检查依赖跨文件类型推断。反馈速度差异正是两者分工的根因。

### 7. (对比类) noConstAssign 这类 tsc 也报，还要 Biome 吗？
**来源**：https://biomejs.dev/reference/configuration/

要。tsc 会报但需编译时机；Biome 更快、且即便你暂时跳过了 tsc（如脚本、CI 提前阶段）也能兜住。多一层快速浅检不冗余。

### 8. (实战类) 发现 correctness 一条明显误报怎么办？
**来源**：https://biomejs.dev/reference/diagnostics/

先 biome explain 读懂它意图，确认是误报就用精确行内 ignore + 理由，或调相关配置（如声明全局）。别因为一条误报就把整组关掉，损失保护。

### 9. (原理类) noPrecisionTypeLoss 抓的是什么？
**来源**：https://biomejs.dev/reference/configuration/

易被忽略的数值精度丢失（如某些返回 number 却丢精度的写法）。体现 correctness 组哲学：宁提醒一个真·数值 bug，也不搞风格噪音。

### 10. (对比类) correctness 与 suspicious 的边界？
**来源**：https://biomejs.dev/reference/configuration/

correctness=几乎肯定错（可整组常开）；suspicious=可疑但可能有意为之（如 noExplicitAny、双等），更易引战，宜逐条评估。分级让「严」和「松」各得其所。

### 11. (坑类) 重构后一堆 noUnusedVariables 报错？
**来源**：https://biomejs.dev/reference/configuration/

多半是删了调用没删声明的死代码残留。逐条确认是真该删还是忘了用，别整体 ignore 该组——它正帮你清理债务。

### 12. (实战类) CI 里 correctness 应设 warn 还是 error？
**来源**：https://biomejs.dev/reference/configuration/

error（配合 --error-on-warnings 更严）。既然它是「大概率 bug」，就该能挡 PR。降级为 warn 会让真 bug 溜过，违背整组常开的初衷。

### 13. (原理类) 为什么这组误报率低？
**来源**：https://biomejs.dev/reference/configuration/

因为它只报「无需上下文也几乎确定错」的模式，不碰主观风格。判断标准客观，故可常开、少引战。

### 14. (对比类) 给 Promise.allSettled/未 await 的 fire-and-forget 怎么办？
**来源**：https://biomejs.dev/reference/configuration/

若确实要「发后不管」，用显式 void 标注向规则表态「我知道且不处理」，比留裸 Promise 更清晰、也比全组 ignore 更精准。

### 15. (实战类) tsc 已过、Biome correctness 还报，信谁？
**来源**：https://biomejs.dev/reference/configuration/

都看：类型层面信 tsc；未使用/悬空 Promise/可疑写法这类 tsc 不全覆盖的，Biome 报得更多。两者正交，绿了 tsc 不等于 correctness 干净。
