# 面试题：断言与扩展（vitest-matchers）

### 1. (对比类) toBe / toEqual / toStrictEqual 三者区别？
**来源**：https://vitest.dev/api/expect.html

toBe 用 Object.is（原始值相等或同一引用）；toEqual 递归深比较内容、忽略引用；toStrictEqual 更严——额外要求同一 class、不把 {a:undefined} 当等于 {}。日常 toBe+toEqual，要精确用 toStrictEqual。

### 2. (实战类) 怎么断言一个函数抛特定错误？
**来源**：https://vitest.dev/api/expect.html

expect(()=>fn()).toThrow(/消息|Error类/)。关键是传「会抛的箭头函数」而非调用结果——直接 fn() 会在传参阶段就抛、断言接不住。

### 3. (坑类) expect(promise).resolves 忘了 await 会怎样？
**来源**：https://vitest.dev/api/expect.html

用例可能在 Promise 落定前就判通过（假绿）。异步断言必须 await，或让 Vitest 通过返回 Promise 感知。这是异步测试头号坑。

### 4. (实战类) DOM 断言为什么推荐 jest-dom？
**来源**：https://vitest.dev/api/expect.html

它提供 toBeInTheDocument/toHaveValue/toBeVisible/toHaveClass 等语义化 matcher，比手写 classList/textContent 判断可读、失败信息友好。是 Vitest 兼容生态的扩展。

### 5. (原理类) jest-dom 的 matcher 怎么注册到 Vitest？
**来源**：https://vitest.dev/guide/extending-matchers.html

在 setupFiles 里 import @testing-library/jest-dom/vitest，它通过 Vitest 的扩展 matcher 机制挂到 expect 上，之后所有用例可用。集中注册、无需每个文件重复。

### 6. (实战类) 浮点数断言为什么不能用 toBe？
**来源**：https://vitest.dev/api/expect.html

0.1+0.2 不等于 0.3（IEEE754）。用 toBeCloseTo(expected, numDigits) 做容差比较，避免二进制精度导致偶发失败。

### 7. (对比类) expect.hasAssertions 和 expect.assertions(n)？
**来源**：https://vitest.dev/api/expect.html

前者断言「本用例至少有一条断言被执行」，防异步里断言根本没跑到；后者要求恰好执行 n 条。用来堵「看起来绿了其实没断言」的空转。

### 8. (原理类) 怎么自定义一个 matcher？
**来源**：https://vitest.dev/guide/extending-matchers.html

expect.extend({ toBeWithinRange(received, floor, ceiling){...返回 {pass, message}} })，在 setupFiles 注册即可全局用。适合团队反复出现的领域断言。

### 9. (坑类) toEqual 对 Date / 正则 / Map 怎么比？
**来源**：https://vitest.dev/api/expect.html

toEqual 理解这些内建类型做合理深比较（Date 比时间值、Map/Set 比内容）。若行为不合预期，改用 toStrictEqual 或先规范化再比。

### 10. (实战类) 怎么断言数组包含某元素？
**来源**：https://vitest.dev/api/expect.html

toContain 判元素在数组/子串在字符串；对象数组按引用，要按内容用 toEqual 整体或 expect(list).toEqual([expect.objectContaining({id:1})]) 部分匹配。

### 11. (对比类) objectContaining 有什么用？
**来源**：https://vitest.dev/api/expect.html

只断言对象「包含」某些字段而忽略其余，适合响应体只关心关键字段、不锁全形状的场景。避免整体 toEqual 一有额外字段就红。

### 12. (原理类) 为什么不建议背 matcher 全表？
**来源**：https://vitest.dev/api/expect.html

数量多且会演进，记忆无迁移价值。掌握核心十几个覆盖绝大多数断言，其余遇到查 api/expect 文档，是本包「主干自驱、细节按需查」的体现。

### 13. (实战类) 快照和显式 matcher 何时各用？
**来源**：https://vitest.dev/api/expect.html

关键业务值（金额、状态）用显式 matcher 精确断言；「防整个结构意外变化」用快照。别拿快照当具体值的断言工具。

### 14. (坑类) expect 对 undefined / null 混淆怎么办？
**来源**：https://vitest.dev/api/expect.html

toBeNull 只过 null、toBeUndefined 只过 undefined、toBe(null) 严格区分。要明确语义就分别用专用 matcher，别用 toEqual 蒙。

### 15. (对比类) Vitest matcher 兼容 Jest 吗？
**来源**：https://vitest.dev/api/expect.html

绝大多数常用 matcher 与 Jest 同名同义（toBe/toEqual/toThrow/快照等），迁移顺。差异主要在 ESM/mock 提升，而非断言层。有 comparisons/migration 页对照。
