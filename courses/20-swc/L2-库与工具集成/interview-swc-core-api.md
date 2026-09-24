# 面试题：@swc/core 程序化（swc-core-api）

### 1. (实战类) 给打包器写插件时常用哪个 API？
**来源**：https://swc.rs/docs/usage/core

transform(src, opts) 或其 sync 版：拿到源码字符串转成 code+map 交给打包器。transformFile 适合读磁盘脚本，打包器里源码已在内存多用 transform。

### 2. (原理类) 三个 transform 系列 API 的区别？
**来源**：https://swc.rs/docs/usage/core

transform 吃字符串(异步)、transformSync 字符串同步、transformFile 读文件路径。返回结构一致。异步版能利用内部并行，构建管线优先用异步。

### 3. (坑类) 代码传的 opts 和 .swcrc 谁赢？
**来源**：https://swc.rs/docs/usage/core

代码传入优先，.swcrc 需要先设 swcrc:true 才参与读取，然后被显式 opts 覆盖。忘设 swcrc:true 会以为「配置文件没生效」——其实根本没读。

### 4. (坑类) 为什么我 API 转译出来线上堆栈对不上？
**来源**：https://swc.rs/docs/configuration/swcrc

没落 source map。transform 返回的 map 要写 .map 并在 code 尾加 sourceMappingURL，否则浏览器只有编译后代码位置。可加 inlineSourcesContent 把源内联。

### 5. (生态类) @swc/core 的多平台二进制怎么装？
**来源**：https://swc.rs/docs/usage/core

通过 npm optionalDependencies 分发平台专属包（core-darwin-arm64 等），装时按 os/cpu 命中。这也意味着 lockfile 有平台性，跨系统复用要小心。

### 6. (坑类) 本地 mac、CI 是 Linux，报 Cannot find module？
**来源**：https://swc.rs/docs/usage/core

典型跨平台锁问题：mac lockfile 未记录 linux 二进制。CI 里 npm install 重装并生成含 linux 的锁，或用 --os/--cpu 补装。别怀疑代码，是分发机制。

### 7. (对比类) --legacy / 纯 JS 回退是干嘛的？
**来源**：https://swc.rs/docs/usage/core

给老 glibc 等无法跑原生二进制的机器提供的 JS 兜底实现，能编但慢。优先解决 native 分发，legacy 只是应急。

### 8. (实战类) @swc-node/register 适合什么场景？
**来源**：https://swc.rs/docs/swc-node-vs-swc

让 node 脚本/ts-node 替代品即时跑 TS/ESM，读 tsconfig 的 paths。适合 CLI 工具、后端服务开发期，免构建。生产仍建议预编译。

### 9. (对比类) @swc/core 和 @swc-node 谁读 tsconfig？
**来源**：https://swc.rs/docs/swc-node-vs-swc

@swc-node 系列支持读 tsconfig.json（含路径别名），@swc/core 只管你传入的 opts，不自动解析 tsconfig。从 tsc 迁来想要「直接跑」时用 @swc-node 更平滑。

### 10. (原理类) 为什么返回是 { code, map } 而不是分开发？
**来源**：https://swc.rs/docs/usage/core

一次编译同时产出代码与映射最经济，调用方自行决定 map 落盘方式（外链/内联/上传）。库只给原料，落盘策略交给上层构建器。

### 11. (实战类) 并行转译多个文件怎么做？
**来源**：https://swc.rs/docs/usage/core

用异步 transform + Promise.all，SWC 内部有线程池；或交给打包器的多 worker。别在热路径用 transformSync 阻塞主线程。

### 12. (坑类) swcrc: false 时会读 .swcrc 吗？
**来源**：https://swc.rs/docs/usage/core

不会。API 默认把「不传 opts 就按最小配置转译」，需显式 swcrc:true 才去磁盘找 .swcrc。这是「API 显式优于隐式」的设计。

### 13. (生态类) Wasm 插件如何在 API 里挂上？
**来源**：https://swc.rs/docs/plugin/ecmascript/getting-started

jsc.experimental.plugins 传插件包名数组，SWC 会加载对应 Wasm 在 AST 上跑自定义 transform。插件与 core 版本历史上需匹配（v1.15 起兼容性改善）。

### 14. (实战类) 想把编译和压缩一次做完？
**来源**：https://swc.rs/docs/usage/core

opts 里同时给 jsc（转译）与 minify:true/对象，transform 一趟输出已压缩的 code。这正是 SWC 相对「转译完再单独 terser」的效率优势所在。

### 15. (实战类) 写一个脚本把 src 下所有 .ts 递归转译到 dist，核心步骤？
**来源**：https://swc.rs/docs/usage/core

遍历目录收集 .ts 路径 → 对每个调 transformFile（或 read+transform）→ 把 code 写到 dist 对应 .js、map 写 .js.map 并在 code 尾拼 sourceMappingURL → 非 资源文件直接拷贝。用 Promise.all 并发，避免主线程用 transformSync 阻塞。
