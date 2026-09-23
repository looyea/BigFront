# react-data-fetching 面试题精选

> 共 15 题，覆盖 A 服务端状态心智 / B useQuery 缓存 / C useMutation / D 与 Context·Vue·loader 对照四类。

---

## 一、服务端状态心智（A 类）

### 1. 什么是"服务端状态"？为什么要把它从"客户端状态"里分出来单独管理？

**答**：服务端状态是**别处（服务器）才是真相、你只是持有一份只读缓存镜像**的数据（用户列表、文章）。它天然有：可能过期、需要异步拉取、多组件共享同一份、写后要失效重取等特性。客户端状态是**只有你的 UI 知道**的（弹窗开合、主题、表单草稿）。若不分开、用 Redux/Pinia 手动缓存接口数据，就得自己重复实现缓存/去重/失效，还容易不一致。分开后：服务端状态交给 Query/SWR，客户端全局态交给 store（呼应 vue-state-patterns）。

**来源**：TanStack Query 文档 — The Server State、Accessor: Server cache、Dan Abramov — You Might Not Need a State Management Library

### 2. 只用 useState + useEffect + fetch 取数会有哪些坑？

**答**：① **竞态**——先发后至、快速切换参数拿到旧结果，要 `ignore` 标志/`AbortController`；② 无缓存，同数据多组件各请求一次；③ 加载/错误/重试三态要手写；④ 组件卸载后 setState 报警；⑤ 跨页面共享/失效困难。这些都是 Query 已内置解决的（呼应 react-effect-patterns）。

**来源**：TanStack Query 文档、Dan Abramov — A Complete Guide to useEffect

---

## 二、useQuery 缓存（B 类）

### 3. TanStack Query 的 queryKey 起什么作用？为什么推荐数组？

**答**：queryKey 是一份数据的**唯一标识**，缓存、去重、失效都以它为地址。数组形式（`['user', id]`）把结构化参数编进 key：id 变 → key 变 → 视为不同数据自动新缓存 + 重取；同 key 的多个组件共享同一份、只发一次请求。失效时也按 key 前缀匹配（`invalidateQueries({queryKey:['todos']})`）。字符串拼 key 易歧义，数组更可靠。

**来源**：TanStack Query 文档 — Query Keys、Best Practices

### 4. staleTime、gcTime 分别控制什么？

**答**：`staleTime`——数据从"新鲜(fresh)"变"过期(stale)"的时长；stale 后一旦有触发（组件重新挂载、窗口聚焦、refetchInterval）会**后台重取**，但期间仍返回缓存、不闪 loading。`gcTime`（旧称 cacheTime）——缓存数据在无观察者引用后**保留多久**再被垃圾回收删除。典型：`staleTime:60s` 让详情页 1 分钟内复用、`gcTime:5min` 让离开后短期回访秒开。

**来源**：TanStack Query 文档 — Data Staleness、Lifecycle、gcTime

### 5. 多个组件同时 useQuery 同一 key，会发几次请求？

**答**：并发只发**一次**（请求去重），大家共享同一 Promise 与结果；已存在有效观察者时新挂载的组件命中缓存不重复请求（除非 stale 触发重取）。这也是把取数从组件抽出的收益：跨组件、跨路由天然复用（呼应 react-data-fetching 第三节）。

**来源**：TanStack Query 文档 — Deduplication、Caching

---

## 三、useMutation 与写操作（C 类）

### 6. useQuery 会去重，为什么 useMutation 不去重？

**答**：语义相反。useQuery 是"读同一份数据"，重复读可共享缓存；useMutation 是"执行一次写"（发帖子、下单），每次调用都应真正发请求，去重会丢操作。所以 mutation 每次都执行，UI 层用 `isPending`/禁用按钮防**用户重复点击**，而非框架合并。

**来源**：TanStack Query 文档 — Mutations、useMutation

### 7. 写操作成功后如何保证列表数据是最新的？

**答**：在 mutation 的 `onSuccess` 里 `queryClient.invalidateQueries({ queryKey:['todos'] })`，把相关查询标记过期、触发后台重取。追求即时体验可用**乐观更新**（`onMutate` 先 `setQueryData` 本地追加、`onError` 回滚、`onSettled` 再 invalidate）。也可在 action/mutation 返回后用 `setQueryData` 直接写入缓存（若响应即最终数据）（呼应 react-router-data 写后重取）。

**来源**：TanStack Query 文档 — Mutations & Invalidation、Optimistic Updates

### 8. 什么是乐观更新？失败怎么办？

**答**：不等服务器确认就**先假设成功、立刻改本地 UI**（如点赞数 +1），体验零延迟。实现：`onMutate` 里 `cancelQueries` + 快照旧数据 + `setQueryData` 改缓存；请求失败在 `onError` 用快照**回滚**；`onSettled` 再 `invalidateQueries` 与服务器对齐。关键是保留回滚快照，避免"假成功"后数据错乱。

**来源**：TanStack Query 文档 — Optimistic Updates

---

## 四、与 Context / loader / Vue 对照（D 类）

### 9. 有了 Data Router 的 loader，还需要 React Query 吗？

**答**：互补。loader 覆盖"进路由就要的数据 + 写后自动重取"，但它不管**跨路由的客户端缓存/去重/后台重取/无限滚动/组件级局部取数**。React Query 提供全局缓存层、失效策略、乐观更新、分页等。常见组合：loader 里 `queryClient.prefetchQuery`/`ensureQueryData` 预取并塞进 Query 缓存，组件仍用 `useQuery` 消费——兼得"进页面数据就绪"与"缓存复用"（呼应 react-router-data 第 10 题）。

**来源**：React Router 文档 — prefetch、TanStack Query 文档 — SSR / prefetching

### 10. React 里"全局客户端状态"你选 Context 还是 Zustand/Redux？

**答**：少量、低频变化、天然属组件树的（主题、登录用户、国际化）→ Context 足够，注意 value 变化会广播全部消费者、要拆 context/useMemo 缓解（呼应 react-context）。高频/大量选择/需中间件与 devtools → 外部 store（Zustand 轻、选择器只订阅切片、少重渲染；Redux 重、适合大团队规范）。判断标准仍是"这是客户端全局态还是服务端缓存"——后者无论多少都用 Query 而非塞进 store（呼应 react-state-mgmt）。

**来源**：Zustand 文档、Redux Toolkit 文档、React 官方文档 — You Might Not Need Context

### 11. 从 Vue + Pinia 迁过来，原本在 store action 里 fetch 接口，在 React 里你会怎么改？

**答**：把"接口数据"从 Pinia 里剥离交给 Query：Pinia 里手写的 `fetchTodos` + `todos/loading/error` state 在 React 里就是 `useQuery({queryKey:['todos'], queryFn})`。store 只保留真正的客户端全局态（如筛选条件、用户偏好）。写操作从"store action 里 POST 再重取"改为 `useMutation` + `invalidateQueries`。收益：自动缓存/去重/失效，store 更纯粹（呼应 vue-pinia-basics、vue-state-patterns）。

**来源**：TanStack Query 文档 — Server State、Pinia 文档对照

### 12. Query 的错误、加载、重试是怎么自动管理的？

**答**：`queryFn` 返回的 Promise：pending→`isLoading/isFetching`，reject→`isError`+`error`，resolve→`data`。默认对失败**自动重试**（`retry`，指数退避，默认 3 次），SSR/4xx 常关掉。`error` 会冒给 `errorElement`/你自己渲染错误块。也可用 `Suspense` 模式（`useQuery` 的 `suspense:true`）把加载交给上层边界（呼应 react-render-control、react-effect-patterns 异步错误不吞）。

**来源**：TanStack Query 文档 — Error Handling、Retry、Suspense

---

## 补充（新专题 13-15）

### 13.  queryKey 就是请求参数吗？如何设计缓存粒度（太粗漏失效、太细不共享）？

queryKey 不是「参数」而是「这份数据的身份」：它既编码请求所需输入（如 ['posts', {filter,page}]，函数里解构出来拼 URL），又是缓存与失效的匹配键。粒度权衡：太粗（如把整页对象塞进 key，含不该区分数据的字段）会导致本应共享的取不到同一份、或频繁 miss；太细（漏掉影响结果的输入，如只 key 到 ['posts'] 却按 filter 返回不同数据）会造成「读到错数据」和「该失效的没失效」。原则：① 凡是「影响响应结果」的输入都必须进 key（URL 路径参数、query、当前用户租户 id）；② 用数组层级便于「前缀失效」（invalidateQueries({queryKey:['posts']}) 命中所有 posts*）；③ 别把不改变数据的 UI 态混进 key。这套与 React 依赖数组、Data Router 的 params 是同一思维。

**来源**：TanStack Query queryKeys 指南（key 即数据身份、层级与前缀失效）。

### 14.  把乐观更新的完整链路讲清：onMutate 快照、回滚、竞态与最终一致性怎么保证？

标准四段：① onMutate——先 `cancelQueries` 停掉进行中的相关取数，`setQueryData` 直接把缓存改成「预期结果」（UI 秒更新），并返回一个 context 存「变更前快照」；② mutation 执行真实请求；③ onError——用 context 里的快照 `setQueryData` 回滚，并提示失败；④ onSettled（成功或失败都跑）——`invalidateQueries` 重新取真值，让 UI 最终与服务端对齐。竞态处理：多个乐观写并发时以「请求级序列/后端返回的版本号」收敛，回滚要回滚到「本次变更前」而非「最初」，故用 onMutate 返回的局部快照而非全局初值。React 19 的 useOptimistic 把「渲染乐观值+失败回滚」内建，但仍需配合 Query 做缓存失效。乐观是「先斩后奏」，onSettled 的再取是「事后对账」，缺一会漂移。

**来源**：TanStack Query 乐观更新官方示例（onMutate/cancelQueries/回滚/onSettled）；React useOptimistic。

### 15.  Data Router 的 loader 与 TanStack Query 什么关系？什么项目该同时用、怎么组合？

它们解决重叠但不相同的问题：loader 把「取数」放到路由层、天然并行与竞态安全，但它的 loaderData 是「一次性、按路由分支」的，没有跨页共享缓存/去重/staleTime/后台再取；Query 提供「按 key 的全局缓存、去重、失效、乐观、后台刷新」。组合姿势（官方推荐的 SSR/流式协作）：在 loader 里 `queryClient.ensureQueryData(...)` 预取并让首屏数据就绪，客户端 hydrate 后由 Query 接管缓存与再验证（配 `dehydrate/hydrate` 传递缓存），组件用 useQuery 消费。小项目纯 loader 够；一旦有「多页复用同一数据、写后局部刷新、后台轮询、无限滚动」等需求，就是 Query 进场的时候。别把同一份数据的「权威缓存」同时维护在 loaderData 和 Query 两处——定一个为主。

**来源**：React Router + TanStack Query data prefetching 官方集成指南；dehydrate/hydrate 说明。
