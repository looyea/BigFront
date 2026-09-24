# L2 作业：缓存模型

## 一、知识回顾
1. queryKey 序列化规则（对象序无关/数组序有关）与前缀匹配四档。
2. staleTime/gcTime 双时钟与 fresh→stale→GC 状态机。
3. invalidateQueries 的 refetchType 语义与被动刷新三件套。

## 二、代码实操
1. 为一个「订单」资源写 key 工厂（all/list/detail/items），并实现「改一条明细 → 前缀失效整个订单」。
2. 用 staleTime: 5000 复刻 fresh/stale 两态：5 秒内切组件看秒出，5 秒后看 isFetching 角标，DevTools 截一张三态图。
3. 断网后触发一次 invalidate 并恢复网络，观察 paused→自动续取；再把 refetchType 改 'none' 对比 active 的差异。

## 三、思考题
1. 为什么「改数据后 setQueryData 手改」常常不如 invalidate 稳？什么场景手改反而更好？
2. staleTime 调大能省请求，但有哪两种 UX 代价？

## 四、延伸阅读
- TanStack Query 官方：guides/query-keys、guides/caching、guides/query-invalidation、guides/polling
- 官方 key 最佳实践：query-options 指南

## 五、自查清单
- [ ] 全站 queryKey 出自工厂，无裸字符串拼接
- [ ] key 中无时间戳/随机数
- [ ] 四类数据各配了明确 staleTime
- [ ] 变更后失效走 invalidate，手改缓存的场景能说出理由
