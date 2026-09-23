# nuxt-i18n-content-layers 面试题精选

> 共 15 题，覆盖 i18n 模块 / Content 内容层 / Layers 继承体系 / 架构对照 四类。

---

## 一、@nuxtjs/i18n

### 1. Nuxt 项目上多语言，从配置到页面要动哪几处？

四步：①`modules: ['@nuxtjs/i18n']` + `i18n.locales/defaultLocale/strategy` 配置；②`i18n/locales/*.json` 字典；③页面 `useI18n()` 取 `t/n/d`；④切换器用 `switchLocalePath`。前缀重定向、hreflang、路由表本地化全由模块代劳——比 Next 手工路线少写 middleware 与 alternates 两块代码（呼应 nuxt-i18n-content-layers 第一节）。

**来源**：@nuxtjs/i18n — "Guide"

### 2. strategy 选 prefix 还是 prefix_except_default？对 SEO 有什么影响？

`prefix`：所有语言统一形态，canonical/hreflang 最简单，推荐对外站点；`prefix_except_default`：默认语言短 URL 好看，但同一内容出现"带/不带前缀"两形态——**必须保证无前缀页的 hreflang 组完整且自引用**，否则语言版本互相找不到。答题落点：形态本身都对，坏在做得不完整（呼应 nuxt-i18n-content-layers 第一节、next-i18n iv8）。

**来源**：@nuxtjs/i18n — "Strategy options"；Google hreflang 文档

### 3. 路由 slug 也想本地化（/en/about vs /zh/guan-yu），Nuxt 里怎么配？

i18n 模块的 `pages` 映射表：每个命名路由给各语言的 path（`about: { zh: '/guan-yu', en: '/about' }`），导航用 `localePath('about', 'en')` 自动落到对应语言 slug。成本意识同步带上：映射表是第三份要维护的"翻译"，小站不做也罢（呼应 nuxt-i18n-content-layers 第一节、next-i18n iv12 同题）。

**来源**：@nuxtjs/i18n — "Localized paths / pages option"

---

## 二、@nuxt/content

### 4. @nuxt/content 的存储模型是什么？为什么改 markdown 不用重新构建？

dev/test：内存 SQLite（文件变更热查询）；生产 build：预查询编译进产物文件库（`database.sql`/sqlite 文件随 Nitro 分发）。因为查询走的是 **SQLite 抽象层**而非"构建期 AST 烘焙"，内容与代码解耦——对照 Next 的 contentlayer：后者 build 时把 markdown 转成 JS 模块，改文案要重构建（呼应 nuxt-i18n-content-layers 第二节）。

**来源**：@nuxt/content — "How it works / SQLite"

### 5. page 集合和 data 集合各举一例，查询 API 有什么不同？

page：`docs`（有 slug、可 `<ContentRenderer>` 渲染、配 `content/docs/*.md`）；data：`authors.json`、站点设置（无路由语义，纯记录）。API 同一套 `queryCollection(name)` 链式（where/order/limit，终端 `.all()/.first()`），差别在消费端：page 结果喂 `<ContentRenderer>`，data 结果自己渲染模板；当前页用 `useRouteContent()` 免查 slug（呼应 nuxt-i18n-content-layers 第二节）。

**来源**：@nuxt/content v3 — "Collections / Page & Data"

### 6. v2 的老项目升到 v3，最先撞到的 API 变化是什么？

查询入口从 `queryContent(['docs','posts'])`（复数、多集合合并）变为 **`queryCollection('docs')`（单数、一个集合一条链）**；文件组织从 `content/` 平铺改为按集合的 `source` 目录（`content/docs/**`）；配置移到 `content.config.ts` + zod schema。见到教程里 `$collections.docs` 就该警觉是 v2 遗产（呼应 nuxt-i18n-content-layers 第二节口径更新）。

**来源**：@nuxt/content — "v3 migration guide"

### 7. Content 需要登录可见/动态内容吗？它的边界在哪？

不需要也不该。Content 定位是 **Git 内容（file-based CMS）**：全员可见的文档/博客/营销页。权限内容、用户生成内容属于真数据库与 API（server/api + Prisma/Mongo，呼应 09-express）。混用的信号：开始往 markdown frontmatter 塞 userId——那是数据建模长在文案里（呼应 nuxt-i18n-content-layers 第二节）。

**来源**：@nuxt/content — "When to use / limitations"

---

## 三、Layers

### 8. 什么场景该抽 Layer 而不是发 npm 包？

需求是"带上**约定目录**的复用"：组件自动导入、pages 直接可用、composables 自动注册、nuxt.config 增补（css/hooks）——这些靠 npm 包的显式 export 表达不了，要靠层的"文件即约定"。纯逻辑工具函数反而适合普通包（框架无关、可单测）。一句话：**层复用"一个 Nuxt 项目的形状"，包复用代码**（呼应 nuxt-i18n-content-layers 第三节、nuxt-modules）。

**来源**：Nuxt — "Layers" 官方概念篇

### 9. extends 数组的优先级怎么记？层能覆盖层的页面吗？

主项目 > extends 数组末位 > … > 数组首位——**越靠后越近主项目，覆盖力越强**；同名组件/页面/composable 走这条链解析，所以"租户薄层换掉 core 层的首页"成立。风险提示：覆盖是静默的，层一多要 `npx nuxt info`/输出物核对到底谁生效（呼应 nuxt-i18n-content-layers 第三节）。

**来源**：Nuxt — "extends 优先级说明"

### 10. 多租户白标方案：Layer、环境变量、中间件改写主题三种做法怎么比？

Layer 方案：每租户一薄层 build 出独立产物——定制深度最大（可换页面结构），代价是 N 份构建；env+runtimeConfig 主题 token：一份产物运行时换肤，改不了结构；混合最常见：**结构进层、参数进 env**（呼应 nuxt-runtime-config 的 public 配置、nuxt-deploy 的多 preset）。答题展示"定制深度 vs 运维份数"的权衡轴即高分。

**来源**：Nuxt 白皮书式实践（内容站/白标多租户通识）

---

## 四、架构对照

### 11. "Next 把选择权留给生态，Nuxt 把默认答案写进框架"——用 i18n/Content/分层三个例子证一遍。

i18n：Next 要 middleware+[locale] 段+next-intl 手工接线；Nuxt 一个 @nuxtjs/i18n 配置块。内容：Next 选 contentlayer/MDX/外部 CMS 各家自备；Nuxt 官方 @nuxt/content 带 Studio。分层：Next 复用=monorepo+包导出（无目录继承概念）；Nuxt `extends` 内置。代价同样清楚：Nuxt 路线绑定框架版本节奏，Next 路线自由但每个决定要你负责（呼应 nuxt-i18n-content-layers 第四节、nuxt-architect 终局题）。

**来源**：Nuxt vs Next 对照通识；07/08 两包课程总结

### 12. 三件套会不会让 Nuxt 项目"配置魔法化"？团队怎么防御？

会——自动导入+模块+层链让"这个组件哪来的"变难答。防御清单：①层数预算（≤3 层，超了改拆包）；②模块准入：读 changelog 与 issue 再进 nuxt.config；③`nuxt info`/`.nuxt/` 生成物进新人培训，让"魔法有说明书"；④关键路径（鉴权/计费页）优先显式 import（nuxt-auto-imports 讲过的"显式导入正当场景"在此复用）（呼应 nuxt-auto-imports、nuxt-directory）。

**来源**：Nuxt — "Auto-imports 可维护性讨论"；工程实践通识

---

## 补充（新专题 13-15）

### 13.  多语言站的内容工作流：翻译文案、URL slug、图片本地化三件事分别在哪层解决？

三件事三种落点：① UI 文案——i18n 语言包（键值对，构建期进包或 lazy），翻译流程走"键为真相、译文进翻译平台/TMS 再同步回仓库"，禁止在组件里硬编码可翻译字符串（扫描规则配进 lint）；② 内容文案与 slug——结构化内容进 CMS/content collections 按 locale 建模（一篇文档多语言版共享 id、各 locale 有自己的 slug 字段），localized route 的 paths 映射引用内容字段——slug 是内容不是 UI，别塞语言包；③ 图片本地化——按 locale 目录/字段指向不同资源（banner 带中文文字的图必须独立版本），NuxtImg 的 src 走内容字段解析。协同点：hreflang 与语言切换器的 URL 来源要同一套解析（都从 i18n 模块的 localePath 出），两套实现必然漂移；预览环境按 locale 建（编辑只看到自己语言的渲染）。反模式警告：Google 翻译挂件冒充多语言=收录与体验双输，机器翻译版要么 noindex 要么不进索引地图。

**来源**：@nuxtjs/i18n 文档（localePath/localizedRoute）；SegmentFault《slug 本地化的三种存储模型》

### 14.  Git 内容仓（@nuxt/content）什么时候该换成 Headless CMS？换与不换的成本各在哪？

不换的理由（Content 赢的面）：内容与代码同仓同 PR 流（审核=git review）、类型化集合给编辑即时校验反馈、无外部服务依赖（成本与可用性）、预览=分支部署天然、版本回滚=git revert——开发者主导、编辑≤几人、发布节奏可排期的团队，Git 方案五年不过时。该换的信号（每条都是 Git 模型救不了的）：编辑自助发布不能等构建（CMS 的发布即生效 vs Content 的 push 触发重部署）、非技术编辑要所见即所得与角色权限、内容被多端复用（App/小程序吃同一内容 API）、结构化关系与多语言工作流（翻译状态机）、内容量到需要检索/ CDN 级缓存。换的成本清单：内容建模与迁移脚本、预览环境与生产双链路、缓存失效设计（webhook 触发 ISR revalidate 而非重建）、供应商锁定与导出条款、"内容 bug 不再走 PR"的质量流程重建（校验从 CI 挪进 CMS schema）。中间态最诚实：代码仓放结构化长文、营销页/多端内容进 CMS——按"编辑自主度需求"分界而不是站队技术。

**来源**：@nuxt/content 官方与 Headless CMS 生态对比；InfoQ《内容平台化临界点》

### 15.  Layer 机制做多品牌产品底座（设计系统/合规壳），升级与差异化的治理怎么设计？

底座设计：平台 Layer 提供 app.vue 壳、鉴权/埋点/错误页等"合规必须件"与组件 tokens；品牌项目 extends 平台层，差异走三条合法通道——覆盖（品牌目录下同名组件/配置覆写）、扩展点（平台层暴露插槽与配置项而非让人 fork 文件）、env/runtimeConfig（值差异不进代码）。升级治理：平台层版本化发布（npm 私包语义化，禁 main 漂移引用），品牌项目 lockfile 锁版本、升级按依赖升级流程（变更日志+视觉回归 e2e）；平台层内部"待迁移清单"公开（废弃 API 双活一个 minor 周期），逼升级的代价平台层自己付。腐化防线：品牌层里 grep "覆盖了多少平台文件"做健康度报表，覆盖数失控=平台层的扩展点设计失败，要回头补机制而不是骂业务团队。边界重申（呼应 modules 题）：品牌间是"同一应用的皮肤差异"→ Layer；是"不同应用共享能力"→ 模块+npm 库，混用会让"改平台动所有产品"的半径失控。

**来源**：Nuxt 官方 layers 文档；掘金《白标产品线的层架构一年实践》
