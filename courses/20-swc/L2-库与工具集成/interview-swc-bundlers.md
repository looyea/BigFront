# 面试题：打包器与框架（swc-bundlers）

### 1. (实战类) webpack 里怎么把 babel-loader 换成 SWC？
**来源**：https://swc.rs/docs/usage/swc-loader

装 swc-loader，rule.use 换成它，options 直接搬你原来的 .swcrc 形状（jsc/module）。exclude node_modules 保持。多数 preset-env/react 的配置能一一映射到 jsc。

### 2. (原理类) Rspack 和 SWC 是什么关系？
**来源**：https://swc.rs/docs/usage/swc-loader

Rspack 是 Rust 打包器，JS 转译层直接内建 SWC（builtin:swc-loader），配置就是 SWC 的 jsc/module 结构。会配 SWC 就会配 Rspack，无需额外装 loader。

### 3. (生态类) Next.js 用 SWC 需要配置吗？
**来源**：https://swc.rs/docs/getting-started

基本不用——v12+ 默认 SWC 编译与 minify。你只需用 next.config.js 的开关启用 styled-jsx/styled-components 支持，别新增 babel 配置，否则会把 SWC 旁路回 Babel。

### 4. (坑类) Next 项目里加了 .babelrc 会怎样？
**来源**：https://swc.rs/docs/getting-started

检测到自定义 Babel 配置，Next 会放弃 SWC 回退 Babel，构建变慢且和 SWC 插件生态脱节。迁移方向是反过来：把 babel 插件需求换成等价 SWC 插件后删掉 babelrc。

### 5. (对比类) Vite 项目里该引 SWC 吗？
**来源**：https://swc.rs/docs/benchmarks

通常不必。Vite dev 用 esbuild 转译、build 用 Rollup，链路已最优。硬塞 SWC 只是增加复杂度。SWC 的战场在 webpack/Rspack/Next 和自建构建。

### 6. (实战类) swc-loader 的 options 从哪来？
**来源**：https://swc.rs/docs/usage/swc-loader

就是 .swcrc 的对象形式：jsc、module、minify、env 全可内联进 webpack rule.options。也可让它读外部 .swcrc（swcrc 相关 loader 选项）。一处配置两种投递方式。

### 7. (原理类) 「选打包器就是选转译层」怎么理解？
**来源**：https://swc.rs/docs/usage/swc-loader

webpack 默认 babel、可换 swc-loader/esbuild-loader；Rspack 内置 SWC；Vite 内置 esbuild。你选的 bundler 基本决定了 JS 语法怎么被降级、以什么速度。转译层又直接影响产物与耗时。

### 8. (对比类) Parcel 呢？
**来源**：https://swc.rs/docs/getting-started

官方文档把 Parcel 列为使用 SWC 的工具之一：Parcel 用 SWC 做默认 JS/TS 编译。所以 Parcel 用户其实也在配 SWC 的编译选项（通过其 transformers 配置）。

### 9. (实战类) 大仓换 swc-loader 的收益怎么量化？
**来源**：https://swc.rs/docs/benchmarks

测冷启动与增量重建时间：保留 babel 配置跑一次记录耗时，换 swc-loader 同条件再跑。多数 TS-heavy 大仓能看到转译阶段数倍到十倍级下降，用官方基准做上限预期。

### 10. (坑类) 替换后某些 babel 插件的行为没了怎么办？
**来源**：https://swc.rs/docs/plugin/ecmascript/getting-started

先查有无对应 SWC 内置 transform（很多 react/typescript 类已内置）；没有的找社区 Wasm 插件；再没有就得为该插件保留一条 babel 处理或重写逻辑——这是迁移真正的长尾。

### 11. (生态类) webpack + swc-loader 与直接上 Rspack 怎么权衡？
**来源**：https://swc.rs/docs/usage/swc-loader

存量 webpack 项目想低风险提速→换 swc-loader（保留整个 webpack 插件生态）；新起项目且能接受生态迁移→Rspack 整包更快更一致。前者是渐进，后者是换代。

### 12. (原理类) Next 里 SWC 也负责 minify 吗？
**来源**：https://swc.rs/docs/configuration/minification

是。next build 默认用 SWC minifier 替代 Terser（历史上有 swcMinify 开关，现默认）。所以你关 babel 的同时也统一了压缩层，体积与 terser 接近而更快。

### 13. (实战类) 怎么确认我的 Next 真在用 SWC？
**来源**：https://swc.rs/docs/getting-started

产物里找 automatic JSX runtime 的 import、或删掉 babelrc 后构建日志不再提 Babel；也可跑 build 看耗时对比。有 .babelrc 基本就还没用 SWC，先清它。

### 14. (对比类) Deno 和 SWC？
**来源**：https://swc.rs/docs/getting-started

Deno 早期用 SWC 做 TS/JS 的转译与类型剥离。说明 SWC 不只是 npm 生态，也在被独立 JS 运行时采用为编译底座——它的定位是「可嵌入的编译器库」。

### 15. (实战类) swc-loader 与 minify：构建里两处都能配，会重复吗？
**来源**：https://swc.rs/docs/usage/swc-loader

会。若 swc-loader 开了 minify、打包器又跑 TerserPlugin，就压了两遍。约定：swc-loader 只负责转译，把压缩交给打包器的 minimizer（或 Rspack 内置 SWC minifier），职责单一不重叠。
