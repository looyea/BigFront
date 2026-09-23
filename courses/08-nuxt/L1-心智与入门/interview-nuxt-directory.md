# nuxt-directory 面试题（12 题）

> 主题：目录约定、别名系统、生成物排查、配置分层。

## A. 目录与约定

### A1. Nuxt 项目里 app/utils、server/utils、shared/utils 三个"工具目录"怎么区分？

**答**：按可达上下文划：① app/utils——前端自动导入池，composable 与页面可用，会被打进浏览器 bundle（放的东西要过"能不能进客户端"这一关）；② server/utils——只在 Nitro 服务端自动导入，数据库封装、密钥工具放这里，永远不会泄漏进前端产物；③ shared/utils——前后端都显式 import（#shared 别名）的纯逻辑：类型、校验 schema、格式化函数，不能含 Node API 也不能碰 window。误放的典型事故：把带 fs 的函数放进 app/utils 引发客户端构建报错；把 zod schema 放 server/utils 导致前端想复用却拿不到。目录即权限边界，这是比 webpack alias 更高一层的架构表达。

**来源**：掘金《Nuxt 的三个 utils 一个 typo 引发的血案》；SegmentFault《shared 目录到底给谁用》。

### A2. 为什么 .nuxt 与 .output 都不进 git？clone 项目后第一步做什么？

**答**：两者都是"输入确定则输出确定"的生成物：.nuxt 由目录扫描+配置推导而来，.output 由 build 产出；入库会导致假冲突、review 噪音与过期产物事故（经典 CI 灾难：把旧 .output 提交进库，部署时缓存构建短路，线上跑了三周前的代码）。clone 第一步：装依赖后 `nuxt prepare`（或 dev）生成 .nuxt，IDE 类型即恢复。同款纪律在任何代码生成框架都成立（Prisma client、proto 生成物同理，呼应 node-config 的可复现构建原则）。

**来源**：CSDN《生成物入库的一次线上回溯》；知乎《nuxt prepare 在 CI 里的正确位置》。

### A3. pages/ 里放一个 components/Footer.vue 会发生什么？为什么？

**答**：它会被注册成路由 `/components/footer`——pages/ 目录内的一切 .vue 都按文件路径映射路由，没有"子目录豁免"。这是文件路由的代价：目录语义单一化，混放即污染。防护手段：项目规范约定 pages/ 只放页面（页面级子组件放 app/components/ 或就近 colocate 但用 `definePageMeta` 无法排除路径，只能靠目录纪律/ESLint 自定义规则）；Next 的 app/ 同理——page 之外的文件不生成路由，是更精细的"文件名即角色"约定，两家哲学差异在此可见（呼应 next-routing 第 2 节段文件全家桶）。

**来源**：掘金《我为什么多出了一页 404》；InfoQ《文件路由的两种设计：目录角色 vs 文件名角色》。

## B. 别名与生成物排查

### B1. 自动导入的组件在模板里标红"未注册"，给出你的排查链路。

**答**：按生成物链路查：① .nuxt/components.d.ts 里有没有它——没有说明扫描没命中：检查文件名是否符合前缀/目录规则（Nuxt 组件命名会拼目录前缀，ui/Button/Base.vue → <UiButtonBase/>，重名还会自动加后缀）；② 有声明仍标红——IDE 的 TS 服务指向了旧 .nuxt/tsconfig.json，重启 vue-tsserver 或 prepare；③ 全局组件正常、仅某目录异常——config 的 components:[]  dirs 被改过或目录在 app/ 扫描范围外（旧布局迁移遗留是常见雷）；④ 动态组件字符串引用不在扫描统计内，属预期。方法论：先问生成物，再问配置，最后怀疑魔法。

**来源**：SegmentFault《组件标红排查手册》；掘金《Vue 语言服务的假阳性与真失效》。

### B2. 为什么 Nuxt 选择 #imports 这种虚拟模块而不是真实文件？Vite 里同类手法有哪些？

**答**：虚拟模块（不占磁盘、构建期按请求生成内容）的好处：① 与目录扫描实时联动，新增 composable 即出现在导出表，无需维护 index.ts 桶文件；② 树摇友好——聚合导出配合打包器按需取用；③ 类型侧用同名 .d.ts 镜像即可，TS 与运行时解耦。代价：跳转/搜索体验依赖 IDE 支持（点开 #imports 能看到生成的导出清单，这就是理解魔法的窗口）。Vite 生态同款手法：`virtual:` 前缀插件模块、import.meta.env 注入、未声明依赖的预打包重定向（呼应 vite-intro、vite-plugin-api 的自定义模块实践——写过一次插件就不觉得神秘了）。

**来源**：知乎《虚拟模块：框架魔法的通用解法》；CSDN《从 #imports 看 unimport 原理》。

### B3. 运行时报"Cannot find module '~/lib/x'"但文件明明存在，两种以上可能？

**答**：① 路径语义错位：~/ 在 app server 布局指向 app/，文件其实在项目根 lib/（旧习惯写新结构），该用 @@/lib/x 或把文件挪进 app/；② 服务端上下文里 ~ 的解析不同（server/ 代码 import 前端目录会失败——两个世界各有一套 alias，跨世界引用要走 #shared）；③ 构建缓存脏了：删 .nuxt 与 node_modules/.vite 重来；④ 大小写：Linux 生产环境严格区分，Windows 开发机宽容——经典"本地好好线上就挂"。定位顺序：看报错堆栈的解析后路径 → 对照两套 alias 表 → 清缓存复现。

**来源**：掘金《一个 ~ 引发的双环境惨案》；InfoQ《大小写敏感：跨平台部署的暗礁》。

## C. 配置体系

### C1. nuxt.config、app.config、runtimeConfig 三者时机与可见性矩阵，背不下来怎么讲清楚？

**答**：抓两个轴就够：可见性（谁能读到）× 时机（何时定格）。nuxt.config——构建期求值，决定框架行为，客户端不可读（除少数透传）；app.config——构建期定格、客户端可读、运行期只读，放"产品皮肤"（主题、文案开关）；runtimeConfig——运行期读取（NUXT_ 环境变量覆盖），分 public（透传前端）与私密（仅服务端），放"部署参数"（API 地址、密钥）。一句话口诀：**改代码生效的是 nuxt.config，改 UI 皮肤用 app.config，改部署环境用 runtimeConfig**。Next 对照：第三个被 NEXT_PUBLIC_ 的二分法粗略覆盖，但 Nuxt 的 public/私密分栏在同一个对象里，比前缀约定更防呆（nuxt-runtime-config 细讲）。

**来源**：知乎《Nuxt 配置三层时机表》；CSDN《runtimeConfig 与 app.config 的选型困惑》。

### C2. 团队想把 nuxt.config 拆成多环境多份，支持吗？怎么拆才不踩坑？

**答**：支持两路：① 文件内条件——config 本身是 TS，读 process.env.NODE_ENV 做条件字段；② 数组式 extends（c1/legacy 配置格式）叠加多份 config 文件。坑位预报：数组式合并的规则是对象浅合并、数组追加——routeRules 会整块覆盖、css 会重复累加，"以为继承了其实丢了"的投诉都出自这里；且 config 文件被 import 的模块参与构建缓存 key 计算，动态拼出来的配置让缓存行为玄学化。推荐姿态：一份主 config + runtimeConfig/env 管差异——**构建产物不可变、环境差异留给运行期**（呼应 nuxt-overview B3、node-config 十二要素）。

**来源**：SegmentFault《多份 nuxt.config 合并语义详解》；掘金《不可变基础设施在前端的落地》。

### C3. .env 在 Nuxt 里怎么正确用起来？哪些值会真的生效？

**答**：规则：dev 与 build 时加载 .env，但只有能映射到 runtimeConfig 键名的 `NUXT_` 前缀变量生效（NUXT_API_BASE → runtimeConfig.apiBase，下划线连字符都折叠，键名大小写不敏感）；裸的 FOO= 不会凭空出现在任何代码里——想进服务端代码，用 process.env.NUXT_FOO 直读也行，但浏览器永远拿不到非 public 值（这层墙比 Next 的前缀约定更明确）。生产部署不需要 .env 文件，容器环境变量直注入同名键。雷区：把 .env 提交进仓库（.env.example 才是入库的那份）；以及误以为 build 时烘进的值还能运行期覆盖（那是 runtimeConfig 的地盘，不是 import.meta 的地盘）。

**来源**：CSDN《NUXT_ 前缀映射规则全解》；知乎《.env 泄漏事故与防呆设计》。

## D. 结构演化

### D1. 从旧布局（根级 pages/）迁到 Nuxt 4 的 app/ 布局，git 历史怎么保全？

**答**：用 `git mv` 保 blame（重命名识别度高的工具链），一次性完成目录大迁而非分批——混着放时新增文件的归属最容易迷路。步骤：升级依赖 → 建 app/ 移入 pages/components/composables 等 → shared/ 承接跨端 utils → 全量跑 prepare + test → 更新 README 与 IDE 配置。评审技巧：把纯移动 commit 与逻辑修改 commit 严格分开（移动 commit 零代码改动），diff 审查用 `-M --stat` 看真实变更面。大迁移是团队肌肉记忆考验，文档同步比代码更重要。

**来源**：掘金《目录大迁移的 Git 姿势》；InfoQ《breaking change 的项目管理》。

### D2. monorepo 里多个 Nuxt 应用共享组件库，目录结构怎么设计？

**答**：apps/（每 app 一个 Nuxt 项目）+ packages/ui（组件源码）+ packages/config（共享 nuxt.config 片段）。要点：① 组件库以源码形态发布（exports 指 .vue，消费侧 Nuxt 编译），避免预编译 Vue SFC 的版本锁死问题；② 自动导入跨包要显式配 `components: [{ path: '@org/ui', ... }]` 或用模块把扫描目录喂进去；③ TS 用 workspace tsconfig 继承链，别让每个 app 手抄 paths；④ 构建顺序交给任务编排（turbo/nx，缓存思想呼应 vite-build）。对照 Next 团队同款问题（turbopack workspace 支持在演进），Nuxt 生态的 monorepo 文档更薄，边界要自己画牢。

**来源**：SegmentFault《Nuxt monorepo 的四个坑》；知乎《源码分发 vs 编译分发组件库》。

### D3. 你负责给公司定 Nuxt 项目脚手架模板，会固化哪些"结构即纪律"？

**答**：模板即治理，清单：① 目录骨架含 app/server/shared 三区与 README 说明"什么代码放哪"；② ESLint 规则强制 pages/ 内只放页面、server 代码禁 import app 层（import 边界插件）；③ .env.example + runtimeConfig 双栏示范（public/私密），CI 正则扫密钥；④ tsconfig 壳 + lint/typecheck/test 三件套预接；⑤ 生成物 gitignore 三件套 + CI 里 prepare→build→test 的顺序固化；⑥ 一份 ADR 模板放 docs/，要求每个结构级偏离写理由。好的脚手架让新人第一行代码就落在正确位置——07 包 next-fullstack-project 的 M0 里程碑正是同款思想。

**来源**：CSDN《前端脚手架的治理价值》；掘金《把架构决策写进模板里》。
