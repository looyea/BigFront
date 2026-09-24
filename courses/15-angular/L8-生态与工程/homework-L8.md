# homework-L8：生态与工程

> 五段式 · 建议用时 90 min · 覆盖 ng-ssr / ng-testing / ng-lib-ui

---

## 第一段：Bug 修复（每题 3 分，共 30 分）

**1.1** SSR 部署后 hydration mismatch 警告 `Date.now()` 不匹配 → 用什么机制把服务端时间传下来？

**1.2** SSR 环境 service 里 `localStorage.getItem('token')` 抛 ReferenceError → 加什么守卫？

**1.3** `provideClientHydration()` 未配置时 SSR 输出被客户端完全替换 → 闪烁。修：一行。

**1.4** @defer 块里放了 SEO 关键的产品描述 → Google 爬虫看不到首屏。怎么改？

**1.5** TestBed 里 signal input 用 `fixture.componentInstance.name = 'A'` → 模板不更新。修正写法。

**1.6** HttpClient 测试忘调 `httpMock.verify()` → 漏了一个未被 expectOne 的请求 → 生产中该请求失败。加一行修复。

**1.7** zoneless 项目测试里 `fixture.detectChanges()` 后断言 DOM → 值不对。为什么？需要怎么做？

**1.8** standalone 组件模板里用 `<mat-toolbar>` 报 "is not a known element" → 补什么？

**1.9** 使用 ::ng-deep 覆盖子组件 `.mat-dialog-container` padding → v22 升级后失效。替代方案？

**1.10** prerender 构建报错：动态路由 `/blog/:slug` 无法发现。怎么修？

---

## 第二段：手写代码（每题 7 分，共 35 分）

**2.1** 写一个 `ThemeStore` 的 SSR 安全实现：从 cookie 读初始值（非 localStorage）、signal + effect 持久化、provideServerRendering 兼容。

**2.2** 写一个 TransferState 版 Resolver：服务端 GET /api/posts → 存 TransferState → 客户端复用不重发。

**2.3** 为 `CounterStore`（signal store）写完整 Vitest 单测：increment / decrement / computed double / reset。

**2.4** 写一个 standalone 组件测试：`UserCardComponent` 有 `user = input<User>()` → 用 `setInput` + `detectChanges` 断言 DOM。

**2.5** 写一个 HttpClient 单测：UserService 的 `deleteUser(id)` → expect DELETE /api/users/1 → flush ok → 断言 Observable complete。

**2.6** 用 CDK Overlay 写一个自定义 tooltip 指令的核心代码（mouse 时 show / mouseleave 时 hide）。

**2.7** 配置 angular.json 的 prerender + SSR 选项：discoverRoutes true + 指定 routesFile 额外动态路由。

---

## 第三段：场景设计（20 分）

**设计题**：为公司营销站设计 Angular SSR + 测试 + UI 方案。

需求：
- 博客（200篇文章）+ 产品页 + 联系表单
- SEO 要求所有页面静态可爬
- 首屏 LCP < 2s
- 使用自定义设计系统（非 Material）但需 a11y
- CI 跑单元测试 + 5 条 E2E 主流程

请给出：SSR 策略（prerender vs 运行时 SSR 选哪种）+ TransferState + @defer 布局 + CDK 自建 UI 选型理由 + 测试金字塔分配 + CI 命令。

---

## 第四段：简答（每题 5 分，共 15 分）

**4.1** 增量 hydration 与旧版 destroy-and-recreate 的核心差异是什么？withEventReplay 解决什么？

**4.2** 为什么 Angular SSR 天然不存在模块单例债（跨请求泄漏）而 Express + Zustand 存在？

**4.3** CDK 相比直接用 Material 全量组件有什么优劣？什么场景选 CDK 自建？

---

## 第五段：挑战题 🏆（10 分，加分项）

**挑战**：设计一个「Angular SSR + ISR」方案——构建时 prerender 已知页面 + 运行时 SSR 动态页面 + Redis 缓存 30min + CDN 3层缓存策略。给出 server.ts 架构草图、缓存命中/失效流程、以及 Angular TransferState 与 Redis 的交互方式。
