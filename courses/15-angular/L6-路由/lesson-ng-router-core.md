# ng-router-core：路由核心——嵌套、懒加载与 standalone 化

> 目标：Routes 配置树与 RouterOutlet 渲染链；loadComponent/loadChildren 懒加载分包原理；routerLinkActive、重定向、通配 404；withRouterConfig 默认值与 URL 策略（呼应 kit-routing-basics、next-routing、vue-router-basics）

## 一、provideRouter：standalone 时代的入口

```ts
// app.config.ts
import { provideRouter, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent) },
  { path: 'users', loadChildren: () => import('./features/users/users.routes').then(m => m.USERS_ROUTES) },
  { path: '**', component: NotFoundComponent },
];

providers: [
  provideRouter(routes, withComponentInputBinding(), withRouterConfig({ paramsInheritanceStrategy: 'always' })),
],
```

旧写法：`RouterModule.forRoot(routes)` 在 NgModule 里——standalone 项目用 `provideRouter()` 替代。

## 二、Routes 配置树与 RouterOutlet

核心概念：
- **Routes** 是一棵数组树——每个对象是一个路由节点
- **RouterOutlet** 是渲染插槽——匹配到的组件插入该 DOM 位置
- **嵌套路由**：子路由渲染在父组件模板里的 `<router-outlet>` 中（不是 app 根的那个）

```html
<!-- layouts/main-layout.component.html -->
<nav>侧边栏</nav>
<main>
  <router-outlet />  <!-- 子路由组件渲染到这里 -->
</main>
```

```ts
{
  path: 'dashboard',
  component: MainLayoutComponent,
  children: [
    { path: '', component: OverviewComponent },       // /dashboard
    { path: 'analytics', component: AnalyticsComponent }, // /dashboard/analytics
  ],
}
```

匹配规则：**先完整匹配 path**（pathMatch: 'full'）→ 再前缀匹配（默认 'prefix'）→ 按数组顺序取第一个命中。

## 三、懒加载：loadComponent 与 loadChildren

| API | 效果 | 产物 |
|-----|------|------|
| `component: X` | 主包包含 X | 一次性加载 |
| `loadComponent: () => import(...)` | X 被打成独立 chunk | 访问该路由时才下载 |
| `loadChildren: () => import(...)` | 整棵子路由树懒加载 | 子路由共享一个 chunk |

原理：`@angular/build`（Vite）或 Webpack 遇到动态 `import()` 做 code splitting——每个懒加载路由生成独立 JS chunk；Router 在导航触发时 `import()` → 网络加载 → 执行 → 渲染组件。

**对照 Next.js / Nuxt**：Next 的 `app/` 目录按文件夹自动分包（路由级 code splitting 是默认行为）；Angular 必须**显式**写 `loadComponent`/`loadChildren`——因为 Angular 的路由配置与文件系统解耦。

```ts
// 懒加载子模块的典型写法
// users.routes.ts
import { Routes } from '@angular/router';
export const USERS_ROUTES: Routes = [
  { path: '', component: UserListComponent },
  { path: ':id', loadComponent: () => import('./user-detail.component').then(m => m.UserDetailComponent) },
];

// 在主路由里引用
{ path: 'users', loadChildren: () => import('./features/users/users.routes').then(m => m.USERS_ROUTES) }
```

## 四、routerLink 与导航

```html
<!-- 替代 <a href> 的指令式链接 -->
<a routerLink="/users" routerLinkActive="active-tab">用户管理</a>

<!-- 带参数 -->
<a [routerLink]="['/users', userId]">详情</a>

<!-- 编程式导航 -->
this.router.navigate(['/users', userId], { queryParams: { tab: 'posts' } });
```

`routerLinkActive` 在路由匹配时给元素加 class——支持精确/前缀两种模式：
```html
<a routerLink="/users" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
```
exact: true → 只有 URL 恰好是 `/users` 才加 class（子路由 `/users/123` 不算）。

## 五、重定向与通配

```ts
const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },  // 根路径重定向
  { path: 'old-page', redirectTo: 'new-page', pathMatch: 'full' }, // 旧 URL 兼容
  { path: '**', component: NotFoundComponent },          // 404 兜底（必须放最后）
];
```

注意：`redirectTo` 是**相对路径**；`**` 通配必须放数组末尾——Router 按序匹配。

## 六、withRouterConfig：全局默认策略

```ts
provideRouter(routes,
  withRouterConfig({
    paramsInheritanceStrategy: 'always',  // 子路由继承所有父 params（默认 'emptyOnly'）
    onSameUrlNavigation: 'reload',        // 点击相同 URL 是否重新导航（默认 'ignore'）
    urlUpdateStrategy: 'deferred',        // URL 更新时机（默认 'eager'）
  })
)
```

- `paramsInheritanceStrategy: 'always'`：在深层子路由可直接 `inject(ActivatedRoute).params` 拿到父级参数——省去一路 `parent.parent` 爬树。
- `onSameUrlNavigation: 'reload'`：让 `router.navigate(当前URL)` 重新触发解析/守卫——用于强制刷新数据。

## 七、路由生命周期与激活检测

导航完成后 Router 按序执行：
1. URL 解析 → 匹配 Routes 树
2. 守卫（CanMatch → 懒加载 → CanActivate → CanDeactivate）
3. Resolve 数据预取
4. 激活组件 → `canActivateChild` → `ActivatedRoute.snapshot` 就绪
5. `ActivationEnd` 事件 → URL 更新 → 渲染

组件可通过 `inject(ActivatedRoute)` 读取：`params`、`queryParams`、`fragment`、`data`、`url`。

## 八、常见陷阱

1. **忘加 pathMatch: 'full'**：`{ path: '', redirectTo: 'home' }` 不加 pathMatch 会导致所有路径都先匹配空路由→无限重定向。
2. **loadChildren 返回路径错误**：`import('./module').then(m => m.ModuleWithRoutes)` 导出名拼错 → 白屏无报错。
3. **嵌套 outlet 未声明**：父组件模板里忘写 `<router-outlet>` → 子路由永远不渲染。
4. **`**` 放在前面**：通配路由放首位 → 所有路由都命中 404。

## 九、对照其他框架

| 能力 | Angular | Vue Router | Next.js (App Router) | SvelteKit |
|------|---------|-----------|---------------------|-----------|
| 配置方式 | Routes 数组 | routes 数组 | 文件系统 `app/` | 文件系统 `routes/` |
| 懒加载 | 显式 loadComponent | 显式 `() => import()` | 自动 per-segment | 自动 per-page |
| 嵌套 | children + outlet | children + `<router-view>` | layout.tsx + children | +layout.svelte |
| 404 | `**` catch-all | `:catchAll(.*)` 或 `*` | `not-found.tsx` | `[[...catchAll]]` |

Angular 路由的"全家桶"体现：重定向、守卫、resolve、title 策略、scrollPosition 全内置——不需要第三方库。
