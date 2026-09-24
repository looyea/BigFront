# ng-ssr 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕增量 hydration、TransferState 防双请求、SSR DI 隔离与 prerender 的题组。

### 1. (A) 描述 Angular 增量 hydration 的工作原理，对比旧版「destroy-and-recreate」方式的优势。

**来源**：转述自本关 §二增量 hydration 段

旧版：服务端渲染 HTML → 客户端 bootstrap → Angular 创建所有组件 → 销毁 SSR DOM → 重新渲染完整 DOM → 闪烁 + 浪费。增量 hydration（v17+）：客户端 bootstrap → Angular 比对 SSR DOM 与预期渲染 → **保留 DOM 节点** → 只 attach 事件监听器 + 建立 signal 依赖图 → 组件状态恢复。优势：零闪烁、更快 TTI（Time to Interactive）、事件回放保证交互不丢。

### 2. (B) 部署 SSR 后用户报告 hydration mismatch 警告刷屏——列出三种常见根因与修法。

**来源**：转述自本关 §八 Hydration 不匹配段

① **时间戳差异**：模板 `{{ now | date }}` → 服务端时间与客户端差几毫秒/秒。修：用 TransferState 把服务端时间戳序列化传下来。② **随机 ID**：`Math.random()` 或 `crypto.randomUUID()` → 每次渲染不同。修：用 index 或数据 id 做 track。③ **浏览器独有 API**：`@if ('IntersectionObserver' in window)` → 服务端不存在。修：包 `@if (isBrowser())` 或用 afterNextRender。

### 3. (C) Angular TransferState 与 Next.js 的 `__NEXT_DATA__` / React Server Components 的数据传递有什么异同？

**来源**：转述自本关 §四 TransferState + §九对照框架表

相同：都是把服务端预取数据序列化到 HTML 里 → 客户端读取 → 防止 hydration 后重复请求。差异：① TransferState 是 **opt-in**（手动 set/get）；__NEXT_DATA__ 是自动（getServerSideProps 的返回值自动序列化）；② RSC 更进一步——组件本身只在服务端渲染不下发 JS → 连客户端渲染逻辑都省了；Angular 仍是完整组件在两端运行。③ TransferState 按 key 粒度存储，可选择性使用。

### 4. (D) 面试官让你给一个 Angular 电商站设计完整的 SSR 方案：首页 prerender + 商品详情 SSR + 购物车纯 CSR。

**来源**：转述自本关 §六 prerender + §二 hydration + §三 @defer

架构：① 首页无动态 param → `prerender: { discoverRoutes: true }` 构建时生成 HTML；② 商品详情 `/products/:id` → SSR 运行时渲染 + productResolver 预取 → TransferState 缓存；③ 购物车是用户私有状态 → `@defer (on viewport)` 或纯客户端（`@if (isBrowser())` 包裹）→ SSR 只输出 placeholder。配置：`provideClientHydration(withEventReplay())` + `withFetch()`。加分：讨论 CDN 层对 prerender 页面的缓存策略。

### 5. (A) 解释 provideServerRendering() 在 DI 层做了什么——为什么 signal store 在 SSR 下不泄漏？

**来源**：转述自本关 §五 SSR DI 每请求隔离段

`provideServerRendering()` 注册 Angular SSR 引擎——每个 HTTP 请求到来时创建**全新的 root EnvironmentInjector**（包含 app.config.providers 的一份新实例）。`providedIn: 'root'` 的 service 是 per-injector 单例 → 每请求新 injector = 每请求新 service 实例。因此 signal store 的状态不跨请求——A 用户写入的值 B 用户看不到。

### 6. (B) @defer 块在 SSR 时不渲染内容——SEO 怎么办？给两种策略。

**来源**：转述自本关 §三 @defer 与 SSR 的配合

① **首屏关键内容不放 @defer**：只把非首屏（如评论、推荐位）延迟——核心产品描述/标题始终 SSR 输出；② **@defer (on idle) + prerender**：SSR 模式下 @defer 块可配置为服务端也渲染（`prefetch on idle` → 在 hydration 后立即加载）。如果纯 SEO 需要该块内容，改为不用 @defer 直接渲染——SEO 页面 TTFB 优先级高于 JS 体积。

### 7. (C) Angular SSR 的 server.ts 可以用 Express 也可以用 Nest——两种选型有什么差异？

**来源**：转述自本关 §一 ng add @angular/ssr 段

`ng add @angular/ssr` 默认生成 Express 服务器（轻量、够用）。选型差异：① Express：简单中间件链、适合纯 SSR 渲染服务；② Nest：模块化 DI、可与前端共享 DTO/Interceptor、适合 BFF (Backend For Frontend) 模式。两者都用 Angular SSR 引擎做渲染——server 只是 hosting 层。大团队已有 Nest 后端 → 复用 Nest 做 BFF；小项目 → Express 足够。

### 8. (D) 实现一个 SSR 下的 auth 守卫：未登录时服务端直接 302 到 /login 而不是等客户端 hydration 后跳转。

**来源**：转述自本关 §五 DI 隔离 + §二 hydration + L6 路由守卫

Angular v18+ 的 SSR 守卫：`CanMatchFn` 返回 `boolean | UrlTree`——SSR 时 Router 执行守卫 → 返回 UrlTree → `CommonEngine` 检测 redirect → 发 HTTP 302。需要注入 cookie 里的 token（SSR 不能读 localStorage）。配置：`REQUEST_COOKIE` 提供器（v18+）在守卫里 inject。关键：authGuard 在**服务端导航时执行** → 302 发生在 HTTP 层 → 客户端永远不收到未授权的 HTML。

### 9. (A) withFetch() 在 provideClientHydration 里做什么？它对 HttpClient 在 SSR 端的行为有什么影响？

**来源**：转述自本关 §二 withFetch 段

`withFetch()` 启用基于 fetch API 的**响应缓存**：SSR 端 HttpClient 使用 fetch → 响应自动缓存到 TransferState 层 → 客户端 hydration 读取缓存。配合 `provideHttpClient(withFetch())`（HTTP 层也走 fetch）→ 同一请求 key 只发一次。效果：消除「服务端发一遍 + 客户端 hydration 后又发一遍」的经典双请求。

### 10. (B) 同事在 service 构造函数里 `this._data.set(await fetch(...))` 报 "Cannot access 'document' before definition"——实际是 SSR 下哪里出了问题？

**来源**：转述自本关 §七平台判断 + §十常见陷阱

错误信息指向 document 说明 service 在 SSR 端被实例化并访问了浏览器 API。`providedIn:'root'` 的 service 在 injector 创建时就会执行构造函数（如果有其他 provider 依赖它）。根因：service 构造函数里不能做异步 I/O 或直接操作 DOM。修法：① 数据加载移到 Resolver 或组件的 afterNextRender；② 如果有 DOM 访问用 `if (isPlatformBrowser(inject(PLATFORM_ID)))` 包裹。

### 11. (D) 设计一个「ISR（Incremental Static Regeneration）」方案：Angular prerender + CDN + 定时刷新。

**来源**：转述自本关 §六 prerender + 业界 ISR 概念

Angular 原生不内置 ISR（不像 Next.js 的 revalidate）。方案：① 构建时 prerender 所有静态路由；② 部署到 CDN（Cloudflare/Vercel）设 cache-control max-age；③ 后端 webhook 触发重新构建对应页面（调用 CI pipeline 只 build 变更路由）；④ 或用 Angular SSR 运行时 + 内存缓存（Redis）：首次请求 SSR → 存 Redis → 后续命中 Redis → TTL 过期后重新 SSR。加分：对比 Next.js ISR 的 revalidate 语义。

### 12. (A) 解释 Angular SSR 的编译流程：同一份组件代码如何在两端都运行？

**来源**：转述自本关 §一+§二与 Angular 编译模型

Angular 使用 **同构编译**：组件模板编译成 JS 代码 → 该 JS 既能在浏览器运行（DOM API）也能在 Node 运行（Domino 模拟 DOM / v18+ 纯 string 渲染）。构建产出：`main.js`（浏览器 bundle）+ `main.server.ts`（服务端 entry → 编译出 server bundle）。服务端：Node 执行 Angular SSR 引擎 → 调用组件渲染函数 → 输出 HTML string；客户端：同样的组件 → hydration → 绑定 DOM。

### 13. (C) Angular SSR 相比 Nuxt 3 的 SSR 在「开发体验」上有什么主要差异？

**来源**：转述自本关 §一+§九对照框架

- **Nuxt 3**：`npm run dev` 直接起 SSR 开发服务器（Vite + Nitro）、HMR 天然支持服务端组件热更新——零配置。
- **Angular**：`ng serve` 是 CSR dev server；SSR 需要 `ng run app:serve-ssr`（v17+ 简化了）——HMR 对 SSR 部分仍有延迟。Nuxt 部署用 Nitro adapter 一行配置；Angular 需要写 server.ts（Express/Nest）。结论：Nuxt SSR 体验更开箱即用；Angular 更灵活但多一层配置。

### 14. (B) 如何验证 SSR 真的在工作？给出三个检查手段。

**来源**：转述自本关 §六+§十实战排查

① **View Source**：浏览器右键「查看网页源代码」（非 Inspect）→ 应看到完整 HTML 内容而非 `<app-root></app-root>` 空壳。② **Network 面板**：刷新页面 → 初始 HTML document 响应里应包含产品标题/描述文字（不是 JS 执行后才有的 DOM）。③ **禁用 JS**：Chrome DevTools → Settings → 禁用 JavaScript → 刷新 → 仍能看到页面内容 = SSR 生效。

### 15. (D) 面试官问「你的 Angular SSR 应用 Core Web Vitals 指标如何优化？LCP/CLS/INP 分别从 SSR 角度给策略」。

**来源**：转述自本关 §三+§二+§八综合

- **LCP**（最大内容绘制）：SSR 直出首屏 HTML → LCP 元素（hero 图/标题）在 HTML 里 → 用 TransferState 预取 → 无 JS 等待。图片加 `<link rel="preload">`。
- **CLS**（累积布局偏移）：增量 hydration 不销毁 DOM → 无布局跳动；@defer placeholder 给固定尺寸避免内容到达后推挤。
- **INP**（交互到下次绘制）：`withEventReplay()` 保证 hydration 期间的交互不丢失；zoneless + signal 减少变更检测开销 → 交互响应更快。
