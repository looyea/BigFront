# ng-http：HttpClient 实战——函数式拦截器与类型化请求

> 目标：provideHttpClient(withInterceptors([...])) 函数式拦截器取代 HttpInterceptor 类的写法与链式执行；强类型响应<T> 与错误处理（HttpErrorResponse 判别）；与 RxJS 操作符协作（retry/timeout）；fetch 化趋势与 fetchBackend provider（呼应 ng-rx-bridge、sig-server 的 Query 分工讨论）

## 一、注册：provideHttpClient 与 withFetch

```ts
// 目的：provideHttpClient 注册——withFetch 走 fetch 底层、withInterceptors 数组顺=洋葱包裹序
// app.config.ts
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

providers: [
  provideHttpClient(
    withFetch(),                    // v17+ 用 fetch 底层（支持 SSR 更顺）
    withInterceptors([authInterceptor, loggingInterceptor]),   // 先注册先包裹
  ),
],
// ✅ 函数式拦截器集中注册，顺序即洋葱模型
// ❌ 继续用已废弃的 HttpClientModule + HTTP_INTERCEPTORS multi provider→v17 前旧世界，standalone 工程不该出现
```

旧写法（已废弃）：`HttpClientModule` + `HTTP_INTERCEPTORS` multi provider——v17 后不再用。

## 二、类型化请求

```ts
// 目的：类型化请求——泛型定响应、responseType 定载体、observe 定拿多少
interface User { id: number; name: string; email: string; }

// GET 带泛型
getUser(id: number): Observable<User> {
  return this.http.get<User>(`/api/users/${id}`);   // 响应自动推断为 User
}

// POST 带请求体与响应类型
createUser(data: Omit<User,'id'>): Observable<User> {
  return this.http.post<User>('/api/users', data);   // 第二参为请求体
}

// 带 params + headers + responseType
downloadReport(type: string): Observable<Blob> {
  return this.http.get('/api/reports', {
    params: { type },          // 自动拼成 ?type=...
    responseType: 'blob',      // 声明响应为二进制，返回 Observable<Blob>
  });
}

// observe: 'response' 拿完整 HttpResponse（含 headers/status）
this.http.get<User>('/api/me', { observe: 'response' })   // 默认 observe:'body' 只要 body，改成 response 拿全部
  .subscribe(res => console.log(res.headers.get('X-Total')));   // 能读自定义响应头
// ✅ 泛型给响应类型、responseType:'blob' 下载、observe:'response' 拿 headers/status
// ❌ 声明 get<Blob> 却不设 responseType:'blob'→实际拿到的是解析后的文本而非 Blob
```

## 三、函数式拦截器（v15+ 正统）

```ts
// 目的：函数式拦截器（v15+ 正统）——给请求注入 Authorization 头
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();  // inject 合法（在拦截器上下文中）
  if (!token) return next(req);              // 无 token→原样放行

  const cloned = req.clone({                 // req 不可变，必须 clone 再改
    setHeaders: { Authorization: `Bearer ${token}` },
  });
  return next(cloned);                        // 往下传，否则请求中断
};
// ✅ clone 设 header + return next()：拦截器只增强请求不阻断链
// ❌ 忘了 return next(...)→拦截器没往下传→请求根本不发出
```

执行链：请求 → authInterceptor → loggingInterceptor → 后端 → loggingInterceptor → authInterceptor → 组件。**注册顺序 = 洋葱模型**（先注册先包裹）。

与旧 class 写法对比：
```ts
// ❌ 旧（v15 前的 HttpInterceptor class + HTTP_INTERCEPTORS multi provider）
// 目的：旧 class 拦截器——仅供读存量代码识别，新工程改用上面的函数式
@Injectable()
export class AuthInterceptor implements HttpInterceptor { ... }   // 要 implements 接口、写 intercept 方法
// 注册：{ provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }   // multi 三件套样板
```
函数式更轻（无 class/DI）、可 tree-shake、与 standalone 天然兼容。

## 四、错误处理：HttpErrorResponse 判别

```ts
// 目的：错误处理——HttpErrorResponse 三分支判别
import { HttpErrorResponse } from '@angular/common/http';

this.http.get('/api/data').pipe(
  catchError((err: HttpErrorResponse) => {
    if (err.error instanceof ErrorEvent) {
      // 客户端错误（网络断开/请求构造错）
      console.error('Client error:', err.error.message);
    } else if (err.status === 0) {
      // 跨域/网络不可达
    } else {
      // 服务端错误（4xx/5xx）
      console.error(`Server error: ${err.status} - ${err.error?.message}`);
    }
    return throwError(() => err);  // 或 of(fallback) 降级——必须返回一个 Observable
  }),
).subscribe(...);
// ✅ 按 ErrorEvent/status 0/其余 区分三类错，回一个 Observable 保持流不断
// ❌ catchError 里既不前 throwError 也不返 of()→返回 undefined→下游崩或流静默死掉
```

## 五、retry / timeout 操作符

```ts
// 目的：retry / timeout 操作符——超时与退避重试
import { retry, timeout } from 'rxjs/operators';

this.http.get('/api/critical')
  .pipe(
    timeout(5000),           // 5s 无响应报 TimeoutError
    retry({ count: 3, delay: 1000 }),  // 失败重试 3 次、每次等 1s
  )
  .subscribe(...);
// ✅ timeout 包在 retry 里→单次超时会触发重试，适合瞬时拖动不稳定的接口
// ❌ 对 400/401 这类确定性错也盲目 retry→每次必失败仍重试 3 次→拖慢且徒增负载
```

## 六、拦截器里的异步：token 刷新场景

```ts
// 目的：拦截器里的异步——401 时刷新 token 并重试原请求
export const authRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !req.url.includes('/login')) {   // 只对业务请求的 401 响应，登录/刷新本身除外
        return auth.refreshToken$().pipe(
          switchMap(() => next(req.clone({                     // 刷新成功→用新 token 重发原请求
            setHeaders: { Authorization: `Bearer ${auth.token()}` },
          }))),
        );
      }
      return throwError(() => err);   // 非 401 →原样抛出
    }),
  );
};
// ✅ 用 URL 白名单排除 /login、/refresh 本身，避免刷新请求再触发刷新
// ❌ 不判断请求 URL→刷新 token 请求自身也 401→又触发刷新→无限递归刷新风暴
```

## 七、withFetch 与 fetchBackend

`provideHttpClient(withFetch())` 让 HttpClient 内部用 `fetch()` 替代 `XMLHttpRequest`。好处：SSR 兼容更顺（Node fetch polyfill）；支持 `AbortSignal`（与取消语义对齐）。对使用者透明——API 不变、仍返回 Observable。远期（社区 RFC）：可能有 `http.getSignal<T>()` 返回 Resource signal——2026 尚未实现。

## 八、接线图：HttpClient 在整条数据链路的哪一段

```
组件 signal/rxjs → service（HttpClient + interceptor）→ HTTP → 后端 API（Express / Nest）→ ORM（Prisma / mysql2）→ MySQL / Postgres
                      ↑ 客户端这一侧只有“请求与缓存”                ↑ 事实源；Angular 没有“服务端组件”语义，只能走 API
```

- Angular 的 `HttpClient` **只负责把请求发出去并把类型化响应带回来**：拦截器加 token、统一错误处理、retry/timeout 都在这一层；它不提供“缓存/失效”语义，要么自己写 service 缓存，要么接 NgRx Effects（ng-ngrx）或 signal 形态的 `httpResource()`（ng-signals）。
- **浏览器侧持久化**：没有内置 persist，常见做法是在 service 里订阅状态写 IndexedDB/localStorage；原生 IDB、idb-keyval/Dexie 的能力边界与事务坑见 **01-es `es-local-db`**；另外三条红线：**SSR（Angular SSR）里没有 `window.indexedDB`**（要判平台）、循环引用的响应式对象不能直接 `JSON.stringify`（ng-state-services §四）、token 不落明文存储（exp-security）。
- **“公司有一台独立 MySQL”时**：链路仍然是 `HttpClient → API → 库`，Angular 代码里**不会出现数据库连接串**（浏览器没有 TCP 能力，也不该有凭据）；服务端那一段的驱动、连接池、字符集与时区问题全在 **09-express `exp-mysql`**（远程实例白名单/SSL/`wait_timeout` 都在那一关）。

> 🚀 下一站：L6 路由——全家桶里最后那条腿：嵌套/懒加载/函数式守卫/resolve。
