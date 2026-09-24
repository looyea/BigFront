# 面试题：Devtools 与测试（tq-devtools）

### 1. (工具) React Query Devtools 能观察哪些信息？
**来源**：https://tanstack.com/query/latest/docs/framework/react/devtools

缓存条目列表（key/状态/fresh-stale-inactive/fetching 计数/data 原文）、每条的 refetch/remove/reset 手动按钮、全局 invalidate 入口、query 详情里的 fetch 历史与 observers。调试 staleness、失效半径、重试风暴的第一现场。

### 2. (工程) devtools 会进生产 bundle 吗？怎么控制？
**来源**：https://tanstack.com/query/latest/docs/framework/react/devtools

它是独立包 @tanstack/react-query-devtools，生产构建按环境条件挂载或干脆只 dev 依赖（摇树+DCE）。替代生产观测方案：window 暴露 client、QueryCache 订阅上报埋点（脱敏 key 与数据体），别裸奔面板。

### 3. (测试) 官方推荐 Query 测试三件套？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/testing

① 每个测试新 QueryClient（retry:false、gcTime:0 防串扰与退避等待）；② MSW 在 fetch/XHR 网络层 mock 成功失败慢三种响应；③ 组件包统一 Provider helper。断言围绕 UI 状态与缓存联动，而不是 mock 调用次数。

### 4. (测试) 为什么 retry:false 在测试里几乎是必配？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/testing

默认 3 次指数退避让失败用例从毫秒变数十秒，且重试期间的中间态会让断言飘忽。测试要确定性：关掉重试快速到达终态；专门测重试的用例再单独开。

### 5. (测试) MSW 与 jest.mock(api) 的本质区别？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/testing

MSW 拦截的是网络协议层，queryFn 里的真 fetch 照常执行——测到「组件+Query 观察者+序列化+重试」全链路。mock 模块层测的是「你假设的实现」，链路一换（axios 换 fetch）mock 全失效。保真度与可维护性双输的是后者。

### 6. (测试) 怎么测一个乐观更新的回滚路径？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/testing

铺初始缓存（hydrate 或 setQueryData）→ MSW 注入失败响应 → 断言三步：点击后 UI 立刻变（乐观生效）、失败落地后 UI 回到快照（回滚生效）、最终服务器数据经 invalidate 对齐。缺一步都不算测到四拍。

### 7. (测试) mutation 的用例该断言什么？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/testing

两件事：请求体（MSW handler 里断言收到的 variables 是否原样送达）与缓存联动（onSettled 后目标查询是否被 invalidate/更新，表现为列表新增/变化）。variables 是输入契约，缓存是输出契约。

### 8. (测试) Suspense 用例（useSuspenseQuery）怎么测？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/useSuspenseQuery

外层包 Suspense fallback，断言序列：先见 fallback（data 未决）→ waitFor 真内容出现；错误路径把 MSW 置为失败，断言最近 ErrorBoundary 接住。fallback 与 boundary 都造出来，断言才有落点。

### 9. (调试) 线上偶现「数据不刷新」，没有 devtools 怎么查？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient

远程 debug 口子：暴露 client，控制台执行 getQueryCache().find 看目标条项的 state（isInvalidated/fetchedAt/dataUpdatedAt）。八成是 staleTime 过大或失效 key 没打中；定位思路与面板一致，只是手速要求高。

### 10. (工具) 怎么用面板区分「真秒出」与「缓存命中后后台重取」？
**来源**：https://tanstack.com/query/latest/docs/framework/react/devtools

看条目颜色与 fetchStatus：fresh 秒出不会发请求；stale 命中会短暂无新请求但条目闪过 fetching 状态、updated 时间刷新。配合 Network 面板双验：只有水合/首次是真无请求，后续“快”都是 stale 重取。

### 11. (调试) 重试风暴（一次故障打几十请求）的成因与治理？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-retries

默认 3 次 × 多组件订阅同 key × 聚焦重取叠加。治理：全局 retry 函数按状态码分类（4xx 不重试）、失败面大时 refetchOnWindowFocus 降级、重要接口加 retry 上限+退避封顶（retryDelay 控制）；测试与压测都要注入故障看请求数。

### 12. (实践) 怎么给 devtools 藏进仅内部环境可见？
**来源**：https://tanstack.com/query/latest/docs/framework/react/devtools

条件挂载：process.env.NODE_ENV 或构建时 flag + 环境注入（import.meta.env），生产构建走 DefinePlugin 常量折叠让整棵子树 DCE。内部灰度域名另配开关拉面板组件的懒加载 chunk，平时不在包里。

### 13. (测试) 集成测试里多条查询的时序怎么稳定断言？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/testing

waitFor 查「最终可见态」而不是 sleep 猜时长；MSW 用 delay 制造确定的快慢；需要全部 settle 时 await client 的 Promise.allSettled(queryCache 的 refetch) 或用 invalidateQueries 返回的 Promise。断言行为与数据，不断言毫秒数。

### 14. (原理) gcTime:0 在测试配置里的意义？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/testing

测试并行/串行跑多条用例，上条的缓存条目若留在内存（默认 gcTime 5min）可能污染下条断言（比如缓存命中导致的零请求）。gcTime 归零让订阅一撤条目即焚，每用例从干净缓存起跑。

### 15. (实践) 埋点/监控想统计取数耗时与重试数，从哪取数？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryCache

new QueryClient 时配 queryCache 的订阅（onUpdate 事件），从 query.state 取 fetchDuration、fetchFailureCount、key、status 上报。注意脱敏：key 可能含用户实体 id，data 绝对不传原文只传指纹与长度。
