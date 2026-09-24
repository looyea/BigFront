# 面试题：Query vs SWR vs RTK Query（tq-vs-swr）

### 1. (对比) 一句话概括 Query 与 SWR 的差异？
**来源**：https://tanstack.com/query/latest/docs/framework/react/comparison

同一个 stale-while-revalidate 命题的两种面积：SWR 是轻取数 Hook（GET 缓存+聚焦重取+mutate 轻量版），Query 是完整缓存系统（失效三级匹配、mutation 全套生命周期、infinite/并行/SSR/持久化全家桶）。需求越重，Query 的面积越回本。

### 2. (对比) SWR 的 mutate 与 Query 的 useMutation 差在哪？
**来源**：https://tanstack.com/query/latest/docs/framework/react/comparison

SWR 的 mutate 偏「改缓存/触发重取」，无乐观四拍与 useMutationState；Query 的 useMutation 有 onMutate/onSuccess/onError/onSettled、variables 追踪、pending 计数、mutationCache 全局钩子。写逻辑复杂度的分水岭。

### 3. (对比) 无限滚动两家怎么做？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/useInfiniteQuery

Query 内建 useInfiniteQuery（pages/pageParams 契约、getNextPageParam 判终点）；SWR 靠 useSWRInfinite 以「索引生成 key」路线，每页一条独立缓存。每页独立=单页失效容易、整链失效与游标传递要自己拼——两种建模思路的代表作。

### 4. (选型) 什么信号一出现就该从 SWR 迁 Query？
**来源**：https://tanstack.com/query/latest/docs/framework/react/comparison

四个典型：需要失效树（改一条精确刷一片）、乐观更新要回滚、SSR 数据要无缝进缓存生命周期、多标签/离线同步。出现任一条且开始手写补丁，就是迁移信号——补丁数是最诚实的指标。

### 5. (选型) RTK Query 与 Redux 的关系决定了什么？
**来源**：https://tanstack.com/query/latest/docs/framework/react/comparison

RTK Query 的缓存住在 Redux store、失效走 tag 订阅，享受 Redux DevTools 时间旅行，代价是全家桶重量与心智。已有 Redux 且满意的项目顺手；新项目选它等于连 Redux 一起选——先评估状态库。

### 6. (生态) 跨框架能力怎么排？
**来源**：https://tanstack.com/query/latest/docs/framework/react/comparison

Query 官方提供 React/Vue/Solid/Svelte/Angular 五端同构；SWR 根在 React（Vue 有社区 swrv 代餐），RTK Query 基本 React 优先。多栈团队或 Vue 项目想要全套缓存语义，Query 几乎唯一解——本包跨包生态维度的收官答案。

### 7. (对比) 两家的 SSR 支持程度？
**来源**：https://tanstack.com/query/latest/docs/framework/react/comparison

SWR 的水合路径以初始 data 注入为主（无缓存生命周期的深拷贝语义）；Query 有 dehydrate/HydrationBoundary/streaming 整案（L5）。SSR 重的内容站两家差一个量级，这也是官方 comparison 表的重行。

### 8. (深度) 为什么 Query 的 staleTime 是 per-query、SWR 的更像全局策略？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults

Query 的每条查询自带 freshness 状态机（staleTime 入 defaultOptions 也能全局配）；SWR 的 refresh 行为更多挂在 hook 参数与全局配置上，per-entry 的 staleness 表达没那么显式。控制权粒度差异的体现。

### 9. (实战) 团队都熟 Redux，新需求是重缓存，怎么决策？
**来源**：https://tanstack.com/query/latest/docs/framework/react/comparison

数据层归 RTK Query（与 store 同栈、DevTools 统一），客户端状态留在 Redux slice——同生态红利最大化。警惕的是别为用 RTKQ 把简单 GET 也搬进 tag 体系，tag 管理成本会说话。

### 10. (实战) bundle size 敏感场景（嵌入式/落地页）选谁？
**来源**：https://tanstack.com/query/latest/docs/framework/react/comparison

SWR 明显更轻（核心个位数 KB），Query 全家桶体积大得多。落地页只要「缓存+轮询」时，SWR 甚至裸 fetch+状态也够——体积是选型第六维，别拿航母送外卖。

### 11. (对比) Query 与 SWR 各自的默认值哲学？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults

Query 默认激进保新鲜（staleTime 0、聚焦重取、重试 3 次）并明示「按应用调」；SWR 默认同样重验证但旋钮更少，把简单留给用户。一个给足控制力要你调，一个定好默认你少想——设计观分野。

### 12. (坑) 迁移 SWR→Query 最常见的三个不适应点？
**来源**：https://tanstack.com/query/latest/docs/framework/react/comparison

① 从「数组 key 隐式匹配」到前缀/exact/predicate 三档；② 从 mutate(data) 直接改缓存到 invalidate/setQueryData 分工与 mutation 生命周期；③ 从 useSWR(url, fetcher) 的宽松到 v5 对象参数与 key 工厂的规矩。认知负荷全在失效模型。

### 13. (生态) Svelte/Vue 项目为什么不直接上 SWR？
**来源**：https://tanstack.com/query/latest/docs/framework/react/comparison

SWR 核心 API 依赖 React hook 语义（Suspense、useSyncExternalStore 等），Vue 生态由 swrv 代餐但更新节奏与功能面有限；TanStack Query 官方五端同构、文档同权——框架平权角度 Query 更友好。

### 14. (深度) 「SWR 也是一种缓存策略名」，那两库实现的策略相同吗？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/background-fetching-indicators

底层都是 stale-while-revalidate：先给陈旧、后台验证、到达替换。差异在兑现机制：Query 的 staleness 是带类型的状态（fresh/stale/inactive）+ 多触发时机矩阵；SWR 把它压成「挂载/聚焦即 revalidate」。同一策略的两种数据模型。

### 15. (架构) 怎么向老板解释「为什么多一个 Query 而不是继续 useEffect」？
**来源**：https://tanstack.com/query/latest/docs/framework/react/comparison

三笔账：bug 账（竞态/重复请求/状态拷贝类 bug 的存量清零）、性能账（去重+缓存命中+失效联动省掉的请求数，Devtools 截图最有说服力）、体验账（秒出、不闪骨架、乐观响应）。用现网数据算，不空谈。
