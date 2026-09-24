# ng-router-guards 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕函数式守卫模型、CanMatch/CanActivate/CanDeactivate 体系、登录态管理的题组。

### 1. (A) 画出 Angular Router 完整守卫执行链的顺序图，解释为什么 CanMatch 排在懒加载之前。

**来源**：转述自本关 §一时序总览与 §三 CanMatch 懒加载保护段

顺序：CanDeactivate(旧组件) → CanMatch(新路由) → [懒加载 loadComponent/loadChildren] → CanActivate(新) → CanActivateChild(父) → Resolve → 组件创建。CanMatch 排在懒加载前因为设计意图是「先决定该路由是否可用，可用才值得下载 chunk」——CanMatch=false 时 Router 跳过该项继续尝试其他路由。如果放在加载后才检查，用户会白等一次网络下载。

### 2. (B) 同事把 authGuard 写成 `async function`，但返回了 `undefined` 导致用户绕过登录——为什么？

****来源**：转述自本关 §五异步守卫与 return 语义

async function 必须显式 return——若 if 分支只写了 `this.router.navigate(['/login'])`（命令式导航）而没有 return UrlTree/false，守卫返回 undefined → Router 视其为 truthy → 放行。正确写法：守卫内用 `return router.createUrlTree(['/login'], ...)` 而不是 `router.navigate(...)`——createUrlTree 是纯值创建（不触发导航），由 Router 自行处理跳转。

### 3. (C) 对比 Angular CanActivateFn、Vue Router 的 beforeEnter/全局 beforeEach、Next.js middleware.ts 三种权限控制模型。

**来源**：转述自本关 §十对照其他框架表

- **Angular**：路由级函数式守卫，per-route 配置，运行在客户端 Router 导航流程内。粒度：每条 Route 可挂不同守卫组合。
- **Vue Router**：全局 beforeEach（拦截所有导航）+ per-route beforeEnter + in-component onBeforeRouteLeave——三层洋葱。
- **Next.js middleware**：Edge Runtime 服务端拦截，对**所有请求**统一处理——不能在单页面粒度配置。优势：SEO/爬虫也被拦；劣势：只能检查 cookie（无 localStorage 访问）。
- 一句话：Angular/Vue 是客户端路由内部机制；Next 是服务端 HTTP 层前置拦截。

### 4. (D) 实现 sig-auth 的「登出清场」需求：用户点登出后清除 token、跳转 /login、且已打开的其他 tab 也感知登出——Angular 方案。

**来源**：转述自本关 §七实战 sig-auth 段

方案：① AuthService.logout() 里 `this._user.set(null)` + `localStorage.removeItem('token')`；② 跳登录：`this.router.navigate(['/login'])`；③ 跨 tab 感知：在 root service 的构造函数里 `fromEvent(window, 'storage').subscribe(e => { if (!e.newValue) this._user.set(null) })`——一个 tab 清 localStorage 触发 storage event → 其他 tab signal 变 null → 下次导航 authGuard 拦截。加分：可结合 BroadcastChannel API 更可靠。

### 5. (A) CanDeactivateFn 的泛型参数 `CanDeactivateFn<T>` 里的 T 代表什么？为什么这个守卫需要组件实例？

**来源**：转述自本关 §四 CanDeactivate 段

T 代表当前即将被销毁（导航离开）的组件实例类型。CanDeactivate 的独特签名 `(component: T | null, currentRoute, currentState, targetState, targetRoute?)` 让你能直接读组件的脏状态方法——因为只有组件实例才知道「表单有没有被修改」。其他守卫不需要组件实例（它们在组件创建前/后执行但没有组件引用）。注意：null 的极端情况——组件已意外销毁。

### 6. (B) 用户反馈：在 /edit/1 填了表未保存，点浏览器后退按钮直接走了——CanDeactivate 没拦住。为什么？怎么修？

**来源**：转述自本关 §四 CanDeactivate 与 §九常见陷阱

Angular 的 CanDeactivate **对浏览器后退/前进有效**（因为走的是 Router 导航流程）。但用户可能是点击了页面里的 `<a href="/somewhere">` 硬链接——直接导航不走 Router 也不触发守卫。修法：① 所有站内链接必须用 `routerLink` 而非 `href`；② 加 `@HostListener('window:beforeunload')` 在组件里拦浏览器关闭/刷新。加分：提到 Angular v16+ 的 `canDeactivate` 对 `routerLink` 与编程式 navigate 都有效。

### 7. (C) Angular 的函数式守卫与 React 生态里 `react-router` v6.4+ 的 loader/action 权限模式有什么本质区别？

**来源**：转述自本关 §二守卫模型与 React Router loader 对照

- **Angular**：守卫是「拦截器」——导航发起后、目标组件渲染前问 yes/no；关注的是「能不能进」。
- **React Router loader**：每个 route 声明一个 async loader——loader 里可以 throw redirect 实现「进不去就弹走」；关注的是「加载数据时顺便决定」。
- 本质差异：Angular 守卫与数据获取分离（guard 管权限、resolve 管数据）；React Router 把两者合在 loader 里。Angular 更正交，React 更简洁。

### 8. (D) 设计一个 feature-flag 守卫：路由是否可见由远端配置接口动态决定（管理员关闭后该路由入口消失且不能访问）。

**来源**：转述自本关 §三 CanMatch 的扩展应用 + §六守卫链

```ts
// feature-flag.service.ts
@Injectable({ providedIn: 'root' })
export class FeatureFlagService {
  flags = signal<Record<string, boolean>>({});
  constructor() { /* init from API or WebSocket */ }
  isEnabled(key: string) { return this.flags()[key] ?? false; }
}

export function featureFlagGuard(key: string): CanMatchFn {
  return () => inject(FeatureFlagService).isEnabled(key);
}

// 路由：
{ path: 'beta-dashboard', canMatch: [featureFlagGuard('beta-dashboard')], loadComponent: ... }
```
加分：讨论 feature flag 关闭时是否需要隐藏侧边栏入口——用 `@if (flagService.isEnabled('...'))` 控制模板。

### 9. (A) 守卫的返回值有哪几种合法类型？每种对导航的影响？

**来源**：转述自本关 §二与 §五返回值语义

合法返回：① `true` → 放行继续导航；② `false` → 取消本次导航（留在当前页）；③ `UrlTree` → 取消当前导航 + **立即跳转到 UrlTree**；④ 上述三者的 `Observable`/`Promise` 包裹 → Router 等待 resolve 后按结果执行。CanMatch 额外：false 不是「留在当前页」而是「此路由不匹配、Router 尝试下一条」。

### 10. (B) 写了 `canActivate: [() => inject(AuthService).isLoggedIn]` 结果始终放行——为什么？

**来源**：转述自本关 §二函数式守卫写法细节

`isLoggedIn` 是 signal/computed——**引用不等于调用**。`inject(AuthService).isLoggedIn` 返回的是 signal 函数本身（truthy）而非其值。修法：加括号 `() => inject(AuthService).isLoggedIn()` 或写成独立守卫 `export const authGuard: CanActivateFn = () => inject(AuthService).isLoggedIn();`（zoneless signal 读取不需要括号——但 Angular signal 需要 `()` 调用取值）。一句话：signal 作为函数必须调用。

### 11. (D) 面试官要求实现「角色菜单权限 + 路由守卫 + 导航高亮」三件套：给出 Angular 全链路方案。

**来源**：转述自本关 §七实战与 §三 CanMatch 的组合应用

① `AuthService.roles: Signal<string[]>`；② 路由配置 `canMatch: [roleGuard('editor')]` 保护编辑路由；③ 侧边栏菜单：`@for (item of menuService.visibleItems(); track item.path)` —— menuService 根据 roles 过滤可用菜单项；④ 导航用 `routerLinkActive="active"` 高亮当前路由；⑤ 登出时 roles 清 → 菜单自动缩 + 守卫自动拦。加分：提到 canMatch vs canActivate 的选择——隐藏入口用 canMatch + 菜单过滤；防手输 URL 用 canActivate。

### 12. (A) CanActivateChildFn 和 canActivate 的区别是什么？为什么不直接把 canActivate 挂到每个子路由？

**来源**：转述自本关 §九常见陷阱第 3 点

- `canActivate`：只守护**当前路由节点自身**——用户直接输入子路由 URL 时不触发父的 canActivate。
- `canActivateChild`：守护该路由的**所有直接子路由**——只需在父路由声明一次。

不逐个挂的原因：DRY + 安全——新增子路由时忘挂 canActivate = 漏洞。canActivateChild 是「批量保护 + 继承」语义。实际项目推荐：父级 canActivate 管自身 + canActivateChild 管全部后代。

### 13. (B) 守卫里需要异步 HTTP 请求验证 token 有效性（返回 200 才放行）——写两种实现并比较优劣。

**来源**：转述自本关 §五异步守卫段

方案一（Promise）：
```ts
export const tokenGuard: CanActivateFn = async () => {
  const http = inject(HttpClient);
  try { await firstValueFrom(http.get('/api/verify')); return true; }
  catch { return inject(Router).createUrlTree(['/login']); }
};
```
方案二（RxJS）：
```ts
export const tokenGuard: CanActivateFn = () => {
  return inject(HttpClient).get('/api/verify').pipe(
    map(() => true),
    catchError(() => of(inject(Router).createUrlTree(['/login']))),
  );
};
```
优劣：Promise 更直观、不需要 RxJS 知识；RxJS 可链 retry/timeout 操作符做网络容错。两者 Router 都能处理。

### 14. (C) 对比 Angular SSR 场景下守卫与 Next.js middleware 的行为差异：服务端导航是否执行守卫？

**来源**：转述自本关 §十对照框架表 + Angular SSR 知识预告

Angular SSR（@angular/ssr）：服务端渲染时 Router **会执行** CanMatch/CanActivate/Resolve——因此守卫里不能访问 `window`/`document`（只在浏览器端可用）。Next.js middleware：在 Edge Runtime 里跑——完全不执行组件级逻辑。差异：Angular 守卫里如果 `inject(PLATFORM_ID)` 判平台可以区分 SSR/CSR；Next middleware 天然是 server-only。注意：Angular 的 cookie 在 SSR 下需通过 `REQUEST_COOKIE`（v18+）注入获取——不能直接 `document.cookie`。

### 15. (D) 面试官提出：「Angular 守卫是不是一个历史包袱？未来会被 signal-based 路由方案取代吗？」给出你的判断。

**来源**：转述自本关 §二/§八与 Angular RFC 社区趋势

判断：当前（v22）函数式守卫已是主流写法、稳定无废弃风险。未来方向：社区有 `Route Recognizer` 编译期路由校验讨论；signal-based 的「路由状态即 signal」可能让守卫变简单（因为 `isLoggedIn` 是 signal → 模板 @if 自动隐藏入口 → 减少运行时检查）。但**守卫作为导航拦截机制不会消失**——权限判断、异步验证、重定向这些职责需要显式逻辑，不可能纯声明式覆盖。一句话：API 可能微调（返回类型扩展 signal），核心机制长期存在。
