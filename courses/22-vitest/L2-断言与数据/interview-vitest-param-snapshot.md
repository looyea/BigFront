# 面试题：参数化与快照（vitest-param-snapshot）

### 1. (原理类) it.each 解决了什么痛点？
**来源**：https://vitest.dev/api/describe.html

同一逻辑多组输入的用例，复制粘贴难维护且易漏。it.each 用一张表（数组/对象）驱动，加一行覆盖一组输入，标题 %s/$a 插值让每条用例名清晰可读。

### 2. (实战类) 快照存哪、比对什么？
**来源**：https://vitest.dev/guide/learn/snapshots.html

toMatchSnapshot 把值的序列化结果写进 __snapshots__/*.snap，运行时比对；一致通过、不一致失败并展示 diff。首次运行会「创建」基线。

### 3. (坑类) 为什么「无脑 -u」是反模式？
**来源**：https://vitest.dev/guide/learn/snapshots.html

-u 把当前（可能是回归导致的）输出直接记为新基线，等于让失败静默通过。快照的价值全在「红时人读 diff 判断是否符合预期」，跳过这步快照就没在测。

### 4. (实战类) CI 里怎么防止基线被悄悄改掉？
**来源**：https://vitest.dev/config/update.html

CI 用 vitest run（不带 -u、不给更新权限），快照不匹配就失败。基线变更必须发生在本地、显式更新、并经 code review 看 diff，形成守门。

### 5. (对比类) toMatchInlineSnapshot 好在哪？
**来源**：https://vitest.dev/guide/learn/snapshots.html

快照直接内联在测试源码里，读用例即见预期、无需翻 .snap 文件，PR diff 一目了然；更新写回源码。适合小段稳定输出。

### 6. (对比类) toMatchFileSnapshot 何时用？
**来源**：https://vitest.dev/guide/learn/snapshots.html

想把「生成物」（如导出的 schema、文档、配置）纳入版本对比、以普通文件（非 .snap）形式人肉 review 时。它把快照写到你可指定的文件路径。

### 7. (原理类) 快照对「关键业务值」为什么不合适？
**来源**：https://vitest.dev/api/expect.html

快照对「整个结构长啥样」敏感，但不精确断言「某字段=某预期值」——它红了可能只是无关字段变了，也绿了可能没盯住真正关心的值。金额/状态转移该用显式 matcher。

### 8. (实战类) 参数化能和快照组合吗？
**来源**：https://vitest.dev/api/describe.html

能。it.each 每轮对各输入调 toMatchSnapshot，会为该用例的不同参数各生成快照条目，得到「表格 × 结构」的双维覆盖。

### 9. (坑类) addSnapshotSerializer 有什么风险？
**来源**：https://vitest.dev/config/snapshotserializers.html

自定义序列化若不稳定（含时间戳/随机/顺序不定）会让快照偶发红、或吞掉本该发现的差异。加序列化器要确保确定性，且团队知晓全局影响。

### 10. (原理类) 快照里混入时间戳/随机 ID 怎么办？
**来源**：https://vitest.dev/api/expect.html

用序列化器/替换把这些不稳定字段规范化为占位（如把 id 归一为 <id>），或改用 objectContaining 精确断言关心的字段。不稳定的字段不适合进快照。

### 11. (对比类) 组件快照的克制使用？
**来源**：https://vitest.dev/guide/learn/snapshots.html

组件整棵 DOM 快照能防「意外结构变化」，但极易脆（改个 class 全红）、也掩盖「关键断言缺失」。策略：关键行为用 RTL 语义断言，快照只作结构回归的辅助，且少而精。

### 12. (实战类) 每条 it.each 用例名怎么可读？
**来源**：https://vitest.dev/api/describe.html

标题模板用插值把参数写进去（如 it.each 的 "输入 %d 返回 %d"），失败日志直接告诉你哪组数据挂了，胜过默认的匿名序号。

### 13. (坑类) 首次运行就绿就对了？
**来源**：https://vitest.dev/guide/learn/snapshots.html

首次会「写入」快照基线并全绿，但这不代表断言了正确性——基线可能录进去的就是个 bug。必须人工核对生成的 .snap 内容符合预期，才算建立有效基线。

### 14. (原理类) 快照更新与 code review 怎么配合？
**来源**：https://vitest.dev/config/update.html

把 .snap 文件纳入版本控制与 review 范围，PR 里快照 diff 就是要审的内容。让「预期输出变化」在评审眼里显式发生，而非本地一次 -u 混过去。

### 15. (实战类) 怎么决定一处该用快照还是 matcher？
**来源**：https://vitest.dev/api/expect.html

问自己：我在断言「具体某个值对不对」（→matcher）还是「别意外改变整体形状/序列化」（→快照）？两者常配合，但核心业务期望必须有精确 matcher 兜底。
