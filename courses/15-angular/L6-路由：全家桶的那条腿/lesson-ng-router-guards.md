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
// 目的：函数式登录守卫（v15+）——守卫就是一个函数，内部自由 inject
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { inject } from '@angular/core';

// 登录守卫
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);   // 守卫跑在注入上下文，inject 合法
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;  // 放行
  }
  // 未登录 → 跳登录页，带 returnUrl
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });   // 返 UrlTree = 重定向
};

// 在路由配置中使用
{ path: 'admin', canActivate: [authGuard], loadComponent: () => ... }   // 挂到 canActivate 数组
// ✅ 返 true 放行 / 返 UrlTree 重定向 / 返 false 硬拒，三态清晰
// ❌ 在守卫里 inject 组件私有 provider（非 root）→守卫在 root injector 执行→NullInjectorError
```

旧 class 守卫写法（已不推荐）：
```ts
// 目的：旧 class 守卫（已不推荐）——仅供读存量代码识别
@Injectable()
class AuthGuard implements CanActivate {           // 要 @Injectable + implements 接口
  constructor(private auth: AuthService, private router: Router) {}   // constructor DI
  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree { ... }
}
// 使用：canActivate: [AuthGuard]
// ❌ 新工程仍写 class 守卫→额外样板（@Injectable + 需注册），函数式守卫全都免
```

函数式优势：无需 `@Injectable` + 不需在 providers 注册 + inject 上下文天然可用 + 更简洁。

## 三、CanMatch 与懒加载保护

CanMatch 的核心价值：**在加载组件 JS 之前就拒绝**——省带宽：

```ts
// 目的：CanMatch——在加载组件 JS 之前就拒绝，省带宽
export const adminMatchGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  return auth.hasRole('admin');  // false → Router 跳过该路由（不下载 chunk）
};

{ path: 'admin', canMatch: [adminMatchGuard], loadChildren: () => import('./admin/routes').then(m => m.ADMIN_ROUTES) }   // canMatch 拦在懒加载前
// ✅ canMatch 为 false 直接跳过该路由去试下一条，admin 模块 JS 根本不下载
// ❌ 用 canActivate 拦懒加载路由→chunk 已下载才被拒，白费带宽（该用 canMatch）
```

非管理员 → 整个 admin 模块 JS 根本不下载。

## 四、CanDeactivate：离开确认

典型场景：表单编辑未保存，弹出「确认离开？」。CanDeactivate 接收**当前组件实例**：

```ts
// 目的：CanDeactivate——离开当前组件时的未保存确认
export const unsavedChangesGuard: CanDeactivateFn<EditComponent> = (component) => {   // 泛型约束→拿到正确组件类型
  if (component.hasUnsavedChanges()) {
    return confirm('有未保存的更改，确定离开吗？');   // true=离开 / false=留原地
  }
  return true;
};

{ path: 'edit/:id', component: EditComponent, canDeactivate: [unsavedChangesGuard] }   // 挂 canDeactivate
// ✅ 守卫直接收当前组件实例，问一句决定去留
// ❌ 在 CanDeactivate 里做重逻辑/订阅→组件正销毁时调用，易出错；只返 boolean/UrlTree
```

注意：CanDeactivate 的泛型约束确保你拿到正确组件类型。

## 五、异步守卫：返回 Observable / Promise

守卫可以返回 `boolean | UrlTree | Observable<boolean | UrlTree> | Promise<boolean | UrlTree>`：

```ts
// 目的：异步守卫——返 Promise/Observable，Router 等结果再导航
export async function paymentGuard(): Promise<boolean | UrlTree> {   // async 函数式守卫
  const vipService = inject(VipService);
  const router = inject(Router);
  const isPaid = await vipService.checkPaymentStatus();   // await 异步判定
  return isPaid || router.createUrlTree(['/pricing']);    // 未付费→跳定价页
}

// RxJS 风格
export const tokenRefreshGuard: CanActivateFn = () => {
  const http = inject(HttpClient);
  return http.get('/api/check-session').pipe(
    map(r => r.valid),            // 映射成 boolean
    catchError(() => of(false)),  // 网络错→当未登录拒绝，不让流断
  );
};
// ✅ Router 会等 Observable complete / Promise resolve 才继续导航
// ❌ Observable 守卫不 catchError→接口报错时流断裂→导航永久卡 pending
```

Router 会等 Observable complete / Promise resolve 后才继续导航。

## 六、守卫链：多个守卫按序执行

一个路由可挂多个守卫——按数组顺序执行，任一返回 false/UrlTree 即短路：

```ts
// 目的：守卫链——一个路由挂多个守卫，按数组序执行、任一短路
{
  path: 'reports',
  canActivate: [authGuard, roleGuard('viewer')],           // 先验登录、再验角色
  canMatch: [featureFlagGuard('reports-module')],         // 最先跑：特性开关未开就不加载
}
// ✅ featureFlag(CanMatch)→懒加载→authGuard→roleGuard 按序，任一 false/UrlTree 即短路
// ❌ 把 roleGuard 排在 authGuard 前→未登录时 roleGuard 读 user 为 null→报错；应先 auth 再 role
```

执行序：featureFlagGuard(CanMatch) → 懒加载 → authGuard → roleGuard('viewer') → Resolve。

## 七、实战：Angular 版 sig-auth 登录态 + 守卫 + 登出清场

需求（来自 14 包 sig-auth）：
1. 未登录 → 跳 /login?returnUrl=原路径
2. 登录后跳回 returnUrl
3. 登出 → 清 Token + 跳登录页
4. admin 路由非管理员不能看

```ts
// 目的：实战——signal 登录态 + UrlTree 回跳 + 登出清场（zoneless 仍工作）
// auth.service.ts
@Injectable({ providedIn: 'root' })   // root 单例：全应用共享同一登录态
export class AuthService {
  private _user = signal<User | null>(loadFromStorage());    // 从本地存储恢复会话
  readonly user = this._user.asReadonly();                    // 对外只读
  readonly isLoggedIn = computed(() => this._user() !== null);  // 派生登录布尔

  login(email: string, pw: string) { /* HTTP → set token → _user.set(...) */ }
  logout() { this._user.set(null); localStorage.removeItem('token'); }   // 清场：置 null + 删 token
  hasRole(role: string) { return this._user()?.roles?.includes(role); }   // 可选链防未登录
}

// auth.guards.ts
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });   // 未登录带 returnUrl
};

export const adminGuard: CanMatchFn = () => inject(AuthService).hasRole('admin');   // 非管理员不加载 admin 模块

// login.component.ts 里登录成功后：
this.router.decode(this.route.snapshot.queryParams['returnUrl'] || '/');   // 登录后跳回原页，无则回首页
// ✅ 用 providedIn:'root' 单例存登录态，登出 _user.set(null)→isLoggedIn 变 false→下次导航自然被拦
// ❌ 把登录态存进组件级 provider→多实例不同步/登出后旧实例残留→应 root 单例
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
