# 面试题：覆盖率与配置（vitest-coverage）

### 1. (实战类) 覆盖率怎么开启、要装什么？
**来源**：https://vitest.dev/guide/coverage.html

装 provider：npm i -D @vitest/coverage-v8（或 istanbul），配 coverage.provider，跑 vitest run --coverage。没装对应包会提示安装。v8 走引擎原生覆盖、常更快。

### 2. (对比类) v8 和 istanbul provider 有何区别？
**来源**：https://vitest.dev/guide/coverage.html

v8 基于 V8 的覆盖率数据、性能通常更好、是当前默认推荐；istanbul 更成熟可移植、跨运行时一致、某些语句/分支统计口径不同。选一个即可，别混装。

### 3. (实战类) 怎么用覆盖率卡住 CI？
**来源**：https://vitest.dev/config/coverage.html

coverage.thresholds 设 lines/functions/branches/statements 下限，低于就非零退出挡下 PR。加 perFile:true 按文件分别卡，防止一个高覆盖文件把整体拉平均、掩盖裸文件。

### 4. (坑类) 覆盖率 100% 就代表没问题吗？
**来源**：https://vitest.dev/guide/coverage.html

不代表。它只说「这些行被执行过」，不保证「断言正确、边界都测了」。追高会诱导写无断言的空测。覆盖率是找漏测路径的探针，不是质量本身。

### 5. (实战类) 分支覆盖率低怎么补？
**来源**：https://vitest.dev/guide/coverage.html

逐行看 html 报告里黄色/未覆盖的 if/else、三元、?. 和 || 分支，为「另一侧」各补一条有断言的用例（尤其错误/边界路径）。branches 往往比 lines 更能暴露漏测。

### 6. (原理类) test.include 和 coverage.include 区别？
**来源**：https://vitest.dev/config/coverage.html

前者决定哪些是测试文件（跑什么），后者决定哪些源文件计入统计（算什么）。两者独立。设 coverage.include: [src/**] + all:true 让没被碰到的源文件按 0% 进分母。

### 7. (实战类) 怎么让未测文件也计入、避免虚高？
**来源**：https://vitest.dev/guide/coverage.html

coverage.all:true（默认行为视版本）配合 coverage.include 指向源码 glob，把所有匹配源文件纳入分母，即使没测试引用它们。否则只有被 import 过的文件参与计算，数字好看却骗人。

### 8. (实战类) 报告怎么在 CI 里既好看又可上传？
**来源**：https://vitest.dev/config/reporters.html

coverage.reporter 配 text（终端）+ html（可浏览）+ lcov/cobertura（传给 Codecov/PR 评论）。测试本身用 default + github-actions/junit reporter。产物用 actions/upload-artifact 留存。

### 9. (坑类) 覆盖率把 dist/生成代码/类型文件算进去怎么办？
**来源**：https://vitest.dev/config/coverage.html

用 coverage.exclude 排掉 dist、*.d.ts、mock、index barrel 等非真实逻辑。让百分比反映你真正手写、值得测的代码，否则被稀释或虚增都失真。

### 10. (实战类) 只想看「本次改动」的覆盖情况？
**来源**：https://vitest.dev/config/changed.html

vitest run --changed（配合 coverage）只跑受影响文件并聚焦其覆盖，适合大仓 PR 快速判断新代码测没测到位。全量阈值仍应在 CI 兜底。

### 11. (对比类) reporter 家族里 CI 常用哪几个？
**来源**：https://vitest.dev/guide/reporters.html

default（终端）、verbose（逐条）、github-actions（把失败以注解贴到 PR diff）、json/junit（机器可读、传测试报告平台）。CI 常 default+github-actions 或 junit + artifact。

### 12. (坑类) 开了 fake timers 后覆盖率报告偶发异常？
**来源**：https://vitest.dev/guide/common-errors.html

多为异步/定时器与进程退出时机纠缠，个别收尾逻辑没跑完导致统计缺角。测完记得 useRealTimers、必要时 await 收尾，或在集成层用真实时钟复核，别把偶发当常态。

### 13. (原理类) 怎么理解 per-file 覆盖率报告？
**来源**：https://vitest.dev/guide/coverage.html

它按文件列 lines/branches/functions/statements 四率，帮定位「哪个文件、哪种维度」没测够。四率里 branches 常最低也最有价值——行执行了不代表每个条件两侧都测过。

### 14. (实战类) 阈值一开始设多少合理？
**来源**：https://vitest.dev/guide/coverage.html

别拍脑袋 100%。以当前真实覆盖为基线略加缓冲设 floors（如现有 76% 就设 75%），再随重构逐步抬升。目的是「别让覆盖率倒退」，而不是一次逼平理想值。

### 15. (实战类) 怎么排除某一行/分支不计入覆盖？
**来源**：https://vitest.dev/config/coverage.html

对确实无需测的行（防御性 return、平台特定守卫、生成的 switch 默认支）用 istanbul 注释 /* istanbul ignore next */ 等（provider 对应语法）标注。少用、且团队知晓，别拿它藏该测的分支。
