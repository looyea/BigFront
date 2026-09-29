# Devtools 与测试

## 一、面板：缓存的 X 光机

```tsx
// 目的：挂 ReactQueryDevtools 面板——缓存的 X 光机，实时看 key/状态/data/重试
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
<QueryClientProvider client={qc}>
  <App />
  <ReactQueryDevtools initialIsOpen={false} />   {/* 默认收起，右下角按钮唤起；生产整包摇掉 */}
</QueryClientProvider>
// ✅ 面板里手动 invalidate 任意条目验证“失效半径”、数重试第几次——L2 双时钟/前缀失效实验主场
// ❌ 把 devtools 打进生产 bundle：白增体积 + 暴露缓存数据，安全隐患
```

面板里每一条缓存查询实时显示：queryKey、状态（fresh/stale/fetching/inactive）、data 原文、fetcher 计数。三个高频动作：**手动 invalidate** 任意条目（验证失效半径）、**改 refetch 交互按钮**（refetch / remove / reset）、**观察时序**（哪条先飞、重试第几次）。L2 双时钟实验、key 前缀失效实验，主场都在这块面板——不会用它，等于闭眼调缓存。

## 二、生产环境怎么办

devtools 是开发依赖，构建时整包摇掉；线云上想要「缓存可观测」，正路是把 queryClient 挂到调试窗口（`window.__qc`）供控制台读写，或接自建埋点（QueryCache 的 onLoad/onUpdate 订阅，上报 key/时长/重试数——注意脱敏）。别把面板打进生产 bundle，体积和信息安全都不划算。

## 三、测试第一课：关掉重试和定时器

```tsx
// 目的：测试专用 client——retry:false、gcTime:0、staleTime:Infinity，快且零串扰
const testClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0, staleTime: Infinity },  // 失败秒回断言、测间不残留、防聚焦重取抖数据
  },
});
render(<QueryClientProvider client={testClient()}><App /></QueryClientProvider>);   // 每个测试新建，缓存互不污染
// ✅ 包一层 renderWithProviders 复用，别每处手搓 Provider
// ❌ 沿用默认 retry:3：失败断言要等指数退避 30s+ 才落 error，测试慢且易超时
```

retry:0 让失败断言秒回（否则退避等 30s 起步）；gcTime:0 测试间零串扰；staleTime:Infinity 防聚焦重取抖数据。组件库包一层 renderWithProviders，别每处手搓 Provider。

## 四、mock 网络：MSW 是官方推荐

```ts
// 目的：MSW 在网络层拦 fetch（而非 mock 模块）——queryFn 真 fetch 照跑，测整条链
// msw handlers：拦 fetch 而不是 mock 模块——Query 怎么发都测得到
server.use(http.get('/api/todos', () => HttpResponse.json([{ id: 1 }])));   // 注册一条 GET mock 响应
await waitFor(() => expect(screen.getByText('task-1')).toBeInTheDocument());   // 异步渲染完成后断言
// ✅ 失败路径 handler 返 500 断错误 UI、慢路径 await delay(500) 断骨架——比 jest.mock(axios) 保真
// ❌ 不同步断言：fetch 是异步的，render 后立刻 getByText 拿不到，必须 waitFor
```

Mock Service Worker 在网络层拦截，queryFn 里的真 fetch 照常跑——测的是「组件+Query+网络层」的整条链，比 jest.mock(axios) 保真。失败路径：handler 返回 500，断言 error UI；慢路径：resolver 里 await delay(500)，断言骨架。testing 官方指南的三件套（关重试 / MSW / 每测试新 client）就是标准模板。

## 五、写操作的测试套路

mutation 测试关注「点完按钮后缓存对不对」：先 hydrate/setQueryData 铺初始缓存 → fireEvent 提交 → MSW 断言请求体（mutate 的 variables 是否原样送达）→ waitFor 缓存被 invalidate/更新。乐观更新则测「失败注入」：handler 返回 500，断言 UI 先变后滚回——tq-optimistic 的四拍全部可验。

## 小结
Devtools 面板是调 Query 的第一现场（invalidate/看状态/数重试）；测试三件套=每测试新 client+retry:false+MSW 网络层拦截；mutation 测请求体与缓存联动——可观测与可测试是同一种设计的结果。

## 部署预告
给 L3 的 todo 页配 MSW + retry:false 写三条测试：首屏成功渲染、接口 500 出错误态、新增提交后列表出现新项且 MSW 收到正确 body；再打开 devtools 手动 invalidate ['todos'] 观察测试外的真实刷新。
