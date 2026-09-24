# 面试题：服务器状态（tq-server-state）

### 1. (原理类) 什么是 server state？和 client state 的本质区别？
**来源**：https://tanstack.com/query/latest/docs/framework/react/overview

服务器状态是远端数据的本地只读镜像：所有权在服务端、会过期、多方共享；客户端状态（UI 开关、草稿）由本端全权增删改。前者需要缓存同步系统，后者需要 store。

### 2. (实战类) 手写 fetch + useEffect 的典型翻车点有哪些？
**来源**：https://tanstack.com/query/latest/docs/framework/react/overview

竞态覆盖、重复请求、无缓存导航白屏、卸载后 setState、过期策略缺失、内存无回收。每一条都是 Query 的内置特性。

### 3. (对比类) Query 能否取代 Zustand/Redux？
**来源**：https://tanstack.com/query/latest/docs/framework/react/comparison

不能。Query 只解决服务器态；交互态、草稿、跨组件 UI 状态仍属客户端状态库。混用是把缓存系统当 store 用，两头别扭。

### 4. (设计类) 为什么 Query 用 queryKey 而不是 URL 做缓存身份？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-keys

同一 URL 可因参数/视图/权限产生多份数据，不同 URL 也可能语义相同；逻辑 key 让「身份」由业务定义，序列化后再生成实际请求关联。

### 5. (坑类) 把接口数据同步进全局 store 有什么问题？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/queries

双份真相+手动搬运：失效、竞态、去重全要你在 store 层重做一遍——等于用 Query 的思想绕开 Query 的实现。

### 6. (原理类) Query 的「去重」发生在哪一层？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults

同一 queryKey 处于 fetching 时，新的订阅者直接搭现请求的车（in-flight dedupe），不重复发网络请求。

### 7. (实战类) 「陈旧-而-有效」指什么 UI 形态？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/background-fetching-indicators

先渲染缓存里的旧数据，后台 isFetching 转小圈，成功后原地换新——列表页右上角小刷新指示器就是标准姿势。

### 8. (对比类) 与 SWR 的立意差异？
**来源**：https://tanstack.com/query/latest/docs/framework/react/comparison

SWR 同样盯「stale-while-revalidate」但刻意极简（双 API、无 mutation 系统）；Query 提供完整缓存控制面：失效、分页、预取、乐观、SSR。

### 9. (设计类) 为什么 Query 默认 refetchOnWindowFocus？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/window-focus-refetching

切走期间数据可能已变；回来是最自然的「用户还在乎这份数据」信号，默认保新鲜，不喜欢可关。

### 10. (实战类) 哪些数据不该进 Query？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults

纯客户端交互态（modal、主题）、永不变化或本地生成的数据、高频瞬态值（鼠标坐标）——它们没有「服务器镜像」可缓存。

### 11. (坑类) Query 的缓存会永久驻留内存吗？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/caching

不会。无人订阅的查询过 gcTime（默认 5 分钟）被回收，测试里表现为「缓存神秘消失」时要想到这一层。

### 12. (原理类) queryFn 抛错与返回非 2xx 的边界谁负责？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-functions

Query 不关心 fetch 语义：不抛错的 resolve 一律算 success。res.ok 检查要自己写，否则 404 页也会「成功」。

### 13. (实战类) 团队里如何界定 Query 与状态库分工？
**来源**：https://tanstack.com/query/latest/docs/framework/react/comparison

一条数据问三句：来源是服务器吗？会过期吗？需要失效重取吗？三 yes 归 Query，否则归状态库；表单值归表单库。

### 14. (设计类) 为什么把这套能力做成 hooks 而不是全局总线？
**来源**：https://tanstack.com/query/latest/docs/framework/react/quick-start

hooks 让订阅跟组件生命周期绑定：卸载即退订，退订才能算准「无人订阅」触发 GC，作用域管理零成本。

### 15. (开放类) 不用 Query，自研缓存层要补齐哪些点？
**来源**：https://tanstack.com/query/latest/docs/framework/react/overview

去重、失效策略（stale/gc 双时钟）、竞态、跨组件订阅、手动失效 API、SSR 水合、可观测面板——约等于重写一个 Query。
