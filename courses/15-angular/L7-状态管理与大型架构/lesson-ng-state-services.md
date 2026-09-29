# ng-state-services：state 就是 service——signal store 模式

> 目标：私有 writable signal + 公开 asReadonly + action 方法的标准封装；派生 computed 放 store 的纪律；跨路由共享/持久化（sessionStorage 拦截）；何时一个 service 够何时要状态库——对照 14 包 Zustand 的「对象三用法」心智迁移（呼应 za-core、ng-services、sig-scenarios）

## 一、Angular 的默认状态容器：Service

React 需要 useState/Context/Zustand/Redux 四层选择；Vue 需要 ref/reactive + Pinia。**Angular 官方答案从来只有一个：Service**。

Service 天然是单例（providedIn: 'root'）、可注入到任何组件/其他 service——它本身就是状态容器。v17+ signals 时代，这个容器变得更强大：

```ts
// 目的：signal store 标准封装——私有 writable + 公开 asReadonly + action 唯一入口
@Injectable({ providedIn: 'root' })   // root 单例：所有注入者共享同一份状态
export class CounterStore {
  private _count = signal(0);          // 私有可写，外部拿不到
  readonly count = this._count.asReadonly();   // 公开只读，屏蔽 .set/.update

  increment() { this._count.update(c => c + 1); }   // 写操作只走 action
  decrement() { this._count.update(c => c - 1); }
  reset() { this._count.set(0); }
}
// ✅ 组件 inject(CounterStore) 读 count()、调 increment()，无需 Provider 包裹
// ❌ 外部 counter.count.set(5)→asReadonly 无 set→编译报错，只能走 increment()
```

任何组件注入即可共享同一份状态——无需 Provider 包裹、无需 Context、无需 store 挂载。

## 二、封装纪律：private writable + public readonly

核心原则：**外部只能读，不能写**。写操作必须通过 action 方法：

```ts
// 目的：封装纪律——所有变更集中 action、派生放 store、外部只读
@Injectable({ providedIn: 'root' })
export class TodoStore {
  // 私有 writable signal
  private _todos = signal<Todo[]>([]);                    // 列表本体
  private _filter = signal<'all' | 'active' | 'done'>('all');   // 筛选态

  // 公开只读访问
  readonly todos = this._todos.asReadonly();     // 外部拿不到 .set
  readonly filter = this._filter.asReadonly();

  // 派生 computed（也公开只读）
  readonly filteredTodos = computed(() => {      // 放 store：多处消费不重复算
    const f = this._filter();
    if (f === 'active') return this._todos().filter(t => !t.done);
    if (f === 'done') return this._todos().filter(t => t.done);
    return this._todos();
  });

  readonly remaining = computed(() => this._todos().filter(t => !t.done).length);   // 惰性派生计数

  // Actions
  add(title: string) {
    this._todos.update(todos => [...todos, { id: Date.now(), title, done: false }]);   // 造新数组
  }
  toggle(id: number) {
    this._todos.update(todos => todos.map(t => t.id === id ? { ...t, done: !t.done } : t));   // map 出新对象
  }
  setFilter(f: 'all' | 'active' | 'done') { this._filter.set(f); }
}
// ✅ filteredTodos/remaining 用 computed 放 store；action 里 update 总返回新数组/新对象
// ❌ toggle 里直接 this._todos()[i].done=true 就地 mutate→引用没变→computed/视图不更新
```

好处：
- 所有状态变更集中在 action 里——可追踪、可加日志、可加校验
- `asReadonly()` 防外部误写——TS 编译时报错
- 派生 computed 放 store 而非组件——多处消费同一份派生值不重复计算

## 三、跨组件通信：signal store vs @Output/EventEmitter

| 模式 | 适用 | 例子 |
|------|------|------|
| 父子 @Input/@Output | 组件紧耦合的简单通信 | 表单项→父表单 |
| Store service | 跨层级/跨路由共享 | 购物车、用户信息、主题 |
| RxJS Subject 在 service 里 | 事件流（toast/通知） | 一次性消息总线 |

signal store 取代了大部分 BehaviorSubject + async 的场景：
```ts
// 目的：signal store 取代 BehaviorSubject——同一服务的两代写法对照
// 旧（BehaviorSubject）
private _user$ = new BehaviorSubject<User | null>(null);   // 有初值的流
user$ = this._user$.asObservable();                         // 对外只读 Observable
login(user) { this._user$.next(user); }                     // .next 推值

// 新（signal）
private _user = signal<User | null>(null);      // 对应 BehaviorSubject
readonly user = this._user.asReadonly();        // 对应 asObservable→消费直接 user()
login(user: User) { this._user.set(user); }     // .next→.set
// ✅ asObservable→asReadonly、next→set，消费从 | async 变直接调用
// ❌ 迁移只改声明忘把消费端 user$ | async 换成 user()→模板拿到 undefined
```

## 四、持久化：sessionStorage / localStorage 拦截

signal 没有内置持久化——在 service 层加 effect 同步：

```ts
// 目的：持久化——service 层用 effect 监听 signal 变化自动同步 localStorage
@Injectable({ providedIn: 'root' })
export class ThemeStore {
  private _theme = signal<string>(localStorage.getItem('theme') ?? 'light');   // 初始从本地恢复
  readonly theme = this._theme.asReadonly();

  constructor() {
    // 每次 _theme 变 → 写 localStorage
    effect(() => {
      localStorage.setItem('theme', this._theme());   // 读即订阅：_theme 变就重跑写入
    });
  }

  setTheme(t: string) { this._theme.set(t); }   // 唯一写入口，写后 effect 自动落盘
}
// ✅ effect 监听 _theme 变化自动写 localStorage，读写闭环无需手动同步
// ❌ 构造里直接 localStorage.getItem 在 SSR 服务端跑→ReferenceError: localStorage is not defined
```

SSR 注意：localStorage 在 server 不存在 → 需要 `isPlatformBrowser` 守卫：
```ts
// 目的：SSR 安全——isPlatformBrowser 守卫后才碰浏览器专存 API
constructor(@Inject(PLATFORM_ID) private platformId: string) {   // 注入平台标识
  if (isPlatformBrowser(this.platformId)) {                        // 只在浏览器分支
    this._theme.set(localStorage.getItem('theme') ?? 'light');      // 服务端不执行这行→不崩
  }
}
// ✅ isPlatformBrowser 守卫后才访问 localStorage/window，SSR 安全
// ❌ 不加守卫裸用 localStorage/window→服务端渲染直接报错崩掉整页
```

## 五、何时一个 service 够？何时需要状态库？

对照 14 包 Zustand 的「对象三用法」：

| 需求 | Angular 方案 | 是否需要 NgRx |
|------|-------------|--------------|
| 单组件局部状态 | 组件内 signal() | ❌ |
| 跨组件/跨路由共享 | providedIn:'root' service + signal | ❌ |
| 乐观更新 + 撤销 + DevTools | NgRx/ComponentStore | ✅ |
| 中大型团队（20+人）统一状态流 | NgRx Store | ✅ 可选 |
| WebSocket 实时推送更新多模块 | signal store + RxJS fromWebSocket | 视复杂度 |

**Angular 官方立场**：「大多数应用不需要 NgRx」——signal store 模式覆盖 80% 场景。

## 六、store 拆分粒度

一个 store 对应一个业务域（domain），不是对应一个组件：
```
✅ UserService    — 用户信息、登录态、权限
✅ CartService    — 购物车条目、总数、折扣
✅ ProductStore   — 产品列表、筛选、分页
❌ HeaderComponent — 不应该有专属 store
```

如果两个 store 互相依赖 → 考虑提取第三个共享 store 或用 `patch` 一次性更新。

## 七、对照 Zustand / Pinia / Redux Toolkit

```ts
// 目的：Zustand vs Angular signal store 概念对照——心智一一对应
// Zustand 等价写法
const useTodoStore = create<TodoState>((set, get) => ({
  todos: [],                                                        // state
  add: (title) => set(s => ({ todos: [...s.todos, {id: Date.now(), title, done: false}] })),   // action
}));

// Angular signal store — 概念完全对应：
// _todos (writable) = state
// todos (readonly) = selector
// add() = action
// filteredTodos (computed) = derived state (Zustand 没有原语，需要 useMemo 或 zustand/shallow)
// ✅ 一一对应：writable=state、readonly=selector、action=action，迁移无概念障碍
// ❌ 以为 Angular computed 就是 Zustand selector→computed 是惰性派生缓存、selector 是订阅裁剪，机制不同
```

心智迁移：Zustand 用 hook 暴露 → Angular 用 DI 注入；Zustand 订阅 → Angular signal 自动追踪（zoneless 下 computed/effect）。

## 八、常见陷阱

1. **在组件里直接 `_todos.set()`**：下划线前缀是 private 约定——但 TS 编译不强制——加 `asReadonly()` 才是真正的写保护。
2. **computed 里做副作用**：`computed(() => { if (this.a()) this.b.set(1); return this.a(); })` — **禁止**！副作用放 effect()。
3. **store 里 subscribe 了 HTTP 不清理**：`providedIn:'root'` 永不销毁 → 用 takeUntilDestroyed 或只在组件里用 toSignal。
4. **过度拆分 store**：每个小功能一个 service → 10 个 service 互相 inject → 维护噩梦。
