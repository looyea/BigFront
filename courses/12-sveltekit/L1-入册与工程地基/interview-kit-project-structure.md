# kit-project-structure 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

---

### 1. (A) svelte.config.js 与 vite.config.ts 双配置并存的分工逻辑是什么？为什么不全并入 vite？

**来源**：工程结构基础题（配置分裂的经典困惑转述）

svelte.config.js 管**编译器+Kit 语义**（kit.adapter、kit.alias、kit.prerender、kit.csp、编译器 compileOptions），vite.config.ts 管**打包器插件链与 dev server**。历史上进过"全收进 vite 插件参数"的讨论，保持分离的理由：编译器配置要在 Svelte 语言服务/编辑器工具链里同样可读（它们不跑 vite）；vite 插件参数保持"宿主构建器"的纯粹。实操记法：换 adapter/关水合/配别名→前者，配代理/改构建 target/加 vite 插件→后者。

### 2. (A) src/app.html 里的 %sveltekit.head% 与 %sveltekit.body% 各对应 11 包手搓 SSR 的哪个环节？

**来源**：模板机制溯源题（发动机-整车对照收官）

head 占位=手搓版里"把 render() 返回的 head 字符串拼进 <head>"那一行；body 占位=容器 div + 水合数据 script 注入的位置。差异：手搓版你要自己记得转义与序列化协议，Kit 把 devalue 序列化、锚点注释、模块 preload 全部编排进这两个槽——**占位符就是 11 包 svelte-ssr-hydration 那课样板代码的框架化终点**。追问"能在 app.html 里写死全局 meta 吗"：能，但页面级动态 title/meta 归 <svelte:head>（特殊元素在 L9 包讲过，SSR 时会被收集进 head 槽）。

### 3. (A) 为什么 routes 目录下混放的普通组件文件不产生路由？这个"只认 + 前缀"的设计保护了什么？

**来源**：文件系统路由边界设计题

Kit 只把 `+` 开头文件视为路由契约成员，其余文件（组件、样式、utils）随便放不干扰匹配。保护的是**共存性**：路由私有组件（该页专用 Modal/Row）可以贴着页面放，不用跳去 components 目录维持"就近原则"——否则人们会被迫把页面私有代码塞进 $lib，全局层反而变垃圾场。对照 Nuxt：pages/ 下所有 .vue 都成路由（要排除得靠 extensions/自定义），这是"前缀白名单"与"目录黑名单"两种模型。

### 4. (B) 同事把数据库连接串从 $env/static/private 改成 $env/static/public，因为"客户端要显示这个名字"。这段操作的完整风险分析与安全解法。

**来源**：环境变量误用实录

static/public 的值构建期内联进**客户端 bundle**——等于把 .env 内容公开印刷在 JS 里任何人 view-source 可得；若值是连接串还暴露内网拓扑。正解分层：①客户端要的"显示名"应由 server load 读 private 变量后**返回裁剪过的字段**（data.dbName），浏览器看到的是数据不是环境；②确需前端直读的配置（API base URL）才进 PUBLIC_；③MR 检查项：diff 里出现 $env/static/public 的新增引用=安全评审触发器。金句：public 前缀不是访问修饰符，是出版行为。

### 5. (B) "本地 dev 正常，部署后 $env 值全是 undefined"——给出 dynamic vs static 两种病因与鉴别法。

**来源**：环境变量部署事故高频题

病因A（static 误用环境时机）：static 是**构建期**内联——CI 构建机没有配这些 env（只在运行容器里配了），产物里就是空/缺；鉴别：build 机上 echo 变量或 grep 产物。病因B（dynamic 运行期缺失）：dynamic 读 process.env，构建没事、运行容器没注入（编排模板漏了 envFrom/secret）→ 运行期 undefined；鉴别：进容器 printenv。修复方向相反：A 把变量挪进构建环境（或改用 dynamic），B 修部署清单。延伸考点：adapter-node standalone 起法不同（直接 node build 与 npm start）env 注入位点也不同（L6 deploy 关展开）。

### 6. (B) 改了路由目录名之后 `./$types` 里的 PageLoad 类型报错不消失，为什么？两步标准处置。

**来源**：generated types 陈旧坑题

`./$types` 是 `.svelte-kit/types/` 下按 routes 现状生成的声明，IDE/ts server 缓存的是生成前版本——编译器看着旧 manifest。处置：①跑 `npx svelte-kit sync`（或重启一次 dev，它会自动 sync）；②让 ts server 重新加载（VSCode 里 Restart TS Server）。深层认知：**类型是生成物不是解析物**，一切"类型和代码不同步"的怪象先怀疑 sync 时机——CI 里 build 前置 sync 是防这类抖动的标准动作（L8 typescript 关全量展开）。

### 7. (C) Kit 的 $lib 别名与 Next/Nuxt 的路径别名机制相比，独特价值在哪？

**来源**：别名机制横向题

三家都能配 alias（tsconfig paths / #imports / ~/），Kit 的差异化是**语义内置**：$lib 是框架级契约（脚手架默认+文档默认例+编译器知晓），零配置即得"共享层"的共识位置；且它与路由私有性联动——routes 内非 + 文件天然私有，形成"全局层($lib)/私有层(routes)"的**二层默认架构**。Next 无官方等价物（社区自定 @/ 风格），Nuxt 的 ~/ 与 @/ 指向 app 与 src 两层但不是边界约定。加分：$app/、$service-worker 等其他内置别名说明 $ 前缀=框架保留命名空间。

### 8. (C) dev/build/preview 三命令对应的三种运行时形态，和 10-vite 里学的 dev/build 双人格怎么对照？Kit 多了哪一重人格？

**来源**：构建链路横向题（跨包串联）

Vite 双格：dev(ESM 即时编译+插件中间件) vs build(静态产物)。Kit 三格里前两格同款，**第三格 preview 特殊**：它跑的是 adapter 处理后的**服务端产物**（SSR 节点/静态 server），不是纯静态文件预览——"水合不匹配只在 prod 形态出现""$env static 的构建期内联问题"都得靠 build+preview 复现。第四重人格留给部署环境（NODE_ENV=production 的 runtime 差异，如 dev 下 error 带 stack、prod 不带）。排障口诀：行为随形态变，就逐形态二分——这是 10-vite 排障方法论的 Kit 版。

### 9. (D)  monorepo 场景：三个 Kit 应用共享一套组件库与请求封装，包结构怎么划？$lib 还能用吗？

**来源**：仓库组织设计题

骨架答案：pnpm workspace 拆 `packages/ui`（框架组件，peerDep svelte）、`packages/api-client`（纯 TS 请求层）、`apps/web|admin|docs`（三个 Kit 应用）。$lib 仍是**应用内**共享层，跨应用共享升格到 workspace 包——两个层级各司其职不要互相替代。要点：①svelte 包要带 exports 里的 svelte 条件字段（编译器消费源码而非预编译产物，Svelte 4 时代的 svelte 字段已让位于 exports.".".svelte）；②Vite 对 node_modules 里的 Svelte 组件要确保被 svelte 插件处理（optimizeDeps/dedupe svelte）；③Kit 的 alias $lib 可指到 workspace 包做局部别名简化。追问"组件库要不要预编译"给"库模式 Svelte 5 编译器产物+SSR 兼容"的判断线（呼应 11 包 svelte-tooling library mode）。

### 10. (D) 面试官现场出题："为 Kit 项目设计 .gitignore 与 CI 缓存策略。"给出清单与理由。

**来源**：工程实践细节题

gitignore 核心：`.svelte-kit/`（生成物）、`build/`（adapter 产物）、`.env*`（防密钥入库，.env.example 除外）、`node_modules`、test-results/playwright-report。CI 缓存三层（复用 10-vite CI 章方法论）：包管理 store → node_modules → vite/Kit 构建缓存（node_modules/.vite 意义有限，重点放 **svelte-kit sync 后的 types 与 build outputs 的 artifact 传递**）；关键戒律：缓存 key 必须含 lockfile hash + .env 相关版本，否则 static env 陈旧内联（本关第 5 题事故的生产版）。加分动作：CI 构建跑 `sv check` + 一次 build+preview 冒烟。

### 11. (D) 老项目 routes 在项目根、新项目全员 src/routes，团队混着两套。合并的代价评估与建议。

**来源**：历史包袱决策小场景

`files.routes: 'routes'` 是 Kit 配置能共存，但两套心智的隐性成本在**新人导读与 grep 习惯**（文档示例全是 src/routes）。迁移代价评估：①纯目录移动，git 可识别 rename；②风险点在 tsconfig include、构建脚本、CI 路径过滤、编辑器 code action 里硬编码 `src/` 的工具；③建议一次 big-bang 迁移配一个 rename-only PR（零逻辑改动保证可审），别和重构混车。收束判据复用：改动频率低、影响面纯机械的事，一次做完>长期并存。

### 12. (D) 压轴系统设计："给 20 人团队定 Kit 仓库规范：目录、命名、env、检查四张清单，各挑三条最有效的。"

**来源**：团队规范设计题（本包 L1 三关的毕业小考）

目录：①路由私有组件贴页面放、第二层引用即上收 $lib（"两次规则"）；②(group) 只做布局分组不承载业务语义；③+server.ts 集中 api/ 子树，页面目录不夹接口。命名：①动态段目录用单数（[id] 非 [ids]）；②matcher 后缀全员小写名词（[id=uuid]）；③load 返回字段 camelCase 且禁止 `data.data` 套娃。env：①PUBLIC_ 前缀变更=安全评审触发；②应用只从 $env 导入、禁 process.env 直读（lint 规则封死）；③.env.example 与部署清单双写同步。检查：①pre-commit 跑 sv check；②CI 必 build+preview 冒烟；③sv format+prettier 统一 +文件模板风格。评分口径：每条给"防什么事故"的>空列清单的。
