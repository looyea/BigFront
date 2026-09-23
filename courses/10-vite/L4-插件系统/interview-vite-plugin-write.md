# vite-plugin-write 面试题精选

> 共 15 题，覆盖 **虚拟模块 / transform 注入 / dev 中间件 / HMR 推送 / 构建守卫 / 工程化** 六类。

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

---

## 补充（新专题 13-15）

### 13.  从零设计一个 transform 类插件（比如给命中文件自动注入埋点调用），如何同时保证正确性与性能？

正确性四件套：① filter 先行——用钩子的 id 判断（扩展名、路径、include/exclude 工具如 vite-plugin-utils 的 createFilter）把不相关模块第一时间 return null，Vite 对 null 视为"跳过"零开销；② 位置保真——改写一律用 magic-string 按 span 替换而不是正则拼字符串，原始位置之前的内容不动，map 才可负担；③ 依赖登记——注入内容若引用其他模块（埋点 SDK），要么生成 import 让模块图自然收集，要么 this.load 显式拉入，避免"源码里有但图里没有"的悬空标识符；④ sourcemap 必返——map: m.generateMap({ hires: true })，丢 map 会让下游整链错位（呼应 plugin-api 关）。性能习惯：大文件先测试短路（正则粗筛再精确解析）；AST 解析只付一次——若还要读结构，用 es-module-lexer 这类轻量扫描替代完整 babel 解析；避免每模块同步 IO。工程面：enforce 与 apply 显式声明、给插件写最小复现测试（用 Vite programmatic API 起一次性 build 断言产物）、提供 enable/disable 开关便于排查。加分句：transform 插件的质量问题九成出在"改了不该改的模块"和"丢了 map"，filter 与 map 两行代码就是性价比最高的保险。

**来源**：Rollup 官方 transform 钩子文档；magic-string README（性能与 sourcemap 动机）；Vite 插件开发指南

### 14.  虚拟模块的 id 为什么约定加 \0 前缀？哪些环节会消费这个约定？

约定本源：\0（null 字符）不是合法文件名字符，给"并非磁盘路径"的模块 id 打前缀，让所有按"这是不是文件路径"行事的消费方能一眼区分。消费环节逐个看：① load 钩子——resolveId 返回带 \0 的 id 后，只有你的 load 认领它，其他插件的 fs 读取逻辑必须跳过（判前缀）；② Vite 的 ssr.external / optimizeDeps 等按"能否 fs 解析"决策的内部逻辑，未排除虚拟 id 会误报找不到模块（Vite 对 virtual:\0 类 id 有内置豁免，历史上多个 CVE 与失效都出在这类判断的漏洞）；③ 其他插件对 id 做 path.extname/existsSync 的 transform——前缀让它们在第一步 return。为什么前缀而非后缀：多个插件的命名空间要共存（virtual:sw:、virtual:pwa:），前缀统一好过滤；且 Rollup 的 external 判断、Vite 的 /@id/ URL 编码都能保留前缀语义。工程细节：浏览器网络面板里 \0 显示为 %00，调试时按此搜索；Vite 的 moduleTransformAnalysis 会把 \0 模块排除出 fs.allow 检查。加分句：\0 不是技术要求是"生态合同"——它的价值在于别人也遵守，自定义解析 id 时不遵守就会在某个第三方插件里诡异翻车，这就是读规范的意义。

**来源**：Rollup 官方 plugin FAQ（\0 前缀约定）；Vite 虚拟模块文档；rollup-plugin-virtual 源码

### 15.  如果让你手写一个最小 vue 插件（编译 SFC），transform 里依次要做什么？会碰到哪些真实框架插件已经解决的问题？

最小流程：① filter .vue 后缀；② 用 @vue/compiler-sfc 的 parse 拆出 script/template/style 块；③ template 编译成 render 函数（compileTemplate，产出带 map 的 JS）；④ script 与 template 拼接成单个 ES 模块（codegen 阶段处理 setup 返回值绑定），返回 { code, map }；⑤ style 块另路处理（transform 里 this.emitFile 或交给 CSS 管道，实际插件拆成多个子插件分钩子做）。真实插件多解决的问题清单（面试的深水区）：HMR 边界——哪些块改动做热替换（template/script 各自粒度）、哪些必须 reload（自定义块）；source 映射两段式（Vue 语法→JS→esbuild JS→最终 JS 的 map 链拼接）；slotted CSS 作用域与 scoped 哈希的跨块一致性；编译器宏（defineProps）需先于普通 script 处理（enforce pre 的原因）；自定义块（docs/yaml）的通用协议；virtual 辅助模块（?vue&type=style 查询参数路由）的 resolveId/load 配套。能说出"查询参数子模块"这个设计（?vue&type 让同一文件的不同部分成为不同模块，是 HMR 粒度的基石）就超过 80% 回答。收口句：框架插件的难不在"编译"在"编译结果如何继续活在模块图与 HMR 体系里"——这是插件开发从 demo 到 production 的分水岭。

**来源**：@vue/compiler-sfc 文档；vite-plugin-vue 源码导读；Vue SFC 规格说明
