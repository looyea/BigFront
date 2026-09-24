# homework-L6：路由——全家桶的那条腿

> 五段式 · 建议用时 90 min · 覆盖 ng-router-core / ng-router-guards / ng-router-data

---

## 第一段：Bug 修复（每题 3 分，共 30 分）

找出以下路由配置/代码中的错误并修正。

**1.1** 新项目 app.config.ts 里路由注册：
```ts
providers: [
  importProvidersFrom(RRouterModule.forRoot(routes)),
]
```
→ 修正一行。

**1.2** 懒加载写法报错 "NG8001: ':id' route has no component"：
```ts
{ path: 'users/:id', component: () => import('./user-detail').then(m => m.UserDetailComponent) }
```
→ 修正字段名。

**1.3** 无限重定向错误：
```ts
{ path: '', redirectTo: 'home' },
{ path: 'home', component: HomeComponent },
```
→ 补一个字段。

**1.4** 守卫永远放行：
```ts
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (!auth.isLoggedIn()) {
    inject(Router).navigate(['/login']);
  }
  // 未写 return
};
```
→ 修正返回值。

**1.5** Resolver 导致白屏（HTTP 404 时）：
```ts
export const userResolver: ResolveFn<User> = (route) => {
  return inject(HttpClient).get<User>(`/api/users/${route.paramMap.get('id')}`);
};
```
→ 加错误处理。

**1.6** 子路由不渲染（/dashboard/analytics 白屏）：
```ts
{ path: 'dashboard', component: DashboardComponent, children: [...] }
```
DashboardComponent 模板只有 `<h1>Dashboard</h1>` → 缺什么？

**1.7** `routerLinkActive` 导致两个 tab 同时高亮：
```html
<a routerLink="/users" routerLinkActive="active">用户</a>
<a routerLink="/users/1" routerLinkActive="active">管理员</a>
```
→ 第一个加什么属性？

**1.8** withComponentInputBinding 已开启但 input 始终 undefined：
```ts
id = input<string>('id');  // 路由 /items/:id
```
→ input() 的参数是什么含义？正确写法？

**1.9** SSR 部署后用户反馈打开详情页 API 被调了两次 → 少配了什么？

**1.10** 通配路由 `path: '**'` 不生效 → 路由配置：
```ts
{ path: '**', component: NotFound },
{ path: 'users', loadChildren: ... },
```
→ 问题在哪？

---

## 第二段：手写代码（每题 7 分，共 35 分）

**2.1** 写出 provideRouter 配置：包含首页（''重定向到 home）、懒加载 /products 模块（children 含 list 和 :id 详情）、404 通配。

**2.2** 写出 CanMatchFn 工厂 `roleGuard(roles: string[])`——从路由 data.roles 读所需角色，与 AuthService.user().roles 比对。

**2.3** 写一个 `productResolver: ResolveFn<Product>`：从 route param 取 slug → HttpClient 获取 → catchError 跳 /404。

**2.4** 用 withComponentInputBinding 重写旧写法：
```ts
// 旧：ngOnInit() { this.route.params.pipe(map(p => p['id'])).subscribe(id => this.id = id); }
```
→ 新：组件里只需写哪一行？

**2.5** 配置 withInMemoryScrolling：后退恢复位置 + 锚点滚动。

**2.6** 写一个 CanDeactivateFn 配合 EditComponent（组件有 `isDirty: signal<boolean>()`）——dirty 时弹 confirm。

**2.7** 写出 TransferState 在 Resolver 里缓存数据并在组件中读取的完整代码片段。

---

## 第三段：场景设计（20 分）

**设计题**：为一个在线教育平台设计路由架构。

需求：
- 游客可浏览课程列表/详情（SEO 需要 SSR）
- 已购买用户可播放视频（/course/:id/watch）
- 管理员后台（/admin）整体懒加载 + 角色保护
- 课程详情页有 Tab（简介/目录/评价）用子路由
- 未购买跳 /pricing

要求：给出 Routes 配置树 + 需要哪些守卫 + Resolver + 懒加载边界 + title 策略 + 滚动策略。文字+代码结合说明。

---

## 第四段：简答（每题 5 分，共 15 分）

**4.1** CanMatch 和 CanActivate 分别在什么时机执行？选错会导致什么问题？

**4.2** 解释 withComponentInputBinding 如何改变组件与路由的耦合方式——对比传统 ActivatedRoute 的优劣。

**4.3** Angular Router 的 TransferState 与 Next.js 的 `__NEXT_DATA__` 解决的是同一个问题吗？说清异同。

---

## 第五段：挑战题 🏆（10 分，加分项）

**挑战**：实现一个「路由级面包屑」系统——每条路由的 `data: { breadcrumb: '产品管理' }` 或 Resolver 动态提供文字。写一个 BreadcrumbService，在每次导航完成时从 `ActivatedRoute.pathFromRoot` 收集所有层级的 breadcrumb 生成数组，并在模板 `@for` 渲染。要求：支持动态 breadcrumb（如 /users/:id 显示用户名）。给出核心代码。
