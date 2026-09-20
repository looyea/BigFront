# 面试题 · Next.js App Router

1. **App Router 与 Pages Router 的核心差别？**
   - App：文件系统 = 路由树、`layout/page/loading/error` 特殊文件、Server Component 默认、支持 React 18 Suspense/Streaming。
   - Pages：`getServerSideProps` 时代模型，每页一个数据入口。

2. **Server Component 与 Client Component 的边界？**
   - Server（默认）：不能 useState/useEffect、不能浏览器 API；可以读文件、连数据库、直连后端密钥。
   - Client（`'use client'`）：交互、状态、hooks。
   Server 可以渲染 Client，反之不行；但 Server 可以传 render-props 让 Client 里嵌 Server。

3. **路由段（segment）与嵌套布局？**
   `app/feed/[id]/page.tsx` → `/feed/xxx`。layout 从外到内嵌套渲染，只重渲变化的段。

4. **dynamic route 与 catch-all？**
   `[slug]`、`[[...slug]]`（可选 catch-all）、`[...slug]`（必选）。

5. **route group 和 parallel routes？**
   `(marketing)/about` 只分组不进 URL；`@modal` + `children` 参数做并行路由（如模态路由）。

6. **中间件（middleware.ts）用途？**
   运行在 Edge Runtime，请求预处理：鉴权重定向、A/B、header 改写、i18n 语言协商。

7. **Link 预取如何生效？关闭它？**
   视口内 + 生产环境的 `<Link>` 会自动预取目标 RSC payload。可 `prefetch={false}`。

8. **Next 13+ 的 `generateStaticParams` 与 `dynamicParams`？**
   generateStaticParams 决定构建时预渲染哪些动态段；dynamicParams=false 则只允许预生成的段。
