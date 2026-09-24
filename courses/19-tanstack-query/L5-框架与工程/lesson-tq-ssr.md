# SSR 与水合：服务端先把数据备好

## 一、客户端取数的原罪

纯 CSR 的数据获取发生在「HTML 到手、JS 跑起来」之后：白屏→骨架→真内容三连跳，SEO 也只拿到空壳。SSR 的解法：**渲染 HTML 之前就在服务器上把数据取好**，首帧即真内容——这也是 za-next、jo-ssr 两关讲过的同一命题，Query 交出的是最成体系的答案。

## 二、每请求一个 QueryClient

水合的本质是把服务端缓存「复印」进浏览器。复印就要原件：

```tsx
// server.tsx —— 每次请求 new 一个，绝不模块级共享！
const queryClient = new QueryClient();
await queryClient.prefetchQuery({ queryKey: ['posts'], queryFn: fetchPosts });
const dehydratedState = dehydrate(queryClient);   // 缓存 → 可序列化 JSON
```

模块级单例会的服务端全局缓存——用户 A 的请求带着用户 B 的数据，经典安全事故。客户端侧 `QueryClientProvider` 接一个 Provider 包 `HydrationBoundary state={dehydratedState}`，hydrate() 把 JSON 灌回内存缓存，首帧 useQuery 直接命中——**不再发第二次请求**。

## 三、streaming：不等最慢的那个

advanced-ssr 的进阶形态：外壳先 flush，慢数据用 Suspense 边界占位，好了再流式补进页面：

```tsx
// 服务端： prefetch 不 await，把 promise 塞进边界
const postsPromise = queryClient.prefetchQuery({ queryKey: ['posts'], queryFn });
<HydrationBoundary state={dehydrate(queryClient)}>
  <Suspense fallback={<Skeleton />}>
    <Posts promise={postsPromise} />   {/* 内部 useSuspenseQuery */}
  </Suspense>
</HydrationBoundary>
```

TTFB 由「最慢接口」降为「框架外壳」，配合 useSuspenseQuery（数据没好就 suspend，error 走 ErrorBoundary）就是 Next.js App Router 里 'use client' 组件的标准玩法。

## 四、何时值得上 SSR

判据仍是 za-next 那三条：SEO 抓首屏、首屏速度是产品指标、内容在服务器才拿得到（鉴权页）。纯后台/内部工具 CSR 足够——别为了用而用。Query 的 SSR 方案是「客户端代码一行不改，取数时机前移」，比 RSC 全量迁移温和得多，存量 React 应用可渐进接入。

## 五、坑位清单

① dehydrate 只带「已完成的查询」——prefetch 没 await/没完成就被复印，水合等于没做；② persister 与 SSR 同时用时 store 必须客户端专属（tq-persist 见）；③ queryKey 在 server/client 必须逐字节一致（key 工厂在此显威力）；④ streaming 下 hydrate 时机靠 HydrationBoundary 自己排队，手动调 hydrate 容易抢跑。

## 小结
Query 的 SSR 三板斧：每请求 new client + prefetch 预热 → dehydrate 复印 → HydrationBoundary 灌回；进阶用 streaming + useSuspenseQuery 把 TTFB 和慢接口解耦——「同样的组件，更早的取数」。

## 部署预告
拿 Next.js Pages Router 跑官方 ssr 示例：service worker 掐掉网络刷新页面，验证首屏数据来自水合而非请求（Network 里应只有 RSC/文档请求）；再换 App Router 版试 streaming，观察慢接口不再卡整页。
