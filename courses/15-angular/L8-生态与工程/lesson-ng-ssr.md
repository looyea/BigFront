# ng-ssr：SSR 与 hydration——全家桶的服务端拼图

> 目标：ng add @angular/ssr 后 server.ts 引擎与 Angular 的 SSR 编译（增量 hydration v17+ 非破坏式）；@defer 与 SSR 的配合、STATE_KEY 服务端预取防双请求（provideClientHydration with fetch caching）；SSR 下的 DI 每请求隔离（对照 14 包 sig-server 模块单例债的 Angular 答案）；prerender 站点生成（呼应 sig-server、kit-load-universal、nuxt-render-modes）

## 一、启用 SSR：ng add @angular/ssr

```bash
# 目的：一条命令启用 SSR，ng add 会自动补齐服务端文件与配置
ng add @angular/ssr   # 生成 main.server.ts / server.ts，并写 angular.json 的 ssr 配置
# ✅ ng add 后 ng serve 即输出服务端渲染的 HTML，查看源代码可见内容
# ❌ 只手动 npm i @angular/ssr 而不跑 ng add→缺 server.ts 与 angular.json 配置，SSR 不生效
```

新增文件：
- `src/main.server.ts`：服务端 bootstrap（`bootstrapApplication(AppComponent, provideServerConfig())`）
- `src/server.ts`：Express/Nest 服务器入口（或用 `@angular/ssr` 的内置引擎）
- `angular.json` 加 `ssr: { entry: "src/server.ts" }`

```ts
// 目的：服务端入口——用 server 版 config bootstrap 应用，交给 SSR 引擎渲染
// main.server.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';   // 引服务端专用 config（含 provideServerRendering）

export default () => bootstrapApplication(AppComponent, config);   // 导出的工厂函数被 server.ts 每请求调用
// ✅ 用 app.config.server（合并了 serverConfig），SSR 端才具备服务端渲染能力
// ❌ 这里误引客户端 app.config→缺 provideServerRendering，SSR 渲染不出 TransferState
```

## 二、provideClientHydration：增量 hydration（v17+）

```ts
// 目的：注册增量 hydration——让客户端复用 SSR DOM 而非销毁重建
// app.config.ts
import { provideClientHydration, withEventReplay, withFetch } from '@angular/platform-browser';

providers: [
  // withEventReplay() 缓冲 hydration 前的交互事件；withFetch() 启用 fetch 缓存配合防双请求
  provideClientHydration(withEventReplay(), withFetch()),
]
// ✅ 加上后客户端「附着」到 SSR DOM，零闪烁，hydration 前的点击也不丢
// ❌ 忘配 provideClientHydration→客户端 bootstrap 销毁全部 SSR DOM 重建→首屏闪烁、SSR 白做
```

**增量 hydration**（v17 起默认）取代旧的全量 destroy-and-recreate：
- 旧：SSR HTML → 客户端 bootstrap → 销毁所有 DOM → 重新创建组件 → 闪烁
- 新：客户端保留 SSR DOM → 只「附着」事件监听器和 signal 依赖 → **零闪烁**
- `withEventReplay()`：hydration 完成前缓冲用户交互事件（防止点击丢失）
- `withFetch()`：用 fetch API 做数据预取缓存（配合 TransferState 防双请求）

## 三、@defer 与 SSR 的配合

```html
<!-- 目的：@defer 与 SSR 配合——SSR 只输出 placeholder，deferred 块留到客户端按需加载 -->
<!-- SSR 时 @defer 块不渲染（输出 placeholder）→ 客户端 hydrate 后按需加载 -->
@defer (on viewport) {
  <app-heavy-chart />   <!-- 重量级组件：不进 SSR HTML，视口内才动态 import -->
} @placeholder {
  <div class="skeleton">加载中...</div>   <!-- SSR 输出的占位，保证首屏 HTML 更小 -->
}
<!-- ✅ 首屏 SSR HTML 不含 deferred 块→体积更小、TTFB 更快 -->
<!-- ❌ 把重型组件写在 @defer 外→它被渲进 SSR HTML 又随 hydration 拉进主包，失去拆包意义 -->
```

SSR 只渲染首屏可见部分（不含 deferred 块）→ HTML 更小 → TTFB 更快。客户端 hydration 后 `on viewport` 触发 → 动态 import chunk → 渲染。

`prefetch on idle` 可在 hydration 后空闲时预下载 chunk——实际显示时零等待。

## 四、TransferState 与防双请求

SSR 端 Resolver 取数据 → 序列化到 HTML → 客户端复用：

```ts
// 目的：TransferState 防双请求——服务端取一次数据序列化进 HTML，客户端直接复用
// resolver（服务端+客户端都执行）
const POSTS_KEY = makeStateKey<Post[]>('posts');   // 类型安全的 state key

export const postsResolver: ResolveFn<Post[]> = (route, state, injector) => {
  const http = injector.get(HttpClient);
  const transferState = injector.get(TransferState);

  if (transferState.hasKey(POSTS_KEY)) {
    // 客户端命中服务端传来的数据→不再发请求
    return of(transferState.get(POSTS_KEY, []));
  }
  // 服务端首次取数→写入 TransferState（会被序列化进 HTML）
  return http.get<Post[]>('/api/posts').pipe(
    tap(posts => transferState.set(POSTS_KEY, posts)),
  );
};
// ✅ 服务端 set、客户端 hasKey 命中复用，列表数据只拉一次
// ❌ Resolver 返回 class instance→TransferState 序列化后变 plain object，客户端方法/类型丢失
```

`provideClientHydration(withFetch())` 自动缓存 HttpClient 响应 → 组件初始化不发第二遍请求。

## 五、SSR 下的 DI：每请求隔离

**核心问题**：Node.js 长生命周期进程处理多个请求 → 如果用 `providedIn: 'root'` 存了用户 A 的 token → 用户 B 请求进来拿到的还是 A 的！

Angular 的解法：**每个请求创建独立 Injector 树**：

```ts
// 目的：服务端根 config——provideServerRendering() 确保每请求新建 DI 树，避免跨请求泄漏
// app.config.server.ts
import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),   // 内部确保每请求独立 root injector
    // 每请求重置的 service 在这里 provide（或用 REQUEST provider）
  ],
};
// ✅ provideServerRendering() 后 signal store 不跨请求泄漏，用户 A/B 各拿自己的状态
// ❌ 长生命周期进程里用 providedIn:'root' 存用户 token→用户 B 请求拿到的是 A 的（串数据）
```

v17+ `provideServerRendering()` 内部确保每请求新 root injector → signal store 不跨请求泄漏。

对照 14 包 sig-server：Node.js Express 里 Zustand/MobX 的模块级单例是「模块单例债」——Angular 用 DI 层级天然解决了这个问题。

## 六、Prerender（静态站点生成 SSG）

```ts
// angular.json
"prerender": {
  "discoverRoutes": true,  // 自动从 Router 配置发现所有静态路由
}
```

构建时 `ng build` → 对每条路由执行 SSR → 输出 `dist/browser/<route>/index.html`。

适合：营销页、博客、文档站——不需要运行时 Node 服务器，纯静态托管。

动态路由（含 :param）需要手动枚举 `routesFile` 或 `discoverRoutes: false` + 只 prerender 已知路由。

## 七、SSR 下的平台判断

```ts
// 目的：isPlatformBrowser——只在浏览器端访问 window/localStorage，避免 SSR 端报错
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';

const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));   // 服务端为 false

if (isBrowser) {
  localStorage.getItem('token');  // 只在浏览器分支里访问，安全
}
// ✅ 用 isPlatformBrowser 守卫浏览器独有 API，SSR/客户端两端都跑不崩
// ❌ service 构造函数里直接 window/document/localStorage→SSR 端 ReferenceError: window is not defined
```

常见坑：service 构造函数里直接用 `window`/`document`/`localStorage` → SSR 端 ReferenceError。

## 八、Hydration 不匹配的修复

SSR 输出 HTML ≠ 客户端首次渲染结果 → 控制台报 "Hydration mismatch"：

原因：
- Date.now() 服务端和客户端不同
- 随机 ID
- 条件渲染依赖浏览器独有 API

修法：
- 用 TransferState 把服务端时间戳序列化传下来
- 用 `afterRenderEffect` 在 hydration 后再操作 DOM
- 对浏览器独有部分用 `@if (isBrowser())` 控制

## 九、对照其他框架的 SSR

| 能力 | Angular (@angular/ssr) | Next.js | Nuxt | SvelteKit |
|------|----------------------|---------|------|-----------|
| 增量 hydration | ✅ v17+ | React 18 hydrateRoot | Vue 3 hydration | ✅ |
| 防双请求 | TransferState | __NEXT_DATA__ / RSC | useNuxtData | +layout load |
| SSG/Prerender | ✅ discoverRoutes | getStaticPaths | nitro prerender | +prerender |
| Edge 部署 | Firebase/Node | Vercel Edge | Nitro adapters | adapters |
| 每请求隔离 | DI 天然 | 手动（AsyncLocalStorage） | useState() per req | 天然 per req |

## 十、常见陷阱

1. **忘 `provideClientHydration()`**：SSR HTML 被客户端完全替换 → 闪烁 → 浪费服务端渲染。
2. **service 里用 DOM API 不加平台判断**：SSR 崩溃。
3. **Resolver 返回非纯数据（class instance）**：TransferState 序列化后变成 plain object → 客户端类型丢失。
4. **prerender 路由含动态 param**：不会自动发现 → 手动 routesFile 或走 ISR。
