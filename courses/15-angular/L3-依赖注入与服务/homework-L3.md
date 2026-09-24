# L3 阶段作业：依赖注入与服务

> 覆盖：ng-di-core / ng-services / ng-inject
> 判分：Bug 每题 3 分、手写每题 7 分、场景题 20 分、简答每题 5 分、挑战 +10 分（基分 100）

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**（providedIn 缺失）
```ts
@Injectable()
export class NotifyService {
  private http = inject(HttpClient);
}
```
组件 inject(NotifyService) 报 No provider。@Injectable 装饰器已经写了为什么还不行？

**Bug 2**（ngOnInit 里 inject）
```ts
ngOnInit() {
  this.data = inject(DataService).fetchAll();
}
```
运行报 NG0203。指出不合法原因与两行修法。

**Bug 3**（asReadonly 后尝试 set）
```ts
readonly count = this._count.asReadonly();
// 在组件里：
this.svc.count.set(42);
```
strictTemplates 下 TS 编译器报什么？给正确替代。

**Bug 4**（constructor 里 inject）
```ts
constructor() {
  this.http = inject(HttpClient);  // v22 新工程
}
```
同事说这行写法与 field initializer 等价——判断对错并说明 v22 的合法位置。

**Bug 5**（循环依赖未处理）
```ts
@Injectable({providedIn:'root'})
export class AService { b = inject(BService); }
@Injectable({providedIn:'root'})
export class BService { a = inject(AService); }
```
运行时 crash。给出不使用 forwardRef 的两种修法。

**Bug 6**（useFactory deps 忘写）
```ts
{ provide: COMBO, useFactory: () => new Combo(inject(A), inject(B)) }
// 但 app.config providers 里 COMBO 注册先于 A 和 B
```
这段代码在 v14+ 是否合法？在 v13 是否合法？分别说明。

**Bug 7**（signal 里 next）
```ts
private _items = signal<Product[]>([]);
fetchAll() {
  this.http.get<Product[]>('/api').subscribe(d => this._items.next(d));
}
```
把 BehaviorSubject 写法带过来了。signal 正确的更新 API 是什么。

**Bug 8**（effect 里 inject）
```ts
constructor() {
  effect(() => {
    const svc = inject(AnalyticsService);  // 想做懒注册
    svc.track('view');
  });
}
```
effect 回调里 inject 会怎样？给修法。

**Bug 9**（手动 new 绕过 DI）
```ts
export class Dashboard {
  private state = new DashboardState();  // 不是 inject
}
```
DashboardState 内部 inject(HttpClient)。这段代码有什么问题？

**Bug 10**（InjectionToken 泛型丢失）
```ts
const CONFIG = new InjectionToken('CONFIG');
const cfg = inject(CONFIG);
cfg.apiUrl;  // TS 报 Property 'apiUrl' does not exist on type 'unknown'
```
修一处声明让 cfg 有正确类型。

## 二、手写题（5 题）

**手写 1**：用 signal 模式写一个 TodoService：private writable + asReadonly + addTodo/removeTodo/toggleDone + computed remaining。不查资料 8 分钟内完成。

**手写 2**：写出四种 provider 各一行示例（useClass/useValue/useFactory/useExisting），并各配一句『典型使用场景』注释。

**手写 3**：用 InjectionToken + multi:true 设计一个『验证器管道』：多个验证器函数通过 provider 注册、核心服务 inject 后按序执行。写 token 定义 + 两个注册 + 消费代码。

**手写 4**：把一个 BehaviorSubject + asObservable + AsyncPipe 的旧 UserService 重写为 signal + asReadonly + 直接模板调用的新写法。给出旧/新两段代码。

**手写 5**：用 runInInjectionContext 写一段代码：点击按钮时才动态拿一个 HeavyService 并调用它（避免组件创建时就实例化）。

## 三、场景题（1 题，20 分）

你接手一个 Angular 工程，它当前有以下问题：① 50 个 Service 全部写在 app.config.ts providers 里（无 providedIn:'root'）；② 三个核心 Service 互相注入（A→B→C→A 循环）；③ 组件里大量 constructor(private x: XService) 旧写法且没有统一测试策略；④ 配置值散落在各组件里硬编码。给出一次性治理方案：DI 注册方式统一、循环拆解、constructor→inject 迁移步骤、配置 token 化。每步说清收益。

## 四、简答题（3 题）

**简答 1**：为什么 Angular 官方推荐有状态服务用 DI 注入而纯函数工具直接 import？给三条区分判据。

**简答 2**：解释『zoneless 下 signal 服务不需要 AsyncPipe』这句话的完整因果链（signal 写→谁重算→不需要谁）。

**简答 3**：Angular 的 providedIn:'root' 与 Java Spring 的 @Component（singleton scope）在 lazy 创建与 tree-shaking 上的异同。

## 五、挑战题 🏆（+10 分）

设计一个『Angular DI 作用域可视化调试工具』的 PRD：① 在浏览器 DevTools 里展示当前选中组件的 injector chain（从 Element→Route→Root→Platform），每层列出已注册的 token；② 点击一个 token 高亮『谁注入了它』的消费方组件列表；③ 标红 circular dependency 的注入环。输出：数据结构设计（injector 树如何序列化）、Angular 内部 API 钩子清单（需要哪些 private API 或公开接口）、实现风险与替代方案（不能改 Angular 源码时怎么拿到这些数据）。
