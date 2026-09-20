# vite-plugin-api 面试题精选

> 共 12 题，覆盖 **插件模型 / 通用钩子 / Vite 独有钩子 / 顺序作用域 / dev-build 差异 / 虚拟模块** 六类。

---

## 一、插件模型

### 1. Vite 插件的本质是什么？和 Rollup 插件什么关系？

Vite 构建阶段基于 Rollup，因此**一个 Vite 插件首先是一个 Rollup 插件**（返回带 `name` 和钩子的对象），能直接用大量 Rollup 插件。Vite 又在其上**扩展了自定义钩子**处理 Rollup 管不到的事：dev server（`configureServer`）、HTML（`transformIndexHtml`）、HMR（`handleHotUpdate`）、配置（`config`/`configResolved`）。所以关系是"超集"：Rollup 钩子 + Vite 扩展钩子。

**来源**：Vite — "Plugin API / Rollup compatibility"; Rollup — "Plugin development"; Vite RFC — "plugin hooks"

### 2. 插件对象里 name、apply、enforce 分别是干什么的？

- `name`（必填）：调试与报错定位标识，Vite 用它打印是哪个插件。
- `apply`：作用域开关，`'build'`/`'serve'`/函数 `(config, env) => boolean`，决定插件只在构建或只在 dev（或按 mode 条件）挂载，避免无谓开销与误用不触发钩子。
- `enforce`：插件间顺序 `'pre'`（内建转换前）/ normal / `'post'`（最后），用来与 Vite 内建插件抢先后（如要在框架编译前处理原始源码用 pre）。

**来源**：Vite — "Plugin order / apply / enforce"; Rollup — "plugins array order"

---

## 二、通用（Rollup）钩子

### 3. resolveId、load、transform 三个钩子的职责与顺序？

顺序 `resolveId → load → transform`。
- `resolveId(source, importer)`：把一个 import 说明符**解析成规范模块 id**（绝对路径或自定义 id），可返回 `{id, external}`。
- `load(id)`：当模块还**没有内容**时为它**生成源码**（如虚拟模块、非文件来源）。
- `transform(code, id)`：对**已加载的源码**做改写（编译/注入/替换），返回 `{code,map}` 或字符串，会传给下一个插件的 transform。
记法：定身份 / 给初稿 / 改正文。

**来源**：Rollup — "resolveId / load / transform hooks"; Vite — "custom hooks notes"

### 4. 为什么 transform 里要尽量返回 sourcemap 而不是只返回字符串？

Vite 管线里源码被多层 transform 反复改写（TS/JSX/框架宏/你的插件）。若你只返回 `code` 而丢了 `map`，最终产物到原始源码的映射断裂 → 报错定位、断点调试、控制台栈全指向编译后的代码，DX 崩塌。用 `magic-string` 基于原 `code`+`map` 做增量修改并 `toString({hires:true})` 产出新 map，保留可调试性。

**来源**：Rollup — "Sourcemap / transform return"; Rich Harris — "magic-string"; Vite — "sourcemap in plugins"

### 5. this.emitFile 和直接 fs 写文件有何区别？

`this.emitFile({type:'asset'|'prebuilt-chunk'|'chunk', ...})` 把文件**纳入 Rollup 产物图**：受 outDir/资产命名/hash/buildEnd 生命周期管理、dev 下可被服务、增量构建可追踪。直接 `fs.writeFileSync` 绕过管线：不受清理/哈希/watch 管理，可能覆盖、残留、路径错乱。插件要产出文件优先 emitFile。

**来源**：Rollup — "this.emitFile"; Vite — "plugin context"

---

## 三、Vite 独有钩子

### 6. config 和 configResolved 有什么区别？分别能做什么？

`config(userConfig, {command, mode})` 在**配置合并阶段**调用，可**返回要 merge 的额外配置片段**（如插件自带 `define`/`optimizeDeps`/`resolve.alias` 默认值）——是"改配置"的地方。`configResolved(config)` 在解析完成后调用，拿到**最终只读配置**，用来**读取**判断（当前是 build 还是 serve、什么 mode），不可再改。前者写、后者读。

**来源**：Vite — "config / configResolved hooks"; Vite — "shared plugins config"

### 7. 如何在 dev server 里加一个自定义接口/中间件？

用 `configureServer(server)`，通过 Connect 风格 `server.middlewares.use((req,res,next)=>{...})` 注册。要跑在 Vite 内部转换中间件**之前**可在钩子里直接 `use`；要在**之后**则 `return (server) => { server.middlewares.use(...) }`（返回后置函数）。还能访问 `server.moduleGraph`、`server.watcher`、`server.ws` 做文件监听/HMR 推送。这是很多 mock/devtools/探针类插件的基础。

**来源**：Vite — "configureServer / middleware mode"; Connect — "middleware"; Vite — "server.moduleGraph"

### 8. handleHotUpdate 什么时候需要？给个场景。

默认 HMR 按模块图自动传播失效。当你改的文件**不是标准 JS/CSS 模块**（如 `.md`、`.yaml`、i18n `.json`、自定义 DSL），Vite 不知道该怎么热更，需要你在 `handleHotUpdate({file,modules,server})` 里：过滤/扩展受影响模块返回、或 `server.ws.send({type:'full-reload'})`、或发自定义事件让前端接收后局部更新。做非代码类文件的精细 HMR 时必备。

**来源**：Vite — "handleHotUpdate / custom HMR"; Vite — "HMR API"

---

## 四、虚拟模块与 dev/build 差异

### 9. 讲讲虚拟模块的实现与 `\0` 前缀的作用。

插件用 `resolveId` 把某个说明符（如 `virtual:config`）解析成一个**自定义 id**，再在 `load` 里对该 id **返回生成的源码**，业务就能正常 `import`。约定给解析后的 id 加 `\0`（null 字节）前缀：① 表明"这不是真实文件路径"，② 让其它插件默认跳过（Rollup 生态惯例，避免被别的 resolveId/文件系统插件争抢或误当文件去读）。虚拟模块是"把任意数据变成可 import 模块"的通用手法（图标、config、markdown）。

**来源**：Rollup — "id resolution and external / virtual modules"; Vite — "virtual modules"; @rollup/plugin-virtual

### 10. 为什么"dev 正常、build 出问题"（或反过来）常和插件有关？

因为 Vite 双模型：dev 走按需 ESM 中间件、build 走完整 Rollup。同一钩子在两模式行为不同——`resolveId/load/transform` 两边都跑（dev 针对每个请求模块），而 `options/renderChunk/generateBundle/writeFile` **只在 build 触发**。若插件把关键逻辑放 build-only 钩子却期待 dev 生效（或反之）、或没处理 dev 下模块以不同形态被请求，就会出现单侧正常。对策：明确用 `apply` 分离、把两模式都要的逻辑放通用钩子、dev 特殊处理放 `configureServer`。

**来源**：Vite — "Build vs Dev / plugin compatibility"; Vite — "features that differ between dev and build"

---

## 五、生态与实践

### 11. 一个成熟的 vite-plugin 应具备哪些素质（可发布角度）？

单一职责 + 明确 TS 类型（`Plugin` 接口、options 类型）；合理默认值与 options 校验；`name` 规范（`vite-plugin-xxx`）；正确用 `apply`/`enforce` 限定作用域与顺序；保留 sourcemap；对每个 id 先做后缀/路径**过滤**再处理（dev 性能敏感，别对每模块空跑）；用 `config` 注入自带默认而非要求用户手配；dev/build 双模式测试；文档 + 示例；类型声明与 ESM 导出；不产生副作用式写盘（用 emitFile）。

**来源**：Vite — "Authoring a plugin / plugin conventions"; create-vite-plugin; Anthony Fu — "Vite 插件约定"

### 12. 有现成插件还自己写，选型时注意什么？

优先复用社区/官方插件（框架支持、legacy、PWA、图标、markdown、可视化分析等几乎都有）。注意：① 是否兼容你的 Vite 大版本与 Vite6 Environment API；② 是否 Rollup/Vite 通用还是绑死某模式；③ enforce 与现有插件链是否冲突；④ 维护活跃度与体积；⑤ 有无更轻替代（也许一个 `transform` 钩子就够，不必引重包）。真没有合适再自研，且写成可复用包而非一次性配置。

**来源**：awesome-vite / Vite — "Plugins registry"; Rollup — "plugin list"; npm search vite-plugin
