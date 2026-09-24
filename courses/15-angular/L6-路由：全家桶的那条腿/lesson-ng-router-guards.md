# ng-router-guards：函数式守卫与登录态——CanMatch/CanActivate 实战

> 目标：FunctionalGuard（CanMatchFn/CanActivateFn/CanDeactivateFn）与旧类守卫差异；注入 service 判断登录态、返回 boolean|UrlTree 的跳转语义；守卫可返回 Observable/Promise 的异步判断与 RxJS 收敛；把 14 包 sig-auth 的「登录态+守卫+登出清场」需求在此用 Angular 实现一遍（呼应 sig-auth、mp-login）

## 一、守卫类型总览

| 守卫 | 接口 | 时机 | 返回值含义 |
|------|------|------|-----------|
| **CanMatchFn** | 是否匹配此路由 | 懒加载**前** | true=匹配 / false=跳过该路由试下一条 |
| **CanActivateFn** | 是否允许进入 | 懒加载**后**、Resolve 前 | true=放行 / UrlTree=重定向 / false=拒绝 |
| **CanActivateChildFn** | 批量控制子路由 | 父路由 CanActivate 后 | 同 CanActivate |
| **CanDeactivateFn** | 是否允许离开 | 导航离开当前组件时 | true=离开 / false=留在原地 |

执行顺序：CanDeactivate(旧) → CanMatch(新) → 懒加载 → CanActivate(新) → Resolve → 渲染。

## 二、函数式守卫：取代旧 class 守卫

v15 引入、v16+ 主流——守卫就是一个函数，内部自由 `inject()`：

```ts
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { inject } from '@angular/core';

// 登录守卫
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;  // 放行
  }
  // 未登录 → 跳登录页，带 returnUrl
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

// 在路由配置中使用
{ path: 'admin', canActivate: [authGuard], loadComponent: () => ... }
```

旧 class 守卫写法（已不推荐）：
```ts
@Injectable()
class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}
  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree { ... }
}
// 使用：canActivate: [AuthGuard]
```

函数式优势：无需 `@Injectable` + 不需在 providers 注册 + inject 上下文天然可用 + 更简洁。

## 三、CanMatch 与懒加载保护

CanMatch 的核心价值：**在加载组件 JS 之前就拒绝**——省带宽：

```ts
export const adminMatchGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  return auth.hasRole('admin');  // false → Router 跳过该路由（不下载 chunk）
};

{ path: 'admin', canMatch: [adminMatchGuard], loadChildren: () => import('./admin/routes').then(m => m.ADMIN_ROUTES) }
```

非管理员 → 整个 admin 模块 JS 根本不下载。

## 四、CanDeactivate：离开确认

典型场景：表单编辑未保存，弹出「确认离开？」。CanDeactivate 接收**当前组件实例**：

```ts
export const unsavedChangesGuard: CanDeactivateFn<EditComponent> = (component) => {
  if (component.hasUnsavedChanges()) {
    return confirm('有未保存的更改，确定离开吗？');
  }
  return true;
};

{ path: 'edit/:id', component: EditComponent, canDeactivate: [unsavedChangesGuard] }
```

注意：CanDeactivate 的泛型约束确保你拿到正确组件类型。

## 五、异步守卫：返回 Observable / Promise

守卫可以返回 `boolean | UrlTree | Observable<boolean | UrlTree> | Promise<boolean | UrlTree>`：

```ts
export async function paymentGuard(): Promise<boolean | UrlTree> {
  const vipService = inject(VipService);
  const router = inject(Router);
  const isPaid = await vipService.checkPaymentStatus();
  return isPaid || router.createUrlTree(['/pricing']);
}

// RxJS 风格
export const tokenRefreshGuard: CanActivateFn = () => {
  const http = inject(HttpClient);
  return http.get('/api/check-session').pipe(
    map(r => r.valid),
    catchError(() => of(false)),
  );
};
```

Router 会等 Observable complete / Promise resolve 后才继续导航。

## 六、守卫链：多个守卫按序执行

一个路由可挂多个守卫——按数组顺序执行，任一返回 false/UrlTree 即短路：

```ts
{
  path: 'reports',
  canActivate: [authGuard, roleGuard('viewer')],
  canMatch: [featureFlagGuard('reports-module')],
}
```

执行序：featureFlagGuard(CanMatch) → 懒加载 → authGuard → roleGuard('viewer') → Resolve。

## 七、实战：Angular 版 sig-auth 登录态 + 守卫 + 登出清场

需求（来自 14 包 sig-auth）：
1. 未登录 → 跳 /login?returnUrl=原路径
2. 登录后跳回 returnUrl
3. 登出 → 清 Token + 跳登录页
4. admin 路由非管理员不能看

```ts
// auth.service.ts
@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user = signal<User | null>(loadFromStorage());
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);

  login(email: string, pw: string) { /* HTTP → set token → _user.set(...) */ }
  logout() { this._user.set(null); localStorage.removeItem('token'); }
  hasRole(role: string) { return this._user()?.roles?.includes(role); }
}

// auth.guards.ts
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const adminGuard: CanMatchFn = () => inject(AuthService).hasRole('admin');

// login.component.ts 里登录成功后：
this.router.decode(this.route.snapshot.queryParams['returnUrl'] || '/');
```

关键点：
- `authGuard` 用 signal 的 computed `isLoggedIn()` → **zoneless 下仍工作**（守卫是导航时一次性调用，不依赖变更检测）
- 登出后 `user.set(null)` → isLoggedIn 变 false → 下次导航自然被拦
- 清场在 logout() 里做（清 token + 清 localStorage）

## 八、withGuard 与路由导出模式（v17.2+）

v17.2 引入 `withNavigationErrorHandler` / `withCallGuardInitialization` 等 provideRouter 特性函数。守卫的最佳实践：集中放在 `shared/guards/` 目录 barrel export——路由文件只 import 不内联。

## 九、常见陷阱

1. **守卫里 subscribe 不清理**：手动 subscribe HTTP → 永远在 → 用 Promise 或 toSignal 代替。
2. **CanMatch 里 inject 了组件级 service**：守卫在 Router 上下文执行（root injector）——inject 组件私有 service 会 NullInjectorError。
3. **忘记 CanActivate 也挡子路由**：只在父路由挂 canActivate → 直接访问子路由 URL 时守卫不触发（因为父 matched 但子独立激活）→ 要 `canActivateChild`。
4. **CanDeactivate 在组件销毁后调用**：不能在这里做重逻辑——只返回 boolean/UrlTree。

## 十、对照其他框架

| 概念 | Angular | Vue Router | Next.js |
|------|---------|-----------|---------|
| 路由守卫 | CanActivate/CanMatch | beforeEach/Per-route guard | middleware.ts |
| 登出清场 | guard + service signal | router.beforeEach + store | middleware redirect |
| 离开确认 | CanDeactivate | onBeforeRouteLeave | 无原生（useEffect cleanup） |
| 权限粒度 | route-level / component-level | route-level | layout-level (middleware) |
