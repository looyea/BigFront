# ng-rx-bridge 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕 toSignal/toObservable 桥、AsyncPipe 地位、RxJS 与 signals 分工的题组。

### 1. (A) toSignal 的自动清理机制底层怎么实现？为什么在 root service 里用会泄漏？

**来源**：转述自本关 §二 toSignal 选项与 §七 DestroyRef 关系

toSignal 内部做两件事：① 创建 writable signal；② 订阅 Observable 并在 next 里 set signal。自动清理：注入当前上下文的 DestroyRef→注册 `destroyRef.onDestroy(() => sub.unsubscribe())`。组件销毁时 DestroyRef 触发→sub 取消→流关闭。root service 问题：root injector 与应用同寿命（直到 SPA 页面卸载），DestroyRef 的 onDestroy **永不被调用**→Subscription 永远在内存里活着→如果流是 WebSocket/SSE 长连接，这就是真正的内存泄漏。解法：service 里手动管 `this.destroyRef`（用 `inject(Injector).get(DestroyRef)`）或 `.pipe(takeUntilDestroyed(this.destroyRef))` + 只订阅转 signal 不裸 subscribe。

### 2. (B) 同事写了 `const data = toSignal(this.http.get('/api'))` 在 constructor 里——ng build 不报错但页面永远显示 loading。分析原因。

**来源**：转述自本关 §二 toSignal 与 HttpClient 异步时序

原因：constructor 执行时 field initializer 里调 `this.http.get()` 发起请求——此时 this.http 可能 undefined（若 http 是 `private http = inject(HttpClient)` 且 field 声明顺序在 http 之后）。JS field 按声明顺序依次初始化——若 `http` 在 `data` 之后声明，`this.http` 为 undefined→get 报错→toSignal 拿到一个 error 状态的 Observable→signal 永远是 initialValue（或 undefined）。修法：**调整 field 声明顺序**（http 在前、data 在后）或改用 `constructor() { ... }` 里统一按序初始化。另一种：HttpClient 返回 Observable 不会立即发错——但请求失败（404/网络错误）且没填 initialValue 会让 signal 变 undefined。

### 3. (C) RxJS 的 BehaviorSubject 与 Angular signal 都表达『有当前值的可观察状态』——两者在『新订阅者是否收到当前值』这个行为上等价吗？

**来源**：转述自本关 §五 BehaviorSubject 迁移与 14 包 sig-paradigms（呼应 sig-vs-streams）

等价：BehaviorSubject 新订阅者立即收到 `.value`（最后发的值）；signal 的 `()` 读取永远返回当前值（无『首次订阅』概念因为它不是推模型）。不同在**消费方式**：BehaviorSubject 要 `.pipe(distinctUntilChanged())` 防重复值触发、`.subscribe(fn)` 注册回调；signal 是拉模型——你读它才有值、不读就不算。signal 无『订阅/退订』——所以也没有忘记退订的问题。一句话：BehaviorSubject=推（值来了通知你）、signal=拉（你读我给）；『有当前值』这层语义一致。

### 4. (D) 面试官给你一段代码：`combineLatest([this.route.params, this.http.get('/user')])`——要求用 signal + toSignal 重写。写出来并指出错误处理差异。

**来源**：转述自本关 §三 toObservable/toSignal 双向桥与 §五 RxJS 保留场景

重写：
```ts
params = toSignal(this.route.params, { initialValue: {} as Params });
user = computed(() => params()['id'] ? `/api/users/${params()['id']}` : null);
user$ = toObservable(this.user).pipe(
  switchMap(url => url ? this.http.get<User>(url) : of(null)),
);
userResult = toSignal(this.user$, { initialValue: null as User|null });
```
错误处理差异：combineLatest 里一个流出错整条链 error（Observable 语义——error 终止流）；signal 没有 error 通道——set 一个错误值需要手动 catchError 转成 `of({error: e})`。toSignal 对 error 的处理：流 error 时 signal 不更新（保持上一值）——不像 async pipe 会抛。需要 `catchError` 把 error 转为一个值 emit。

### 5. (A) 为什么 Angular 不把 HttpClient 改成返回 Promise 或 Signal？保留 Observable 的架构理由是什么？

**来源**：转述自本关 §一现实三场景与 §八 fetchBackend 远期

三条理由：① **取消语义**——Observable 的 unsubscribe 天然映射 AbortController.abort()（切换页面时取消 in-flight 请求）；Promise 没有取消（只能忽略结果）、Signal 没有操作符链做 switchMap；② **操作符代数**——企业项目里 retry/timeout/progress/catchError 用管道一行接一行；换成 Promise 要么写 retry 函数手写、要么引入另一套工具；③ **流多值**——某些场景（SSE/progress events）一个请求发多次值：Observable 天生多值、Promise 一值、Signal 最新一值（丢历史）。保留 Observable 是『流语义的 API 用流容器』的设计决策——与 14 包『signal 表达当下的值、stream 表达事件序列』的判据一致。

### 6. (B) 你的 zoneless 项目里有 20 个组件用 `| async` 渲染 Observable 数据。切换到 toSignal 后页面白屏——给两步排查思路。

**来源**：转述自本关 §四 AsyncPipe 与 signal 桥切换的实战

Step 1：**检查 Observable 是否在组件注入上下文里可用**——toSignal 需要当前有 InjectionContext（field initializer 里有），如果 `this.someObs$` 是在 service 里 new 出来传入但 service 没暴露 DestroyRef→toSignal 不知道何时清理→可能拿到旧订阅或报错。Step 2：**检查 initialValue**——toSignal 不填 initialValue 时 signal 首值为 undefined，模板 `{{ data().name }}` 就崩（Cannot read property of undefined）；加 `initialValue: {} as DataType` 或 `@if (data()) { }` 条件渲染。加分：zoneless 下 Observable 没有 zone 自动触发变更检测——若 Observable next 时没人 markForCheck→视图不更新；toSignal 内部用 signal 写→触发通知所以解决了这个问题（这就是 AsyncPipe 在 zoneless 下需要手动 changeDetectorRef.markForCheck 的历史坑）。

### 7. (C) 14 包 sig-server 讨论过『服务端状态该归 Query 库还是全局 store』——在 Angular 里这个选型问题的答案是什么？

**来源**：转述自本关 §五-六与 14 包 sig-server 的 Angular 落地（呼应 sig-server、ng-services）

Angular 的答案：**HttpClient + toSignal 就是『内置 Query 层』**——不需要 TanStack Query 这类外部库的核心理由：DI + Route Resolve + signal 三件套已覆盖『数据预取→缓存→组件消费』主流程（resolve 预取放 route data、toSignal 转 signal、computed 派生 loading/error）。TanStack Query 的增量价值（自动重试/乐观更新/失效策略/后台刷新）在 Angular 里用 RxJS 管道手动写（retry/catchError/switchMap）。选型结论：小中型应用 HttpClient+signal 够用、大型应用值得引入 @angular-architects/ngrx-toolkit 或 ngx-query 做服务端缓存管理——不推荐 TanStack Query（与 DI/signal 生态不搭）。

### 8. (A) AsyncPipe 在 zoneless 下为什么不再自动触发视图更新？它的旧机制依赖什么？

**来源**：转述自本关 §四 AsyncPipe 地位下滑段

AsyncPipe 旧机制：Observable.next → AsyncPipe.transform() 被调用 → 存最新值 → 调 `changeDetectorRef.markForCheck()` → **等 zone.js 触发下一轮变更检测时**模板取到 new value 重渲染。zoneless 下没有 zone.js 做『全局异步完成→跑一轮 CD』的驱动——markForCheck 只标脏但**没人调度变更检测**。解法（zoneless 仍想用 async pipe）：手动 `ChangeDetectorRef.markForCheck()` + 确保有 signal 写触发通知；或改用 toSignal（signal 写→模板绑定订阅者→自动更新）。这就是官方推 signal 而让 AsyncPipe 退位的核心原因：**signal 自带通知链、不依赖外部调度器**。

### 9. (D) 设计一个『带缓存与取消的搜索组件』：用户输入→300ms 去抖→发起请求→新输入取消旧请求→结果显示。用 signal+toObservable+RxJS 混合模式写完整骨架。

**来源**：转述自本关 §三双向桥与 §五 RxJS 保留场景

```ts
@Component({...})
export class Search {
  private http = inject(HttpClient);
  query = signal('');

  results = toSignal(
    toObservable(this.query).pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => q ? this.http.get<Result[]>(`/api/search?q=${q}`) : of([])),
      catchError(() => of([] as Result[])),
    ),
    { initialValue: [] as Result[] }
  );
  loading = toSignal(
    toObservable(this.query).pipe(
      map(q => q.length > 0),
    ), { initialValue: false }
  );
}
```
加分：loading 用 switchMap 后的 tap 更准确（start loading at request send、stop at response），上面简化了；讨论用 signal + 手动 setTimeout 实现 debounce 的可行性（能做但缺取消语义）。

### 10. (B) 同事把 toSignal 放在 computed 里试图做嵌套响应：`combined = computed(() => toSignal(obsA()).length + toSignal(obsB()).length)`——报运行错。为什么？

**来源**：转述自本关 §二 toSignal 与注入上下文关系

toSignal 需要 InjectionContext（用 DestroyRef 注册清理）；computed 回调**不是注入上下文**（它是响应式计算上下文）——在里面调 toSignal 会抛 NG0203。而且语义错误：computed 是纯函数、toSignal 有副作用（订阅流）——违反 computed 的纯函数约束。正确做法：obsA/obsB 的 toSignal 在 field initializer 里各创建一个，computed 里只用它们的 `.()` 结果。

### 11. (C) 对比 Angular (toSignal + signal)、React (useQuery + useState)、Svelte (auto-subscribe store) 三种『异步数据进视图』的范式：谁的心智负担最重？

**来源**：转述自本关 §四与跨框架异步数据消费模式对比（呼应 react-forms、svelte-stores、sig-server）

**Angular**：signal 做状态 + toSignal 桥 + RxJS 管道（三层概念——signal/Observable/RxJS 操作符）→心智最重。**React**：useState + useEffect/useQuery 两层（组件 state + 异步 hook）→中等；但 useQuery 库隐藏了竞态/缓存复杂度。**Svelte**：store 的 `$store` 自动订阅语法糖→最轻（但 store 的 get/update/set 语义与 signal 重合）。面试结论：Angular 在 2026 正在通过推 signal 默认简化这条链路——长期目标可能把 HttpClient 也 signal 化；现阶段桥接层的概念数确实最多。

### 12. (A) toObservable(signal) 创建的 Observable 与源 signal 的关系是什么？signal 多次变化 Observable 会怎样？

**来源**：转述自本关 §三 toObservable 用法段

toObservable 返回一个**热 Observable**——每次 signal 值变化时 emit 新值（内部 `effect(() => { sub.next(signal()); })` 做桥接）。特性：① 新订阅者收到**当时的当前值**（像 BehaviorSubject）；② 后续 signal 变化持续 emit；③ signal 不变→不 emit（无 distinctUntilChanged 重复问题）；④ Observable 没有 complete 时机（除非 signal 所属 injector 销毁——由 DestroyRef 管理）。一句话：toObservable(signal) ≈ new BehaviorSubject(initialValue) + 每次 signal.set 自动 .next(新值)。

### 13. (D) 面试官问『你怎么判断一个团队应该 all-in signals 还是保留 RxJS 双轨』——给三条判据。

**来源**：转述自本关 §五-六与迁移策略（呼应 sig-migrate、ng-version-map）

三判据：① **团队 RxJS 熟练度**——RxJS 用得好（管道组合无 bug、retry/switchMap 熟练）→双轨共存成本低于全迁 signal（迁移要重写所有异步逻辑）；RxJS 用得烂（subscribe 不取消、内存泄漏频发）→全切 signal 是正解；② **异步复杂度**——搜索去抖取消/多源合并/乐观更新链→留 RxJS；简单 CRUD→signal 足够；③ **版本负债**——项目已 v21 zoneless→signal 是默认变更检测驱动→继续用纯 Observable+async pipe 需要额外 markForCheck 成本→推 toSignal 更顺。三判据给结论：**多数新应用 all-in signals 只 RxJS 桥必要处**、大型存量按 feature 渐进。

### 14. (B) zoneless 项目中 AsyncPipe 渲染的 Observable 数据不更新——给最小修复方案（不重写为 signal）。

**来源**：转述自本关 §四 AsyncPipe 与 zoneless 交互机制

根因：zoneless 下 AsyncPipe 的 markForCheck() 标脏但无人触发变更检测。最小修复：用 `provideZonelessChangeDetection()` + 在 AsyncPipe 所在组件的 Observable 来源处确保有 signal 写触发通知——如用 `toSignal(obs$)` 替代 async pipe 消费（回到 signal 世界）。若**坚持保留 async pipe**：手动注入 ChangeDetectorRef 并在 Observable pipe 里加 `tap(() => cdr.markForCheck())` + 确保有微任务 flush 触发检测（`afterNextRender` 里 `ApplicationRef.tick()` 兜底——不推荐）。结论：zoneless + async pipe = 别扭；要么 toSignal、要么回 zone.js 模式。

### 15. (D) 设计一个『实时通知中心』：WebSocket 推事件→列表渲染→每条通知 5 秒后自动消失。用 signal + RxJS WebSocketSubject + toSignal 组合实现核心逻辑。

**来源**：转述自本关全篇知识在实时流场景的综合应用

```ts
@Injectable({ providedIn: 'root' })
export class NotifyService {
  private ws = inject(WebSocketSubject).pipe(
    map((raw: WsMessage) => ({ id: nanoid(), text: raw.text, ts: Date.now() })),
    shareReplay(1),
  );
  notifications = toSignal(
    this.ws.pipe(
      scan((list, n) => [...list.slice(-19), n], [] as Notification[]),
    ),
    { initialValue: [] as Notification[] }
  );
  constructor() {
    // 5s 自动过期：用 effect + setTimeout 或 RxJS delay
    effect(() => {
      const list = this.notifications();
      const now = Date.now();
      const filtered = list.filter(n => now - n.ts < 5000);
      if (filtered.length !== list.length) this._notifications.set(filtered);
    });
  }
}
```
加分：说明 WebSocket 是『事件流』不是『状态』→RxJS 主场；列表是当下状态→signal 主场；两者通过 toSignal(scan(...)) 桥接——这就是 §五分界线的实战版。
