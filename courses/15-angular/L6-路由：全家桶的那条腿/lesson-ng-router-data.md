# ng-router-data：路由数据流——resolve、component input binding 与滚动策略

> 目标：withComponentInputBinding 让路由参数直达 input()；ResolveFn 预取数据（仍是 Observable）与 SSR 时的 server 端执行点；data/static 路由元数据与 title 策略；scrollPositionRestoration/锚点滚动；Route Recognizer 与预编译路由的边角（呼应 ng-http、kit-load-universal、sig-server SSR）

## 一、withComponentInputBinding：路由参数零样板

开启后，路由 params / data / resolve 的键自动绑定到同名组件 `input()`：

```ts
// 目的：开启 withComponentInputBinding——路由参数自动绑同名 input
// app.config.ts
provideRouter(routes, withComponentInputBinding())   // 不加这个 flag，下面的 input 自动绑定不会生效
// ✅ 打开后 params/data/resolve 的键自动喂给同名 input()
// ❌ 不写 withComponentInputBinding() 却在组件声明 input 期待自动绑定→input 永远拿不到值
```

```ts
// 目的：组件端——只声明同名 input，Router 负责喂值（零 ActivatedRoute 样板）
// user-detail.component.ts
@Component({ selector: 'app-user-detail', standalone: true, template: `...` })
export class UserDetailComponent {
  // 路由 /users/:id → params.id 自动绑到同名 input
  id = input<string>();       // 键名 id 必须与 :id 参数一致

  // 路由 resolve: { user: userResolver } → data.user 自动绑
  user = input<User>();       // 接 resolver 解析好的数据

  // 静态 data: { title: '用户详情' } → 绑定到 data 对象
  data = input.required<any>();  // 整体 data 对象也可注入（注意 data 是保留 key）
}
// ✅ id 接 :id、user 接 resolve、data 接静态 data，全都自动
// ❌ input 名与参数名不一致（id 写成 userId）→对不上 key→input 恒 undefined
```

对比不开启时的传统写法：
```ts
// 目的：不开启时的传统写法（inject + 订阅）——对比样板量
// 旧写法：inject + 订阅
private route = inject(ActivatedRoute);                 // 必须手动注入 ActivatedRoute
id$ = this.route.params.pipe(map(p => p['id']));                         // 手动 map 取参
user = toSignal(this.route.data.pipe(map(d => d['user'])));   // 用 toSignal 桥接 data
// ✅ 动态/嵌套场景仍需它，合法且灵活
// ❌ 简单取参也这么写→样板冗余（inject+pipe+map+toSignal）且易漏退订，正解用 input binding
```

收益：**无 ActivatedRoute 注入、无订阅、无 get()** —— 组件只声明 input、Router 负责喂值。

## 二、ResolveFn：导航前预取数据

```ts
// 目的：ResolveFn——导航前预取数据，Router 等它完成才激活组件
// user.resolver.ts
import { ResolveFn } from '@angular/router';

export const userResolver: ResolveFn<User> = (route, state) => {
  const id = route.paramMap.get('id')!;                       // ! 断言非空（需路由确实带 :id）
  return inject(HttpClient).get<User>(`/api/users/${id}`);    // 返 Observable，SSR 在服务端执行
};

// 路由配置
{ path: 'users/:id', loadComponent: () => ..., resolve: { user: userResolver } }   // 解析结果放 data.user
// ✅ 组件里不出现 loading 闪烁（数据就绪才渲染），配 input binding 直接拿 user
// ❌ get('id')! 断言却无 id→运行时 null 拼成 /api/users/null→请求错地址
```

要点：
- ResolveFn 可返回 `Observable<T> | Promise<T> | T`——Router 等它完成才激活组件
- 组件里不出现 loading 闪烁（数据已就绪才渲染）
- **SSR 时**：Resolver 在服务端执行 → 数据预序列化到 TransferState → 客户端 hydration 时不重复请求
- 配合 withComponentInputBinding → 组件 `user = input<User>()` 直接拿到解析好的数据

异步 Resolver 示例（带错误处理）：
```ts
// 目的：异步 Resolver 带错误处理——报错也不能断导航
export const postsResolver: ResolveFn<Post[]> = (route) => {
  const http = inject(HttpClient);
  const router = inject(Router);
  const userId = route.paramMap.get('id')!;
  return http.get<Post[]>(`/api/users/${userId}/posts`).pipe(
    catchError(() => {
      router.navigate(['/404']);   // 导航去错误页
      return of([]);               // 同时返空数组，保证 Resolver 流不断
    }),
  );
};
// ✅ catchError 里既 navigate 又返 of([])，Resolver 正常完成、导航不中止
// ❌ Resolver 不 catchError→HTTP 报错→整个导航中止→用户白屏
```

## 三、路由 data 与 title 策略

路由配置里可写静态 `data` 对象——透传到组件/Resolver 使用：

```ts
// 目的：路由静态 data + v15+ title 字段——透传元数据与设页面标题
{
  path: 'settings',
  loadComponent: () => import('./settings.component').then(m => m.SettingsComponent),
  data: { title: '系统设置', icon: 'cog', roles: ['admin'] },   // 静态元数据，透传组件/Resolver
  title: '系统设置',  // v15+ 专用 title 字段（可以是 string 或 Observable<string>）
}
// ✅ title 专用字段直接设页面标题，data 携带 icon/roles 等自定义元数据
// ❌ 把整个 data 绑到名叫 data 的 input→拿到的是 {title,icon,roles} 整体而非某个字段（data 是保留 key）
```

title 三种写法：
```ts
// 目的：title 三种写法——固定 / 函数 / 全局 TitleStrategy
title: '固定标题'                      // 最直接：静态字符串
title: (route) => route.data['title']   // 函数：从 data 读标题
// 或自定义 TitleStrategy 全局统一
@Injectable()
class CustomTitleStrategy extends TitleStrategy {                 // 全局接管标题生成
  override buildTitle(route: Data) { return `${route['title']} | MyApp`; }   // 统一加后缀
}
provideRouter(routes, withTitleStrategy(new CustomTitleStrategy()))   // 注册策略
// ✅ 自定义 TitleStrategy 统一加品牌后缀，免每个路由各写一遍
// ❌ buildTitle 忘了拼成 string（如返回对象）→浏览器标签显 [object Object]
```

## 四、scrollPositionRestoration 与锚点滚动

```ts
// 目的：withInMemoryScrolling——导航时的滚动位置恢复与锚点滚动
provideRouter(routes,
  withInMemoryScrolling({
    scrollPositionRestoration: 'enabled',  // 'top' | 'enabled' | 'disabled'
    anchorScrolling: 'enabled',            // URL 含 #fragment 时滚到对应 id= 元素
  })
)
// ✅ 'enabled'：后退恢复之前位置、前进滚到顶，符合浏览器直觉
// ❌ 想要「后退回原位」却配 'top'→每次导航都置顶，后退也回顶，丢位置
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
// 目的：ActivatedRoute 深度用法——嵌套/动态读取仍离不开它
private route = inject(ActivatedRoute);

// 父级 params（配合 paramsInheritanceStrategy: 'always'）
parentId = this.route.parent?.snapshot.params['orgId'];   // 沿 parent 链拿父级参数

// 订阅同路由参数变化（/users/1 → /users/2 组件复用不重建时）
userId$ = this.route.paramMap.pipe(map(p => p.get('id')));   // paramMap 是流，参数变会重发

// queryParams（不带入 input binding 除非加 withComponentInputBinding + 自定义策略）
tab$ = this.route.queryParamMap.pipe(map(q => q.get('tab')));   // 查询参数 ?tab=
// ✅ 动态/嵌套场景用 ActivatedRoute 的 paramMap/queryParamMap 订阅，能感知同路由参数变化
// ❌ 只读 snapshot.params 应对 /users/1→/users/2→组件复用不重建，snapshot 不更新→永远显 user 1
```

注意：**同组件不同参数时 Angular 默认复用组件实例**（不重新创建）——此时 input() 会收到新值触发变更；如果用旧 snapshot 读值则不更新。

## 六、TransferState：SSR 预取防双请求

```ts
// 目的：TransferState——SSR 预取数据序列化到客户端，防 hydration 二次请求
// resolver 里存
const POSTS_KEY = makeStateKey<Post[]>('posts');   // 声明一个状态 key
export const postsResolver: ResolveFn<Post[]> = (route, state, injector) => {
  const http = injector.get(HttpClient);
  const transferState = injector.get(TransferState);
  return http.get<Post[]>('/api/posts').pipe(
    tap(posts => transferState.set(POSTS_KEY, posts)),   // 副作用：服务端取到就存进 TransferState
  );
};

// 组件/service 消费时
transferState.get(POSTS_KEY, null) ?? http.get('/api/posts')  // 有缓存直接用、没才请求
// ✅ SSR 取一次→序列化进 <script id="ng-state">→客户端命中缓存不重发
// ❌ 不做 TransferState→SSR 已取一次、hydration 又发一次→双请求闪烁
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
// 目的：withNavigationErrorHandler——全局兜底导航错误
provideRouter(routes,
  withNavigationErrorHandler((error) => {
    if (error instanceof HttpErrorResponse && error.status === 401) {   // 401 未授权
      inject(Router).navigate(['/login']);   // 集中跳登录
    }
    console.error('Navigation error:', error);   // 其余记录
  })
)
// ✅ Resolver 抛错/懒加载 chunk 404 都冒到这里，集中处理 401/403/500
// ❌ 只 console.error 不做导航→用户停在空白页无反馈
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
