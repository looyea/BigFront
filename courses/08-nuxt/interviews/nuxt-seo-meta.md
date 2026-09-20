# nuxt-seo-meta 面试题（12 题）

## A. 基础认知

### 1. 上了 SSR 是不是 SEO 就一定好？还需要做什么？
**答**：不是。SSR 只解决"爬虫能拿到内容"这一必要条件，效果还取决于：每页唯一的 title/description、正确的文档语义结构与正文层级、canonical 与站内链接可达、sitemap/robots 配置合理、图片有 alt 且可加载、移动端可用（CWV 达标）。典型反例是 SSR 项目所有页面 title 相同、正文靠客户端补拉，收录表现与 SPA 无异。评估口径：查看真实 Google/百度搜索的控制台数据（收录数、有展示页面数），而不是自评"我们 SSR 了"。

**来源**：《技术 SEO 检查清单》、《SSR 与收录的因果边界》

### 2. useHead 与 useSeoMeta 有什么区别？分别在什么时机调用？
**答**：同一套 @unhead 之上的两层 API：useSeoMeta 提供 40+ 预设语义字段（title/description/og*/twitter*），免去手写 property 名并有类型提示；useHead 承载任意标签（link canonical、script JSON-LD、htmlAttrs/bodyAttrs、meta 特例）。两者都必须在 setup 同步阶段调用（内部依赖组件实例注册），可在值上传函数获得响应式；服务端渲染时写入 HTML head，客户端导航时 diff 替换。混用同一语义字段的两套写法是"重复 meta"的主要原因。

**来源**：《unhead 设计说明》、《Nuxt head 管理三家对比》

### 3. 讲讲 titleTemplate、canonical、robots meta 的正确用法。
**答**：titleTemplate 放在 app.vue/布局层做全站后缀（字符串 `%s` 或函数形式以便空值兜底），页面只写本页标题；canonical 每页输出规范绝对 URL（`site.url + route.path`，并剥离跟踪参数），避免 `?utm_`/分页参数造成权重稀释；robots meta 管索引（noindex/nofollow/follow），与 robots.txt 的"管抓取"是两件事——已 Disallow 的 URL 上的 noindex 不会被读到（爬虫根本不看页面），所以"想立刻撤下索引"要用 noindex + 允许抓取，或站点权限层直接非 200。

**来源**：《canonical 与参数页治理》、《noindex 与 robots.txt 的冲突》

## B. 对比与辨析

### 4. Nuxt 的 head 方案与 Next.js 的 Metadata API 相比？
**答**：Next 用**声明式**：segment 导出 `generateMetadata` 函数或 `metadata` 常量，框架收集生成，天然支持按路由层级缓存、不能误写副作用；Nuxt 用**命令式 composable**：`useHead()` 在 setup 里注册，心智更贴近 Vue、可响应式，但也可能因调用时机错（onMounted 里、await 之后）静默失效。Nuxt 的灵活度体现在任意位置（组件、布局）都能加分支标签；Next 的严谨度体现在"元信息是数据不是行为"。两者服务端输出能力等价，OG 图 Next 有 `ImageResponse`（Edge 运行时生成），Nuxt 走 satori 端点/官方 og-image 模块。

**来源**：《Next Metadata 与 Nuxt unhead 对比》、《声明式与命令式 head 管理》

### 5. 为什么 JSON-LD 优于 microdata/ RDFa？要注意什么？
**答**：Google 官方只推荐 JSON-LD：独立于 DOM 结构（改样式不破数据）、可机器校验、书写与调试成本低、且能在脚本里由数据直接生成。注意三点：①必须与页面可见内容一致，编造结构化数据会导致手动处罚；②放进 `useHead({ script: [{type:'application/ld+json', innerHTML}] })` 时要转义，尤其用户输入里出现 `</script>` 会截断脚本形成 XSS 注入路径；③用富媒体测试/Structured Data Linter 验证，别只看源码。

**来源**：《结构化数据落地指南》、《JSON-LD 的注入风险》

## C. 实战场景

### 6. title 出现"先空白/先默认值再跳变"，如何彻底解决？
**答**：根因是数据未就绪时响应式函数返回 undefined，落到 titleTemplate 产生残缺标题。三招：①页面用 `await useFetch` 保证 SSR 前数据已在（而不是 onMounted 拉，呼应 nuxt-state 第 5 节）；②title 函数给兜底 `?? '加载中'` 或用 `status` 控制不输出；③若确实要等异步（流式渲染），接受 SEO 侧用默认标题，但用户侧用 `<Suspense>`/骨架避免跳变（呼应 vue-async-suspense）。验收以 view-source 的首帧 HTML 为准。

**来源**：《SSR 标题闪烁治理》、《view-source 才是事实》

### 7. 后台/私有页面怎样才算"对搜索引擎彻底关闭"？
**答**：分层做。①抓取层：`/robots.txt` 与 `@nuxtjs/robots` 在 dev/预发全站 Disallow；②索引层：meta noindex,nofollow（生产上对确实被外链指向的页面仍要留 noindex，因为 robots.txt 挡不住已存在的链接被收录"仅标题"）；③访问层：服务端鉴权前置，未授权直接 302 或 401/403，而不是返回 200 HTML 再靠前端跳（呼应 nuxt-middleware-auth 第 12 题）；④缓存层：这类页面禁止 prerender/swr，避免带身份的内容进 HTML 缓存（nuxt-render-modes 的安全线）。只做第 ②层是常见半吊子方案。

**来源**：《内部系统的 SEO 隔离》、《noindex 与访问控制的配合》

### 8. 站点要做中英文双语，SEO 层面要注意什么？
**答**：用 `@nuxtjs/i18n` 生成带前缀的路由（`/zh/`、`/en/`）与 hreflang（含 `x-default`），每语言独立 canonical（互不指向对方，否则权重全跑到一种语言），sitemap 按语言分别输出并在 `<url><xhtml:link>` 里声明替代版本；语言由 URL 决定而不是 cookie/Accept-Language（爬虫不会带你的 cookie），且要保持 SSR 输出对应语言（`ssr:false` 的语言切换对收录几乎无效）；OG 与 JSON-LD 的 inLanguage 同步。另外别忘了 `htmlAttrs.lang`——它在 useHead 里设。

**来源**：《多语言站点 SEO 架构》、《hreflang 与 canonical 的关系》

## D. 深度追问

### 9. 搜索引擎会执行 JS，为什么还要坚持服务端渲染？请给出成本视角的回答。
**答**：Google 的"两波渲染"意味着：抓取只拿 HTML，渲染排队进无头 Chrome 队列，消耗的是站点的抓取预算（crawl budget），大站常见渲染积压数天。工程上我不接受把收录寄托在对方愿意跑 JS 上，因为：①非 Google 引擎（百度等）与所有分享/预览爬虫不执行 JS，那部分流量占比常常不低；②SSR 出内容同时改善首屏与 CWV（省一次数据往返，呼应 nuxt-perf）；③服务端输出的 OG/canonical 才是可回归测试的确定性产物。所以 SSR 的价值不只是"能不能被索引"，而是"确定性与成本"。

**来源**：《抓取预算与渲染队列》、《为什么不要赌爬虫会跑 JS》

### 10. 如何量化 SEO 改动的收益？你怎么设计验证流程？
**答**：分三层。①静态正确性（自动化）：CI 里对预渲染页面与关键路由跑断言——title 唯一、description 长度、canonical 绝对且匹配路由、og:image 可 200 拉取、JSON-LD 通过 schema 校验，可用 `nuxt test` 或爬取脚本；②渲染层：Lighthouse SEO 分、CWV（CrUX 真实数据）；③业务层：Search Console 的收录页数、展现、点击、平均排名，以及带 `utm_source=search` 的转化——用变更前后的时间窗对比，控制季节性。关键是**把"可索引性"做成可回归的测试而不是上线后靠运气**（呼应 nuxt-testing）。

**来源**：《SEO 的工程化验证》、《把收录检查放进 CI》

### 11. 大站迁移到新框架，SEO 不能掉，你的方案是什么？
**答**：五步：①抓取全量旧 URL 与来源权重（导出 GA/SC/Ahrefs 数据），按流量分层（top 1000 重点保障）；②建立 1:1 URL 映射表，缺失映射的一律 301 到最相近分类页而非首页（软 404 会被忽略），重定向链路必须一跳完成；③结构对齐：新站先按旧 URL 兼容路由上线（保留可访问），观察 2-4 周；④分阶段切流（灰度/子目录），保留旧域名的 robots 与 sitemap 提交，加速重抓；⑤监控告警：SC 索引数、404 突增、品牌词排名。历史教训：一次全站改版把 20 万 URL 统一 301 到首页，权重全丢——**映射表是唯一值得写代码去校验的东西**。

**来源**：《站点重构的 SEO 迁移》、《301 策略与权重保全》

### 12. 从产品视角，你会怎么排 SEO、SSR 性能、开发成本三者的优先级？
**答**：按流量结构决定而不是按技术偏好。以内容分发为生的站点（文档、电商详情、资讯）：SEO 是主渠道，SSR/prerender 属于必投，投入产出最清晰；以内嵌工具/登录后台为主：SEO 基本无价值，优先做首屏与交互性能，SPA 模式（ssr:false）反而省事；品牌/App 落地页：分享卡片与 CWV 权重高，OG 图与预渲染是低成本高收益项，全站 SSR 未必必要。我的做法是先给页面分类（可索引内容页/参数页/私有页/工具页），再对每类定渲染模式（呼应 nuxt-render-modes 与 nuxt-seo-meta 第 5 节表格），最后按页面模板统一实现——**"全站 SSR"这种一刀切决策通常是团队在回避分类这个真正的工作**。

**来源**：《按流量结构选择渲染策略》、《页面分类先于技术方案》
