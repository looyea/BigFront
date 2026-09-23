# Nuxt 生命周期：一次请求的完整时间线

上一关的链路图给了骨架（呼应 nuxt-render-modes C1），这一关把每个关卡的名字、时机、能干什么讲全——学完你能在面试里口述"从 curl 到水合完成"的每一站，也能精确定位"我的代码到底什么时候跑"（事件系统基础呼应 node-events，小程序生命周期对照 mp-lifecycle）。

## 1. 两套生命周期别混淆

| 层 | 归属 | 典型钩子 |
|----|------|----------|
| Vue 组件 | 每个组件实例 | onMounted/onUnmounted、setup 时机 |
| Nuxt 应用 | 全局/每次导航 | app:created、page:start、route middleware、app:suspense:resolve |

Nuxt 钩子的注册入口有两个：插件里 `nuxtApp.hook('page:finish', ...)`（全局），组件里 `useRuntimeHook()` 族/`defineNuxtPlugin`（局部消费）。命名规律 `xxx:start / xxx:end / xxx:resolve`，全部支持异步——**setup 里 await 的东西会阻塞该阶段**（这是 SSR 数据收集的实现基础，nuxt-usefetch 关回收）。

## 2. 服务端时间线（一次 SSR 请求）

1. **Nitro 请求进入** → server middleware（每个请求，含静态资源——别在这做重活，呼应 nuxt-middleware-auth）；
2. **routeRules 应用**（redirect/proxy/缓存命中即短路出栈）；
3. **createServerApp + 路由匹配**：每个请求新建 Vue app（SSR 防状态串染——与 Next 每请求 RSC 树同理，呼应 next-render-modes）；
4. **route middleware 顺序执行**：全局数组序 → per-route；可 redirect/abort（导航中断、HTML 不出）；
5. **组件 setup 服务端执行**：useFetch 等 await 挂起渲染、数据写入 payload 收集器；Suspense 边界决定流式与否（ssr: 'defer' 的路由规则可做流式，nuxt-perf 展开）；
6. **render:html / render:body 钩子**：最终 HTML 拼装（head 注入在这，nuxt-seo-meta 的底层）；
7. 响应出栈（可缓存的按规则写入缓存层）。

## 3. 客户端时间线（首屏与导航）

**首屏加载**：HTML 解析 → JS bundle 执行 → **payload 反序列化**（window.__NUXT__，服务端收集的 props/state 在此复用）→ Vue 水合（hydrate，nuxt-hydration 的主题）→ `app:created` → 插件按 `.xx` 顺序执行（plugins 的 hook 时机：runApp:created 前后各有站位）→ `app:suspense:resolve`（首屏数据就绪）→ `page:finish`。

**SPA 导航**（点 NuxtLink）：route middleware（同上可拦截）→ 新页面 setup（useFetch 真实发请求——服务端那份 payload 不复用于新导航）→ 旧页卸载新页挂载 → `page:start / page:finish` 夹住过渡。

**关键区别**：服务端 middleware 每请求跑、客户端导航也跑；插件只在 app 创建时跑一次；组件钩子跟着实例走。把"我以为它每次都跑"的清单列出来，生命周期 bug 就治好了大半。

## 4. 钩子的三板斧用法

```ts
// ① 插件：全站埋点与页面耗时
export default defineNuxtPlugin((nuxtApp) => {
  const t: Record<string, number> = {};
  nuxtApp.hook('page:start', () => { t.start = performance.now(); });
  nuxtApp.hook('page:finish', () => { sendBeacon('/api/metrics', { nav: performance.now() - t.start }); });
});

// ② defineNuxtRouteMiddleware：鉴权/AB 分流（可中断导航）
export default defineNuxtRouteMiddleware((to) => {
  if (to.path.startsWith('/admin') && !useAuth().loggedIn.value)
    return navigateTo('/login');
});

// ③ Nitro 服务端插件：启动期预热（只跑一次）
export default defineNitroPlugin(() => { warmTheCache(); });
```

对应 Next 世界：①≈instrumentation/layout 客户端上报（呼应 next-error-loading 第 4 节）、②≈middleware.ts（但 Nuxt 分"服务端运行时"与"客户端运行时"两套执行上下文，Next 只有 Edge 一份）、③≈无对等物（Nitro 插件是独立引擎赠品，nuxt-server-routes 细讲）。

## 5. 调试台：Nuxt DevTools

装 @nuxt/devtools（默认内置），Time travel 面板能看：每次导航的钩子序列、middleware 执行与耗时、payload 内容（水合数据一目了然——nuxt-hydration 的排查主战场）、组件树与环境开关。**学生命周期最好的老师就是它**：跑一次 dev，把首屏和一次 SPA 导航各录一遍，时间线从抽象变具象。

## 6. 自检清单

- [ ] 能默写服务端 7 站时间线，说出哪三站能"短路出栈"；
- [ ] 分清 route middleware（每次导航）与插件（每次 app 创建）的执行频次；
- [ ] payload 在客户端时间线的哪一站被消费说得清；
- [ ] 三种钩子注册入口（nuxtApp.hook / defineNuxtRouteMiddleware / defineNitroPlugin）各举一例用途；
- [ ] DevTools 的 timeline 与 payload 面板会用。

## 7. 小结

生命周期是框架的"时刻表"：Nitro 管请求进站出站，Nuxt app 管水合与导航，Vue 管组件实例。把时刻表背熟，任何"为什么我的代码没跑/跑了两次/跑早了跑晚了"都能在 30 秒内定位到站。下一关专治水合：那个 payload 与真实 DOM 的对账现场。

🚀 部署预告：下一关 nuxt-hydration 直面 SSR 的第一大敌——水合不匹配：三大来源、ClientOnly 的正确用法与 import.meta.client 的编译期魔法。
