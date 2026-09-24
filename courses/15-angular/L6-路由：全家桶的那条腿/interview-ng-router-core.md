# ng-router-core 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕 Routes 配置树、RouterOutlet 渲染链、懒加载分包策略、重定向与通配的题组。

### 1. (A) 描述 Angular Router 从 URL 变化到组件渲染的完整流程（从 Navigation 事件触发到 ActivationEnd）。

**来源**：转述自本关 §七路由生命周期与激活检测段

流程六步：① URL 序列化 → Router 解析 URL 为 UrlTree；② 匹配 Routes 数组（按序尝试，pathMatch 决定 full/prefix）；③ 守卫链：CanDeactivate(旧) → CanMatch(新) → 触发 loadComponent/loadChildren 异步加载 → CanActivate(新) → Resolve 预取；④ 所有检查通过后激活组件——按 outlet 层级从外到内创建；⑤ 发射 NavigationEnd 事件 → 更新浏览器 URL；⑥ ActivationEnd / ChildActivationEnd 通知 ActivatedRoute 就绪。加分：说明每个阶段可通过 inject(Router) 订阅 Events 观察。

### 2. (B) 同事配了 `{ path: '', redirectTo: 'home' }` 结果浏览器报 "Maximum call stack size exceeded"——为什么？怎么修？

**来源**：转述自本关 §八常见陷阱第 1 点

原因：空路径 '' + 默认 pathMatch='prefix' → 匹配所有 URL（空前缀匹配一切）→ 重定向到 /home → /home 又匹配到 '' 路由（再次前缀匹配）→ 无限递归。修法：加 `pathMatch: 'full'`——只在 URL 恰好是根路径时才匹配：`{ path: '', pathMatch: 'full', redirectTo: 'home' }`。面试考点：理解 prefix/full 对空路径的影响差异。

### 3. (C) 对比 Angular loadChildren 与 Next.js App Router 的 code splitting 机制：谁更自动化？各自的优劣？

**来源**：转述自本关 §三懒加载与对照其他框架表

Next.js：文件系统即路由——app/dashboard/page.tsx 自动成为独立 chunk，开发者无需配置——**约定优于配置**，零心智负担。Angular：Routes 数组与文件系统解耦——必须显式写 `loadChildren`/`loadComponent` 动态 import——**灵活但易忘**。优势对比：Angular 一个组件可被多条路由复用不重复打包；Next 文件即路由粒度天然；Angular 支持运行时条件懒加载（guard 内再 import）更灵活。劣势：Angular 团队新人常忘配 loadChildren → 主包膨胀。

### 4. (D) 设计一个三层嵌套后台布局：顶层 Layout → 中层模块 Tab → 底层详情页——给出 Routes 配置和 RouterOutlet 分布。

**来源**：转述自本关 §二嵌套路由与 §三懒加载的综合应用

```ts
// 顶层
const routes: Routes = [
  { path: '', component: AdminLayoutComponent, children: [
    { path: 'users', loadChildren: () => import('./users/users.routes').then(m => m.USERS_ROUTES) },
    { path: 'orders', loadChildren: () => import('./orders/orders.routes').then(m => m.ORDERS_ROUTES) },
  ]},
];
// users.routes.ts
export const USERS_ROUTES: Routes = [
  { path: '', component: UserTabLayoutComponent, children: [
    { path: '', component: UserListComponent },
    { path: ':id', loadComponent: () => import('./user-detail.component').then(m => m.UserDetailComponent) },
  ]},
];
```
模板分布：AdminLayout 里有 `<router-outlet>` → UserTabLayout 里有 `<router-outlet>` + Tab 导航 → UserDetail 渲染在最内层 outlet。

### 5. (A) routerLinkActive 默认是前缀匹配——给出一种场景使前缀匹配不符合需求，以及修法。

**来源**：转述自本关 §四 routerLinkActive 段

场景：顶部导航『首页 routerLink="/dashboard"』和『报表 routerLink="/dashboard/reports"』——当前缀匹配时访问 /dashboard/reports 两个链接同时亮 active。修法：给『首页』加 `[routerLinkActiveOptions]="{ exact: true }"`——只有 URL 完全等于 /dashboard 才高亮。加分：讨论 Angular Material 的 nav 组件如何与 routerLinkActive 配合的常见 CSS 选择器。

### 6. (B) 项目懒加载路由访问时白屏且控制台无报错——列举三种可能原因和排查方法。

**来源**：转述自本关 §三 loadComponent/loadChildren 与 §八常见陷阱

① **import 路径错误/导出名拼错**：`then(m => m.USERS_ROUTE)` 少了 S → 返回 undefined → Router 静默失败。排查：改为 `.then(m => { console.log(m); return m.USERS_ROUTES })` 检查模块导出。② **目标组件有编译错误未暴露**：AOT 构建成功但运行时模板错误。排查：Network 面板检查 chunk 是否 200 返回+evaluate 有无红字。③ **父组件忘写 `<router-outlet>`**：子路由匹配但无处渲染。排查：搜索父组件模板确认 outlet 存在。

### 7. (C) Angular 的 Routes 数组配置与 Vue Router 的 routes 数组有什么结构差异？各家的嵌套表达法？

**来源**：转述自本关 §二 Routes 配置树与对照其他框架

两家极相似（都是数组树 + children）——差异在：① Vue 的 component 字段默认同步 import，懒加载写 `component: () => import(...)` 一个字段搞定；Angular 区分 component / loadComponent / loadChildren 三个字段；② Vue 的通配是 `/:catchAll(.*)` 或 `*`（v4 path 选项）；Angular 是 `**`；③ Vue 的嵌套出口是 `<router-view>` 标签；Angular 是 `<router-outlet>`；④ Angular 有 named outlets（auxiliary routes）——Vue/Next 无原生等价。

### 8. (D) 面试官给一张 PRD：后台有 5 大模块（用户、订单、商品、报表、设置），要求首屏最快、模块隔离——设计路由懒加载策略和 chunk 粒度。

**来源**：转述自本关 §三懒加载分包原理与 §六全局配置

策略：每个模块 loadChildren 独立 chunk → 主包仅含 Layout + 登录 → 5 个模块各自一个懒加载 chunk → 模块内部详情/编辑页再嵌套 loadComponent 做二级 split（高频访问的不拆、低频详情页拆）。收益：首屏 < 200KB；用户只下载访问过的模块。加分：提到 angular.json budgets 可设 initial 和 anyComponentStyle 两个维度门禁防止主包膨胀。

### 9. (A) 解释 pathMatch: 'full' 与 'prefix' 的匹配规则，给出一个需要 prefix 的合理场景。

**来源**：转述自本关 §二匹配规则段

- **full**：URL 的**整段剩余路径**必须完全等于路由 path（常用于空路径重定向、精确匹配页）。
- **prefix**（默认）：只要 URL 剩余路径**以**路由 path 开头就命中（常用于有 children 的父路由——父只需前缀命中，子负责后续段）。

需要 prefix 的场景：`{ path: 'users', component: UserLayout, children: [...] }` —— 父路由 'users' 用 prefix 才能匹配 /users/123/edit 让子路由继续解析剩余段。

### 10. (B) 同事写了 `{ path: 'old', redirectTo: 'new' }` 不带 pathMatch，发现 /old/extra 也被重定向到 /new 丢失了 extra 段——怎么让重定向保留剩余路径段？

**来源**：转述自本关 §五重定向与 §八常见陷阱

Angular 的 redirectTo 是**绝对重定向**——不自动保留剩余段。要保留子路径需要用 URL 重写中间件或 Router 事件钩子：`router.events.pipe(filter(e => e instanceof NavigationStart))` 里手动改 URL。更简洁的替代：用 `UrlSerializer` 自定义 或 SSR 层 rewrite。在纯路由配置里可以用正则路径匹配器（v14+ `pathMatch` 自定义 UrlMatcher）实现「捕获剩余段拼接到目标」。面试考点：知道 redirectTo 不保留子段这个限制。

### 11. (C) Angular Router 的 withComponentInputBinding() 做了什么？它和传统的 ActivatedRoute.params 读取有什么本质区别？

**来源**：转述自本关 §二激活路由 + 预告 ng-router-data

`withComponentInputBinding()` 开启后，路由的 params / data / resolve 值**自动映射到激活组件的同名 input()** ——组件不需要 inject(ActivatedRoute) 也不需要订阅。对比：传统 `route.params.pipe(map(p => p['id']))` 需要显式订阅 + 手动取值；开启后组件直接 `id = input<string>()` 即可接收。本质区别：**路由参数从 push 订阅模型变为 pull 声明模型**。加分：这是 Angular 向 React Router loader / Next.js props 靠拢的设计。

### 12. (D) 设计一个带 Tab 切换的二级路由：/articles 页面内有「全部 / 已发布 / 草稿」三个 Tab——用子路由实现 Tab 状态持久化在 URL 中。

**来源**：转述自本关 §二嵌套路由 + §四 routerLinkActive

```ts
{ path: 'articles', component: ArticleLayoutComponent, children: [
  { path: '', pathMatch: 'full', redirectTo: 'all' },
  { path: 'all', component: ArticleListComponent, data: { status: null } },
  { path: 'published', component: ArticleListComponent, data: { status: 'published' } },
  { path: 'draft', component: ArticleListComponent, data: { status: 'draft' } },
]}
```
模板：Tab 用 `<a routerLink="published" routerLinkActive="tab-active">已发布</a>`。组件内：`status = inject(ActivatedRoute).snapshot.data['status']`。收益：刷新保持 Tab、可分享链接、浏览器前进后退可用。

### 13. (B) 如何在路由切换时实现「页面滚动到顶部」？如果有锚点 #section 则滚到锚点——一行配置搞定。

**来源**：转述自本关 §六 withRouterConfig 段 + 预告 ng-router-data

```ts
provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }))
```
scrollPositionRestoration: 'top' → 每次导航滚到顶部；anchorScrolling: 'enabled' → URL 有 fragment 时滚到对应 id 元素。两者可组合——有 #fragment 滚到锚点、无则回顶。面试考点：知道 Router 内置了滚动策略不需要额外写 window.scrollTo。

### 14. (A) 解释 Angular Router 的 CanMatch 守卫为什么存在？它与 CanActivate 的执行时机差异解决了什么场景？

**来源**：转述自本关 §七生命周期段 + 预告 ng-router-guards

CanMatch 在**懒加载之前**执行——返回 false 时 Router 跳过该路由继续匹配数组中下一条。CanActivate 在**组件加载完成后**执行。场景：权限系统里 Admin 路由只有管理员能匹配——用 CanMatch 可避免加载 Admin chunk 浪费带宽（false → 根本不下 JS）；如果用 CanActivate，chunk 已下载完再拒绝。一句话：CanMatch 是性能+安全的第一道门。

### 15. (D) 面试官问：Angular 有没有类似 Next.js 的 parallel routes（一个页面多个 outlet）？给出 Angular auxiliary route 的语法和使用场景。

**来源**：转述自本关 §二 RouterOutlet 命名机制

有。`<router-outlet name="sidebar">` 定义命名 outlet；导航用 `[{ outlets: { primary: 'dashboard', sidebar: ['chats'] } }]`。URL 表达：`/dashboard(sidernel:chats)`。场景：IM 应用的聊天列表固定在侧边栏 outlet、消息详情在主 outlet；弹窗表单用 aux route 控制。加分：指出 aux route 是 Angular 独有能力，Next.js/Vue Router 目前无等价——需手动 state 管理。
