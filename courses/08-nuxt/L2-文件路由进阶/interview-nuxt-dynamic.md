# nuxt-dynamic 面试题（15 题）

## A. 参数与匹配

### A1. 动态段、通配段、可选段三种参数的类型分别是什么？给出防御代码。

**答**：[id] → string（永远，哪怕 /blog/42）；[...path] → string[]；可选段 [[level]] → string | undefined。防御三件套：① `const id = computed(() => Number(route.params.id))` + `if (Number.isNaN(id)) 404`；② 通配段 `route.params.path.join('/')` 前判空数组；③ 形状校验上移到 `definePageMeta({ validate })`——validate 返回 false 直接 404，比页面内到处 if 干净。核心纪律：URL 是外部输入，参数转换与校验是服务端/页面入口的固定动作（呼应 exp-validation、nuxt-routing B3）。

**来源**：掘金《Nuxt 动态路由的类型防御》；CSDN《validate 钩子小文件大作用》。

### A2. /user/[id] 与 /user/new 同时存在会冲突吗？vue-router 的优先级规则是什么？

**答**：不冲突——静态段优先级高于动态段，/user/new 命中静态记录，其余命中 [id]。规则链：静态 > 动态 > 通配（与 Next 段文件的"specificity"一致，呼应 next-dynamic 第 1 节）。真正危险的是两个不同名动态段同位（遮蔽）与通配段吞掉未来新页面（[...all] 下新增页面必须排在它之前注册）。实践建议：new 这类"语义保留字"要在 [id] 页 validate 里显式排除（万一路径重构丢了静态页，动态页也不要把 new 当 id 查库）。

**来源**：SegmentFault《路由匹配优先级图解》；知乎《动态段吞掉保留字的经典事故》。

### A3. 通配路由 [...slug] 做文件浏览器，如何防止路径穿越（../../etc/passwd）？

**答**：参数数组逐项消毒再拼接：① 每项过白名单正则（`/^[\w.-]+$/`），拒绝 `.`、`..`、空段与编码变体（%2e 解码后同样是点）；② `path.resolve(root, ...parts)` 后必须以 root 为前缀（resolve+startsWith 双保险）；③ 服务端读取用文件 ID 映射而非裸路径（数据库存 uuid→物理路径）。URL 形状信任是分布式系统里最贵的错觉之一——这条在 Next 的 Route Handler、Express 里同样是必考题（呼应 exp-security、next-route-handlers）。

**来源**：CSDN《一次路径穿越渗透测试复盘》；InfoQ《前端可控路径的安全边界》。

## B. 实例复用与数据

### B1. 同路由不同参数时页面不重新请求数据，Nuxt 这样设计的理由是什么？代价呢？

**答**：理由：vue-router 复用组件是性能默认——避免每次参数变化整页销毁重建（列表来回点详情时体感明显），且让"跨参数持续状态"（滚动位置、播放器实例）可行。代价：数据获取若写成一次性 setup 逻辑（await useFetch 固定 URL）就成了"该刷新没刷新"的坑源。Nuxt 的调和方案：useFetch URL 传响应式 getter 自动重取；definePageMeta key 显式声明"我要按 URL 重建"；滚动行为/过渡另有全局配置。对比 Next：App Router 默认按 segment key 重建组件，两个框架在"默认复用还是默认重建"上给出相反答案——迁移者必须重拧这颗螺丝（呼应 nuxt-dynamic 第 3 节）。

**来源**：知乎《组件复用：性能默认值与正确性代价》；掘金《Next 与 Nuxt 的 key 哲学差异》。

### B2. 详情页 /post/[id] 的取数怎么写成"参数变即自动重取且 SSR 安全"？

**答**：标准形：`const { data } = await useFetch(() => \`/api/posts/${route.params.id}\`, { key: 'post' })`——URL 传函数（响应式依赖 params），Nuxt 内部在参数变化时自动 refetch 并更新 data；SSR 期间执行一次并把结果烘进 payload，水合后复用不重发（useFetch 的 SSR 友好正是它区别于裸 $fetch 的核心，nuxt-usefetch 关展开）。要点：别手动 `watch + refresh` 拼接（容易漏 immediate 与竞态）；key 相同的多实例页面（标签页并存）要注意 payload 复用冲突。

**来源**：CSDN《useFetch 响应式 URL 的正确姿势》；SegmentFault《watch+refresh 组合的竞态问题》。

### B3. 列表 → 详情 → 返回列表，想保留列表滚动位置和数据不重拉，怎么做？

**答**：两半拼：① 滚动——Nuxt 已配 scrollBehavior 的 savedPosition 基础，SPA 返回默认尝试还原；异步数据页要等渲染完成再定位，用 `<NuxtPage keepalive>` 或过渡 after-leave 钩子；② 数据——返回时组件实例被 keepalive 缓存则不重跑 setup（useFetch 不再请求，直接吃 payload）；不用 keepalive 时靠 payload 与 Router 级缓存（对照 Next Router Cache 的回退零网络体验，呼应 next-fetch-cache 第 6 节）。Nuxt 的 keepalive 是页面级方案，粒度比 Next 缓存粗但心智直白。

**来源**：掘金《keepalive 与滚动还原的组合拳》；知乎《SPA 返回体验的三种缓存层次》。

## C. 嵌套与组织

### C1. Nuxt 的 layouts 和"父页面 + NuxtPage"两种嵌套方式怎么选？

**答**：判断轴是"外壳要不要随参数重渲染/带数据"：纯框架（导航+侧栏）→ layouts（跨页面复用、切换时外壳不重建、性能最优）；外壳本身是业务实体（用户主页要显示该用户头像/统计）→ 父页面 + <NuxtPage/>（外壳可以 useFetch、可以按参数重建）。Next 只有后者形态（layout.tsx 即父段），所以它需要 template.tsx/缓存控制来救场（呼应 next-routing 第 3 节 layout vs template）。混合用法常见：外层 layout 定皮肤、内层父页面带子路由数据。

**来源**：InfoQ《两种嵌套模型的分工》；CSDN《layout 和父页面到底放什么》。

### C2. 深层嵌套（五层目录）在 Nuxt 里会带来什么问题？怎么压平？

**答**：问题：路由 name 变成 `a-b-c-d-id` 式的连字符长串（push 按 name 跳转可读性差）、每层都要放一个 <NuxtPage/> 出口（漏一层子页 404 且报错迷惑）、组件重建链变长。压平三板斧：① 参数化——把"稳定的中间层"折进 query（/a/b/c?id=）；② 路由组思想手动化——只为共享布局的分组用 layouts 表达，不占 URL 层级；③ 目录聚合——/user/[id]/posts/[postId] 压到 /p/[userId]/[postId] 这种以资源为中心的短路径。URL 是产品契约的一部分，目录结构迁就它而不是反过来（呼应 nuxt-groups-matchers 的 Next 路由组对照）。

**来源**：掘金《把五层路由压成两层》；SegmentFault《路由 name 可读性的工程处理》。

### C3. 为什么 Nuxt 没有做并行路由/拦截路由？这说明两家对"路由"的理解差在哪？

**答**：并行/拦截（@slot、(.)）的成立前提是"URL 段与渲染槽位解耦 + 客户端导航由框架 Payload 体系驱动"——那是 Next App Router 的结构主义路由观：路由树=数据获取树=缓存树。Nuxt 的路由观是 vue-router 的自然延伸：URL=组件树路径，一一对应，简单可预测；并行语义在其模型里没有表达位置（硬做要用 layouts+query 手搓，社区方案皆如此）。差异本质：Next 把路由当"编译器输入"做重编排，Nuxt 把路由当"运行时对象"保持轻。没有对错——复杂 modal/dashboard 需求在 Next 里是语法糖，在 Nuxt 里是设计题（呼应 next-dynamic 第 3、4 节）。

**来源**：知乎《两种路由哲学的分叉》；InfoQ《并行路由为什么只长在 Next 里》。

## D. 综合

### D1. 电商分类 /c/[...category]（手机/配件/充电器三级），设计到接口与 SEO 的完整方案。

**答**：路由：通配段数组直接对应分类链，`category.value.join('/')` 查询接口；层级校验在服务端按分类表逐级解析（不存在的中间层→404 而非空列表）。数据：useFetch 响应式 URL + key=`c-${join}`，payload 精准复用。SEO：每级分类页 title/canonical 按层级生成（面包屑 Schema，nuxt-seo-meta）、分页 rel=next/prev；性能：分类树预热进服务端缓存（defineCachedFunction），高流量顶部分类用 route rules prerender/isr。边界：深层长尾页 SSR 成本→按 PV 分层（顶部静态、腰部 ISR、长尾动态）——这是 Next hybrid 同款决策（呼应 nuxt-render-modes）。

**来源**：CSDN《电商分类树路由设计全案》；掘金《按流量分层的渲染策略》。

### D2. 迁移一个 Next 项目到 Nuxt，路由层你会列哪些必改项？

**答**：七项：① page.tsx 一族 → 纯 .vue 页面（layout.tsx 拆到 layouts/ 或父页面出口）；② generateStaticParams → routeRules.prerender 集中声明；③ 拦截/并行路由的功能用 query/独立页重设计；④ useRouter 语义映射（redirect → navigateTo、usePathname → useRoute().path）；⑤ next/link 预取假设换成 NuxtLink 的 key/预取控制；⑥ [slug] 参数从"默认重建"换到"默认复用"心智，逐个动态页补 key 或响应式取数；⑦ 中间件重写：Next 一个 matcher 全局中间件 → Nuxt 全局 + per-route middleware 组合（服务端拦截另放 nitro middleware，呼应 nuxt-middleware-auth）。路由层之外还有缓存/Action 差异，那部分更大，单独开清单。

**来源**：SegmentFault《Next → Nuxt 迁移手册（路由篇）》；知乎《两个框架路由心智的七处不同》。

---

## 补充（新专题 13-15）

### D3.  动态段参数切换（/blog/1→/blog/2）时组件复用与数据重取的默认行为？几种正确姿势各适合什么场景？

**答**：默认：同一路由记录参数变化复用组件实例（不重挂载）——老代码"onMounted 取数"就失效。useFetch 传"选项对象为响应式 URL/params"时自动随 ref 重取，watch: [id] 显式声明追踪源；三种进阶：① definePageMeta({ key: route => route.fullPath })——key 变即重创建组件，最彻底、适合整页形态差异大的详情，代价是丢局部状态；② 数据层不重挂载只重取（useFetch 的 refresh：refresh()/refreshNuxtData(key)）——保留 UI 状态、只刷数据，适合列表筛选/同页编辑；③ 手动 watch(route.params) 调 $fetch 自己管 loading——只在极端定制时用（多数是自找 memo 问题）。易错点：refreshNuxtData 影响所有共享该 key 的调用（列表详情同时刷）；payload 水合与"服务端首取"的 key 要一致否则水合后又来一发。收口：先问"切换参数时这个页面哪些状态该活下来"，答案决定 key 还是 refresh。

**来源**：Nuxt 官方 useFetch watch/lazy 与文档"数据刷新"；SegmentFault《切了 id 页面还是旧数据》。

### D4.  routeRules 的 prerender/crawl/sitemap/swr/isr 怎么拼出"哪些动态页预生成"的方案？与 Next 的 generateStaticParams 思路差在哪？

**答**：Nuxt 的枚举是"声明式来源"：prerender: true 单路由强制预渲染；nitro.prerender.routes 给清单、crawlLinks 从首页顺着站内链接爬、urls 可由 sitemap 文件生成钩子提供——本质是"构建期跑一个爬虫/清单"，作者不用在页面文件里写枚举函数。对比 Next：generateStaticParams 是代码内联枚举（colocation：页面知道自己有哪些参数），Nuxt 是中心配置（routeRules/nitro：部署视角统一声明）。差异账：中心派——策略集中好审计、多租户/按环境不同清单灵活，代价是"URL 清单"与页面代码分离易失同步；内联派——新增枚举忘写进 config 都不会漏，代价是大站构建期枚举函数成性能焦点。混合实战：长列表 sitemap 喂爬虫、热点清单代码生成、其余走 swr 首访现渲+边缘缓存——routeRules 支持 /blog/**: {swr: 3600} 这种通配即"默认兜底"。

**来源**：Nuxt 官方 route Rules/prerendering 与 nitro prerender.crawlLinks；Next 对比。

### D5.  Islands 架构（.island.vue + <Island>）解决什么场景？与客户端水合、与 RSC 各自的边界在哪？

**答**：场景：页面 90% 静态、少数"需要每请求现算的互动块"（搜索框、购物车角标、个性化推荐）——island 组件带交互但只在"用户触达时"才水合（idle/visible/交互触发），静态 HTML 可整页预渲染/CDN 缓存。边界对照：传统 SSR 水合=整页一次性 hydrate，islands=按交互单元分次；RSC=运行位置在编译期二选一（服务端组件不下发）、islands=运行位置都下发、水合时机可延迟——两者哲学不同但可叠加（Nuxt 的 ServerComponent 实验走的就是"服务端渲染+按需水合岛"）。工程限制：island 不能包全局响应式状态（水合边界处 store 不同步）、middleware/auth 在 SSR 期对 island 内部仍跑（数据权限别指望"没水合就看不到"——HTML 已在响应里，这是安全认知必考点）。选型：内容站混合页值得试；后台应用整页重交互，islands 没意义（ssr:false 更诚实）。实验特性要标注稳定性预期。

**来源**：Nuxt 实验性 Islands 文档；ViteConf Islands 演讲。

### D6.  列表页链接进动态详情页，NuxtLink 的预取与路由 chunk 加载怎么权衡？哪些情况该关？

**答**：默认行为：NuxtLink 进入视口即预取目标路由的代码 chunk（vite 动态 import）并触发目标页 useFetch 的预取（payload 级，视版本开关）——对动态段意味着每个可见链接都可能换一次网络。权衡账：① 列表项少、详情转化高（文章/商品前 20 项）——保持默认，点击即秒开；② 长列表/无限滚动（成百上千个 [id] 链接）——视口预取会打爆接口与带宽，链接上 explicit 或关 prefetch（:prefetch="false"），只保 hover 预取或首屏手动 prefetch；③ 详情页取数贵（重 SQL/外部 API）——预取会白烧下游成本，关 payload 预取只留 chunk 预取（把贵取数改 lazy 或客户端触发）；④ 登录墙后的动态路由——预取会先行请求触发 401/重定向链，该关。实现细节：chunk 预取与数据预取是两层，排查时分开归因；routeRules 的 isr/swr 对详情页生效时，预取命中边缘缓存代价骤降，可不关——先度量（网络面板数一发预取请求的代价）再决策，别凭感觉全局关。

**来源**：Nuxt 官方 NuxtLink prefetch 文档；掘金《长列表预取雪崩的一次排查》。
