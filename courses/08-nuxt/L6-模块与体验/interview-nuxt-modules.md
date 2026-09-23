# nuxt-modules 面试题（15 题）

## A. 基础认知

### 1. 什么是 Nuxt 模块？它解决什么问题？
**答**：模块是构建期被 Nuxt 执行的一段代码（函数或带 meta/setup 的对象），通过 hooks 流水线读写 Nuxt 内部状态，从而一次性扩展"自动导入、组件注册、路由、Vite/Nitro 配置、生成的类型与虚拟文件、运行时插件"。解决的问题是**能力的分发与安装体验**：框架不内置的功能（图片、内容、i18n、状态）也能以"一行数组 + 一个 npm 包"的方式获得与内置几乎一致的体验，避免每个项目手抄胶水代码。

**来源**：《Nuxt 模块系统原理》、《为什么 Nuxt 生态如此密集》

### 2. defineNuxtModule 的结构与关键字段？
**答**：`meta`（name、version、configKey——决定 nuxt.config 里的字段名与冲突提示）、`defaults`（可给函数按 nuxt.options 计算默认值）、`hooks`（声明对其他模块事件的响应）、`setup(options, nuxt)`（主体）。setup 里应只做注册钩子与调用 Kit API，不要做副作用式的文件写入。类型上用泛型声明 options，配 `declare module 'nuxt/schema'`  augmentation 让用户配置有提示。 Kit 还提供 `useLogger`（统一日志前缀）、`createResolver`（模块内路径解析）、`addTemplate`（生成 .nuxt 文件）。

**来源**：《@nuxt/kit API 全览》、《模块作者指南》

### 3. 模块代码与运行时代码如何分离？
**答**：约定 `modules/<name>/index.ts` 为构建期入口，`modules/<name>/runtime/**` 为运行期代码，由 `addPlugin/addImports/addServerHandler` 用 `createResolver(import.meta.url)` 解析出的绝对路径注入。二者分属不同编译环境：index.ts 在 Node 里的 Nuxt 进程中跑，runtime 里的插件/composable 会进客户端与服务端两份 bundle。在 index.ts 里 import Vue 组件、或在 runtime 里 import `@nuxt/kit` 都是典型错误（后者会把构建期代码打进浏览器 bundle）。

**来源**：《模块目录规范》、《runtime 目录为什么必须存在》

## B. 对比与辨析

### 4. Vite 插件、Nuxt 模块、Nuxt Layer 三者怎么分？
**答**：看作用层。Vite 插件管"模块图与资源怎么编译"（transform/load/handleMR，10-vite 里写过），不知道 Nuxt 的 pages 是什么；Nuxt 模块管"框架约定"，能改路由表、自动导入清单、注入 server handler 与全局配置，并可顺带注册 Vite 插件；Nuxt Layer 是"项目级继承"，通过 `extends` 提供可被覆盖的目录与 nuxt.config，适合企业基座/多品牌。口诀：改编译用 Vite 插件，改约定用模块，改项目结构用 Layer。

**来源**：《三层扩展点对比》、《Layer 作为企业模板基座》

### 5. 与 Next.js 的扩展性相比，各自利弊？
**答**：Next 走"约定 + 配置字段"路线（`next.config.js`、`instrumentation.ts`、`middleware.ts`、官方内置图片/字体/OG），优点是可预测、升级面小、生态不需要那么多胶水；缺点是团队级复用只能靠脚手架复制代码或自建包，扩展点少。Nuxt 的模块系统灵活度更高（能改路由与类型），生态因此能覆盖大量小需求，但代价是：模块质量参差、版本耦合（模块依赖 Nuxt 内部 hooks 语义）、排查链条变长（构建期行为难观测）。跨框架看，Nuxt 更接近 VS Code 式生态，Next 更接近 Cloudflare 式平台内置。

**来源**：《扩展模型对比：模块 vs 内置》、《框架生态的两种演化路径》

## C. 实战场景

### 6. 要做一个公司内部模块：统一埋点 + 提供 `<TrackerBanner>` 组件 + 注入 `/api/collect` 端点，怎么写？
**答**：`modules/tracker/index.ts` 里 `addImportsDir(resolve('./runtime/composables'))` 暴露 `useTracker`（自动导入）、`addComponentsDir({ path: resolve('./runtime/components'), prefix: true })` 注册组件、`addServerHandler({ route: '/api/collect', method: 'post', handler: resolve('./runtime/server/collect') })` 提供端点、`addPlugin({ src: resolve('./runtime/plugin') })` 做初始化；options 通过 `configKey: 'tracker'` 接收 dsn/采样率，采样率这类**部署时才知**的值应再落到 `runtimeConfig.public`（构建期与运行期分层，呼应 nuxt-runtime-config）。所有运行期文件放 `runtime/`，模块发布为私有 npm 包供多个项目引用。

**来源**：《企业级 Nuxt 模块实践》、《埋点 SDK 的同构封装》

### 7. 装了某个模块后 dev 启动变慢 5 秒、build 变慢 2 分钟，怎么定位与处理？
**答**：定位：`NUXT_DEBUG=true nuxt dev` 与 `nuxt build --profile`（Nitro/Vite 各自耗时）；对比禁用该模块后的时间；看它是否在构建期做了重活（生成大量 template、扫描大目录、下载远端资源、为每个页面预渲染类型）。处理：给它限定范围（如 content 的文档目录、image 的 provider 改为远端交给构建期不下载）、把重活挪到运行时（缓存/懒生成）、提 issue 或 fork 加开关、必要时改用轻量替代。团队层面把"引入模块必须记录启动/build 时间前后对比"进评审清单——这类慢性退化最容易失控。

**来源**：《Nuxt 构建耗时分析》、《依赖引入的工程纪律》

### 8. 如何给模块写"只在 SSR 项目生效，纯 SPA 下自动禁用并警告"的逻辑？
**答**：setup 里读 `nuxt.options.ssr`（以及 `nuxt.options._generate` 判断是否在预渲染），若不满足条件就 `useLogger(...).warn('当前配置下 xxx 模块不生效')` 并 return，不再注册任何钩子；同时用 `nuxt.options.runtimeConfig.xxx = undefined` 之类保持类型一致。更好的设计是提供显式 `enabled` 开关并把自动判断只作为默认值，避免"用户以为生效但被静默关掉"。同类判断还包括 Node 版本、是否 dev、是否启用 Nitro（`nuxt.options.nitro === false`）。

**来源**：《模块的兼容性声明》、《meta.compatibility 的用法》

## D. 深度追问

### 9. 如何评价"模块能改一切"这种设计的安全与工程风险？
**答**：风险真实存在：模块以第一方权限运行，能读改配置、注入代码、访问构建环境变量（可能把 `process.env` 里的密钥烧进产物），一个恶意或被劫持的 npm 包就是供应链事故。缓解手段：①只引入有官方认证（@nuxtjs 组织或模块认证标记）或自建评审的包；②`package.json` 锁版本 + lockfile 审计 + CI 里 `npm audit`/依赖白名单；③构建环境最小权限（不把生产密钥给 CI 构建机，运行期再注入——呼应 nuxt-runtime-config 的 12-Factor）；④构建产物 diff（对比 .output 体积与新增端点清单）。收益与风险之间，工程上做"可控的灵活"而不是拒绝生态。

**来源**：《前端供应链安全》、《构建期代码执行的边界》

### 10. 模块如何影响最终产物体积？作者该做哪些克制？
**答**：路径有四：注入全局组件（自动注册会让所有页面 potentially 引用，若 `global: true` 且未树摇则进主包）、注入插件（每个请求/每次启动都执行）、生成虚拟模块（把数据内联进 bundle，如 content 的索引）、注册 polyfill 或改 `build.transpile`。克制做法：组件目录加 `prefix` 避免撞名并让未使用组件被 tree-shake；重能力用 `addPlugin({ mode: 'client' | 'server' })` 精确投放；数据类生成物提供懒加载与分页 API；提供 `autoImport: false` 让项目自己决定引入点（呼应 nuxt-auto-imports 的"显式导入的正当场景"）。体积回归要进 CI（rollup visualizer 对比，呼应 nuxt-perf）。

**来源**：《模块与包体积》、《自动导入的隐藏成本》

### 11. 一个模块既要支持 Nuxt 3 又要兼容 Nuxt 2，可能吗？该怎么决策？
**答**：几乎不可能优雅做到：Nuxt 2 的组合式 API 依赖 @nuxtjs/composition-api，模块 API（@nuxt/kit 的钩子名、Nitro 不存在、Vite vs Webpack）与目录约定都不同，只能写两套 setup 分支维护成本翻倍。正确决策是：新版本只支持 Nuxt 3，为 Nuxt 2 冻结最后一个大版本并在 README 标 EOL 与安全修复窗口；同时给迁移提供 codemod 或迁移清单（呼应 ts-migration、next-architect 里的迁移方法论）。业务侧同理——**升级策略要写在架构文档里而不是每次现编**。

**来源**：《大版本兼容的成本》、《框架迁移策略》

### 12. 从架构师视角，你的团队要不要自研模块？判断标准是什么？
**答**：判断三问：①这段胶水是否会在 ≥3 个项目里重复出现（低于这个数，用 Layer 或直接抽 composable 库更划算）；②它是否需要触碰"构建期才知道的信息"（路由表、自动导入、生成类型、注入 server 端点）——只有需要才值得做模块，纯运行期逻辑用普通 npm 包即可；③我们是否有人长期维护（模块与 Nuxt 版本耦合，属于有 owner 的资产，不是写完就完）。收益是消除复制粘贴、统一埋点/鉴权/主题等横切关注点；成本是隐式行为增多、新人上手要理解构建期。我的口径：**能被"约定"解决的优先约定，能被"库"解决的不做模块，只有全站一致的构建期增强才做模块。**

**来源**：《团队是否该自研框架扩展》、《横切关注点的分层落位》

---

## 补充（新专题 13-15）

### 13.  模块（Module）与 Layer 都能复用代码，边界在哪？公司内部能力库该做成哪种、怎么发版？

分界判据：Layer=目录叠加（约定资产：components/composables/pages/assets 直接合并进消费项目，nuxt.config 可 extends 级联，面向"共享一整套项目形态"）；Module=函数式干预（setup 里动 config、注册 hook、注入插件、加虚拟模块，面向"改变构建/运行行为"）。设计系统这类"UI 资产为主、少量构建配置（tailwind preset、自动导入）为辅"的复用，实践中常是 Layer 装组件+薄模块装配置的双件套——硬塞一个模块里就用 vite 插件手写组件解析，得不偿失。发版策略：monorepo（pnpm workspace+changeset）内部 registry；语义化版本纪律——Layer 的"API"是目录结构与导出组件的 props（删组件=破坏性）、模块的 API 是 configKey 字段与 hook 行为；两者都要写 codemod 或迁移指南配 major。教训句：复用的单位选错，后面每次升级都在替历史布局付费。

**来源**：Nuxt 官方 modules 与 layers 文档；掘金《我们团队把设计系统从 Layer 迁进模块的复盘》

### 14.  模块开发者的可观测与防御清单：如何让"装了你的模块"从玄学变成可诊断？

清单十条选重点讲：① setup 里一切失败要 throw 带上下文的错误（缺配置、版本不符），禁止 console.warn 后静默半工作；② compatibility 与 engines 双声明（Nuxt major/minor、Node 范围），版本不符给"预期行为"提示；③ 注入的插件/虚拟模块用命名前缀（tracker:runtime），全局冲突可 grep；④ 不改用户没同意的 config 字段，改了就进 debug 日志（nuxt debug --timeline 可见）；⑤ 提供 disable 开关（env 或 config 字段）让项目能"装了但先关"排查干扰；⑥ 自动导入注册项列清单进 README（和官方目录的冲突要有矩阵）；⑦ 构建钩子里耗时操作（生成路由、扫描内容）打计时日志，>1s 要说明理由；⑧ 运行期插件默认零开销（懒初始化、按 options 裁剪注入）；⑨ 给出 /api/_tracker/health 类自检端点（内部模块）或 devtools 集成；⑩ 错误信息面向使用者写"下一步做什么"而不是抛内部术语。收口：模块的口碑=失败路径的质量，成功路径大家都差不多。

**来源**：Nuxt 官方模块钩子文档；SegmentFault《给模块作者的可观测性十条》

### 15.  模块生态的供应链风险：私有 registry、权限、依赖深度，团队准入怎么定？

风险分层：① 官方模块（@nuxtjs/*、nuxt-modules org）——质量不一但有 CI 与发布规范，仍是"第三方维护者的代码"，出问题窗口期看公告订阅；② 社区模块——看三件：维护者响应（issue 积压时长）、发布纪律（changelog、是否 latest 漂移）、依赖树深度（一个模块拖 200 包=把 200 包的攻击面请进来）；③ 私有模块——发布权限收敛（CI 发版禁本地 npm publish）、lockfile 全项目强制+定期 audit、内部 registry 配 scope 白名单。准入实操：建立"模块台账"（谁在用哪个版本、负责人、最近审查日期），新模块进项目过安全 checklist（运行时权限面：会不会注入全局插件/改 server 路由/读写 FS），大版本升级按依赖升级流程跑 e2e。Nuxt 特有面：模块有构建期全权（改 config、读文件、动产物），npm 恶意包在模块位上的破坏力大于普通组件库——这就是"官方模块优先、能薄自研不自研厚"的治理理由。

**来源**：Nuxt 安全公告（如 3.x 路径穿越类）处理流程；InfoQ《前端供应链：从 npm 到框架官方模块》
