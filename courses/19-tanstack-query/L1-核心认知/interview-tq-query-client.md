# 面试题：QueryClient 与 Provider（tq-query-client）

### 1. (原理类) QueryClient 内部管着哪两本账？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient

QueryCache（所有查询与其状态）和 MutationCache（所有变更），client 方法都是对两本账的操作门面。

### 2. (实战类) defaultOptions 能配哪些层？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/interfaces/QueryClientConfig

queries / mutations / 细到 useQuery、useInfiniteQuery 等 hook 级，粒度从全局到单个 API 族。

### 3. (坑类) 组件里直接 new QueryClient() 会发生什么？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient

每次渲染新空缓存：数据永远 loading、refetch 风暴。用 useState 初始化器或模块单例保住引用。

### 4. (设计类) 为什么 Query 需要 Provider 而 Zustand 不需要？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/QueryClientProvider

Query 的缓存必须可交换（SSR 每请求、测试隔离、多 client），显式注入是这一能力的代价与入口。

### 5. (实战类) useQueryClient 的典型用途？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/useQueryClient

拿 client 调 invalidateQueries/setQueryData 做变更后的缓存联动，或事件回调里命令式 prefetch。

### 6. (设计类) SSR 里 client 应该活多久？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/ssr

一个请求一个：服务端渲染结束即弃，dehydrate 出快照传给客户端，绝不可模块级共享。

### 7. (实战类) client.clear() 什么时候用？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient

登出切换账号时一键清空缓存，防上一用户数据残留；比逐个 removeQueries 稳妥。

### 8. (对比类) getQueryData 与 useQuery 读缓存的区别？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient

前者一次性快照不订阅（非响应式），后者挂钩子随更新重渲；组件内别用 getQueryData 当读取器。

### 9. (原理类) setQueryData 会触发重取吗？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient

不会，它只改缓存并通知订阅者；数据是否再新鲜仍由 stale/失效机制决定。

### 10. (实战类) 多 QueryClient 嵌套支持吗？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient

支持——内层 Provider 换 client 即可做局部隔离域；但常规需求用 key 前缀更简单。

### 11. (设计类) mount 时 client.setQueryData 预置数据，和 initialData 谁优先？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient

同一 key 首次 useQuery 时 initialData 生效；client 预置则命中已有缓存，两者都是「首帧有数据」的手段。

### 12. (坑类) dev 环境热更新后缓存去哪了？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient

client 定义在组件/模块里被重建即失忆；HMR 保留策略或把 client 放 app 外围单例可缓解。

### 13. (实战类) prefetchQuery 和 fetchQuery 差在哪？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient

prefetch 发完就不管（fire-and-forget 预热），fetchQuery 等结果可 await——路由场景前者常用。

### 14. (开放类) 让你设计跨应用共享缓存怎么办？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/ssr

client 实例不序列化；共享的应是 dehydrate 快照或持久化层（tq-persist），进程内多 app 同构才可共 client。

### 15. (对比类) QueryClient 与 Jotai 的 createStore 哲学异同？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient

同为「显式容器+作用域」；Query 的容器天生带过期与 GC 时钟，Jotai 的值永不过期——镜像 vs 本源。
