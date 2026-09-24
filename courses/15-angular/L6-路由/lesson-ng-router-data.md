# ng-router-data：路由数据流——resolve、component input binding 与滚动策略

> 目标：withComponentInputBinding 让路由参数直达 input()；ResolveFn 预取数据（仍是 Observable）与 SSR 时的 server 端执行点；data/static 路由元数据与 title 策略；scrollPositionRestoration/锚点滚动；Route Recognizer 与预编译路由的边角（呼应 ng-http、kit-load-universal、sig-server SSR）

## 一、withComponentInputBinding：路由参数零样板

开启后，路由 params / data / resolve 的键自动绑定到同名组件 `input()`：

```ts
// app.config.ts
provideRouter(routes, withComponentInputBinding())
```

```ts
// user-detail.component.ts
@Component({ selector: 'app-user-detail', standalone: true, template: `...` })
export class UserDetailComponent {
  // 路由 /users/:id → params.id 自动绑到同名 input
  id = input<string>();

  // 路由 resolve: { user: userResolver } → data.user 自动绑
  user = input<User>();

  // 静态 data: { title: '用户详情' } → 绑定到 data 对象
  data = input.required<any>();  // 整体 data 对象也可注入
}
```

对比不开启时的传统写法：
```ts
// 旧写法：inject + 订阅
private route = inject(ActivatedRoute);
id$ = this.route.params.pipe(map(p => p['id']));
user = toSignal(this.route.data.pipe(map(d => d['user'])));
```

收益：**无 ActivatedRoute 注入、无订阅、无 get()** —— 组件只声明 input、Router 负责喂值。

## 二、ResolveFn：导航前预取数据

```ts
// user.resolver.ts
import { ResolveFn } from '@angular/router';

export const userResolver: ResolveFn<User> = (route, state) => {
  const id = route.paramMap.get('id')!;
  return inject(HttpClient).get<User>(`/api/users/${id}`);
};

// 路由配置
{ path: 'users/:id', loadComponent: () => ..., resolve: { user: userResolver } }
```

要点：
- ResolveFn 可返回 `Observable<T> | Promise<T> | T`——Router 等它完成才激活组件
- 组件里不出现 loading 闪烁（数据已就绪才渲染）
- **SSR 时**：Resolver 在服务端执行 → 数据预序列化到 TransferState → 客户端 hydration 时不重复请求
- 配合 withComponentInputBinding → 组件 `user = input<User>()` 直接拿到解析好的数据

异步 Resolver 示例（带错误处理）：
```ts
export const postsResolver: ResolveFn<Post[]> = (route) => {
  const http = inject(HttpClient);
  const router = inject(Router);
  const userId = route.paramMap.get('id')!;
  return http.get<Post[]>(`/api/users/${userId}/posts`).pipe(
    catchError(() => {
      router.navigate(['/404']);
      return of([]);
    }),
  );
};
```

## 三、路由 data 与 title 策略

路由配置里可写静态 `data` 对象——透传到组件/Resolver 使用：

```ts
{
  path: 'settings',
  loadComponent: () => import('./settings.component').then(m => m.SettingsComponent),
  data: { title: '系统设置', icon: 'cog', roles: ['admin'] },
  title: '系统设置',  // v15+ 专用 title 字段（可以是 string 或 Observable<string>）
}
```

title 三种写法：
```ts
title: '固定标题'
title: (route) => route.data['title']   // TitleStrategy 函数
// 或自定义 TitleStrategy 全局统一
@Injectable()
class CustomTitleStrategy extends TitleStrategy {
  override buildTitle(route: Data) { return `${route['title']} | MyApp`; }
}
provideRouter(routes, withTitleStrategy(new CustomTitleStrategy()))
```

## 四、scrollPositionRestoration 与锚点滚动

```ts
provideRouter(routes,
  withInMemoryScrolling({
    scrollPositionRestoration: 'enabled',  // 'top' | 'enabled' | 'disabled'
    anchorScrolling: 'enabled',
  })
)
```

| 选项 | 效果 |
|------|------|
| `scrollPositionRestoration: 'top'` | 每次导航滚到顶部 |
| `scrollPositionRestoration: 'enabled'` | 后退恢复之前位置，前进滚到顶 |
| `anchorScrolling: 'enabled'` | URL 含 `#fragment` 时滚到对应 `id=` 元素 |

对照：Next.js `<Link>` 默认就做了 scroll restoration；Vue Router 的 `scrollBehavior` 配置等价。

## 五、ActivatedRoute 的深度用法

withComponentInputBinding 不覆盖所有场景——嵌套路由或动态读取时仍需 ActivatedRoute：

```ts
private route = inject(ActivatedRoute);

// 父级 params（配合 paramsInheritanceStrategy: 'always'）
parentId = this.route.parent?.snapshot.params['orgId'];

// 订阅同路由参数变化（/users/1 → /users/2 组件复用不重建时）
userId$ = this.route.paramMap.pipe(map(p => p.get('id')));

// queryParams（不带入 input binding 除非加 withComponentInputBinding + 自定义策略）
tab$ = this.route.queryParamMap.pipe(map(q => q.get('tab')));
```

注意：**同组件不同参数时 Angular 默认复用组件实例**（不重新创建）——此时 input() 会收到新值触发变更；如果用旧 snapshot 读值则不更新。

## 六、TransferState：SSR 预取防双请求

```ts
// resolver 里存
const POSTS_KEY = makeStateKey<Post[]>('posts');
export const postsResolver: ResolveFn<Post[]> = (route, state, injector) => {
  const http = injector.get(HttpClient);
  const transferState = injector.get(TransferState);
  return http.get<Post[]>('/api/posts').pipe(
    tap(posts => transferState.set(POSTS_KEY, posts)),
  );
};

// 组件/service 消费时
transferState.get(POSTS_KEY, null) ?? http.get('/api/posts')  // 有缓存不请求
```

SSR 输出 HTML 里嵌 `<script id="ng-state" type="application/json">...</script>` → 客户端 hydration 读取 → 不再发第二遍请求。与 Next.js 的 `__NEXT_DATA__` / Nuxt 的 `useNuxtData` 思路一致。

## 七、Route Recognizer（预编译路由）

v17 引入实验性 `Route Recognizer`——在编译期分析 URL 是否匹配已知路由，用于：
- **@defer 的 on router 触发器**（未来）
- **SSR 路由预匹配**：服务端决定是否渲染该路由
- 自定义 matcher（如 UUID 格式验证路径）

普通项目不需要手动配置——它是 Angular 内部 SSR 编译器使用的 API。面试提到即可不深追。

## 八、withNavigationErrorHandler 与错误边界

```ts
provideRouter(routes,
  withNavigationErrorHandler((error) => {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      inject(Router).navigate(['/login']);
    }
    console.error('Navigation error:', error);
  })
)
```

Resolver 里抛出的错误 / 懒加载 chunk 404 都会冒到全局 error handler——集中处理 401/403/500。

## 九、常见陷阱

1. **withComponentInputBinding 与 data 冲突**：路由的 `data` 字段是保留 key——如果你想把 data 绑到组件 input 名叫 `data`，它会拿到整个路由 data 对象而非自定义字段。
2. **Resolver 里忘 catchError**：HTTP 报错 → 导航中止 → 用户白屏——一定要 catchError 兜底或 navigate(['/error'])。
3. **组件复用不感知参数变化**：从 /users/1 导航到 /users/2——组件不重建——如果只读 snapshot 则永远显示 user 1。用 input() binding 或 paramMap 订阅。

## 十、对照其他框架

| 能力 | Angular | Vue Router | Next.js App Router |
|------|---------|-----------|-------------------|
| 路由参数→组件 | input binding / ActivatedRoute | `props: true` 或 `route.params` | 自动 props（page 组件 receive params） |
| 数据预取 | ResolveFn | 全局 beforeEach 里 fetch | `loader()` 导出 |
| 防双请求(SSR) | TransferState | `useState` | `__NEXT_DATA__` 序列化 |
| 滚动控制 | withInMemoryScrolling | `scrollBehavior` | 默认 top + 手动 scroll |
| 页面 title | title 字段 / TitleStrategy | `meta` 插件 | `export const metadata` |
