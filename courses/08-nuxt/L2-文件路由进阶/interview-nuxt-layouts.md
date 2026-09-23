# nuxt-layouts 面试题（12 题）

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
