# QueryClient 与 Provider

## 一、QueryClient 是什么

一个 QueryClient = 一块查询缓存 + 一组全局配置 + 一套命令式 API。它不属于任何组件，是 Query 世界的「总店」：所有 useQuery 的读写最终都落到它身上的 QueryCache（查询）与 MutationCache（变更）。

```tsx
// 目的：QueryClient 构造——defaultOptions 立全站查询/变更策略，个别查询再覆盖
const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },   // 全局：1 分钟内不重取、失败只重试 1 次、聚焦不刷新
    mutations: { retry: 0 },   // 变更默认不重试（重试写操作易重复提交）
  },
});
// ✅ 生产把激进默认收紧（staleTime>0、关掉聚焦刷新），开发期才吃库默认的“新鲜至上”
// ❌ mutations 设 retry>0 → 提交失败自动重发，可能写重复数据；变更重试要极其克制
```

defaultOptions 是全站策略的抓手：接口普遍 1 分钟不新鲜就把 staleTime 全局设 60s，个别页面再覆盖。

## 二、Provider 注入

```tsx
// 目的：Provider 注入——把 client 交给组件树，树内 hook 都经它找缓存
<QueryClientProvider client={client}>{children}</QueryClientProvider>   // 显式交出缓存所有权 = SSR 每请求一 client、测试隔离的抓手
// ✅ 与 Zustand“无 Provider 单例”相反：Query 强制显式注入，换来得作用域可控
// ❌ 忘了套 Provider 就用 useQuery → 报 "No QueryClient set, use QueryClientProvider to set one"
```

组件树里任何 useQuery/useMutation/useQueryClient 都经这个 Provider 找 client——与 Zustand 的「无 Provider 单例」相反，Query 强制你显式交出缓存所有权，这正是 SSR 每请求一 client 与测试隔离的抓手（jo-store 同款语义）。

## 三、命令式 API：client 脱离 React 用

```ts
// 目的：client 命令式 API——脱离 React 也能读写缓存/预取/失效（vanilla-first，路由守卫、WS 回调可用）
client.getQueryData(['user', 1]);          // 读缓存（同步，可能 undefined）
client.setQueryData(['user', 1], fn);      // 改缓存（乐观更新主力，fn(prev)=>next）
await client.prefetchQuery({ queryKey: ['u'], queryFn }); // 预取：命中缓存则不发请求
client.invalidateQueries({ queryKey: ['u'] });            // 标失效：触发订阅中的查询重取
await client.fetchQuery({ ... });          // 不存在或过期则取并等结果（返回 Promise）
// ✅ 在 WS 收到“订单更新”消息处 invalidateQueries(['orders'])，让所有在看的页面自动刷新
// ❌ 组件渲染期直接 setQueryData 改缓存 → 触发重渲循环，写缓存要放到事件/action 里
```

路由守卫、事件总线、WebSocket 回调里都能用（za-store-api、jo-store 的 vanilla 能力，Query 从第一天就是 vanilla-first，React 层只是薄壳）。

## 四、client 的稳定引用坑

```tsx
// 目的：client 引用必须稳定——每次渲染 new 会让缓存永远为空
// 反例：每次渲染 new —— 缓存永远空的
function App() { const client = new QueryClient(); ... }   // ❌ 每帧新 client，前一次写入的缓存随旧 client 一起被丢弃
// 正例：模块级单例 或
const [client] = useState(() => new QueryClient());   // ✅ useState 惰性初始化只 new 一次，引用稳定
// ✅ 纯 CSR 用模块级单例最省事；SSR 必须每请求新建（全局单例=跨请求缓存泄漏，A 看到 B 数据）
```

模块级单例适合纯 CSR 应用；**SSR 必须每请求新建**（全局单例=跨请求缓存泄漏，A 用户看到 B 用户数据，tq-ssr 专讲）。

## 五、多 client 场景

一个应用默认一个 client；出现「完全隔离的两块缓存」（多租户互不可见、测试并行、Storybook 每例干净）才加第二个——通常直接用不同 queryKey 前缀切命名空间更省事（tq-query-key）。

## 小结
QueryClient=缓存+配置+命令式三合一；Provider 显式注入换来 SSR/测试隔离能力；client 引用必须稳定、SSR 必须每请求新建、全局策略进 defaultOptions。

## 部署预告
本地把 staleTime 设成 10 分钟后开两个组件订阅同一 key，观察第二个组件秒出缓存数据不再发请求；再用 client.getQueryData 在组件外的 console.log 里偷看缓存内容。
