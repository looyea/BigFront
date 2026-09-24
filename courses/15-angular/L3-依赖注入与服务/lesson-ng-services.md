# ng-services：服务与业务分层——Angular 的『状态就是服务』

> 目标：掌握 Service 作为业务逻辑与共享状态的默认容器——@Injectable({providedIn:'root'}) 单例、signal 封装私有状态对外只读暴露；从 BehaviorSubject 时代到 signal 时代的迁移姿势；服务拆分粒度与循环依赖处理（呼应 ng-di-core、ng-state-services、za-core）

## 一、『状态就是服务』：Angular 与 React 的根本分工差异

React：状态放组件里（useState）、跨组件共享才提升到 Context 或外部 store（Zustand/Redux）。
Angular：**组件是视图壳、状态与逻辑默认放 Service**——组件通过 inject(Service) 读 signal / 调 action；Service 是业务逻辑的『正职人员』、组件是『UI 渲染器』。

这不是强制约定（你也可以把 signal 写在组件 class 里），而是**框架给了 DI 工具链**后社区自然收敛的模式——状态放 Service 的好处：跨组件无 Provider 包裹、可单元测试、可路由级隔离（L7 详展）。

## 二、Signal 时代的服务模板：私有 writable + 公开 readonly + action

```ts
import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CounterService {
  // 私有 writable signal
  private _count = signal(0);

  // 公开只读暴露
  readonly count = this._count.asReadonly();

  // 派生也是 computed signal
  readonly doubled = computed(() => this._count() * 2);

  // action 方法——唯一能写 _count 的入口
  increment() { this._count.update(c => c + 1); }
  reset() { this._count.set(0); }
}
```

三个纪律：
1. **外部永远拿不到 writable signal**（asReadonly 屏蔽 .set/.update/.patch）；
2. **写操作只走 action 方法**（统一入口方便加日志/校验/事件）；
3. **派生用 computed**——不手动维护 `doubled`、让 signal 图自动传播。

对比 14 包 Zustand 的 `create(set => ({count:0, inc:()=>set(s=>({count:s.count+1}))}))`——语义一一对应，但 Angular 用 class + DI 封装、Zustand 用闭包。

## 三、BehaviorSubject 时代 → Signal 时代的迁移对照

旧写法（v17 前主流、RxJS 重度用户）：
```ts
@Injectable({providedIn:'root'})
export class UserService {
  private _user$ = new BehaviorSubject<User|null>(null);
  user$ = this._user$.asObservable();

  loadUser(id: number) {
    this.http.get<User>(`/api/users/${id}`).subscribe(u => this._user$.next(u));
  }
}
// 组件消费：user$ | async
```

新写法（signal + toSignal 桥）：
```ts
@Injectable({providedIn:'root'})
export class UserService {
  private _user = signal<User|null>(null);
  readonly user = this._user.asReadonly();

  loadUser(id: number) {
    // HttpClient 仍返回 Observable——用 toSignal 桥或 subscribe 写 signal
    this.http.get<User>(`/api/users/${id}`).subscribe(u => this._user.set(u));
  }
}
// 组件消费：user()——直接调用，不需要 AsyncPipe
```

迁移要点：
- BehaviorSubject 的 `asObservable()` → signal 的 `asReadonly()`；
- `.next(val)` → `.set(val)` 或 `.update(fn)`；
- `| async` pipe → 直接 `()` 调用（zoneless 自动追踪）；
- 需要多源合并（combineLatest）→ 保留 RxJS 或用 computed 手写。

## 四、服务拆分粒度：一个 Service 管多大范围

原则：**一个 Service 对应一个『业务概念』而非一个『页面』**。

| 粒度 | 示例 | 评价 |
|------|------|------|
| 太粗 | `AppService` 装了用户/主题/通知/购物车 | 测不了、谁都要 inject、耦合爆炸 |
| 合适 | `AuthService` / `ThemeService` / `CartService` | 一个概念一个 store |
| 太细 | `HeaderService` / `FooterService` / `SidebarService` | 页面壳层不是业务概念 |

判断标准：① 这块状态有独立的 action 语义吗（登录/登出/刷新 token → AuthService 管）；② 有超过一个组件读它吗（是→抽 Service、否→留组件里）；③ 它的生命周期和谁一致（跟用户会话→root、跟页面→component provider）。

## 五、循环依赖处理与 forwardRef 的『避法』

```ts
// ❌ 循环：A imports B, B imports A
@Injectable({providedIn:'root'})
export class AService {
  constructor(private b: BService) {}  // B
}
@Injectable({providedIn:'root'})
export class BService {
  constructor(private a: AService) {}  // A
}
```

Angular DI 遇到循环会抛 `Circular dependency` 或运行时 undefined。**避免**是首选：

1. **拆第三方**：A 和 B 都依赖的共享逻辑抽成 C——A→C←B 变 DAG；
2. **事件总线解耦**：A 发 signal 变化、B 的 effect 监听——无显式引用；
3. **接口 token**：`{provide: USER_REPO, useExisting: UserService}`——A 依赖 token（USER_REPO）而非 B 类本身。

若实在绕不开，旧逃生口是 `forwardRef`（`constructor(@Inject(forwardRef(() => BService)) private b: BService)`）——但 v22 文档标注 deprecated 方向：官方鼓励用上面的拆解法而非运行时 lazy 引用。inject() 函数式写法天然避部分循环（`private b = inject(BService)` 在字段初始化器执行比 constructor 稍晚）。

## 六、服务里用 HttpClient：异步状态管理的 signal 模式

```ts
@Injectable({ providedIn: 'root' })
export class ProductService {
  private _items = signal<Product[]>([]);
  private _loading = signal(false);
  private _error = signal<string|null>(null);

  readonly items = this._items.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  fetchAll() {
    this._loading.set(true);
    this._error.set(null);
    this.http.get<Product[]>('/api/products').subscribe({
      next: data => { this._items.set(data); this._loading.set(false); },
      error: err => { this._error.set(err.message); this._loading.set(false); },
    });
  }
}
```

组件用：`@if (products.loading()) { <spinner /> } @else if (products.error()) { <p>{{ products.error() }}</p> } @else { @for (p of products.items(); track p.id) { ... } }`

与 14 包 Zustand 的 `fetch` action + loading 三件套对比：语义完全一致，但 Angular 不需要 `useStore(s => s.loading)` selector——inject 后 signal 自动追踪、只重渲染实际读取了变化 signal 的组件。

> 🚀 下一关：inject() 函数的使用边界与 constructor DI 的黄昏——为什么 v22 官方文档里 constructor 注入不再是推荐写法。
