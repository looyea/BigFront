# ng-rx-bridge：RxJS 在 Angular 的现在与未来——toSignal 桥与 AsyncPipe 的退场

> 目标：厘清 2026 年 Angular 里 RxJS 的真实地位——HttpClient/路由事件仍是 Observable 的现实；toSignal()/toObservable() 双向桥的用法与 DestroyRef 清理；AsyncPipe 地位下滑但没死；哪些场景留 RxJS、哪些换 signals（呼应 rx-basics、sig-vs-streams、ng-signals、sig-server）

## 一、现实：Angular API 仍是 Observable 的三大场景

到 v22 为止，以下 API **返回的仍是 Observable**（官方未改成 signal，因为流语义更合适）：

1. **HttpClient**——`http.get<T>()` 返回 `Observable<T>`（可 retry/timeout/cancel）；
2. **Router events**——`router.events` 是 `Observable<Event>`（导航生命周期流）；
3. **ActivatedRoute params/data**——`route.params` 仍是 `Observable<Params>`（同路由复用参数流）。

这意味着：**纯 signal 消灭不了 RxJS 在 Angular 里的存在感**——你需要桥。

## 二、toSignal：Observable → Signal 单向桥

```ts
import { toSignal } from '@angular/core/rxjs-interop';

@Component({...})
export class UserProfile {
  private route = inject(ActivatedRoute);
  // 把 Observable<Params> 转成 ReadonlySignal<Params>
  params = toSignal(this.route.params, { initialValue: {} as Params });

  // 模板直接用：{{ params().id }}——不需要 async pipe
}
```

选项：
- `initialValue: T`——流还没发值时 signal 的初始值（不填则 signal 初始 undefined）；
- `requireSync: true`（v17.2+）——流必须同步发首值否则抛错（用于 BehaviorSubject 等保证有初值的流）；
- 自动退订：toSignal 在**当前注入上下文销毁时**自动 unsubscribe——不需要手管 Subscription。

## 三、toObservable：Signal → Observable 反向桥

```ts
import { toObservable } from '@angular/core/rxjs-interop';

const searchQuery = signal('');
// 转 Observable 后进 RxJS 管道
const results$ = toObservable(searchQuery).pipe(
  debounceTime(300),
  distinctUntilChanged(),
  switchTerm(q => this.http.get<Result[]>(`/api/search?q=${q}`)),
);
const results = toSignal(results$, { initialValue: [] as Result[] });
```

场景：signal 做状态、进 RxJS 操作符链处理复杂异步、结果再回 signal——**双向桥让两者共存无摩擦**。

## 四、AsyncPipe 的地位：从『唯一桥』到『三选一』

旧时代（v17 前）：Observable 在模板里只能用 `| async` 渲染。现在三种选择：
1. `toSignal(obs$)` + 模板 `{{ data().xxx }}`——**zoneless 首选**；
2. `obs$ | async`——**仍合法**，在 zone.js 模式下或不想转 signal 时继续用；
3. 手动 `.subscribe()` 写 signal——最啰嗦但最灵活（可控制 next/error/complete 分别处理）。

AsyncPipe 没被废但在**新文档与脚手架里已不再是默认推荐**——官方 examples 里 async pipe 出现频率从 v17 的每页必现降到 v21 的少数保留场景。面试说法：『AsyncPipe 正在从正统退为兼容工具，signal 是新的默认。』

## 五、哪些场景该留 RxJS

判据：**数据流拓扑**——如果操作只在时间轴上做变换（合并/节流/取消/回溯），RxJS 无可替代：

| 场景 | 为什么 signal 做不了或很笨 |
|------|--------------------------|
| debounceTime | signal 没有『等 N ms 再通知』原语 |
| switchMap（取消前请求） | signal 没有『新值来了 abort 旧的异步』语义 |
| combineLatest（N 流同步合并） | computed 可以做但缺错误处理统一通道 |
| retry / timeout / catchError | Observable 有操作符代数、signal 无链式变换 |
| 多源 merge（事件流合流） | 多个 signal 合并需要手写——merge(A$,B$) 一行 |

## 六、哪些场景该换 signals

判据：**状态容器与简单派生**——不涉及时间变换时 signal 更轻：

| 旧 RxJS 写法 | signal 等价 | 收益 |
|-------------|------------|------|
| BehaviorSubject + asObservable | signal + asReadonly | 无 subscribe/unsubscribe 管理 |
| 多个 BehaviorSubject combineLatest | 一个 computed 读多 signal | 模板无 async pipe |
| scan 累加 | signal.update(prev => ...) | 代码短一半 |
| pipe(map(x => x*2)) 做派生 | computed(() => x()*2) | 惰性+memo |

## 七、DestroyRef 与 toSignal 的关系

```ts
@Component({...})
export class Comp implements OnDestroy {
  data = toSignal(this.http.get('/api'));
  // toSignal 内部已注册 DestroyRef.onDestroy(() => sub.unsubscribe())
  // → 组件销毁时自动取消订阅，不需要手写 ngOnDestroy
}
```

toSignal 的自动清理基于**当前注入上下文**的 DestroyRef——若 toSignal 在 service 里调（providedIn:'root'），service 永不销毁→流永不退订！最佳实践：只在组件/指令的 field initializer 里用 toSignal（跟随视图生命周期）；service 里要订阅+转换→手动管 Subscription 或用 `takeUntilDestroyed(destroyRef)` 操作符。

## 八、fetchBackend 与 RxJS 的远期关系

Angular v20+ 提供 `provideHttpClient(withFetch())` 让 HttpClient 底层用 fetch API 而非 XMLHttpRequest——但对外接口仍返回 Observable（兼容性考虑）。远期（社区 RFC 讨论中）：HttpClient 可能出 signal-based 新 API（`http.getSignal<T>()` 返回 Signal<Resource<T>> 类似 fetch 封装）。现阶段：**桥是常态、全替换是远期**。

> 🚀 下一关：变更检测与 zoneless——zone.js 到底替你做了什么、zoneless 之后 signal 通知如何取代脏检查。
