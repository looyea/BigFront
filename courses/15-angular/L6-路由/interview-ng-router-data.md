# ng-router-data 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕 ResolveFn、withComponentInputBinding、TransferState 与滚动策略的题组。

### 1. (A) 描述 ResolveFn 在 Angular Router 导航流程中的精确位置和执行语义。

**来源**：转述自本关 §二 ResolveFn 段

位置：在 CanActivate 之后、组件激活之前。Router 导航流程：URL 解析 → CanMatch → 懒加载 → CanDeactivate(旧) → CanActivate(新) → **Resolve** → 组件创建/激活 → ActivationEnd。执行语义：Router 调用 ResolveFn(route, state)——若返回 Observable/Promise 则 Router 内部 subscribe/await 直到 complete/resolve——**导航暂停**直到数据到达。resolve 结果写入 ActivatedRoute.snapshot.data[key]——开启 input binding 后自动到同名组件 input。

### 2. (B) 同事的 Resolver 里发 HTTP 请求没 catchError——用户刷新 /users/999（不存在的 ID）页面白屏。怎么修？

**来源**：转述自本关 §二 Resolver 错误处理与 §九常见陷阱

原因：HttpClient 返回 404 → Observable error → Router 导航失败 → 组件不激活 → 页面停留在前一个状态（空白）。修法：
```ts
return http.get<User>(url).pipe(
  catchError(() => { router.navigate(['/404']); return of(null); }),
);
```
或者在全局 `withNavigationErrorHandler` 里统一 catch HttpErrorResponse 跳错误页。面试考点：Resolver 异常默认中断导航而非降级。

### 3. (C) withComponentInputBinding 与 React Router v6.4+ 的 loader 机制有什么核心异同？

**来源**：转述自本关 §一与 §十对照其他框架表

相同点：都在组件渲染前准备好数据——消除 loading 闪烁；都支持 URL params → 组件自动接收。差异：① React Router 的 loader 同时返回数据 + 可 throw redirect（合权限+数据一体）；Angular 分 ResolveFn（数据）+ Guard（权限）职责分离。② React Router 的 useLoaderData hook 读取；Angular 用 input() 声明式绑定。③ Angular 可在 SSR 端执行 Resolver + TransferState 缓存——React Router loader 本身就是 server-only（Remix 模式）。

### 4. (D) 设计「文章详情页 /blog/:slug」的完整数据流：SEO title + 预取文章 + 评论区延迟加载——Angular 全套路由配置。

**来源**：转述自本关 §一/§二/§三的综合应用

```ts
{
  path: 'blog/:slug',
  loadComponent: () => import('./blog-detail.component').then(m => m.BlogDetailComponent),
  resolve: { article: articleResolver },
  title: (route) => route.data?.article?.title ?? '文章',
}

export const articleResolver: ResolveFn<Article> = (route) => {
  const slug = route.paramMap.get('slug')!;
  return inject(HttpClient).get<Article>(`/api/articles/${slug}`);
};

// 组件内评论区延迟
comments = toSignal(
  this.http.get<Comment[]>(`/api/articles/${this.article().id}/comments`),
  { initialValue: [] }
);
```
评论区是组件内 effect 拉数据（非 Resolver）——不阻塞首屏渲染。

### 5. (A) TransferState 的工作原理：从服务端到客户端的数据流是怎样的？

**来源**：转述自本关 §六 TransferState 段

① 服务端渲染时 Resolver 拿到数据 → `transferState.set(KEY, data)` 存入 TransferState 容器；② Angular SSR 引擎渲染完毕，把 TransferState 序列化为 JSON 嵌入 HTML `<script id="ng-state" type="application/json">...</script>`；③ 客户端 bootstrap → 从 DOM 中解析 ng-state 脚本 → 反序列化填充 TransferState；④ 组件/Resolver 先检查 `transferState.hasKey(KEY)` → 有则直接用 → 不发 HTTP。效果：SSR→CSR 只一次网络请求。

### 6. (B) 开启 withComponentInputBinding 后发现组件里声明了名为 `data` 的 input——它接收到了路由的整个 data 对象。这是 bug 吗？

**来源**：转述自本关 §九常见陷阱第 1 点

不是 bug 是设计。路由的 `data: { title: 'xxx' }` 整体作为一个 key 绑定——组件声明 `data = input<any>()` → 收到整个 data 对象。如果你想绑 data 里的某个字段，应该用 Resolver：`resolve: { customData: myResolver }` + `customData = input<T>()`。data 字段是保留名。最佳实践：避免把组件 input 命名为 data。

### 7. (C) Angular 的 title 配置（v15+）与 Next.js 的 `export const metadata` 在能力上有什么异同？

**来源**：转述自本关 §三 title 策略段

相同：都是路由/页面级标题声明；都支持动态值。差异：① Angular 的 `title` 是 Route 配置的字段（string/Observable/函数），全局 TitleStrategy 可统一加后缀——声明位置在路由文件；Next.js 的 metadata 是页面文件导出——声明位置在组件文件。② Angular 需要自定义 TitleStrategy 才能拼 `pageTitle | AppName`；Next.js 用 `title.template` 一行搞定。③ Angular 还有 resolver 里动态设 title 的能力（因为 title 可以是 Observable）。

### 8. (D) 面试官问「怎么实现 Angular 路由切换时页面过渡动画」——从路由数据流角度给出方案。

**来源**：转述自本关 §五 ActivatedRoute 与 RouterOutlet 机制

方案：① 在 RouterOutlet 的 `activate` 事件里拿到新组件实例；② 用 Angular Animations（@trigger）或 CSS transition 做进出场；③ 路由的 `data: { animation: 'fadeIn' }` 标记该页面动画类型。

```ts
// app.component.html
<div [@routeAnimation]="getAnimationData(routerOutlet)">
  <router-outlet #ro="outlet" (activate)="onActivate($event)" />
</div>

getAnimationData(ro: RouterOutlet) { return ro.activatedRouteData?.['animation'] ?? 'none'; }
```
加分：提到 zoneless 下 @defer 的 transition 配合可以做更顺滑的切换。

### 9. (A) scrollPositionRestoration: 'top' 与 'enabled' 的区别分别适用什么场景？

**来源**：转述自本关 §四滚动控制段

- **'top'**：每次导航都滚到顶部——适合 SPA 管理后台（每个页面是独立视图不需要位置记忆）。
- **'enabled'**：模拟浏览器行为——后退恢复位置、前进/新导航滚到顶——适合内容型网站（博客/新闻列表→详情→返回列表恢复滚动位置）。
- **'disabled'**：不自动处理——开发者手动 `window.scrollTo` 或用 ViewportScroller 精确定位。

anchorScrolling: 'enabled' 与上述组合——处理 `#fragment` 锚点跳转。

### 10. (B) 同事用 Resolver 做了异步操作（setTimeout 500ms），发现用户导航时感觉页面「卡了」500ms——怎么优化？

**来源**：转述自本关 §二 Resolver 阻塞语义与导航体验

Resolver 阻塞导航是 by design——Router 等 Resolver 完成才渲染组件。体验优化：① 在 Resolver 开始前用 `router.events` 监听 `NavigationStart` → 显示全局 loading bar（如 ngx-top-loading-bar）；② 把非关键数据从 Resolver 移到组件内 `afterNextRender` 或 effect 里加载（不阻塞首屏）；③ 如果必须等，加 skeleton 占位。核心原则：**Resolver 只放首屏关键数据**，其他都在组件内异步。

### 11. (C) 对比 Angular ActivatedRoute.params（Observable）与 withComponentInputBinding（input）的读取范式：在组件复用场景下各自行为？

**来源**：转述自本关 §一+§五 ActivatedRoute 深度用法段

从 /users/1 → /users/2 组件复用时：
- **params Observable**：持续发射新值——`this.route.params.pipe(map(p => p['id']))` → 订阅者自动收到新 id → 组件需响应式处理。
- **input binding**：input 信号收到新值——如果组件内有依赖该 input 的 computed/effect → 自动重算。
- 区别：params 是 push 模型（推给你）；input 是 pull 模型（你声明了 Router 喂给你）——input binding 省去 subscribe 样板。但 queryParams/fragment 目前不自动绑 input（需手动或自定义策略）。

### 12. (D) 设计一个「多级面包屑」：从路由 data 自动收集路径名生成 breadcrumbs——给出 Resolver + data + service 方案。

**来源**：转述自本关 §三 data 字段 + §一 input binding

```ts
// 路由
{ path: 'products', data: { breadcrumb: '产品管理' }, children: [
  { path: ':id', data: { breadcrumb: null }, resolve: { breadcrumb: productCrumbResolver }, children: [
    { path: 'edit', data: { breadcrumb: '编辑' } }
  ]}
]}

// 组件初始化时从 route.pathFromRoot 收集所有 data.breadcrumb
breadcrumbService.generate(route)  // → ['产品管理', 'iPhone 15', '编辑']
```
加分：说明 data 在父子路由间的继承（paramsInheritanceStrategy）；breadcrumb null + Resolver 动态填充。

### 13. (A) 解释 Route Recognizer（v17+ 实验特性）的定位和普通开发者是否需要关心。

**来源**：转述自本关 §七 Route Recognizer 段

Route Recognizer 是 Angular 内部的编译期/启动期路由分析工具——它把 URL 匹配逻辑抽成可复用模块，供 SSR 引擎和预编译路由检测使用。普通应用开发者不需要手动实现/配置它。未来可能开放给自定义 matcher（如 UUID 校验路径段格式）——目前文档极少，面试点到即可不深入。

### 14. (B) SSR 场景下 Resolver 执行了 HTTP 请求取数据——为什么客户端 hydration 后又发了一遍相同请求？怎么防？

**来源**：转述自本关 §六 TransferState 段

原因：Resolver 服务端执行 → 数据塞进组件 → HTML 输出；但客户端 hydrate 时 Router 重新初始化 → **重新执行 Resolver**（除非配了 TransferState 缓存）。防双请求：① Resolver 里 `transferState.set(KEY, data)`；② 组件或 Resolver 里先检查 `transferState.get(KEY, null)` 有值则返回 of(cached)；③ provideClientHydration(withFetch()) 确保 HTTP 响应序列化。一句话：TransferState 是 Angular 版的 __NEXT_DATA__。

### 15. (D) 面试官让你用 Angular Router 的完整能力（懒加载 + 守卫 + Resolver + input binding + 滚动策略 + title 策略）搭建一个三页面电商前台的骨架——给出 app.config 和路由配置。

**来源**：转述自本关全章 + ng-router-core + ng-router-guards 的综合应用

```ts
const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'products' },
  { path: 'products', title: '全部商品', data: { scroll: 'top' },
    loadComponent: () => import('./pages/products.component').then(m => m.ProductsComponent),
    resolve: { products: productsResolver } },
  { path: 'products/:id', title: (r) => r.data['product']?.name ?? '详情',
    loadComponent: () => import('./pages/detail.component').then(m => m.DetailComponent),
    resolve: { product: productResolver },
    canActivate: [productExistsGuard] },
  { path: 'cart', title: '购物车', canMatch: [cartFeatureGuard],
    loadComponent: () => import('./pages/cart.component').then(m => m.CartComponent) },
  { path: '**', component: NotFoundComponent },
];

provideRouter(routes,
  withComponentInputBinding(),
  withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
  withNavigationErrorHandler(handleNavError),
)
```
组件侧：`product = input<Product>()` 自动收到 Resolver 数据——零样板。
