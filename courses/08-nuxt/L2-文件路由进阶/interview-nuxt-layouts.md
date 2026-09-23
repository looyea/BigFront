# nuxt-layouts 面试题（15 题）

> 主题：布局模型、实例存活语义、嵌套布局与 Next 段布局对照。

## A. 模型与用法

### A1. Nuxt 的 layouts 目录模型和 Next 的 layout.tsx 段模型，各自优劣势？

**答**：Nuxt：布局是"命名的全局皮肤"，集中一目录、页面按名认领——优势：一眼盘点全站有几套壳、运行时可换（:name）、复用显式；劣势：布局嵌套要手写层中层、"这段路由共用哪壳"散在每页 meta 里。Next：布局是"段的所有权"，目录结构即布局树——优势：嵌套自动、布局与路由结构天然一致、服务端布局可以直连数据；劣势：换壳要动目录（路由组）、运行时动态布局别扭、深层布局链性能与缓存复杂。本质是"注册表模型 vs 组合树模型"，没有银弹；面试官问这题想听的是你能否说清自己项目的选择理由（呼应 nuxt-architect 终局对照）。

**来源**：知乎《两种布局模型的设计权衡》；InfoQ《 layouts 目录与 layout.tsx 的十年之争》。

### A2. app.vue 里不写 <NuxtLayout> 会发生什么？为什么脚手架有时这么干？

**答**：layouts 系统整体失效——所有页面的 definePageMeta layout 被无视（NuxtLayout 才是布局渲染器的挂载点），页面直接进 <NuxtPage/>。脚手架故意这么做的场景：纯 API 服务（app.vue 里连 NuxtPage 都不要）、或用更细的外壳方案（每页自包 NuxtLayout 做运行时切换）时防双套。排查含义：全站布局突然消失，第一个看 app.vue 是否被改动过——这是"入口开关"级的知识点（呼应 nuxt-layouts 第 1 节）。

**来源**：CSDN《布局莫名失效的排查线索》；SegmentFault《app.vue 的三种存在形态》。

### A3. 布局、父页面、全局组件三种"共享外壳"手段怎么选？

**答**：三问定位：① 换 URL 会换它吗？换 → 父页面（业务实体随路由走）；不换 → ② 会因运行时状态换皮肤吗？会 → NuxtLayout 动态 :name；不会且全站统一 → ③ 需要路由感知（middleware/过渡/滚动参与）吗？需要 → layouts；纯视觉外框（顶部公告条）→ 全局组件写进 app.vue。反例：把导航栏塞 app.vue 全局组件——它就无法按路由差异化（登录页不要导航），layouts 的路由耦合性是特性不是负担。

**来源**：掘金《共享外壳的决策树》；知乎《为什么我的登录页带着侧栏》。

## B. 语义与坑

### B1. "布局不随同名切换重建"会造成什么典型 bug？怎么治？

**答**：布局里的局部状态（ref 拉的列表、watch 的一次性副作用、写死的"当前用户"）跨页滞留：从 A 管理员后台切到 B 的，侧栏头像还是 A 的。治法三层：① 数据层——共享状态入 Pinia/useState，由页面级数据驱动更新（响应式源头对）；② 视图层——布局内组件对 route 参数 watch 后 refresh；③ 核弹——`<NuxtLayout :key="route.fullPath">` 强制重建（牺牲复用换正确性）。这题与动态路由的实例复用是同一枚硬币的两面：Nuxt 默认偏性能、正确性要你显式声明（呼应 nuxt-dynamic B1）。

**来源**：掘金《布局状态残留 bug 复盘》；SegmentFault《key 强刷 layouts 的得与失》。

### B2. 布局里能不能用 useFetch？团队约定怎么说？

**答**：技术上能——布局在服务端渲染期执行，useFetch 会跑、结果进 payload；但约定上限制：布局的生命周期语义（跨页存活、切换时机复杂）让"取数发生在哪一次导航上"难以推理，同名切换不重取、换名重建又重取，数据新鲜度直觉全靠记忆。团队约定模板：布局只消费 store，数据写入统一在插件/页面/middleware 完成；布局需要数据时配 lint 规则（no-restricted-imports 在 layouts/**）拦截。把"能不能"和"该不该"分开回答，是框架题的高级答法（呼应 nuxt-state）。

**来源**：CSDN《我们的 Nuxt 数据层规范》；知乎《布局层取数为什么被 lint 禁止》。

### B3. 页面过渡（page transition）在布局切换时表现如何？有什么坑？

**答**：`<NuxtPage :transition>` / definePageMeta transition 驱动 Vue Transition，同名布局换页 → 只有页面区过渡，外壳不动（体验好）；换布局 → 壳与页一起进出，默认会出现"旧壳未走新壳已至"的双层重叠或白闪，处理：给 NuxtLayout 也配 transition、或外层用统一壳（把换壳降级为组件切换）。进阶坑：异步布局 + out-in 模式的死锁（leave 未完成 enter 不开始，配合 Suspense 时偶现卡死）——升级后留意 Nuxt 对 layout 过渡的修复记录。体验类问题先画"壳是否更换"的时间线再对症（呼应 vue-class-style-transition）。

**来源**：掘金《布局切换的过渡撕裂与修复》；SegmentFault《out-in 与异步组件的卡死疑案》。

## C. 对照与架构

### C1. Next 用路由组 (shop)/(admin) 分布局，Nuxt 怎么做等价的事？

**答**：Nuxt 没有路由组（URL 里没有、目录名也不能带括号——pages 一切 .vue 即路由，呼应 nuxt-directory A3）。等价手段就是 layouts 本身：命名布局 admin/default/console 承担"分组"职责，URL 前缀分组靠 middleware 按路径批量指派 layout（或逐页 meta）。差异在表达位置：Next 的分组信息刻进目录结构（文件系统即架构文档），Nuxt 的分组信息在布局名与 meta 里（注册表式）。迁移提醒：从 Next 路由组项目过来，别试图复刻"目录分组"——那是布局目录 + 命名规范的工作（呼应 next-groups-matchers 第 1 节）。

**来源**：InfoQ《组织同一路由的两套语法》；掘金《从路由组到命名布局的迁移笔记》。

### C2. 一个多租户 SaaS（每客户可自定义主题壳），布局体系怎么设计？

**答**：皮肤参数化而非布局多实例爆炸：① layouts 只保留结构骨架（admin/console/blank 三件套封顶）；② 租户主题进 CSS 变量（--brand 色、logo、侧栏折叠默认）由插件在 SSR 前注入 `<style>:root{...}</style>`（避免闪烁，呼应 next-css 的主题对照）；③ 结构性差异（有/无某模块菜单）用组件级 v-if + 租户配置 store，不做布局排列组合；④ 白标域名→middleware 按 host 解析 tenant 注入上下文。教训阈值：布局数超过"5 个且仍在增长"时，说明你在用布局表达配置——该降到数据驱动（呼应 nuxt-runtime-config）。

**来源**：CSDN《多租户前端的主题架构》；知乎《当布局数量失控之后》。

### C3. 如果让你给 Nuxt 提 RFC 支持布局嵌套树，你会保留现状还是改造？

**答**：诚实答案：保留现状 + 文档化组合模式。理由：① 布局嵌套树=重引入路由段的缓存/重建复杂度，Nuxt 的同构模型里没有对应的收益（布局不承载数据获取的段级语义，数据在 useFetch 层）；② 现有逃生门够用：布局内包 NuxtLayout、组件组合、动态 :name——三种正交手段覆盖已知场景；③ 框架 API 的面相要克制，layouts 之所以好学就是因为它只有三个概念（default/命名/false）。改造方案（如 definePageMeta 的 layouts 数组）的代价：命名冲突、过渡语义组合爆炸、迁移文档负担。这题考的是 API 设计观：新概念要证明旧组合无法优雅表达，否则宁可不加（呼应 nuxt-architect 的框架哲学讨论）。

**来源**：掘金《为什么 Nuxt 不做布局树》；InfoQ《框架 API 克制的艺术》。

---

## 补充（新专题 10-15）

### C4.  布局切换（user 壳↔admin 壳）时页面组件会整体重挂载，这个默认行为的利弊与缓解手段？

**答**：机制：app.vue 里 <NuxtLayout> 以 layout 名为 key 包 <slot>，name 变即销毁重建整棵子树——页面组件、其局部状态、进行中的请求副作用全部重来。利：不同壳的 DOM 结构/样式作用域/滚动容器差异大，重建最干净，不会带着上个壳的残影；Provide/inject 链重置也避免了跨角色布局共享上下文的权限泄漏。弊：从 user 页跳 admin 页等于付一次冷启动（骨架屏、取数重发、滚动位置丢）；同一数据在两个壳的布局里各 useFetch 一次还会双发。缓解按层给：① 数据层升级共享（useState/Pinia/服务端缓存 defineCachedEventHandler），重挂载不再等于重取数；② 高频成对切换的壳做成同一个布局内的条件分支（一个 shell 组件内 v-if 两种头尾），牺牲隔离换连续；③ 跳转体验用 page:transition 配壳间动画，配 keepalive 对布局无效（keepalive 挂在路由出口不在布局 key）要明说。决策句：先问『两个壳共享多少状态与数据』，共享多就并壳，共享少就认重建、把钱花数据层。

**来源**：Nuxt 官方 Layouts 文档；SegmentFault《布局切换白屏与状态丢失排查》。

### C5.  需要跨页面持久驻留的 UI（播放器/通知抽屉/调试悬浮球），放布局还是别处？几种方案怎么比？

**答**：候选与账：① 放 default 布局——布局同名切换不重建时可行，但一旦页面切到不同 layout（admin/登录页）就被销毁，且登录页等无布局页直接消失，隐式假设多；② app.vue 直接挂 <NuxtLayout> 外面——真正的全局驻留位，跨布局切换存活，但要自己处理与路由的联动（登录页是否显示）；③ <ClientOnly> + Teleport to body——解决定位被布局层叠上下文/overflow 截断的问题，和前两条叠加用而不是替代；④ 布局切换重建引发的『播放器闪断』是历史事故高发区，UI 状态（播放进度）必须进 Pinia/useState 与组件解耦，组件可以死、状态不能死。验收三问：切布局活着吗？刷新后状态从哪恢复？SSR 首屏它出现吗（ClientOnly 就不出现，占位高度要留够防 CLS）。

**来源**：Nuxt 官方文档；知乎《小程序和 Web 的全局浮层都逃不过这三招》。

### C6.  主题偏好（深色/浅色）要 SSR 首屏正确且不闪烁，和布局体系怎么配合？

**答**：本质：主题决定首帧 HTML 的 class/CSS 变量，而它在服务端只能来自 cookie（localStorage 服务端看不见）。方案对比：① useCookie 存主题+服务端读它渲染 <html :class>——SSR 模式彻底无闪烁，是正解；纯 SPA（ssr:false 的路由）退化为客户端起步，只能靠默认值猜；② 客户端脚本读 localStorage 抢在渲染前打 class——适合无 SSR 的站点，Nuxt 项目里等于绕道；③ 先渲染浅色再纠正——必闪，还带 CLS，属于没方案。落地链：主题写进 cookie（sameSite 按部署配）→ 根布局或 app.vue 服务端读 cookie 决定壳 class → 主题切换组件 useCookie.value 直接改（响应式自动 SSR 同步回 payload）。和布局的配合：主题 class 要挂在布局之上（html 或 app.vue 层），挂布局内则换布局瞬移失效；app.config 放编译期默认主题，runtime 值走 cookie——三个配置面各就各位。

**来源**：Nuxt 官方 useCookie 文档；掘金《SSR 主题防闪烁的四条路线》。

### C7.  app.vue 与 default 布局都可以包 <NuxtPage/>，脚手架为什么有时两个都生成？共存时会发生什么？

**答**：机制：布局解析链是"页面 definePageMeta 的 layout 名（缺省 default）→ layouts/ 目录查找"，而 app.vue 是应用根组件——两者都能放 <NuxtLayout>+<NuxtPage/>，职责重叠区就在"谁包谁"。共存反例：app.vue 写了 <NuxtLayout><NuxtPage/></NuxtLayout> 且 layouts/default.vue 里又写 <slot/>+<NuxtPage/>——页面被出口两次、或 default 布局形同虚设（取决于谁持有出口），症状是"布局改不生效/内容渲染两遍"。官方脚手架二选一的逻辑：纯 app.vue 模式（无 layouts 概念，简单应用）或 layouts+default 模式（多壳应用）。治理规矩：项目里只允许一种"出口持有者"——有 layouts/default.vue 则 app.vue 退化为 <NuxtLayout><NuxtPage/></NuxtLayout> 薄壳且不再放页面内容，并用 ESLint 自定义规则或 code review 清单锁死"<NuxtPage/> 全站只出现一次"。加分句：布局与 app.vue 的边界=“是否需要一个不参与布局切换的常驻层”，需要才拆两层，不需要就只留一个出口。

**来源**：Nuxt 官方文档（The App and Pages / Layouts 章节）；SegmentFault《页面被渲染了两次的诡异 bug》。

### C8.  路由里 layout: 'admin' 指向一个不存在的布局文件，会发生什么？这类"约定漂移"怎么防？

**答**：默认行为：运行时抛布局未找到错误（dev 直接红屏错误页；生产表现为渲染失败/错误页），而不是静默回退 default——"响亮失败"是对的，但发现时点可能在合并后才暴露。防线按成本递增：① 类型层——definePageMeta 的 layout 字段是 string 不设枚举，裸写无提示；项目里把布局名收拢成常量（shared 里 export const LAYOUTS = { admin: 'admin', user: 'user' } as const，页面引用常量）把拼写错误降级为编译错误；② 构建期断言——一个轻量脚本（Nuxt hook 或 CI step）：扫描所有 definePageMeta 的 layout 字面量与 layouts/ 目录文件清单做集合比对，缺失即 fail（十几个行数的脚本换一类整类 bug）；③ 流程层——新布局落地 PR 必须同时含文件与首个使用页（一起改一起验），CODEOWNERS 让布局变更进设计系统组评审。泛化教训：Nuxt 约定式 API 的字符串参数（layout、middleware 名、错误页路径）都不进类型系统，"字面量收敛成常量+构建期比对"是所有约定漂移的通用疫苗。

**来源**：Nuxt 官方 layouts 错误处理；掘金《我们把路由元信息写成了常量》。

### C9.  全站顶部公告条（服务端下发的运营数据）放哪？怎么兼得"跨布局常驻、SSR 直出、关闭状态跨页生效"？

**答**：三需求各自的坑：常驻——放布局则换布局重建（关闭状态与闪动），放 app.vue 层才真正跨壳存活；SSR 直出——app.vue 的 setup 服务端执行，useFetch 结果进 payload 首帧即在，但要注意"公告数据进每页 payload"的体积（小 JSON 可接受，带富文本/图要裁字段）；跨页关闭状态——纯组件局部 ref 换页即忘，要 useState('notice-dismissed')（本次加载内共享+进 payload）或写 cookie（跨刷新持久，运营类可接受）。实现形态：app.vue 里 <NoticeBar/><NuxtLayout><NuxtPage/></NuxtLayout>，NoticeBar 内部 useFetch('/api/notice') + useCookie 判已读（服务端读得到→SSR 首帧就不渲染已关过的条，防闪现）；公告为空时零输出不留占位高度（防 CLS 反向问题）。边界声明：登录墙文案不进全站公告接口（服务端筛受众），"点关闭变 401"的串位事故源于把用户维度数据放进无身份缓存（swr）的公告接口——缓存键里有身份才能上缓存（呼应 render-modes 安全题）。

**来源**：Nuxt 官方 useFetch/app.vue 文档；CSDN《全站公告条的三种实现与翻车记录》。
