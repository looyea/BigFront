# vite-plugin-write 面试题精选

> 共 12 题，覆盖 **虚拟模块 / transform 注入 / dev 中间件 / HMR 推送 / 构建守卫 / 工程化** 六类。

---

## 一、虚拟模块

### 1. 手写一个虚拟模块插件，完整说明 resolveId 与 load 如何配合。

业务 `import 'virtual:config'` 时，Vite 调各插件 `resolveId('virtual:config')`；你的插件认领它并返回一个自定义 id（惯例加 `\0` 前缀 `\0virtual:config`）表示"非真实文件"。随后 Vite 需要该模块源码时调 `load(resolvedId)`，你对匹配到的 id **返回一段生成的 ESM 源码字符串**。两步一一对应即成。可在 `load` 里读文件、查 DB、跑计算动态拼源码——这就是图标集、Markdown、i18n、env 注入类插件的通用骨架。

**来源**：Vite — "virtual modules"; Rollup — "resolveId / load"; @rollup/plugin-virtual

### 2. `\0` 前缀不加会怎样？

不加 `\0`，解析出的 id 看起来像普通路径，其它插件（尤其内建的文件读取/其它 resolveId/transform）可能把它当真实模块继续处理或争抢，导致解析混乱、被 `fs` 读取失败、或 sourcemap 报错。`\0` 是 Rollup 生态广泛遵循的信号："这是虚拟模块，请默认跳过文件系统处理"。省略它偶尔也能跑，但脆弱、易与其它插件冲突。

**来源**：Rollup — "convention: \0 prefix for virtual modules"; Vite issue — "virtual module resolution"

---

## 二、transform 注入

### 3. transform 和 load 都能"产出源码"，何时用哪个？

`load(id)`：模块**尚无内容**时给初稿（虚拟模块、非文件来源、需要从零生成）。`transform(code, id)`：模块**已有源码**（文件或其它插件 load 出来的）后改写正文（编译、注入、替换）。判断标准——有没有"原始 code 输入"：没有就 load，有就 transform。很多插件两者都用：load 造虚拟模块，transform 改真实文件。

**来源**：Rollup — "load vs transform"; Vite — "plugin hooks"

### 4. 用插件做"编译期功能开关"（feature flag 死代码消除）的思路？

`transform` 里把源码中 `__FEATURE_X__` 标识符替换为 `true`/`false` 字面量（来源可是 env/config）。替换成常量后，`if (false) {...}` 分支 + 其内独占依赖会被 Rollup tree-shaking 与 minifier 当作死代码剔除，产物里根本不含未启用路径，运行时零开销。注意：标识符替换要保证语法正确、别误伤字符串内容；更严谨可用 AST（estree/`magic-string`）并保 sourcemap。Vite 内建 `define` 也能做常量替换，插件版更灵活。

**来源**：Rollup — "tree-shaking / dead code"; Vite — "define"; esbuild — "define feature flags"

### 5. 为什么在 transform 里用 magic-string 而不是字符串拼接/replace？

`String.replace` 简单但会**丢失 sourcemap**、易越界误改、多次替换位置错乱。`magic-string` 基于原 code + 原 map 做**增量编辑**（overwrite/update/remove/prepend/append），全程维护偏移，`toString({hires:true})` 产出**精确的新 map**，让报错/调试仍能映射回源码；还能用 `guessIndent`、按 AST 节点范围替换（配 `es-module-lexer`/estree）。凡是需要保留可调试性的代码注入都应走它。

**来源**：Rich Harris — "magic-string"; Rollup — "sourcemap in transform"; es-module-lexer

---

## 三、dev server 中间件

### 6. 写一个 dev-only 的 mock 接口插件，关键要素有哪些？

① `apply: 'serve'` 确保只在开发挂载、生产不打包、不带上线；② `configureServer(server)` 里 `server.middlewares.use('/mock/x', handler)`（Connect 风格）；③ 正确设置 `Content-Type`、`res.end(JSON.stringify(...))`；④ 若要拿到"经 Vite 转换后的模块"，`return (server)=>{...}` 把中间件插到内部处理之后；⑤ 可结合 `server.watcher` 监听 mock 文件改动热更新。

**来源**：Vite — "configureServer / middleware mode"; Connect — "middleware"; vite-plugin-mock

### 7. configureServer 里"直接 use"和"返回一个函数再 use"区别是什么？

直接 `server.middlewares.use(...)` 注册的中间件在 **post 内部中间件之前**（即早于 Vite 的转换/transform middleware），适合独立于模块图的端点。而 `configureServer(){ return (server)=>{ server.middlewares.use(...) } }` 返回的函数会在 **Vite 内部中间件安装之后再执行**，用于需要晚于 Vite 处理（比如访问转换后资源、或做兜底 404/SPA fallback）的场景。位置不同 = 请求链先后不同。

**来源**：Vite — "configureServer post hooks"; Connect — "middleware order"

---

## 四、HMR 与文件监听

### 8. 插件里如何主动触发 HMR 更新/整页刷新？

通过 `server.ws.send(payload)`：`{type:'full-reload'}` 整页刷新；`{type:'update', path, timestamp}` 更新指定模块；`{type:'custom', event, data}` 发自定义事件（前端 `import.meta.hot.on(event, cb)` 接收）。配合 `server.watcher.on('change', file => ...)` 监听非标准文件（如 `.env`、内容资源）变化后决定推哪种。做自定义文件类型热更（Markdown、i18n、路由表）时非常关键。

**来源**：Vite — "HMR API / server.ws.send / import.meta.hot"; Vite — "handleHotUpdate"

### 9. handleHotUpdate 与 transform 触发 HMR 有什么不同分工？

`transform` 只管"改代码内容"，改完后模块被标脏、HMR 由 Vite 按模块图自动传播（这是标准 JS/CSS 路径）。`handleHotUpdate` 是**定制这次更新如何传播**：当变更文件不是常规模块（或你想改变失效范围）时，你在此返回要更新/移除的模块列表、抑制默认行为、或改发 full-reload/custom 事件。前者生产代码、后者控制传播策略。

**来源**：Vite — "handleHotUpdate vs transform"; Vite — "HMR propagation"

---

## 五、构建守卫与产物操作

### 10. 想扫描最终产物做检查（密钥/体积阈值/许可证头），用什么钩子？

`generateBundle(options, bundle)`（或 `renderChunk` 处理单个 chunk）：能遍历所有 chunk/asset，读 `chunk.code`、`asset.source`，命中问题 `this.error()` 让构建失败（守卫），或用 `magic-string` 追加 banner/license 头、`this.emitFile` 补充文件。做体积告警、敏感信息拦截、产物注入版权头的插件都落在这里。注意它在 dev 不触发——守卫只应在 build 跑（配 `apply:'build'`）。

**来源**：Rollup — "generateBundle / renderChunk / this.error"; vite-plugin-virtual / size-limit 思路

---

## 六、工程化

### 11. 把插件写成可发布 npm 包要注意什么？

导出默认工厂函数并带 JSDoc/TS 类型（`import type { Plugin } from 'vite'`）；options 给默认值与校验；`name` 遵循 `vite-plugin-*`；用 `apply`/`enforce` 精确限定；对 id 先过滤再处理（性能）；保留 sourcemap；提供 `.d.ts`、`sideEffects:false`、ESM 入口；README 用法 + 示例；dev/build 双模式 + 多版本 Vite 测试；避免副作用式直接写盘（用 emitFile）与硬编码路径。发布前打 `--dry-run` 检查体积与文件清单。

**来源**：Vite — "Authoring a plugin"; create-vite-plugin template; npm publishing — "package exports/types"

### 12. 排查"我的插件没生效/顺序不对"，你会怎么定位？

① 确认 `plugins: [mine()]` 已加入且函数被调用（构造时打日志）；② 检查 `apply` 是否把当前模式排除（dev/build）；③ 钩子在该模式是否触发（build-only 钩子 dev 不跑）；④ 用 `enforce` 或返回函数调整相对内建插件的先后；⑤ transform 里确认 id 过滤条件真命中（dev/build 的 id 形态不同，打 log 看实际 id）；⑥ 是否与别的插件争抢同一 id（虚拟模块漏 `\0`）；⑦ 用 `vite build --debug` 看转换链路。系统化：先证"被加载"，再证"被调用"，再证"命中判断"。

**来源**：Vite — "debug mode / troubleshooting"; Rollup — "plugin order"; community — "why my vite plugin isn't running"
