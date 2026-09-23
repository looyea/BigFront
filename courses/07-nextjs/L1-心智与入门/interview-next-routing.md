# next-routing 面试题（15 题）

> 来源：整理自 CSDN、掘金、SegmentFault、知乎等站点历年 Next.js 路由高频面经，中文重述。

---

## A. 文件约定

**1. App Router 里 page、layout、template 三者的关系与差异？**
**来源**：掘金《Next.js App Router 文件约定全解》；SegmentFault《layout 和 template 到底差在哪》
page 定义段内容；layout 是持久化外壳，跨子导航不重挂载；template 与 layout 结构相同但每次导航重新挂载（等价于换 key 重建）。需要"进新路由就重置状态"（入场动画、表单壳）才用 template。

**2. route.ts 和 page.tsx 可以共存于同一个目录吗？**
**来源**：CSDN《Next.js Route Handler 能与 Page 同目录吗》
可以。同一文件夹可同时有 page（HTML 界面）与 route（API），互不冲突；但**不能**同时有 page 和 route 且都响应同一方法的 GET 页面导航——导航请求永远命中 page，route 只处理对 API 的调用。更常见的做法是 API 放 `/api/xxx` 独立目录避免混淆。

**3. 为什么根 layout 不能删掉？它可以是客户端组件吗？**
**来源**：知乎《Next.js 根布局的三条军规》
Next 不提供 index.html，`<html>/<body>` 标签必须由根 layout 渲染，删掉会导致文档结构缺失。根 layout 不能是客户端组件（不能加 'use client'），因为它负责文档骨架，且 metadata 等服务端能力都挂在它身上（呼应 next-metadata）。

---

## B. 嵌套与状态

**4. Next 的嵌套布局和 vue-router 的嵌套路由是怎么对应的？**
**来源**：InfoQ《三大框架路由模型对比》
目录层级 = 路由层级 = 布局层级：app/blog/layout 包住 app/blog/[id]/page，等价于 vue-router 里 children + `<RouterView>`。差异在 vue-router 要显式写 children 配置与 RouterView 占位，Next 用 children prop 与目录隐式完成；小程序则根本没有嵌套概念，每个页面独立整屏（呼应 mp-route 页面栈）。

**5. 子路由切换时父布局不重新渲染，那共享状态放哪？反过来想要重置怎么办？**
**来源**：SegmentFault《Next.js 布局状态管理实践》
不重渲染正是布局设计的目的（导航栏/侧栏保状态、省资源）；跨页共享可放 layout 内的 Context 或客户端状态（呼应 react-context）。想重置就在该层放 template，或给 layout 组件动态 key——但后者会丢服务端缓存语义，优先原生 template。

**6. loading.tsx 是干什么的？它和 Suspense 什么关系？**
**来源**：掘金《Next.js loading 文件与流式渲染》
loading 自动为该段包一层 `<Suspense fallback>`，是路由级的加载边界；当下层内容（数据未就绪、动态段 import 中）挂起时先显示它。它与 error.tsx（错误边界）、not-found.tsx 组成"段级三件套"，本包 L3/L7 分别展开（呼应 react-advanced-hooks 的 Suspense 用法）。

---

## C. 迁移与坑

**7. 从 Pages Router 迁移到 App Router，目录和思维上主要改什么？**
**来源**：CSDN《pages 到 app 迁移清单》；知乎《迁移 App Router 踩坑总结》
`pages/_app.tsx`→`app/layout.tsx`、`_document` 删除（html 归根 layout）、每个 `pages/x.tsx` 变 `app/x/page.tsx`；`getServerSideProps/getStaticProps` 的取数下沉进组件（async 组件）；`<Head>` 换 metadata API；Router 的 API 换成 next/navigation 家族（呼应 next-link-router）。

**8. 有哪些"路由没生效/404"的常见排查点？**
**来源**：SegmentFault《Next.js 路由 404 排查手册》
① 段里没有 page.tsx（只有 layout 不算路由）；② 默认导出缺失或不是组件；③ 文件名大小写不符约定；④ layout 没渲染 children（表现为白屏而非 404）；⑤ middleware rewrite 把路径改飞了（呼应 next-middleware-auth）；⑥ 动态段生成函数返回里没有该参数（呼应 next-dynamic）。

**9. Next.js 里怎么实现"同一个 URL 下不同子状态"（如 tab 切换进 URL）？**
**来源**：知乎《用 searchParams 管理 UI 状态》；掘金《useSearchParams 的 SSR 陷阱》
把 tab 状态写进查询参数（`?tab=info`）配合 useRouter.replace，刷新/分享可还原。注意 useSearchParams 在纯客户端读 URL，SSR 时为 null——官方曾要求包 Suspense 防整体降级为客户端渲染（呼应 next-boundaries、react-router-data 的"URL 即状态"哲学）。

---

## D. 综合与对比

**10. 文件路由是趋势吗？和 Vite 生态的 TanStack Router / 小程序的注册制怎么比？**
**来源**：InfoQ《文件路由之争》
Vite 系 TanStack Router、Nuxt（definePageMeta+文件路由）都走约定式；小程序是集中注册制（app.json pages）。约定式的收益是"结构即文档、零注册心智"，代价是隐式规则多（本包第一~六节背的全是规则）； TanStack 类型安全更极致，Next/Nuxt 与渲染深度绑定（呼应 vue-router-basics、mp-directory）。

**11. Next 的路由级代码分割是怎么自动发生的？**
**来源**：CSDN《Next.js 分包策略解析》；掘金《next build 后每个路由的 chunk》
每个路由段独立 chunk，导航时才按需加载 JS——layout 因持久化其依赖被提升到共享 chunk。这解释了"为什么 Next 不用手写 React.lazy 也有路由级分割"（对照 react-performance 手搓 lazy、vite-splitting 手动 split）；细粒度分割靠 next/dynamic（呼应 next-perf）。

**12. 面试被问"Next 路由和 React Router v6 数据路由谁好"，怎么答不踩坑？**
**来源**：知乎《React Router v6.x data API 与 Next.js 对比》
先分场景再表态：SPA 内交互密集型（工作台类）React Router 的 loader/action + 客户端状态更灵活；内容/全栈型 Next 的嵌套布局+RSC+缓存一体优势明显。展示你理解"路由与数据/渲染耦合深度"这条光谱（呼应 react-router-data、react-architecture 的取舍方法论），比站队更加分。

---

## 补充（新专题 13-15）

**13.  App Router 的"URL 结构与目录结构同构"带来哪些工程收益与代价？**
**来源**：掘金《App Router 目录即路由的工程实践》；SegmentFault《文件路由的利与弊》
收益：① 可发现性——新人打开 app/ 就是网站的 URL 地图，不用查路由表；② 代码分割天然按路由做——每段一个 chunk、layout 与 page 组合关系与运行时嵌套关系一致；③ 嵌套 layout 让"共享 UI + 局部子树"不用像 React Router 那样显式写 Outlet/parent route；④ 路由组/私有文件夹/并行/拦截等所有"高级路由"都是目录级操作，与文件浏览器/编辑器/版本控制契合。代价：① 目录深=URL 深，重构改目录=改 URL 语义（SEO/书签），迁移成本比"改路由表"高；② 文件即路由带来的"魔法目录名"（[id] / [...slug] / (group) / @slot / (.)intercept / _private / +modal 等）学习曲线陡、拼错无强提示；③ 大型站 app/ 树膨胀时组织策略必须靠路由组与私有文件夹，而这些不是所有团队都熟悉；④ Route Handler 也在同一棵树里、和页面抢段名（page/route 冲突），需要规划 api/ 子域。

**14.  一个中大型 App Router 项目（300 页 + 30 API 路由 + 后台/公开两套），app/ 目录你会怎么组织？**
**来源**：InfoQ《大型 Next.js 项目的目录组织》；知乎《Next.js 路由组与私有文件夹怎么用》
按"公开站 vs 后台 vs API"三大域切顶层路由组，域内再按业务子域、避免按文件类型平铺：app/(public)/{home,blog,pricing,about,layout.tsx}, app/(admin)/dashboard/{orders,users,settings,layout.tsx}, app/api/v1/{orders,users,...}/route.ts。跨域共享放 app/_shared（私有段、不映射 URL）或更常见的直接放到 src/features/* 与 src/components/*（不占用路由段），只在 pages/components 里 import。要点：① 路由组用括号 (public)/(admin)——保持 URL 干净；② 私有 _components 目录放组件、避免误当路由；③ 鉴权用 middleware 按段前缀（/dashboard/*）分派，layout 内再用 session 渲染对应导航；④ API 版本化从 v1 起（未来好切），Route Handler 别混进页面段；⑤ 站点级 layout 只放"全站骨架"（html/body/font/全局 metadata），域级 layout 放各自导航。这套与前端"feature-first"同构——只是路由树的物理形态把这套约束"钉"在了文件系统上。

**15.  Pages Router 迁移到 App Router，路由与数据获取上最容易踩的三类坑？**
**来源**：Next.js 官方《Upgrading: App Router》迁移指南；掘金《我们从 Pages Router 迁 App Router 踩的坑》
① 数据入口从"getServerSideProps/getStaticProps + _app + Router 事件"变到"组件里直接 await + 嵌套 layout + 生命周期 hook（loading.tsx/error.tsx）"——老代码里"页面级取数集中一处"的形态被打散到组件级，要重设取数边界与错误边界，别把 SSR 请求散成一堆 await 却仍用 useSWR 在客户端二次拉；② <Link> 与 useSearchParams 语义差异——App Router 下 useSearchParams 在 Server Component 直接读会强制整页动态（要包 Suspense 或下推到 client），Pages 没这问题；路由跳转 useRouter 的 push/replace 与 prefetch 时机也不同（App 走 RSC payload 预取）；③ 布局与状态持久——App Router 的 layout 在跨子路由切换时不重挂载，Pages 时代"每页独立"的心智会让"页面里 useEffect 只在挂载跑一次"的初始化逻辑不再执行（切到兄弟路由时组件被复用），要把"每次进入都跑"的放 usePathname 依赖 effect 或改用 route group 分壳。迁移策略是先切新页、老页保留 Pages 共存，不要一次性重写全站。
