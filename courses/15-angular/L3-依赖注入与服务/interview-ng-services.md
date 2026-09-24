# ng-services 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕 Angular Service 作为状态容器、signal 封装模式、BehaviorSubject 迁移与循环依赖处理的题组。

### 1. (A) 为什么 signal 封装模式要求『私有 writable + 公开 asReadonly』而非直接暴露 writable signal？

**来源**：转述自本关 §二三个纪律段

两条核心理由：① **写入口收敛**——外部拿到 writable signal 就能绕过 action 直接 .set()，破坏了 action 里的日志/校验/事件通知/乐观更新逻辑；② **重构安全**——内部实现从 signal 换成 BehaviorSubject（或反过来）时，只要 asReadonly 暴露的接口不变，外部代码零改动。直接暴露 writable = 放弃封装。一句话：**asReadonly 是 Angular signal 版的『getter only』**——等价于 TS private _x + public get x()。

### 2. (B) 同事在组件里 `this.counterService.count.set(10)`，TypeScript 编译不报错但运行时无效（或 TS 报错被忽略）。原因与正确做法。

**来源**：转述自本关 §二 asReadonly 屏蔽写操作的机制

`asReadonly()` 返回 `ReadonlySignal<number>`——类型层面没有 .set/.update/.patch 方法，TS 应该报编译错（如果 count 类型正确推断为 ReadonlySignal）。若同事写了 `@ts-ignore` 强转成 WritableSignal 或用了 `as any`——绕过了类型保护但 signal 内部写保护机制（v20+ 有 dev mode write guard）仍然会阻止。正确做法：通过 action 方法写：`this.counterService.increment()` 或 `this.counterService.reset()`。如果需求确实需要外部重置，加一个 action 暴露出去。

### 3. (C) Angular 的 Service + signal 与 14 包 Zustand 的 store 创建在『订阅粒度』上有什么差异？

**来源**：转述自本关 §二与 14 包 za-core 的 selector 对比（呼应 za-core、sig-scenarios）

Zustand：组件用 selector `useStore(s => s.count)` 订阅——**只有 selector 返回值变化时才重渲染**（浅比较）。Angular signal：组件 inject service 后模板里 `{{ count() }}`——**signal 变→模板绑定的 signal 订阅者自动重算**，不需要手动 selector。粒度等价（细到每个 signal），区别在：Zustand 的 selector 可以组合多个字段 `s => ({x:s.x, y:s.y})`（但新对象引用问题需 shallow compare）；Angular 的 computed signal 天然做组合且用 === 比较不触发多余更新。一句话：Zustand 要手动 selector、Angular signal 模板绑定就是 selector。

### 4. (A) BehaviorSubject 时代为什么需要 AsyncPipe？signal 时代为什么不需要？

**来源**：转述自本关 §三迁移对照段

BehaviorSubject 是 RxJS Observable——模板不能直接渲染一个流对象，需要 AsyncPipe 做『订阅→拿最新值→标记组件需要重渲染→组件销毁时退订』四件事。signal 时代：signal 本身就是值容器（`.()` 调用直接拿值），zoneless 变更检测把 signal 的写通知直连到模板绑定——不需要额外的 pipe 层做订阅管理。AsyncPipe 是『Observable 与 Angular 模板之间的桥』——signal 不需要桥因为它**就是 Angular 的一等公民**。加分：signal 时代 AsyncPipe 仍有位置——当数据源仍是 Observable（如 HttpClient 响应）且你想在模板里 `.subscribe()` 而不想手转 signal 时。

### 5. (D) 设计一个购物车 Service：需要 addItem/removeItem/updateQty/clear 四个 action、items 列表、total 派生、itemCount 派生、coupon 折扣。用 signal 模式写出完整骨架。

**来源**：转述自本关 §二 signal 封装模式与 §四拆分粒度的综合应用

```ts
@Injectable({ providedIn: 'root' })
export class CartService {
  private _items = signal<CartItem[]>([]);
  private _discount = signal(0);
  readonly items = this._items.asReadonly();
  readonly itemCount = computed(() => this._items().length);
  readonly subtotal = computed(() =>
    this._items().reduce((s, i) => s + i.price * i.qty, 0));
  readonly total = computed(() =>
    this.subtotal() * (1 - this._discount()));

  addItem(item: CartItem) { this._items.update(list => [...list, item]); }
  removeItem(id: string) { this._items.update(l => l.filter(i => i.id !== id)); }
  updateQty(id: string, qty: number) { this._items.update(l => l.map(i => i.id===id?{...i,qty}:i)); }
  clear() { this._items.set([]); this._discount.set(0); }
  applyCoupon(code: string) { /* 异步验证 → this._discount.set(0.1) */ }
}
```
加分：解释为什么 items 不可变更新（`[...list, item]`）——signal 默认用 === 比较变化，mutation 不触发通知。

### 6. (B) signal 服务里用 HttpClient 异步获取数据、subscribe 回调里 set signal——同事发现 loading 状态在快速连续调用 fetchAll() 时出现闪烁。原因与修法。

**来源**：转述自本关 §六异步三件套与 14 包 sig-server 竞态问题

原因：两次 fetchAll() 并发——第一次设 loading=true→第二次又设 true→第一次返回设 loading=false→第二次返回又设 false；中间有瞬间 loading=false 但实际还有请求在飞。修法：① 加 pending 计数器 `private _pending = signal(0); loading = computed(() => this._pending() > 0)`；fetchAll 开头 `_pending.update(p=>p+1)`、complete 里 `_pending.update(p=>p-1)`；② 或用 RxJS switchMap 保证只保留最后一次（toSignal 桥）；③ 最简：`takeUntil(this.destroyRef)` + 在 set 前判 loading 是否已被后续接管。

### 7. (C) 为什么 Angular 社区没有像 React 那样分出『状态管理库』的生态（除 NgRx 外）？

**来源**：转述自本关 §一『状态就是服务』的框架级解释（呼应 sig-map、za-core）

因为 Angular 的 DI 把状态管理的核心需求（作用域、生命周期、跨组件共享、测试替换）**在框架层面做掉了**——一个 @Injectable + signal 就覆盖了 Zustand/Jotai 的『全局可访问、作用域隔离、可替换』三大卖点。React 没有框架级 DI：Context 重渲染太粗、全局变量没作用域、测试没法替换——所以需要外部 store 补这些缺口。NgRx 存在是因为企业 Redux 模式（action log、时间旅行、中间件链）是 Service+signal 不覆盖的额外需求——而不是因为『Angular 没有状态管理方案』。一句话：**框架给了基础设施，社区就不需要造轮子**。

### 8. (A) providedIn:'root' 的服务为什么不支持 constructor 注入自身？循环检测在什么时机触发？

**来源**：转述自本关 §五循环依赖处理段

DI 解析是**按需懒创建**：inject(X) 时若 X 尚未创建→调用 useClass/工厂创建→创建过程中 inject 它的 constructor 参数。如果 X 依赖 Y、Y 依赖 X——解析 X 需要 Y、解析 Y 需要 X——**无限递归**。Angular 在创建栈里维护一个『正在创建』集合，再遇到同 token 时直接抛 Circular dependency 错误（不是运行时 undefined 而是立即 crash）。providedIn:'root' 不特殊——它只是注册位置；循环检测跟 provider 写法无关。避免：拆第三方（§五三法）或改 inject() 为 lazy（`get svc() { return inject(Y) }`——但注意 getter 里 inject 不是注入上下文不合法）。

### 9. (D) 面试官问『你怎么组织一个 50 个 service 的大型 Angular 工程』——按 DI 关和服务关知识给分层方案。

**来源**：转述自本关 §四拆分粒度 + §五循环处理的规模化应用

三层：① **core**（全局单例 providedIn:'root'）：AuthService、ThemeService、HttpErrorService、AnalyticsService——跨功能共享基础设施；② **shared**（按需 providedIn:'root' 或 component 级）：PaginationService、FormFieldService——多 feature 复用但非全局单例；③ **feature**（路由级 providers）：DashboardState、EditorState、OrderFlowService——只在特定模块激活时存在、销毁时清理。目录按 `core/ shared/ features/<domain>/` 三层放。循环依赖规则：**feature 可依赖 core/shared、不可互相依赖**（通过 shared 的 event bus signal 通信）——@angular-eslint 的 no-cross-feature-imports 规则强制。加分：monorepo（nx）给 feature 边界加 dependency constraint lint。

### 10. (B) 从 BehaviorSubject 迁移到 signal，同事在 computed 里用了 subscribe：`const combined = computed(() => a$.pipe(combineLatestWith(b$)).subscribe(...))`——指出三处错误。

**来源**：转述自本关 §三迁移对照与 ng-signals computed 纯函数约束

三错：① **computed 必须是纯函数**——不能 subscribe（副作用），返回的应是同步计算值；② **signal 时代不用 pipe/combineLatest**——直接 `computed(() => a() + b())` 就是多源合并；③ subscribe 返回 Subscription 对象——computed 的返回类型是 Subscription 而非值，模板里拿到的是 subscription 对象。正确：`readonly combined = computed(() => ({a: this._a(), b: this._b()}))`。

### 11. (C) NestJS 的 DI 与 Angular 前端 DI 的架构对比：同样用 @Injectable + token + injector，两者的『作用域』语义有什么根本不同？

**来源**：转述自本关 §二四级注入器树与后端 NestJS 常识对比

NestJS：三种 scope——DEFAULT（=singleton 进程级）、REQUEST（每 HTTP 请求一个实例、注入链上传递 request context）、TRANSIENT（每次 inject 新实例）。Angular：root（应用生命周期）、route（路由激活期）、element（组件子树）。根本不同：NestJS REQUEST scope 是因为**服务端多用户并发**、同一进程处理不同请求需要隔离；Angular 没有『请求』概念（浏览器单用户）——它的隔离维度是**视图作用域**（组件树）。TRANSIENT ≈ Angular 没有的——Angular 每次 inject 同 token 拿同实例（除非在不同 element injector 注册不同 provider）。两者 token/injector 机制设计几乎同构（NestJS 的 @Injectable 直接借鉴 Angular）。

### 12. (A) signal 服务里 asReadonly() 后类型是 ReadonlySignal<T>，在组件里想对它做 effect 监听变化——effect 里需要手动 .() 吗？

**来源**：转述自本关 §二 signal 封装模式与 ng-signals effect 的追踪机制

是的，需要在 effect 里 `.()` 调用——effect 通过**读取时自动追踪**建立依赖（读即订阅）：
```ts
effect(() => {
  console.log(this.cart.count());  // .() 读取建立依赖
  // count 变时这个 effect 自动重跑
});
```
不 .() 就没有读取、就没有依赖——effect 不会因 count 变化而重跑。ReadonlySignal 和 WritableSignal 在**读取**上没有区别——只是不能写。

### 13. (D) 给一个 Angular + NgRx 混合工程提建议：团队说『NgRx 太重了想干掉换成 Service+signal』——给三步渐进路线。

**来源**：转述自本关全篇 + 14 包 sig-migrate 方法论的 NgRx 特化版（呼应 ng-ngrx、sig-migrate）

三步：① **选一个 feature slice 做试点**——找 NgRx 里最简单、无 effect 链、无跨 slice 依赖的一个 reducer+selector 替换为一个 @Injectable({providedIn:'root'}) signal store；Store.select() 改成 inject(NewStore).data()。验证：同 UI 行为、减 NgRx 行数、单测通过。② **按 feature 切流**——重复步骤①逐个迁移 slice；每个 feature 迁移一个 PR；跨 feature 的 NgRx effect（dispatch 另一个 action）改成 service 方法互调或 event signal。③ **清理 NgRx 依赖**——所有 feature 迁完后删 StoreModule.forRoot/EffectsModule——ng update 的 schematics 帮不了这步（纯手动）。关键纪律：迁移期间新旧共存——NgRx Store 与 signal service 互不干扰；**不要一步到位**——与 14 包 sig-migrate 三段渐进同理。

### 14. (B) 同事把 Service 里 _items 的 signal.set() 包了一层 setTimeout(0) 说『防止 ExpressionChangedAfterItHasBeenCheckedError』——这在 zoneless 下还需要吗？

**来源**：转述自本关 §三迁移对照与 §六 zoneless 变更检测行为

不需要。ExpressionChangedAfterItHasBeenCheckedError 是 zone.js 时代变更检测**同步执行**时修改了当前帧已检查的值→第二次脏检查发现值不一致→报错。zoneless 下变更检测是**异步微任务调度**（signal 写→标记脏→下一个 microtask checkpoint 统一刷新）——同步写 signal 不会打断当前帧检查。setTimeout(0) 是旧时代的 hack 且有害（增加一帧延迟、可能与其他 setTimeout 竞态）。正确做法：zoneless 下直接 set 即可；如果仍在 zone.js 模式（v20-）且遇到该错，优先修根因（把写操作移到事件 handler/ngOnInit 而非渲染函数执行期）。

### 15. (D) 面试官问『你怎么测试一个 signal store（Service + signal 模式）』——给出三层测试策略与代码示例。

**来源**：转述自本关 §二 signal 封装模式 + §六 DI 测试（呼应 ng-testing、vite-vitest）

三层：① **action 单测**（无组件）：直接实例化 service（TestBed 或直接 new with mock HttpClient）→ 调 increment() → 断言 `service.count()` 变了；断言 computed 派生正确；② **异步测试**：mock HttpClient（provideHttpClientTesting）→ 触发 fetchAll() → `await` 完成 → 断言 items signal；Vitest fake timers 处理延迟；③ **组件集成**：TestBed + 真实 service → fixture.detectChanges() → 断言渲染文本跟随 signal 变化 → `service.increment()` → 再 detectChanges → 文本自动更新。加分：说明为什么不需要 subscribe/unsubscribe 测试——signal 是 pull 模型、没有『忘记退订』的问题。
