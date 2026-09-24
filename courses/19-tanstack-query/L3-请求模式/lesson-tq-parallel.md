# 并行请求与预取

## 一、并行是默认，瀑布才是坑

两个 useQuery 并排写，挂载即并行发两请求——Query 里「并行」不需要 API。真正要防的是**瀑布**：组件 A 渲染完才挂载 B、B 的 key 还要 await A 的结果；或者 queryFn 里 `await a; await b;` 手写串行。官方 request-waterfalls 指南的处方：**尽早声明、用 prefetch 把取数提前到渲染之前**。

## 二、useQueries：一个都不少地批量发

```tsx
const results = useQueries({
  queries: repoIds.map(id => ({
    queryKey: ['repo', id],
    queryFn: () => fetch('/api/repo/' + id).then(r => r.json()),
  })),
};
// results: 与入参等长的状态数组，各自 data/isPending 独立
```

数组长度可变（加卡片=加请求），每个子查询仍是独立缓存条目（key 含 id），单独失效互不牵连。列表页「首屏 6 个头像卡」这种就它了。

## 三、prefetch：把请求做在点击之前

```ts
// 路由 hover / 渲染列表时预热详情
button.onMouseEnter = () =>
  queryClient.prefetchQuery({ queryKey: ['post', id], queryFn, staleTime: 10_000 });
```

prefetch 的结果**按正常缓存规则入场**——staleTime 内点进详情页秒出，过期则挂载重取（这正是想要的：先给内容，再保新鲜）。usePrefetchQuery 给组件内用，usePrefetchInfiniteQuery 预热无限流；RSC 里还有服务端版 prefetch（tq-ssr 见）。

## 四、预失效（prefetch + invalidate）

后台标签页轮询预热：`invalidateQueries({ refetchType: 'none' })` 只标脏不取，再 `prefetchQuery` 静默取——用户切回时数据既新又不曾看见 loading。高级组合拳，用好了「永远比用户快一步」。

## 五、并行请求的三条纪律

① key 各自独立，别一个 queryFn 打包十个资源（一个变全重取）；② 大数组 useQueries 记得限量/分页，别一次 map 出 200 个并发把网关打挂；③ 有真实依赖才串联（enabled），伪依赖（其实可并行）拆掉——用 DevTools 的瀑布视图数一数：理想首屏是「一横排」，不是「一楼梯」。

## 小结
Query 并行零成本、瀑布才是敌人；useQueries 治动态批量，prefetch 治「点击已在路上」；staleTime 配 prefetch 让预取结果可被消费——把请求做进用户动作之前。

## 部署预告
给卡片列表加 onMouseEnter 预取详情（staleTime 10s），点击进详情测「秒出」；再把首屏三个取数改造成 useQueries 并行，DevTools Network 对比一横排与一楼梯的差别。
