# 面试题：缓存与增量（swc-cache-perf）

### 1. (原理类) 转译为什么可以安全缓存？
**来源**：https://swc.rs/docs/usage/swc-loader

对给定(源码,配置)输出确定不变，是纯函数。命中条件用源码哈希+配置哈希即可复用上次 code/map。

### 2. (实战类) webpack 增量重建靠什么变快？
**来源**：https://swc.rs/docs/usage/swc-loader

filesystem persistent cache：未改动模块跳过 loader（含 swc-loader）直接读上次结果。配 buildDependencies 让配置变更能失效。

### 3. (坑类) 改了 .swcrc 产物没变，怎么排查？
**来源**：https://swc.rs/docs/usage/swc-loader

八成是缓存把配置变更「吃」了。把 .swcrc 路径列入 cache.buildDependencies.config，改配置即失效；或先清缓存复现确认。

### 4. (原理类) 冷编时 CPU 已很低，瓶颈会转移到哪？
**来源**：https://swc.rs/docs/benchmarks

磁盘 I/O：读源文件、写产物、写缓存。SWC 把 CPU 打下来后，I/O 与依赖解析成为新上限，堆更多并发收益递减。

### 5. (实战类) 怎么判断 SWC 到底是不是瓶颈？
**来源**：https://swc.rs/docs/benchmarks

拆阶段计时：转译/类型检查/打包/压缩/安装/IO 分别统计。若类型检查或 node_modules 安装占大头，优化它们而非再抠转译。

### 6. (对比类) esbuild 和 SWC 纯转译谁快？
**来源**：https://swc.rs/docs/benchmarks

同数量级、互有胜负，取决于降级深度与语法覆盖需求。别拿厂商基准当你的项目结论，用自己真实代码测。

### 7. (实战类) --sync 什么时候用？
**来源**：https://swc.rs/docs/usage/cli

排错时强制同步逐个转译，日志清晰、错误定位明确；正常构建用默认并发拿速度。

### 8. (原理类) 类型检查占大头可怎么办？
**来源**：https://swc.rs/docs/migrating-from-tsc

把 tsc --noEmit 移出构建关键路径（放独立 CI job/IDE），或探索 isolatedDeclarations 让 d.ts 生成不必全量类型检查。

### 9. (坑类) watch 模式越跑越慢的常见原因？
**来源**：https://swc.rs/docs/usage/cli

缓存未持久化、每次全量重转、或文件监听范围过大（含 node_modules/dist）。限定 watch 范围并启用持久缓存。

### 10. (对比类) SWC 有内置构建缓存吗？
**来源**：https://swc.rs/docs/usage/core

@swc/core 本身是无状态转译，不做增量；缓存策略由上层（webpack/Rspack/自建）负责。理解这层分工，别到 core API 里找 cache 选项。

### 11. (实战类) 给 monorepo 提构建速度的现实顺序？
**来源**：https://swc.rs/docs/benchmarks

① 正确配持久缓存与失效依赖；② 并行/任务图（只重build受影响包）；③ 类型检查旁路；④ 最后才是换/调转译器。多数收益在前三步。

### 12. (原理类) 为什么持久缓存要求配置进 buildDependencies？
**来源**：https://swc.rs/docs/usage/swc-loader

缓存失效判断基于「输入及其声明的依赖」哈希；配置是输入之一，不声明则改配置哈希不变、错误命中旧缓存。

### 13. (坑类) CI 里持久缓存要注意什么？
**来源**：https://swc.rs/docs/usage/core

缓存目录要跨次构建持久化（卷/缓存层），否则每次冷编；且缓存 key 必须含配置与依赖版本，避免用到过期产物。

### 14. (实战类) 怎么测「冷 vs 增量」耗时？
**来源**：https://swc.rs/docs/benchmarks

冷：清缓存跑一次；增量：改一个文件再跑。各测多次取中位，排除首帧抖动。用真实项目而非 hello-world。

### 15. (对比类) 既然 SWC 已经够快，为什么还要缓存？
**来源**：https://swc.rs/docs/usage/swc-loader

再快乘以巨大文件数也不可忽略；缓存省的是「重复转译未变模块」的绝对时间，且顺带跳过下游 loader/解析。快≠可无限重来。
