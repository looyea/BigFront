# vite-plugin-api 面试题精选

> 共 15 题，覆盖 **插件模型 / 通用钩子 / Vite 独有钩子 / 顺序作用域 / dev-build 差异 / 虚拟模块** 六类。

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

---

## 补充（新专题 13-15）

### 13.  Vite 插件与 Rollup 插件的兼容边界：哪些钩子/字段是 Vite 扩展，写通用插件时怎么两边都跑？

继承面：Vite 直接使用 Rollup 插件管道（resolveId/load/transform/buildStart/generateBundle 等全套语义一致），"能用 Rollup 插件"是 Vite 生态冷启动的杠杆。Vite 扩展项逐个点名：config/configResolved（构建配置参与权，Rollup 无——配置在 Rollup 是外部参数）、configureServer/environments（dev server 控制反转，Rollup 没有 server 概念）、handleHotUpdate（HMR 域，纯 Vite）、apply/enforce（注册语义的糖）。边界坑：Vite 对部分 Rollup 钩子的调用时机有微调（transform 过滤的 include/exclude 语义、watch 事件聚合），以及 Rollup 高级钩子（renderChunk 的 modules 遍历等）在 Rolldown 兼容层有子集差异——"两边都能跑"的安全区是 resolveId/load/transform 三板斧+输出用 generateBundle。跨工具插件的工程形态（unplugin 模式）：工厂函数接受 { include, exclude } 配置、内部按 enforce 与 apply 适配 Vite 语义、对 webpack/Rollup/esbuild/Vite 各写薄适配器（钩子映射表）、测试矩阵跑全工具链。加分句：面试官问"插件本质"时的满分结构是"合同 + 时机 + 扩展"——合同是 Rollup 钩子形状，时机是 Vite 加的 config/server 两域，扩展是 environment/HMR 的 Vite 私有能力。

**来源**：Vite 官方 Plugin API（Rollup 兼容性声明）；Rollup 钩子列表对照；unplugin 仓库设计

### 14.  插件执行顺序为什么是 Vite 工程最容易踩的暗坑？给一张顺序心智图与调试方法。

心智图（一个模块从磁盘到浏览器）：resolveId 链（alias/虚拟模块在前）→ load（原始源码入场）→ transform 链按"pre 用户插件 → Vite 内置（esbuild/框架插件/PostCSS 关联）→ post 用户插件 → build 期收尾类"→ 之后进模块图与 chunk 渲染钩子。踩坑模式：① "我要在 vue 编译前拿到原始模板"没放 pre → 看到的是编译产物；② 依赖"前一个插件的输出格式"但对方升版改了产出 → 顺序耦合脆断（解法：兼容两种输入而不是钉顺序）；③ enforce 不够细（pre 里还有相互顺序——数组序）导致团队内两个插件打架；④ serve/build 顺序差异（同一插件在两套管道的注入点不同，apply 判断漏写）。调试方法学：Vite 官方顺序文档做参照系 → 在 transform 里打印（name + 输入前 200 字符）观察"我到底看到什么"→ 对比期望的中间态定位是谁提前改写了；顺序问题的报告（issue）要带这张打印链，否则维护者也无法复现。防线设计：公共插件库对顺序做显式文档与集成测试（按"给定输入序列→期望输出序列"写用例），把隐式顺序变成契约。收口句：插件系统的"顺序即语义"与中间件的"顺序即安全"是同一条工程定律的两次出现——讲透一个，另一个面试官自动相信你会了。

**来源**：Vite 插件顺序文档（alias→pre 用户→Vite 核心→post 用户→build/serve 插件）；Rollup plugin container 源码；掘金《我的 transform 怎么被前面的插件吃掉了》

### 15.  虚拟模块的完整生命周期：从   前缀到 dev/build 行为一致性，插件作者要盯哪些坑？

生命周期两钩子：resolveId（认领 id：返回带   前缀的内部 id，告诉其他插件"这是虚拟的别读盘"）、load（id→源码）。Vite 特有的坑与规范：①   不能出现在 URL——Vite 在 client 侧把   转 /@id/ 通道编码，含特殊字符的 id（Windows 路径、# 号）要 encodeURIComponent 处理（文档明说的手工活）；② dev 与 build 的 id 流转不同（build 里   一路到底，dev 要可被浏览器 import 的合法 URL——虚拟模块的"内容"变化在 dev 需手动触发 HMR 或标记 no-hmr）；③ transform 链路过虚拟模块时，后续插件可能按"真实文件"假设做路径判断（endsWith .js 类正则要兼容 /@id/ 前缀形态）；④ 缓存语义：虚拟模块的 load 每次 dev 请求都会执行吗（Vite 有模块图缓存，内容动态生成时要自己管失效）。设计守则：id 命名带插件前缀（my-plugin:virtual-entry 防多插件互抢）、可枚举清单（resolveId 认领的命名空间要能列出，"任何未知 id 都造模块"是生态污染）、提供开关允许宿主 exclude。收口句：虚拟模块是"插件给构建系统发明的文件"——发明得守规矩（可路由、可调试、可卸载），否则全生态都要为你的魔法让路，这是区分工具作者与工具玩家的地方。

**来源**：Rollup 虚拟模块约定（  与 plugin-name: 命名）；Vite dev 对虚拟模块的额外处理讨论；unplugin-vue-components 源码参考
