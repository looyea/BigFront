# next-groups-matchers 面试题（15 题）

> 来源：整理自 CSDN、掘金、SegmentFault、知乎等站点 Next.js 目录组织与路由约定高频面经，中文重述。

---

## A. 路由组与目录约定

**1. 路由组 (group) 的设计动机是什么？为什么不用普通文件夹名？**
**来源**：掘金《Next.js 路由组解决什么问题》；SegmentFault（括号目录讨论）
普通文件夹名会被解析进 URL；业务又需要"一组页面共享一套布局/权限域"。括号在文件系统合法、在路由解析器里被剔除——用目录名本身携带元语义。动机是"组织结构与 URL 解耦"（呼应 next-groups-matchers 第一节）。

**2. 两个路由组里出现相同路径的页面会怎样？如何正规解决？**
**来源**：CSDN《two parallel pages that resolve to the same path 报错》
构建期直接报错，因为组透明后两者争夺同一 URL。解法：要么合并进同一 page 用条件渲染，要么真正区分 URL（如 /(marketing)/index 与 /(shop)/goods 各挂不同段），要么其中一组改纯组件目录（_开头）（呼应 next-groups-matchers 第一节）。

**3. _folder、.folder（点开头）这类私有目录和 (group) 的三层差别？**
**来源**：知乎《Next 目录魔法前缀一览》
(group)：解析路径、透明于 URL、参与布局作用域；_/. 私有：完全不解析，纯代码收纳；@slot：不解析成路径但注入渲染树。三者对应"要 URL 不要壳 / 全不要 / 不要 URL 但要坑位"三种需求（本课第二节全表是标准答案底稿）。

---

## B. 静态资源与元数据文件

**4. public 目录的文件和 import 进来的图片，Next 处理有何不同？何时用哪个？**
**来源**：InfoQ《Next.js 图片资源三种姿势》；掘金（next/image 与 public 对比实测）
public 原样伺服：无 hash、无优化、无构建校验；import 的资源进构建管线：content hash 长缓存、可被 next/image 分析尺寸。默认用 import；public 留给"必须固定 URL"的第三方约定文件（robots/verification）与大体积不受优化收益的文件（呼应 next-fonts-images、vite L1 同款结论）。

**5. app/robots.ts、app/sitemap.ts、app/opengraph/image.tsx 各解决什么问题？**
**来源**：CSDN《Next 元数据文件约定》
robots/sitemap 用代码生成爬虫行政文件（随数据变化自动更新，静态站手工维护的替代）；opengraph/image 把"分享卡片图"写成组件——按路由参数动态渲染 OG 图，电商每个商品一张卡片的场景神器（呼应 next-metadata、mp-openapi 分享卡）。

---

## C. 大型项目组织

**6. 一个几百页面的 Next 单体，你如何设计 app 目录防止腐化？**
**来源**：知乎《Next.js 大仓目录治理》；SegmentFault《中后台的鉴权域划分》
按布局/鉴权边界建路由组（public/console/partner）；组内按功能域建段目录；域内私有代码进 _components/_lib；API 独立 api/ 树按资源分；跨域共享进顶层 components/lib；配 colocation 原则——先内聚后提升。加分点：提出"目录 PR 评审 + codemod 迁移脚本"的治理配套。

**7. Next 项目里 feature-based 与 layer-based 目录之争，你的立场？**
**来源**：InfoQ《前端目录组织十年轮回》
层式（components/pages/services 顶层三类）在 Next 里水土不服——路由已强制按页面切；主流落点是"路由段内按域共置（colocation）+ 真共享才上浮"。这与 09-express 按功能域拆 Router、06-mp 分包按业务切的论证同构（呼应 exp-patterns、mp-subpackage）。

**8. 路由命名大小写与尾斜杠为什么值得较真？（SEO 与网关双视角）**
**来源**：CSDN《重复内容的 SEO 惩罚》；Node 相关博客（Nginx 与 Next 的 trailingSlash 冲突案例）
/Blog 与 /blog 是两个 URL 但同页面 → 收录分裂、权重稀释；trailingSlash 配置与 Nginx try_files/重定向规则不一致 → 重定向环或 404。工程答案：全局统一小写、框架与网关取向对齐、加 CI 检查（呼应 next-groups-matchers 第四节、node-deploy-perf）。

---

## D. 综合场景

**9. 老板要在不改 URL 的前提下给 /pricing 换一套全新落地页做 AB，目录层面无侵入的做法？**
**来源**：掘金（中间件分流 + 并行渲染实践）
middleware 按 cookie/UA 将 /pricing rewrite 到内部路由（如 /(ab)/pricing-v2 段），URL 不变、组件不同；或用并行路由槽承载变体。得分点：说明为什么不用"组件里 if 实验组"（JS 分支进包、SSR 缓存键污染）（呼应 next-middleware-auth、react-architecture 的实验设计）。

**10. 微前端场景：三个 Next 应用拼一个门户，路由层面会碰到的头号问题？**
**来源**：InfoQ《Next.js 与微前端共存的现实方案》
 basePath/assetPrefix 与网关转发：每个子应用要能挂在 /app-a 等前缀下且静态资源、跳转链接、cookie 域全部带前缀意识；Link 预取跨子应用会退化为整页导航（RSC payload 不互通）。加分点：坦率承认 Next 对 MF 式运行时聚合不友好，倾向"网关级拼装或单一多路由组大仓"（呼应 react-architecture 的边界课）。

**11. 有人把 app 目录当普通 src 用，建了 app/utils/ 放工具函数，会发什么？**
**来源**：SegmentFault《app 目录滥用警示》
app/ 下每个目录都是潜在路由段：utils/ 无 page 不生成 URL 但会被扫描解析、layout 误放会导致全站包裹异常。工具函数应放顶层 lib/（tsconfig 别名 @/lib）。教训：约定式框架里"位置即语义"，目录不是随便建的（呼应 next-overview 第三节规范）。

**12. 让你给团队写一页《Next 目录军规》，写最重要的五条。**
**来源**：知乎《框架使用规范怎么落地》
参考骨架：① 目录名只允许出现在白名单（段/组/槽/私有/特殊文件），新前缀先 RFC；② 页面一律小写短横线，CI 正则校验；③ 域内代码先共置，第二次引用再上浮；④ public 只放约定文件，其余 import 进构建；⑤ 路由组=鉴权域，跨组不得互相 import 页面组件。规范要可被工具检查，否则等于没写（呼应 ts-strict 的"规则上锁"哲学）。

---

## 补充（新专题 13-15）

**13.  路由组、私有文件夹、catch-all 多种 matcher 并存的大项目里，如何避免"同段冲突/意外遮蔽"这类构建期与运行期问题？**
**来源**：Next.js 官方文档 Introduction to Sections / Defining Routes 冲突说明；SegmentFault《App Router 目录冲突排查》
冲突主要三类：① 两个路由组在同层级映射同一 URL 且各自有 page（(a)/login 与 (b)/login 都指向 /login）——构建直接报错，这是设计使然，逼你明确"这个 URL 归谁"；若要"同 URL 不同呈现"应改用并行路由 slot 而非两个组。② catch-all 与静态段遮蔽：/docs/[...slug] 会吃掉 /docs/faq 吗？——Next 按静态>动态>catch-all 的 specificity 排序，静态优先，但跨 layout 边界时子段挂父 layout 的隐式关系易被忽略，重构挪目录时要重审。③ route.ts 与 page.tsx 同段互斥、matcher 与 rewrite 环。工程防线：把"URL 表"当公共 API——CI 里用路由清单 diff（遍历 app 段生成 URL 快照）防"重命名目录顺手改了 URL"；用 README 约定组命名语义（(site)/(auth)/(admin) 各自代表壳而非业务）；turbopack/next build 报错信息要贴进团队排障手册。

**14.  为什么"URL 不变、目录可重组"值得被当成一种能力？路由组与私有文件夹如何配合做到？**
**来源**：掘金《App Router 目录即路由的工程实践》；InfoQ《前端代码组织：路由映射与归属解耦》
URL 是对外的长期契约（SEO/分享/书签），目录是对内的组织手段（归属/复用/权限），老式框架里两者被一张路由表软连接，文件路由则被目录结构硬绑定——路由组与私有前缀正是官方补上的"解耦阀门"：(group) 允许目录任意分壳分组而 URL 段不变，_folder/下划线前缀允许把纯实现细节（组件、数据 helper）放进 app 树而不污染 URL。收益：团队可以按 feature 重组目录、把某域拆给不同小组维护，而 URL 零变化；重组的 diff 只影响构建产物映射。边界：解耦是手段不是目的——URL 与目录大体同构仍是可读性的最大来源，只有"组织需求与 URL 语义真正打架"（同一 URL 两套壳、目录要按团队而非按域切）时才动用组/私有段，否则一个站里两套心智并存反而更贵。

**15.  一个中台项目 8 个业务域共处一个 app/，你在目录与 matcher 层面怎么做"域隔离"？隔离过度会有什么代价？**
**来源**：InfoQ《大型 Next.js 项目的目录组织》；知乎《Monorepo 与路由组：中台前端的边界治理》
隔离做法：每域一个顶层路由组 (domainA) 配独立 layout（导航/权限壳）、域内私有 _components/_data 目录、域专属 middleware matcher 前缀、API 收敛到 app/api/domains/<a>/；跨域共享沉到 app/_shared 或 workspace 包，禁止跨域 import 内部模块（ESLint boundaries/no-cross-import 钉死）。代价与反噬：① 组爆炸——8 个组各一套 layout 后，"全站统一壳"改动要乘 8，站点级 layout 反而抽不出来；② 跳转语义碎——跨域导航丢预取连续性、cookie/鉴权态在域间命名空间不一致会互相踩；③ 构建期扫描成本与类型推导范围随树膨胀。缓解：把"壳"设计成 站点 layout(全站) > 域 layout(仅导航) > 子域(面包屑) 的严格三层，域 layout 只准组合站点层能力、禁止各自造轮子；跨域协作只允许走三条"显式桥"：路由跳转、共享包、revalidateTag。
