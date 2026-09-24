# ng-http：HttpClient 实战——函数式拦截器与类型化请求

> 目标：provideHttpClient(withInterceptors([...])) 函数式拦截器取代 HttpInterceptor 类的写法与链式执行；强类型响应<T> 与错误处理（HttpErrorResponse 判别）；与 RxJS 操作符协作（retry/timeout）；fetch 化趋势与 fetchBackend provider（呼应 ng-rx-bridge、sig-server 的 Query 分工讨论）

## 一、注册：provideHttpClient 与 withFetch

```ts
// app.config.ts
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

providers: [
  provideHttpClient(
    withFetch(),                    // v17+ 用 fetch 底层（支持 SSR 更顺）
    withInterceptors([authInterceptor, loggingInterceptor]),
  ),
],
```

旧写法（已废弃）：`HttpClientModule` + `HTTP_INTERCEPTORS` multi provider——v17 后不再用。

## 二、类型化请求

```ts
interface User { id: number; name: string; email: string; }

// GET 带泛型
getUser(id: number): Observable<User> {
  return this.http.get<User>(`/api/users/${id}`);
}

// POST 带请求体与响应类型
createUser(data: Omit<User,'id'>): Observable<User> {
  return this.http.post<User>('/api/users', data);
}

// 带 params + headers + responseType
downloadReport(type: string): Observable<Blob> {
  return this.http.get('/api/reports', {
    params: { type },
    responseType: 'blob',
  });
}

// observe: 'response' 拿完整 HttpResponse（含 headers/status）
this.http.get<User>('/api/me', { observe: 'response' })
  .subscribe(res => console.log(res.headers.get('X-Total')));
```

## 三、函数式拦截器（v15+ 正统）

```ts
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();  // inject 合法（在拦截器上下文中）
  if (!token) return next(req);

  const cloned = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
  return next(cloned);
};
```

执行链：请求 → authInterceptor → loggingInterceptor → 后端 → loggingInterceptor → authInterceptor → 组件。**注册顺序 = 洋葱模型**（先注册先包裹）。

与旧 class 写法对比：
```ts
// ❌ 旧（v15 前的 HttpInterceptor class + HTTP_INTERCEPTORS multi provider）
@Injectable()
export class AuthInterceptor implements HttpInterceptor { ... }
// 注册：{ provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
```
函数式更轻（无 class/DI）、可 tree-shake、与 standalone 天然兼容。

## 四、错误处理：HttpErrorResponse 判别

```ts
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
    return throwError(() => err);  // 或 of(fallback) 降级
  }),
).subscribe(...);
```

## 五、retry / timeout 操作符

```ts
import { retry, timeout } from 'rxjs/operators';

this.http.get('/api/critical')
  .pipe(
    timeout(5000),           // 5s 无响应报 TimeoutError
    retry({ count: 3, delay: 1000 }),  // 失败重试 3 次、每次等 1s
  )
  .subscribe(...);
```

## 六、拦截器里的异步：token 刷新场景

```ts
export const authRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !req.url.includes('/login')) {
        return auth.refreshToken$().pipe(
          switchMap(() => next(req.clone({
            setHeaders: { Authorization: `Bearer ${auth.token()}` },
          }))),
        );
      }
      return throwError(() => err);
    }),
  );
};
```

## 七、withFetch 与 fetchBackend

`provideHttpClient(withFetch())` 让 HttpClient 内部用 `fetch()` 替代 `XMLHttpRequest`。好处：SSR 兼容更顺（Node fetch polyfill）；支持 `AbortSignal`（与取消语义对齐）。对使用者透明——API 不变、仍返回 Observable。远期（社区 RFC）：可能有 `http.getSignal<T>()` 返回 Resource signal——2026 尚未实现。

> 🚀 下一站：L6 路由——全家桶里最后那条腿：嵌套/懒加载/函数式守卫/resolve。
