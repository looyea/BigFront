# ng-http 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕函数式拦截器、类型化请求、错误处理与 fetch 化趋势的题组。

### 1. (A) 函数式拦截器与旧 class HttpInterceptor 在执行模型上有什么差异？为什么函数式可以 tree-shake？

**来源**：转述自本关 §三函数式 vs class 对比段

执行模型：两者都是洋葱链——但 class 需要实例化（DI 创建 → intercept 方法调用）；函数式直接调用（fn(req, next)）无实例开销。tree-shake：class 需 @Injectable + HTTP_INTERCEPTORS multi provider——provider 注册是 side-effect entry 摇不掉；函数式拦截器是纯函数、只在 withInterceptors([fn]) 里引用——不 import 就不打包。Angular 官方推函数式的另一理由：无 constructor DI（用 inject() 更灵活）、与 standalone 兼容。

### 2. (B) 同事在拦截器里 `next(req).subscribe(res => { this.cache.set(res) })` 后返回 void——请求完全无效。为什么？

**来源**：转述自本关 §三函数式拦截器返回值约束

拦截器函数必须**返回 `Observable<HttpEvent>`**（next(req) 的结果）——框架用返回值继续链/最终交给调用方。同事 subscribe 了但没有 return——等于返回 undefined→框架拿不到流→请求被丢弃。修法：`return next(req).pipe(tap(res => this.cache.set(res)))`——tap 做副作用但不吞流。

### 3. (C) Angular HttpClient 与 14 包 sig-server 讨论的 TanStack Query / SWR 在『请求缓存』上各做到什么程度？

**来源**：转述自本关 §五 retry/timeout 与 14 包 sig-server 缓存层对比（呼应 sig-server）

HttpClient **不做缓存**——每次 subscribe 都真实发请求；它只提供 retry/timeout/cancel 等流控制原语。TanStack Query 做**请求级缓存**（staleTime/gcTime/deduplication/invalidate）——同一 queryKey 并发只发一次、结果缓存给多组件复用。两者互补：HttpClient 是传输层、Query 是数据管理层——Angular 社区用 ngx-query 或 httpInterceptors 里手写 cache（见拦截器示例）。14 包结论在 Angular 的体现：客户端状态（UI）用 signal、服务端状态（缓存）需要专门策略——框架 HTTP 层不管。

### 4. (D) 设计一个『全局请求取消策略』：路由切换时取消所有未完成的 HTTP 请求。给出拦截器实现。

**来源**：转述自本关 §六异步拦截器与路由生命周期

```ts
export const cancelOnNavigateInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(skipCancelKey)) return next(req);
  const router = inject(Router);
  const destroyRef = inject(DestroyRef);
  return next(req).pipe(
    takeUntil(router.events.pipe(
      filter(e => e instanceof NavigationStart),
      take(1),
    )),
    catchError((err) => {
      if (err instanceof HttpErrorResponse && err.status === 0) return EMPTY;
      throw err;
    }),
  );
};
```
加分：用 RequestContext（v18+）给特定请求标 skipCancel（如登出后的清理请求不被取消）。

### 5. (A) HttpRequest 为什么设计成不可变？拦截器里 clone 的成本分析。

**来源**：转述自本关 §三 req.clone 段

不可变设计因：① 链式执行——A 拦截器改 req 后给 B，B 再改给 C——若可变则 A 的改动会被 B 看到但无法回溯/日志原始请求；② 可测试——同 req 多次 clone 不影响原始——单测里可断言最终发出的 req 内容。clone 成本：浅拷贝（headers/body 引用不变）——O(1) 不复制 body 大对象；只有 setHeaders/params 变化时创建新 HttpHeaders 实例（immutable Map 的 add 返回新 Map）。结论：clone 是廉价的不可变派生。

### 6. (B) 生产环境偶发 'Http failure response for /api/data: 0 Unknown Error'——status=0 但网络监控显示请求正常。给两种可能。

**来源**：转述自本关 §四 HttpErrorResponse status===0 判别

可能一：**CORS 预检失败**——OPTIONS preflight 返回非 2xx 被浏览器拦截（status=0 是浏览器隐藏真实错误）→ 排查 Network 面板看 OPTIONS 请求；可能二：**请求被 AbortController 取消**（如组件销毁/路由切换触发 takeUntil）——Angular 内部 abort 后报 status=0 → 排查：看是否在快速导航时出现、检查拦截器是否有 takeUntil 销毁条件。加分：可能三=浏览器扩展拦截或 mixed-content 阻断。

### 7. (C) Angular HttpClient 返回 Observable vs Vue 生态的 useFetch 返回 Ref vs 14 包讨论的 Resource signal——三种异步状态容器对比：谁有『加载中间态』？

**来源**：转述自本关 §一类型化请求与 14 包 sig-server（呼应 sig-server、vue-use-fetch）

都有但表达不同：① Observable：无内建状态——loading/error 需外部 BehaviorSubject 手动管；② Vue useFetch：返回 `{data, pending, error, status}` refs——自带四态；③ Resource signal（讨论中 RFC）：`status()='LOADING'|'LOADED'|'ERROR'` + value()/error() signal 一体化。Angular HttpClient 是**最原始**的——需要 toSignal 或 service 封装 loading/error 三件套（L3 §六示例）。远期可能官方出 `http.getResource()` 一步到位。

### 8. (D) 面试官让你实现『带自动重试+指数退避+最大 3 次+只对 5xx 重试』的通用 HTTP 工具。写出管道代码。

**来源**：转述自本关 §五 retry 操作符与 §四错误处理

```ts
import { retry, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

export function resilientRequest<T>(obs: Observable<T>, maxRetries = 3): Observable<T> {
  return obs.pipe(
    retry({
      count: maxRetries,
      delay: (err, attempt) => {
        if (err instanceof HttpErrorResponse && err.status >= 500) {
          const ms = Math.pow(2, attempt) * 1000; // 2s,4s,8s
          return timer(ms);
        }
        return throwError(() => err); // 非 5xx 不重试
      },
    }),
  );
}
```
加分：说清 rxjs 7.8+ retry 接收配置对象支持 delay 为函数；旧版 retry(3) 不区分错误类型。

### 9. (B) 同事写了拦截器 `return next(req.clone({ headers: req.headers.append('X-Id', id) }))` 但后端报缺少 header。排查发现 append 返回新对象未赋值——这算 bug 吗？

**来源**：转述自本关 §三 req.clone 与 HttpRequest 不可变段

不是 bug——HttpHeaders 是 immutable 结构：`.append()` 返回**新** HttpHeaders 实例（原 headers 不变）；`req.clone({ headers: newHeaders })` 里把新对象设进 clone——写法正确。若同事写成 `req.headers.append(...)` 没接返回值然后 `clone({})` 用原始 req.headers——那才是 bug。本例代码逻辑正确。排查方向改查：是否该请求跳过了此拦截器（withInterceptors 顺序）或后端大小写敏感（X-Id vs X-ID）。

### 10. (A) provideHttpClient(withFetch()) 与 provideHttpClient() 在 SSR 场景下有什么行为差异？

**来源**：转述自本关 §七 withFetch 段与 ng-ssr 关预告

不加 withFetch()：SSR 下 HttpClient 用 XMLHttpRequest——Node.js 环境无 XHR 实现→请求报错或被拦截器吞。加 withFetch()：SSR 用 Node 18+ 内置 fetch——HTTP 请求在 server 端正常工作。v17+ 官方推荐新工程默认开 withFetch；v20 起可能成为唯一模式（XHR 路径逐步移除）。面试要点：说清 withFetch 是传输层切换不是功能开关。

### 11. (D) 设计一个『请求日志拦截器』：记录 URL/时间/耗时/状态码/错误信息，上报到分析服务。注意：不在开发模式记录 body（含敏感数据）。

**来源**：转述自本关 §三函数式拦截器与 §四错误处理组合

```ts
export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  const env = inject(AppConfig);
  const analytics = inject(AnalyticsService);
  const start = performance.now();
  return next(req).pipe(
    finalize(() => {
      const ms = Math.round(performance.now() - start);
      analytics.log({ url: req.urlWithParams, method: req.method, durationMs: ms });
    }),
    catchError((err: HttpErrorResponse) => {
      analytics.logError({ url: req.url, status: err.status, message: err.message });
      throw err;
    }),
  );
};
```
加分：用 `req.context.get(LOG_SENSITIVE)` 决定是否 log body；开发模式用 environment.debug 跳过。

### 12. (C) 对比 Angular HttpClient / axios / 原生 fetch 的『请求取消』机制：三者的 API 与集成成本。

**来源**：转述自本关 §五 timeout 与请求取消场景（呼应 mp-network）

① HttpClient：`takeUntil(destroy$)` 或 `AbortController`（v15+ 支持 signal 参数）——`http.get(url, { signal })` signal 触发 abort；② axios：`AbortController` + `config.signal`；③ fetch：原生 `AbortController` + `options.signal`。集成成本：HttpClient 与 Observable 天然配合（takeUntil 操作符）；axios/fetch 返回 Promise——需自己管 controller 生命周期。结论：三者取消机制最终都靠 AbortController 做底层——只是 API 包装层不同。

### 13. (B) 同事在组件里 `this.http.get('/api/data').subscribe(d => this.data = d)` 且没有任何错误处理——生产偶发白屏。给两行修。

**来源**：转述自本关 §四错误处理与 ng-services §六三件套

两行修：① `.pipe(catchError(() => of(null)))`——至少降级为 null 不崩；② 组件里 `@if (data()) { ... } @else { <app-error /> }` 兜底渲染。根治：封装 `getResource<T>(url): Observable<Resource<T>>` 返回 `{loading, data, error}` 三件套到 service（L3 §六模式），不让组件裸 subscribe。

### 14. (D) 面试官让你『用拦截器实现乐观更新』：POST 创建资源时先在 UI 本地插入临时项、成功后替换真 ID、失败时回滚。给出拦截器+service 协作骨架。

**来源**：转述自本关 §三-六拦截器能力边界与 14 包 sig-scenarios 乐观更新模式

骨架：service 里 `addTodo(text)` 先本地 signal.update(push临时)→发 POST 请求；拦截器不参与乐观逻辑（它在传输层）。逻辑全在 service 的 subscribe 里：`http.post(...)`.pipe(tap(real => 替换临时), catchError(() => { removeTodo(temp.id); return EMPTY }))。加分：讨论为什么拦截器不适合做乐观更新——拦截器不知道业务语义（哪个临时 ID 对应哪个真 ID），且多请求交叉时难以维护。

### 15. (A) withInterceptors([A, B]) 里 A 抛错（return throwError）对 B 和执行链有什么影响？响应拦截与请求拦截的顺序区别？

**来源**：转述自本关 §三洋葱模型执行链

请求方向：A(req)→B(req)→后端。若 A 在调 next 前抛→B 根本不执行。若 A 在 next(req) 返回的 Observable 里抛→B 已执行完（请求已发出）、A 的 catchError 截住错误给最终调用方。响应方向：后端→B(response)→A(response)——若 B 抛→A 的 catchError 能捕到（因为 A 包裹 B）。一句话：**先注册的外层能捕后注册内层的错误、反之不行**。顺序影响：认证拦截器放第一个（后续都带 token）、日志放最外层（能看到最终状态码）。
