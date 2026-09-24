# L1 作业：核心认知

## 一、知识回顾
1. server state 的三个本质特征（只读镜像、会过期、共享）与手写 fetch 的七个痛。
2. status 与 fetchStatus 两维模型；isLoading、isFetching、isPending 的区分。
3. QueryClient 三合一职责（缓存容器/全局配置/命令式 API）与 Provider 的意义。

## 二、代码实操
1. 用 useQuery 完成一个「用户列表 → 点击进详情（user/:id）」两页应用，观察列表与详情各自 key 的去重与缓存命中。
2. 在 defaultOptions 里把 staleTime 设为 10s、retry 设为 0，配合一个随机失败的接口，对比修改前后的重试与 loading 表现。
3. 在组件外（比如一个按钮 onClick）用 client.getQueryData 与 client.invalidateQueries 各做一次读写，体会命令式 API。

## 三、思考题
1. 为什么 Query 坚持「queryFn 不抛错就算成功」，连 404 都不管？这样设计的边界在哪？
2. client 必须稳定引用、SSR 必须每请求新建——这两条规则共同指向什么本质？

## 四、延伸阅读
- TanStack Query 官方：overview、guides/queries、reference/classes/QueryClient
- 官方 comparison 页（Query vs SWR/RTK）

## 五、自查清单
- [ ] 全站只有一个稳定引用的 QueryClient（且知道在哪 new 的）
- [ ] 所有 fetch 都透传了 signal
- [ ] queryFn 里写了 res.ok 检查
- [ ] 会用 isLoading/isFetching 分别驱动整页骨架与角标转圈
