# react-nextjs 面试题精选

> 共 15 题，覆盖 A 渲染动机 / B App Router 与策略 / C Server/Client / D 水合·Next 独有类。

---

## 一、渲染动机（A 类）

### 1. 纯客户端渲染(CSR)的 React SPA 有什么问题？Next.js 如何解决？

**答**：CSR 先下 HTML 壳 + 大 JS bundle，浏览器执行后才渲染 → **首屏白屏、SEO 不友好（爬虫常看不到内容）、TTFB/FCP 慢**。Next.js 在服务端把首屏渲染成真实 HTML 返回（SSR/SSG），浏览器无需先跑 JS 即可见内容，爬虫可读，并可流式输出；同时内置文件路由、数据获取、代码分割、图片优化等。本质是把"React 渲染"提前到服务器（呼应 vue-ssr-nuxt 同动机）。

**来源**：Next.js 文档 — When to use / SSR、web.dev — CSR vs SSR、Nuxt SSR 对照

### 2. SSR 一定比 CSR 好吗？它的代价是什么？

**答**：不是万能。代价：① 需要常驻 Node 服务器（或 edge），有运维与成本；② 每请求渲染增加服务器压力与延迟（尤其动态数据）；③ 要处理**水合**及其 mismatch；④ 组件要区分 server/client，浏览器 API 不能随便用。对"登录后的内网工具、SEO 无所谓"的应用，CSR/静态可能更简单。选型看 SEO、首屏、数据来源、团队运维能力。

**来源**：Next.js — Rendering 决策、SSR vs SSG vs CSR 权衡文章

---

## 二、App Router 与渲染策略（B 类）

### 3. Next.js App Router 的路由模型是怎样的？

**答**：**文件系统即路由**：`app/` 下文件夹是路由段，`page.tsx` 是页面，`layout.tsx` 提供嵌套外壳（内部 `<children>` 渲染下一级，等价 react-router 的 `<Outlet>`），`[slug]/` 是动态段，`(group)` 是仅组织用不占 URL 的路由组；`loading.tsx`/`error.tsx`/`not-found.tsx` 约定式提供该级 Suspense/ErrorBoundary/404。相比老 `pages/`，App Router 原生支持嵌套布局 + Server Components + 更多约定文件（呼应 react-nextjs 第二节、react-router-basics）。

**来源**：Next.js 文档 — App Router / file conventions、Layouts and Pages

### 4. SSG、SSR、ISR、CSR 分别是什么？如何为一个页面选择？

**答**：
- **SSG**：构建时生成 HTML，产物静态放 CDN——最快最省，适合不常变内容；
- **SSR**：每次请求服务器渲染——适合个性化/实时数据；
- **ISR**：SSG + 按 `revalidate` 周期后台再生——内容多又偶尔更新（博客/电商）；
- **CSR**：浏览器渲染——强交互后台、无需 SEO。
选择口诀："能静态就静态、越靠近 CDN 越好；需要每请求不同才 SSR；静态但会更新用 ISR"。App Router 默认尽量静态化，用到动态 API（`cookies()`、`no-store` fetch）才转动态（呼应 react-nextjs 第三节）。

**来源**：Next.js — Static vs Dynamic、Incremental Static Regeneration、Rendering 模式

### 5. `generateStaticParams` 和 `revalidate` 各起什么作用？

**答**：`generateStaticParams()` 为动态路由（`[slug]`）在**构建时**返回要预渲染的参数列表（这些路径走 SSG，其余可 `dynamicParams` 决定是否按需生成）。`revalidate`（秒，页面级或 `fetch` 级或 `revalidateTag`/`revalidatePath`）设定 **ISR 的再生周期/主动失效**：到期后台重生成，或数据变更时手动触发刷新缓存。二者分别管"预渲染哪些"与"多久/如何刷新"。

**来源**：Next.js — generateStaticParams、revalidate、Segment Config

---

## 三、Server / Client Components（C 类）

### 6. Server Component 和 Client Component 的区别？划分原则？

**答**：**Server Component**（默认）只在服务器渲染：可 `async/await` 直连数据库/文件、密钥不外泄、代码不进客户端 bundle、产物更小；不能用 hooks/浏览器 API/事件。**Client Component**（`'use client'`）在浏览器交互：有 state/effects/事件，其子树也在客户端。原则：**把 client 边界推到尽量深的叶子**，主体留 server，最小化客户端 JS。Server→Client 用 props 传**可序列化**数据（呼应 react-architecture 第四节）。

**来源**：React — Server Components、Next.js — Thinking about Server/Client Components

### 7. `'use client'` 放在一个文件顶部意味着什么？它的所有子组件都变客户端吗？

**答**：标记该组件为客户端模块边界——它及其**导入的子组件**都被打包进客户端并在浏览器渲染（形成一棵 client 子树）。但它作为 Server Component 里渲染的子元素时，仍先在服务端为其生成初始 HTML（RSC payload），客户端再水合交互部分。所以"标一个 client 组件会把其 import 图拖进客户端 bundle"，别在 client 组件里 import 服务器专属/含密钥的模块（要经 props 注入）。

**来源**：Next.js — use client directive、Server Components composition

### 8. 有了 Server Component 直接 await 取数，还需要 useEffect/React Query 吗？

**答**：分工不同。Server Component 的 `await` 适合"进入页面就要、可在服务端拿"的数据，天然免客户端 loading 瀑布。但**客户端交互态数据**（用户点击后按需取、跨页缓存/去重/失效、乐观更新、轮询）仍需 React Query/SWR；写操作也走客户端。二者共存：Server 侧预取首屏、Client 侧管交互与缓存（呼应 react-data-fetching、react-router-data）。

**来源**：Next.js — Data fetching、TanStack Query — SSR/hydration、Server Actions

---

## 四、水合与 Next 独有（D 类）

### 9. 什么是水合(Hydration)？为什么 SSR 之后还要它？

**答**：水合是客户端 React 启动后，**接管服务端已渲染好的 HTML**——不重建 DOM，而是把事件监听、组件内部 state、ref 等"注"进已有节点，使静态 HTML 变为可交互应用。SSR 只产出一次性 HTML、不含运行时交互与后续更新能力，故必须水合来"激活"它。水合要求客户端首次渲染结果与服务端 HTML 一致（呼应 react-nextjs 第五节、vue-ssr-nuxt）。

**来源**：React 文档 — Hydration、web.dev — What is hydration

### 10. 常见 hydration mismatch 成因与规避？

**答**：成因：服务端 HTML 与客户端首帧不同——① 渲染期用 `Math.random()`/`Date.now()`/本地化时间；② 直接读 `window`/`localStorage`/UA；③ 依赖登录态/随机顺序；④ 非法 HTML 嵌套被浏览器改写。规避：浏览器专属逻辑放 `useEffect`（挂载后再渲染那部分）、用"两端一致"的数据、`useId` 生成稳定 id、无害差异（时间戳）用 `suppressHydrationWarning`、SSR 库做动态 import（呼应 react-advanced-hooks 第三节）。

**来源**：React — Hydration Mismatch 错误、Next.js — Avoid hydration mismatch

### 11. Next.js 的 Image / Font / metadata 解决了 SSR 场景下的什么痛点？

**答**：`next/image` 自动按视口/设备 DPR **调整尺寸、转现代格式(WebP/AVIF)、懒加载**，避免 CLS（预留宽高）并优化 LCP，还能防远程图 DoS。`next/font` 本地打包字体、消除外部请求与布局抖动。`metadata` API（Server 侧）集中声明 title/link/OG，比在组件里 `useEffect` 改 `document.head` 更 SSR/SEO 友好（后者在 SSR 下跑不了或闪烁）。这些都是"渲染提前到服务端"后，对**性能与 SEO 细节**的框架级补全（呼应 react-performance）。

**来源**：Next.js — Image、Font、Metadata API

### 12. 面试问"你会不会 Next.js、和纯 React 差别在哪"，如何答得体？

**答**：说清定位——纯 React 是 **UI 库**（只管视图），Next 是**全栈框架**：加了文件路由、SSR/SSG/ISR、Server/Client 组件、数据获取、API routes/Server Actions、图片/字体/缓存/中间件。差别体现在：① 渲染从"纯客户端"变"服务端优先 + 水合"；② 组件要划 Server/Client 边界；③ 数据可在 server `await`；④ 部署从"丢静态"变"可能要 Node/edge 运行时"。再补一句"我在 Nuxt/Vue SSR 里也见过同构问题（水合、SSR 数据、history 回退）"，把认知连成体系（呼应 vue-ssr-nuxt、react-deploy）。

**来源**：Next.js — How Next.js works、Create React App vs Next.js、React 官方 — 框架优先

---

## 补充（新专题 13-15）

### 13.  Next.js 里取数放在哪：Server Component 直接 await、Route Handler、Server Actions、还是外部 API + Query？怎么选？

按「读/写 + 触发时机」分：① 页面首屏读——Server Component 直接 await（可访问 DB/内网/密钥、零客户端往返、可流式），最省心；② 需要在客户端交互后按需读、且要跨页缓存/去重/后台刷新——Route Handler（或 RSC 里发起）配 TanStack Query 接管缓存；③ 写操作且想「表单→校验→重验证」一体化——Server Actions（useActionState/revalidatePath，天然带 pending、可渐进增强）；④ 非 Next 运行时消费/多端共享——独立 API。判据：数据只在服务端要、首屏即定→SC await；要客户端可变与缓存→Query；提交后让服务端数据自动重取→Action+revalidate。别把「该 server 取的」搬到 useEffect，也别给一次性静态数据硬上 Query。

**来源**：Next.js Server Components 数据获取、Route Handlers、Server Actions 官方文档的分工说明。

### 14.  讲清 Next.js 的多层缓存（数据/fetch 缓存、路由段缓存、客户端 Router Cache、CDN）与如何 bust。

分层要分清：① Data Cache/fetch 缓存——server 侧 fetch 的 GET 结果缓存，历史上靠 `revalidate`/`cache:no-store`/`cache:{}` 控制（Next 15 起默认不再自动缓存 fetch，减少「意外长期缓存」）；② Full Route Cache——静态路由在构建/ISR 期缓存整页产物，`revalidatePath/revalidateTag` 失效；③ Router Cache——客户端在内存缓存已访问路由段以即时导航；④ CDN/浏览器 HTTP 缓存——静态资源与 HTML 的 HTTP 头。bust 手段：revalidatePath（按路由）、revalidateTag（按标签做依赖失效，最优雅）、动态路由强制 no-store 走每次渲染、以及渲染时 `dynamic = "force-dynamic"`。最大的坑是「隐式缓存叠加」——以为没缓存其实某层缓存了，排查从「这页到底在哪层被缓存」问起。新版收敛默认值正是为降低这套心智负担。

**来源**：Next.js caching 文档（Data/Full Route/Router Cache、revalidateTag）与 15 版缓存默认变更说明。

### 15.  ISR 页面部署到 Edge 运行时要注意什么？冷启动、流式与 PPR 如何影响选择？

Edge 运行时（V8 isolates）启动极快、贴近用户、适合静态/流式渲染，但受限：非 Node API（fs、部分原生依赖、某些 ORM driver）不可用，取数要走 fetch/边兼容库。ISR 在边缘的形态：静态产物由 CDN/边缘缓存命中，再生成回源。要「同一页里静态壳秒出 + 动态 personalized 部分异步填」，用 PPR（Partial Prerendering）：静态骨架预渲染并缓存，动态部分 Suspense 边界流式补——兼顾 TTFB 与新鲜度，代价是要正确处理 streaming 与 hydration 回退。冷启动在 edge 几乎可忽略、在 Node serverless 则是明显尾延迟。选型：内容型+全球分发→edge + ISR/PPR；强依赖 Node 生态/重后端计算→Node 运行时自托管或容器。

**来源**：Next.js Edge Runtime 限制、Partial Prerendering 与流式渲染文档；serverless 冷启动对照。
