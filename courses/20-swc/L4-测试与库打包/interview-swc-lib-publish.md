# 面试题：发包视角（swc-lib-publish）

### 1. (实战类) 一份规范的库 exports 长什么样？
**来源**：https://swc.rs/docs/configuration/modules

顶层 . 下给 types(最前)/import(.mjs)/require(.cjs)，另留 ./package.json 等子路径；并保 main/module/types 兜底老工具。映射必须与 dist 实际文件一致。

### 2. (坑类) exports 条件顺序有讲究吗？
**来源**：https://swc.rs/docs/configuration/modules

有。从最 specific 到最宽泛（types→node→browser→default 之类），先匹配先用。把 default 放前面会短路掉更具体的条件，导致类型/平台解析失效。

### 3. (原理类) sideEffects:false 到底承诺了什么？
**来源**：https://swc.rs/docs/configuration/bundling

向打包器声明「模块无顶层副作用，未被引用的可安全移除」。若其实有副作用（如引 polyfill、注册全局）却标 false，会被 tree-shake 掉导致运行缺功能——是错误声明。

### 4. (实战类) 怎么让 SWC 产物对 tree-shaking 友好？
**来源**：https://swc.rs/docs/usage/bundling

出干净 ESM（module.type:es6）、避免顶层隐式副作用、别默认全量 re-export 大对象、配 /*#__PURE__*/ 标纯调用。转译产物干净，下游 shake 才彻底。

### 5. (对比类) source map 随包发布 vs 上传监控？
**来源**：https://swc.rs/docs/configuration/swcrc

随包=用户可调试但暴露源码；上传 Sentry 等=可还原线上栈却不公开源，配 inlineSourcesContent 更完整。生产库多取「上传不随包」。

### 6. (实战类) 发布前你固定跑的第一条命令？
**来源**：https://swc.rs/docs/usage/cli

npm pack --dry-run。看真正进 tarball 的文件：漏没漏 d.ts、混进 src/测试/.env 没有。先白名单 files 收口再 publish。

### 7. (坑类) 把源码和 .env 一起发出去了怎么办？
**来源**：https://swc.rs/docs/usage/cli

用 package.json files 字段做白名单（只列 dist 与必要文件），别靠 .npmignore 黑名单（易漏）。发前 dry-run 复查，已泄露则撤回版本并轮换任何泄出的密钥。

### 8. (原理类) @swc/core 怎么发多平台原生包？
**来源**：https://swc.rs/docs/usage/core

主包只放 JS 胶水，真实二进制按平台拆成 darwin-arm64/linux-x64-gnu 等子包，用 optionalDependencies + os/cpu 字段命中安装。含原生模块的库可照此设计。

### 9. (对比类) 纯 JS 库需要平台分包吗？
**来源**：https://swc.rs/docs/usage/core

不需要。平台分包是为分发原生二进制。纯 JS 库跨平台一致，反要注意别把某平台 lockfile 固定死导致 CI 装不上（呼应 L2 锁文件坑）。

### 10. (实战类) typesVersions 现在还有必要吗？
**来源**：https://swc.rs/docs/configuration/modules

较新解析器看 exports.types 即可，但仍有老 TS/工具不认识 exports 子路径，用 typesVersions 兜底最稳。视目标用户工具面决定是否保留。

### 11. (坑类) 装本地 tarball 验证时发现 require 报错？
**来源**：https://swc.rs/docs/configuration/modules

多半 exports 的 require 条件没指对文件或该产物其实只发了 ESM。补 .cjs 产物与 require 条件，双格式各自能 load 才算发布完整。

### 12. (原理类) 为什么 main 和 exports 同时存在会困惑？
**来源**：https://swc.rs/docs/configuration/modules

exports 优先、main 只在不支持 exports 的老环境生效。保留 main 是兼容包袱，新库可靠 exports，但要清楚谁在起作用以免「改了 main 不生效」。

### 13. (实战类) 怎么在 CI 里自动验收产物？
**来源**：https://swc.rs/docs/usage/core

构建→npm pack→在干净 workspace 装 tgz→跑「针对产物」的 smoke 测试（import/require + 关键 API 断言）→多平台矩阵各来一遍。把发布质量守成流水线关卡。

### 14. (对比类) 多平台矩阵构建借鉴了什么？
**来源**：https://swc.rs/docs/usage/core

学 SWC 自身发版：在 linux/mac/windows、x64/arm64 矩阵分别构建，产物/二进制按平台归位，最后统一 pack。含 native 的库尤其需要这模式。

### 15. (原理类) 发布产物与仓库源码为什么必须一致映射？
**来源**：https://swc.rs/docs/configuration/modules

exports/types/sideEffects 都是对「dist 里真实文件」的声明，一旦与实际脱节，用户 import 落空、类型找不到、shake 过度。构建脚本要保证声明随产物生成而非手写漂移。
