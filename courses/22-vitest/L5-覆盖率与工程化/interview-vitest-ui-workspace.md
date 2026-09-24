# 面试题：UI / workspace / 类型测试（vitest-ui-workspace）

### 1. (实战类) --ui 模式适合什么时候用？
**来源**：https://vitest.dev/guide/ui.html

本地排查时：可视化看用例树、每条状态/耗时、失败堆栈与 diff、快照变化，还能点某条单独重跑。CI 里不用 ui，改用 run + 机器可读 reporter。

### 2. (实战类) test.projects 解决什么问题？
**来源**：https://vitest.dev/guide/projects.html

同仓需要多套测试配置：node 跑纯逻辑、jsdom 跑组件，或 monorepo 每个包一份。projects 让你声明多个子项目各带 environment/include/setupFiles，比全局设 jsdom 更快更清晰。

### 3. (原理类) projects 和早期的 workspace 是什么关系？
**来源**：https://vitest.dev/config/projects.html

projects 是当前推荐写法（Vitest 2/3 起以 test.projects 统一表达多测试项目），取代了旧独立 workspace 文件概念。语义一致：一组并列的测试配置，各自可解析、并行跑。

### 4. (实战类) 同仓怎么同时配 node 和 jsdom 两类测试？
**来源**：https://vitest.dev/config/projects.html

projects 里两个条目：一个 name:node、environment:node、include 纯逻辑 glob；一个 name:dom、environment:jsdom、include 组件 glob。一次 vitest run 两类都收集，各自付对应环境成本。

### 5. (对比类) in-source testing 适合哪些场景？
**来源**：https://vitest.dev/guide/in-source.html

小工具/纯函数想就近测试、省得开单独文件；用 if (import.meta.vitest) 内联、构建时被 tree-shake 掉不进产物。适合低层 utils，团队大项目要评估可读性再推广。

### 6. (原理类) typecheck 类型测试和运行时测试什么关系？
**来源**：https://vitest.dev/guide/testing-types.html

互补。运行时测试断言「行为对不对」，typecheck 用 expectTypeOf/assertType 断言「类型对不对」。它独立于运行、需要 tsc 流程，默认不随 vitest run 执行，需开 test.typecheck。

### 7. (实战类) expectTypeOf 怎么写一条类型断言？
**来源**：https://vitest.dev/api/expect-typeof.html

import { expectTypeOf } from vitest; expectTypeOf(sum).parameter(0).toEqualTypeOf<number>(); expectTypeOf(x).toBeString()。它在 typecheck 阶段被判真伪、不产生运行时断言。

### 8. (坑类) typecheck 会拖慢测试、能和普通测试混跑吗？
**来源**：https://vitest.dev/config/typecheck.html

它走 tsc、相对慢，默认关。开 typecheck.include 只挑类型测试文件、并可 checkSources 控制是否检查源码。别把它塞进每轮 watch 全跑，按需/CI 里单列更划算。

### 9. (实战类) monorepo 里各包测试怎么组织最顺？
**来源**：https://vitest.dev/guide/projects.html

根 vitest.config 用 projects 指向各包配置（或内联多项目），共享公共 setup/reporter、各自 environment/include。一条命令跑全部、也可 --project 只跑某个包，与包管理器 workspace 天然配合。

### 10. (实战类) shard 分片是什么、什么时候用？
**来源**：https://vitest.dev/guide/parallelism.html

--shard=1/4 把收集到的测试切成 4 份、本机只跑第 1 份。当单台 CI 机已并行仍太慢，就多机各跑一片横向扩展（配合矩阵），每机设不同 shard 索引。

### 11. (对比类) 并行(fileParallelism/threads) 和分片的区别？
**来源**：https://vitest.dev/config/pool.html

并行是「同一台机器内」多 worker 同时跑多文件；分片是「多台机器间」把用例分配开各跑一部分。前者靠 CPU/内存、后者靠加 CI 节点。二者可叠加：每片内部再并行。

### 12. (实战类) 怎么给一条用例打断点调试？
**来源**：https://vitest.dev/guide/debugging.html

用 it.debug()/test.debug() 让执行停在该用例（或 NODE_OPTIONS=--inspect-brk vitest run 某文件），Chrome DevTools / VS Code 附加调试器逐步跟。比在代码里塞 console.log 高效。

### 13. (实战类) IDE 里点绿三角跑单测怎么配？
**来源**：https://vitest.dev/guide/ide.html

装官方 Vitest 扩展（VS Code），它读 vitest.config、在每条 it 上方给出运行/调试 codelens，可单跑一条、看内联结果。无需记命令行也能快速验证。

### 14. (坑类) projects 里某个子项目配置好像没生效？
**来源**：https://vitest.dev/config/projects.html

常见是 glob/name 对不上、或根级字段与子项目字段合并规则理解偏差。用 --project <name> 明确指定、检查每个 project 的 include 是否真匹配到目标文件，再看是否被更外层配置覆盖。

### 15. (原理类) 想只跑受改动影响的测试提速，靠什么？
**来源**：https://vitest.dev/guide/cli.html

vitest run --changed[=<ref>] 基于 git diff + 模块图只跑相关测试；watch 模式默认也做精准重跑。大仓 CI 用它显著省时，但合并前的全量门仍建议完整跑一次兜底。
