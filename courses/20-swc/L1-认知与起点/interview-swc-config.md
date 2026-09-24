# 面试题：.swcrc 与 CLI（swc-config）

### 1. (实战类) 写一个最小的把 TS 编成 CJS 的配置。
**来源**：https://swc.rs/docs/configuration/swcrc

jsc.parser.syntax=typescript 决定解析，module.type=commonjs 决定产物格式，jsc.target 或 env.targets 决定降级。三者组合即可，扩展名已自动触发 ts 解析时 parser 甚至可省。

### 2. (原理类) env.targets 和 jsc.target 冲突时听谁的？
**来源**：https://swc.rs/docs/configuration/supported-browsers

env.targets 优先。它是 browserslist 驱动，SWC 据目标算降级并可注入 core-js polyfill；jsc.target 是硬指定单一天生态版本。团队统一目标一般只用 env.targets。

### 3. (对比类) browserslist 字符串写 .swcrc 里和写 package.json 的关系？
**来源**：https://swc.rs/docs/configuration/supported-browsers

SWC 的 env.targets 若留空可回退读 browserslist 配置（package.json / .browserslistrc），与 autoprefixer/stylelint 共享同一份目标声明，避免各工具目标漂移。

### 4. (实战类) CLI 如何临时改一个配置而不动文件？
**来源**：https://swc.rs/docs/usage/cli

swc -C jsc.minify=true 或 -C module.type=commonjs。-C/--config-json 传临时覆盖，适合脚本里按环境微调而不污染仓库配置。

### 5. (原理类) .swcrc 里的 include/exclude 干什么？
**来源**：https://swc.rs/docs/configuration/swcrc

限定哪些文件受该配置影响（正则）。monorepo 里常用来对 src 生效、对某些第三方或生成代码豁免，避免全量套用规则误伤。

### 6. (坑类) 为什么改了 .swcrc 没生效？
**来源**：https://swc.rs/docs/usage/core

三种：API 调用默认不读 .swcrc（要 swcrc:true）；代码传入的 opts 覆盖了文件；loader 把 options 直接传进去当显式配置。排查从「谁在喂配置」入手。

### 7. (实战类) 输出 map 怎么开？
**来源**：https://swc.rs/docs/configuration/swcrc

顶层 sourceMaps:true（外链）或 inline（内联）。CLI 与 API 都要配合落 .map 文件与 sourceMappingURL，别只配编译端忘了产出端。

### 8. (对比类) loose 模式在配置里体现为什么？
**来源**：https://swc.rs/docs/configuration/swcrc

jsc.loose 及各 transform.loose，输出更接近可读、体积更小的降级代码但语义略松（class 展开、helpers）。与 Babel 的 loose 概念一致，是正确性与产物的折中开关。

### 9. (坑类) tsx 与 jsx 自动识别靠谱吗？
**来源**：https://swc.rs/docs/getting-started

后缀驱动基本靠谱：.tsx 走 TS+JSX、.jsx 走 JS+JSX。但用非标准后缀（.mdx、无后缀经 loader 传入）时要在 parser 里显式声明 tsx:true，否则会解析失败。

### 10. (原理类) minify 字段写 true 和写对象的区别？
**来源**：https://swc.rs/docs/configuration/minification

true=用一组合理默认压缩；对象=细配 compress/mangle/format 的每个开关。生产要控豁免名或删 console 时用对象形态。

### 11. (实战类) .swcrc 能用注释吗？
**来源**：https://swc.rs/docs/configuration/swcrc

支持 JSONC 风格注释的读取，但若被别的工具当纯 JSON 校验可能报错。稳妥做法：注释版另存或用构建器约定，CI 里以 JSON.parse 为准时避免注释。

### 12. (对比类) 多份配置（根+子包）怎么合并？
**来源**：https://swc.rs/docs/configuration/swcrc

就近的 .swcrc 对其目录下文件生效（类似 tsconfig 的作用域直觉），非深度 merge 全链路。monorepo 常「根放公共、子包放差异」，理解作用域而非继承即可。

### 13. (坑类) polyfill 会自动注入吗？
**来源**：https://swc.rs/docs/configuration/supported-browsers

配 env.coreJs 时按目标注入需要的 core-js 引用片段。注意它是按需 import 垫片，而非把整个 core-js 塞进包——也别指望它能补上运行时全局（如 fetch）的实现。

### 14. (实战类) 想把整个 src 编到 dist 并清旧产物？
**来源**：https://swc.rs/docs/usage/cli

npx swc src -d dist --delete-dir-on-start。清目录避免删掉的文件留下僵尸产物；配合 --copy-files 把非编译资源一并拷过去。

### 15. (坑类) 配置写对了但产物没降级，为什么？
**来源**：https://swc.rs/docs/configuration/supported-browsers

多半是 env.targets 与 jsc.target 同时存在且 env 更宽（如 env 指向现代浏览器把 target 拉回 esnext），或根本没设降级目标默认 esnext 原样保留。检查生效的降级目标以最终 env 计算结果为准。
