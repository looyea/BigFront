# QueryClient 与 Provider

## 一、QueryClient 是什么

一个 QueryClient = 一块查询缓存 + 一组全局配置 + 一套命令式 API。它不属于任何组件，是 Query 世界的「总店」：所有 useQuery 的读写最终都落到它身上的 QueryCache（查询）与 MutationCache（变更）。

```tsx
const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});
```

defaultOptions 是全站策略的抓手：接口普遍 1 分钟不新鲜就把 staleTime 全局设 60s，个别页面再覆盖。

## 二、Provider 注入

```tsx
<QueryClientProvider client={client}>{children}</QueryClientProvider>
```

组件树里任何 useQuery/useMutation/useQueryClient 都经这个 Provider 找 client——与 Zustand 的「无 Provider 单例」相反，Query 强制你显式交出缓存所有权，这正是 SSR 每请求一 client 与测试隔离的抓手（jo-store 同款语义）。

## 三、命令式 API：client 脱离 React 用

```ts
client.getQueryData(['user', 1]);          // 读缓存
client.setQueryData(['user', 1], fn);      // 改缓存（乐观更新主力）
await client.prefetchQuery({ queryKey: ['u'], queryFn }); // 预取
client.invalidateQueries({ queryKey: ['u'] });            // 失效
await client.fetchQuery({ ... });          // 不存在或过期则取并等结果
```

路由守卫、事件总线、WebSocket 回调里都能用（za-store-api、jo-store 的 vanilla 能力，Query 从第一天就是 vanilla-first，React 层只是薄壳）。

## 四、client 的稳定引用坑

```tsx
// 反例：每次渲染 new —— 缓存永远空的
function App() { const client = new QueryClient(); ... }
// 正例：模块级单例 或
const [client] = useState(() => new QueryClient());
```

模块级单例适合纯 CSR 应用；**SSR 必须每请求新建**（全局单例=跨请求缓存泄漏，A 用户看到 B 用户数据，tq-ssr 专讲）。

## 五、多 client 场景

一个应用默认一个 client；出现「完全隔离的两块缓存」（多租户互不可见、测试并行、Storybook 每例干净）才加第二个——通常直接用不同 queryKey 前缀切命名空间更省事（tq-query-key）。

## 小结
QueryClient=缓存+配置+命令式三合一；Provider 显式注入换来 SSR/测试隔离能力；client 引用必须稳定、SSR 必须每请求新建、全局策略进 defaultOptions。

## 部署预告
本地把 staleTime 设成 10 分钟后开两个组件订阅同一 key，观察第二个组件秒出缓存数据不再发请求；再用 client.getQueryData 在组件外的 console.log 里偷看缓存内容。
