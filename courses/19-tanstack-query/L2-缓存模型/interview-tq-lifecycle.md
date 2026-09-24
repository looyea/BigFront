# 面试题：数据生命周期（tq-lifecycle）

### 1. (原理类) 描述一条缓存的完整生命周期。
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/caching

创建(fresh)→过 staleTime 变 stale→被触发时机兑现重取；订阅归零后过 gcTime 被回收出内存。

### 2. (原理类) staleTime 与 gcTime 一句话区分。
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults

前者管「数据多久该再验证」，后者管「无人要的数据多久丢出内存」。

### 3. (坑类) 「缓存只有 5 分钟寿命」这个说法错在哪？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/caching

混淆两时钟：5 分钟是订阅归零后的 GC 时间；一直有人订阅则永不回收，只按 staleTime 反复后台刷新。

### 4. (实战类) 哪些数据该设 staleTime: Infinity？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/initial-query-data

字典、配置、地理数据等近乎静态的；常配 initialData/预取，全站只取一次。

### 5. (实战类) 实时行情类怎么处理？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/polling

staleTime:0 + refetchInterval 秒级轮询，或直接 WebSocket setQueryData 推送写缓存。

### 6. (对比类) v4 的 cacheTime 改名 gcTime 传递了什么信息？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5

旧名让人误以为是「数据可用时长」；gc 明确它是垃圾回收计时，与新鲜度无关。

### 7. (设计类) staleTime 对「加载指示器」的影响？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/background-fetching-indicators

staleTime 内挂载秒出缓存且不发请求→无 loading；过期后后台取→isFetching 角标；策略决定 UI 节奏。

### 8. (原理类) 触发重取需要同时满足什么？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/window-focus-refetching

数据 stale + 触发时机（挂载/聚焦/重连/手动）双条件；fresh 数据遇时机也不取。

### 9. (实战类) refetchOnMount 的三种取值语义？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/queries

true 按 stale 决定；false 永不挂载取；"always" 不管新旧必取。

### 10. (坑类) 调大 gcTime 的隐藏成本？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/caching

内存驻留更多数据条目；大数据列表（几 MB JSON）要权衡，必要时 removeQueries 主动清。

### 11. (设计类) 登出时与生命周期相关的清理动作？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient

client.clear() 是最稳的「全部作废」；只清 stale 不够，fresh 数据也得走。

### 12. (开放类) 给你一个全新业务，怎么定两套时钟？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults

按数据画时效矩阵：秒级/分钟/小时/静态四档配 staleTime；gcTime 默认起步，性能剖析后再动。

### 13. (原理类) invalidate 之后数据算 fresh 还是 stale？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation

被立刻标 stale（对 active 还顺带重取，成功后回 fresh）；invalidated 标记让挂载即取。

### 14. (实战类) 为什么 dev 环境感觉「缓存不生效」？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults

默认 staleTime:0 + 聚焦重取两默认叠加，看起来每次都取；这是安全默认不是 bug。

### 15. (对比类) staleTime 与 HTTP 缓存层怎么分工？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/caching

Query 是应用内缓存，不看 Cache-Control；HTTP 层(如 max-age/SW)管网络层重复。两层各自 TTL 要对齐预期，别叠加翻倍。
