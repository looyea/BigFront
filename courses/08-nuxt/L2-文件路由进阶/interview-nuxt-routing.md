# nuxt-routing 面试题（15 题）

> 主题：文件路由映射、NuxtLink 与预取、导航 API、页面元信息。

## A. 映射与元信息

### A1. Nuxt 的文件路由和手写 vue-router 路由表，什么场景各自更合适？

**答**：Nuxt 项目基本没有选择——pages/ 生成路由表是框架底座，手搓路由表要禁用文件路由（experimental.inlineSSR 类场景不成立），等于对抗框架。讨论价值在理解层：文件路由本质是"路径命名空间即代码组织"，收益是新人按目录找页面、代码分割自动、重命名文件=改 URL 一处生效；损失的是非常规映射能力（同一组件挂多条不规则路径），这用 alias/动态段/路由级中间件补。学 vue-router-basics 手写表的阶段仍然值钱——Nuxt 生成的就是那张表，报错时你要能读懂它（呼应 vue-router-basics）。

**来源**：掘金《文件路由时代还需要手写路由表吗》；知乎《生成式路由的调试心法》。

### A2. definePageMeta 为什么只能用静态值？它的编译产物去了哪？

**答**：宏在编译期被剥离出组件，转成路由记录的 meta 字段——路由表在 app 启动前就构建完成（导航匹配、中间件编排都依赖它），运行时才决定的值它拿不到。产物进 .nuxt/pages.mjs 一类生成文件，可以在那里亲眼看到。需要动态 meta 时的三件替代：middleware 里改 to.meta、用 layout 计算属性（NuxtLayout 支持动态 :name，呼应 nuxt-layouts）、把判断上移到数据层。同构 Vue 宏家族都有这个"编译期提取"约束（vue-sfc-compiler-macros 讲过的 defineProps 同理）。

**来源**：SegmentFault《definePageMeta 的编译魔术》；CSDN《路由元信息静态限制的破法》。

### A3. pages/ 下能不能放非页面组件？团队怎么防？

**答**：能放，但它会变成路由——这是文件路由的刚性语义，没有 Next 那种"非约定文件名自动忽略"的豁免（pages/ 里任何 .vue 都注册，包括 components/ 子目录，会生成 /components/xxx 路由）。防御手段：① 规范：页面级私有组件放 app/components/ 加页面前缀，或 colocate 时放同名目录的非 .vue 位置——`.vue` 一律是页面；② 工具：ESLint 自定义规则扫 pages/ 内路径深度与命名（如只允许 */index.vue 与 [x].vue 形态）；③ code review 检查新增文件的目标路由（构建日志/开发时访问路由表页可见）。设计哲学差异记一笔：Next 用文件名表达角色，Nuxt 用目录表达角色（呼应 nuxt-directory A3）。

**来源**：知乎《pages 目录混放组件的事故与规则》；InfoQ《两种文件路由的约定强度对比》。

## B. 导航与链接

### B1. NuxtLink 相比 vue-router 的 RouterLink 增强了什么？

**答**：四点：① 外链识别：external + 自动补 rel（noopener 安全默认），RouterLink 遇外链直接坏；② 自动预取：进入视口即预取目标 chunk 与 prefetch 数据（noPrefetch 全局关、单点 prefetch 控制），RouterLink 只吃路由级 lazy 的被动分割；③ `router-link-active/exact-active` 类名自动样式友好；④ 到当前页的同址链接自动渲染为非交互 `<a>` 防自跳。Nuxt 场景永远用 NuxtLink——它是 RouterLink 的超集且被 SSR/预取体系深度集成。

**来源**：掘金《NuxtLink 预取调优笔记》；SegmentFault《RouterLink 与 NuxtLink 差异清单》。

### B2. router.push 和 navigateTo 的差异，何时必须用后者？

**答**：navigateTo 是"SSR 感知"的统一跳转 API：服务端上下文里它设置响应状态码（默认 302，可指定 301/307）并中断当前渲染，客户端上下文里退化为 router 行为；还能控制外部跳转（open/external）与 replace。必须用它的场景：① 服务端组件/中间件里做重定向（middleware 的 return 本质就等价它）；② 需要 SEO 正确状态码的旧路径迁移；③ 跳出到外部域名。router.push 只在纯客户端交互（点击后换页）里用。对照 Next：这相当于同时覆盖 `redirect()`（服务端）与 `router.push()`（客户端）两个 API 的职责（呼应 next-link-router 第 3 节、next-middleware-auth）。

**来源**：CSDN《navigateTo 才是 Nuxt 的全栈跳转》；知乎《SSR 里 location.href 为什么无效》。

### B3. useRoute() 为什么不能解构？query 和 params 的可信度有何不同？

**答**：useRoute() 返回的是响应式路由对象的代理，解构（`const { query } = useRoute()`）拿到的是水合瞬间的快照，导航后不更新，watch 也丢——正确写法 `const route = useRoute()` 后以 route.query.x 访问或在 watch 里 getter 包裹。可信度：params 由路由模式约束（[id] 必有值且类型 string），query 完全自由——任意键、字符串或缺省，涉及数字/布尔要显式转换与白名单校验（`const page = Math.max(1, Number(route.query.page) || 1)`）；把 query 直接拼进选择器/SQL/重定向目标是经典注入面（呼应 exp-validation、exp-security）。

**来源**：掘金《响应式路由对象的解构陷阱》；InfoQ《URL 参数当输入看待的纪律》。

## C. 数据与预取

### C1. Nuxt 的链接预取和 Next 的 RSC Payload 预取，机制上各预取了什么？

**答**：Nuxt：链接进视口→路由组件 chunk 提前下载 + 若页面用 useFetch 带 `getCachedData`/默认 prefetch，数据请求也提前发起（客户端导航时组件已就绪，点击即渲染）。Next：链接进视口→向服务端请求目标路由的 RSC Payload（序列化的组件树，非 HTML 非全量 JS）存入 Router Cache。差异根源：Nuxt 页面代码必须进浏览器（同构水合模型），预取重点是"chunk 早到"；Next 页面可以永不发组件 JS（RSC），预取重点是"数据早到"。相同点：都是空闲调度 + 视口触发 + 可关闭，都用空间换点击延迟（呼应 next-link-router 第 1 节）。

**来源**：知乎《两种预取哲学》；掘金《从 Network 面板看 Nuxt 预取》。

### C2. 列表页渲染 200 条带链接的卡片，预取会出什么问题？

**答**：视口边缘的链接群会批量触发 chunk+数据预取，列表滚动时请求风暴、带宽与源站 QPS 都被拉高（Next 同款问题，呼应 next-perf 第 3 节）。调控：列表项统一 `:prefetch="false"`（点击时再走正常导航，SPA 切换仍然快）；或全局 `app.config`/实验配置调预取并发阈值（Nuxt 内建 limit，默认 100 条路由缓存内不重发）；对数据密集页优先保交互带宽。判断标准：预取命中率——预取了 80% 用户不会点的页面就是浪费，宁关勿滥。

**来源**：CSDN《预取风暴排查实录》；SegmentFault《列表页 NuxtLink 的性能选项》。

### C3. validate 钩子和中间件都能拦导航，边界怎么分？

**答**：validate 只管"这个 URL 是否合法可渲染"（params 形状校验，false→404），无副作用、声明式、随页面走——路由自身的门卫；中间件管"这个人能不能进"（鉴权、角色、灰度分流，可 redirect/abort），可以有异步 IO、可复用多个路由——大楼保安。混用的坏处：把鉴权写进 validate 会让 404/401 语义混淆（未登录 ≠ 不存在，安全上有时还正是想要 404 的"存在性隐藏"）；把 params 校验写进全局中间件则满屏 if 路径匹配。复杂场景组合：validate 定形状 → 全局中间件定准入 → 页面里 useFetch 兜不存在（404 数据层）（呼应 nuxt-middleware-auth 的三层纵深）。

**来源**：知乎《404 与 401 的语义边界》；掘金《validate 的正确使用姿势》。

## D. 实战与演进

### D1. 老项目的 URL 结构千奇百怪，迁到 Nuxt 文件路由怎么保住历史链接？

**答**：三层工具箱：① alias——同一页面挂多个路径，适合少量不规则旧链；② routeRules 的 redirect（301/302）——旧路径到新路径的映射表，支持通配 `'/old/**': { redirect: '/new' }`（routeRules 在渲染关细讲，呼应 next-config 的 redirects 段）；③ Nitro server middleware——极端规则（按 UA/参数分流重写）用代码写。原则：重定向必须保留状态码语义（永久改版 301、临时 302，错用伤 SEO），映射表进版本控制、上线前用爬虫清单回归。别指望"路径一样直接迁"，历史项目 90% 会撞形状不匹配。

**来源**：掘金《一次 URL 大迁移的重定向表设计》；InfoQ《历史包袱站的迁移工程学》。

### D2. 多语言路由 /zh/about、/en/about 在 Nuxt 里怎么做？

**答**：主路是 @nuxtjs/i18n 模块：`locales` 前缀策略配置后，pages/ 单份文件 + `definePageMeta({ i18n: true })`，路由自动按语言复制并管理 hreflang/语言 switch。手搓方案（理解原理用）：动态段 `[locale]` 打头 + 全局中间件校验 locale 白名单 + 语言写进 cookie/URL（SEO 优先 URL）。两个易踩的坑：语言切换要保留当前页与 query（router.replace 到同构路径），以及预取按语言分 chunk 的缓存 key 区分（呼应 nuxt-state 的 key 设计）。SEO 侧 hreflang/canonical 归 nuxt-seo-meta（呼应 next-metadata 的 hreflang）。

**来源**：CSDN《Nuxt 多语言路由的两种实现》；SegmentFault《i18n 模块路由前缀策略详解》。

### D3. Nuxt 路由体系里你最喜欢与最想吐槽的设计各一个？

**答**：喜欢 definePageMeta+validate 的组合：页面自包含"我需要什么布局、谁能进、什么参数合法"，不需要维护一张全局路由大表（对照 vue-router 时代 routes 文件 800 行的惨状，呼应 vue-router-basics）。吐槽：pages 混放即成路由、没有显式豁免名单——约定强但没有逃生舱（Next 的"非约定文件忽略"更细），只能靠团队规范补；另外路由命名生成规则（路径转 name 的连字符策略）在深层嵌套时可读性一般，调试 router 面板时要适应。诚实评价：都是小摩擦，不构成选型否决项——架构师报告风险要分级。

**来源**：知乎《Nuxt 路由设计的三个好与两个坏》；掘金《用了两年 Nuxt 的路由吐槽清单》。

---

## 补充（新专题 13-15）

### D4.  Nuxt 文件路由与 Next App Router 的文件路由，设计重心差在哪？各有什么代价？

**答**：同：目录=URL、嵌套布局出口（<NuxtPage/> vs layout children）、动态段语法接近。重心差异：① Nuxt 是 vue-router 的约定皮——路由对象仍然存在（route、router 全 API 可用、definePageMeta 直接落到路由记录），Next 把 router 藏进框架内部（不能拿"路由实例"做任意事）；② 布局模型：Nuxt 的 layouts 是命名槽位（per-route 选一个 layout，可运行时切），Next 是嵌套 layout 目录（多层天然复合）——前者灵活少层级、后者结构强约束多；③ 高级路由：Next 给并行/拦截/路由组一整套目录 DSL，Nuxt 官方只有 middleware+嵌套页，modal 等玩法要自己拿 vue-router 或第三方模块攒；④ 数据与渲染：Nuxt 路由只负责"组件归属"，缓存/SSR 开关在 routeRules 集中声明（配置中心），Next 在段文件里自声明（colocation）。代价对照：Nuxt 的 layout/路由组没有"同 URL 多壳"的原生表达、middleware 承担过多；Next 的目录 DSL 学习曲线陡、重构挪目录即改 URL 语义。

**来源**：Nuxt 官方 Pages routing；对比 Next.js App Router 文档。

### D5.  definePageMeta 能声明什么？middleware/layout/validate 三件在"SSR 与客户端"分别何时跑、跑几次？

**答**：可声明：meta、name/path/alias、layout+layouts（命名槽）、middleware（单个或数组）、validate（路由参数校验，返回 false 即 404）、scrollBehavior、key（组件复用策略）、自定义字段。执行时机：route middleware 在服务端渲染请求跑一次 + 每次该路由激活（含客户端导航）跑——全局插件只在应用生命周期跑一次、per-route middleware 每次进入该路由跑（两侧不对称是"服务端已查过、水合后又查一遍"重复请求的根因，要用 payload/useState 传递）；validate 是"参数进组件前"的同步校验器，非法 id 在 SSR 即出 404 状态码而非在页面里 throw；layout 在布局层读 route.meta 做导航渲染。坑点：definePageMeta 必须顶层同步（不能 await/条件），动态鉴权在 middleware 内做不在 meta 里做；navigateTo vs throw createError 语义差（软跳带状态、错误出真状态码）。

**来源**：Nuxt 官方 definePageMeta / middleware 文档；SegmentFault《route middleware 到底在服务端跑没跑》。

### D6.  多语言、多角色后台共存的大型站点，路由命名与规则你会定哪些"写进模板"的规矩？

**答**：把 URL 当 API 管：① 域前缀即策略边界——/ 公开内容（SSR+缓存头）、/app/** 登录后 SPA（ssr:false+鉴权 middleware）、/admin/** 独立 layout+更强 middleware、/api/** 只走服务端路由——routeRules 按这四段声明，新人看一眼 rules 就懂全站结构；② 命名纪律：资源用复数名词（/orders/[id]）、动作进 query 或 POST（不做 /orders/delete）、locale 前缀统一策略（/zh/... 由 i18n 模块生成 hreflang）、禁止驼峰/下划线混写；③ 版本与日落：对外 URL 从 /v1/ 或 query 版本起步，重定向规则集中 routeRules.redirect（改路由必留 redirect 表，CI 里 URL 清单 diff 当 breaking change 门禁）；④ 参数进 validate 统一校验（数字 id 必转必范围检查，searchParams 是 string 的账在此还）；⑤ 布局/导航元信息进 definePageMeta（roles/feature flag 放 meta 自定义字段供 middleware 读，不散写 if）。规矩能活下来靠三件：脚手架模板带示例、评审 checklist 问"URL 变了 redirect 呢"、CI 有快照。

**来源**：InfoQ《URL 是公共 API：路由治理》；知乎《一个 Nuxt 工程里的 URL 规范》。
