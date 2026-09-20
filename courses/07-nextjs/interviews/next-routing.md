# next-routing 面试题（12 题）

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
