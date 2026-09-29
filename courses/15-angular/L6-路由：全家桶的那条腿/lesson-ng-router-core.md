# ng-router-core：路由核心——嵌套、懒加载与 standalone 化

> 目标：Routes 配置树与 RouterOutlet 渲染链；loadComponent/loadChildren 懒加载分包原理；routerLinkActive、重定向、通配 404；withRouterConfig 默认值与 URL 策略（呼应 kit-routing-basics、next-routing、vue-router-basics）

## 一、provideRouter：standalone 时代的入口

```ts
// 目的：provideRouter——standalone 时代路由入口，替掉 NgModule 的 RouterModule.forRoot
// app.config.ts
import { provideRouter, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },   // 根路径重定向，必带 pathMatch:'full'
  { path: 'home', loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent) },   // 单组件懒加载
  { path: 'users', loadChildren: () => import('./features/users/users.routes').then(m => m.USERS_ROUTES) },   // 整棵子路由懒加载
  { path: '**', component: NotFoundComponent },   // 通配 404 兜底，放末尾
];

providers: [
  provideRouter(routes, withComponentInputBinding(), withRouterConfig({ paramsInheritanceStrategy: 'always' })),   // 组件输入绑定 + params 继承策略
],
// ✅ loadComponent 切单页、loadChildren 切子模块，各自生成独立 chunk
// ❌ { path:'', redirectTo:'/home' } 漏 pathMatch:'full'→空路径前缀匹配一切→无限重定向
```

旧写法：`RouterModule.forRoot(routes)` 在 NgModule 里——standalone 项目用 `provideRouter()` 替代。

## 二、Routes 配置树与 RouterOutlet

核心概念：
- **Routes** 是一棵数组树——每个对象是一个路由节点
- **RouterOutlet** 是渲染插槽——匹配到的组件插入该 DOM 位置
- **嵌套路由**：子路由渲染在父组件模板里的 `<router-outlet>` 中（不是 app 根的那个）

```html
<!-- 目的：嵌套路由——父组件模板里的 <router-outlet> 承载子路由渲染 -->
<nav>侧边栏</nav>
<main>
  <router-outlet />  <!-- 子路由组件渲染到这里 -->
</main>
<!-- ✅ 子路由（Overview/Analytics）都落进父模板这个 outlet，布局只搭一次 -->
<!-- ❌ 父组件模板忘写 <router-outlet>→匹配到了子路由也无处渲染→页面空白 -->
```

```ts
// 目的：children 配置——父 component + 子路由数组组成嵌套树
{
  path: 'dashboard',
  component: MainLayoutComponent,           // 父：提供布局 + <router-outlet>
  children: [
    { path: '', component: OverviewComponent },       // /dashboard（默认子）
    { path: 'analytics', component: AnalyticsComponent }, // /dashboard/analytics
  ],
}
// ✅ 子 path 写相对（'analytics'），Angular 自动拼到父路径下
// ❌ 子 route path 以 / 开头写绝对 '/analytics'→破坏相对拼接→匹配不到
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
// 目的：懒加载子模块——子路由独立文件导出 Routes，主路由 loadChildren 引它
// users.routes.ts
import { Routes } from '@angular/router';
export const USERS_ROUTES: Routes = [
  { path: '', component: UserListComponent },   // /users
  { path: ':id', loadComponent: () => import('./user-detail.component').then(m => m.UserDetailComponent) },   // /users/:id 再懒一层
];

// 在主路由里引用
{ path: 'users', loadChildren: () => import('./features/users/users.routes').then(m => m.USERS_ROUTES) }   // 整棵子树打成独立 chunk
// ✅ 动态 import 命中时 Router 才下载该 chunk、执行、渲染，首屏包更小
// ❌ .then(m => m.USERS_ROUTES) 导出名拼错→拿到 undefined→该路由白屏且无显式报错
```

## 四、routerLink 与导航

```html
<!-- 目的：routerLink——指令式 SPA 导航，不整页刷新、保留应用状态 -->
<a routerLink="/users" routerLinkActive="active-tab">用户管理</a>   <!-- 匹配 /users 时加 active-tab 类 -->

<!-- 带参数 -->
<a [routerLink]="['/users', userId]">详情</a>   <!-- 方括号属性绑定，数组拼成 /users/{id} -->

<!-- 编程式导航 -->
this.router.navigate(['/users', userId], { queryParams: { tab: 'posts' } });   // 拼 ?tab=posts
<!-- ✅ routerLink/[routerLink]/navigate 三选一，均走 SPA 内部导航 -->
<!-- ❌ 用 <a href="/users">→浏览器整页刷新、丢 SPA 内存状态；应改 routerLink -->
```

`routerLinkActive` 在路由匹配时给元素加 class——支持精确/前缀两种模式：
```html
<!-- 目的：routerLinkActive exact——控制高亮是精确还是前缀匹配 -->
<a routerLink="/users" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
<!-- ✅ exact:true→只有 URL 恰为 /users 才高亮，子路由 /users/123 不算 -->
<!-- ❌ 不写 exact→访问 /users/123 时 /users 链接也亮着（前缀匹配），导航高亮错位 -->
```
exact: true → 只有 URL 恰好是 `/users` 才加 class（子路由 `/users/123` 不算）。

## 五、重定向与通配

```ts
// 目的：重定向与通配——旧 URL 兼容 + 404 兜底
const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },  // 根路径重定向（必带 pathMatch:'full'）
  { path: 'old-page', redirectTo: 'new-page', pathMatch: 'full' }, // 旧 URL 兼容
  { path: '**', component: NotFoundComponent },          // 404 兜底（必须放最后）
];
// ✅ redirectTo 是相对路径；** 通配放数组末尾，Router 按序取第一个命中
// ❌ ** 放在数组前面→所有路径都先命中通配→全站 404
```

注意：`redirectTo` 是**相对路径**；`**` 通配必须放数组末尾——Router 按序匹配。

## 六、withRouterConfig：全局默认策略

```ts
// 目的：withRouterConfig——给整棵路由树设全局默认策略
provideRouter(routes,
  withRouterConfig({
    paramsInheritanceStrategy: 'always',  // 子路由继承所有父 params（默认 'emptyOnly'）
    onSameUrlNavigation: 'reload',        // 点击相同 URL 是否重新导航（默认 'ignore'）
    urlUpdateStrategy: 'deferred',        // URL 更新时机（默认 'eager'）
  })
)
// ✅ 'always' 让深层子路由直接 inject(ActivatedRoute).params 拿父级参数，免一路 parent.parent
// ❌ 默认 'emptyOnly' 下期待在子路由直接拿父段 params→拿不到（除非改 always 或手动 parent.params）
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
