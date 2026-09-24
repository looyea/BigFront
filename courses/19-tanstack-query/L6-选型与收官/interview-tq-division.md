# 面试题：异步状态三层分工总决算（tq-division）

### 1. (架构) 状态四层分工是哪四层、各一句职责？
**来源**：https://tanstack.com/query/latest/docs/framework/react/overview

Server State（Query：服务器拥有的数据，缓存+新鲜度+失效联动）；Client State（Zustand/Jotai/Pinia：只有浏览器知道的 UI/会话态）；Form State（RHF 等：未提交的编辑草稿）；URL State（Router：可分享可回退的事实）。判据永远是「数据归谁」。

### 2. (原理) 为什么「把接口数据拷进全局 store」是头号反模式？
**来源**：https://tanstack.com/query/latest/docs/framework/react/overview

双份真相：store 里那份不会自己变新鲜，要靠手动同步链（useEffect+订阅）维持，链一断就是脏数据 bug；同时丢了 Query 的去重/失效/乐观/SSR 全套语义。本包开篇七痛，拷进 store 等于一键全恢复。

### 3. (边界) 表单值为什么不建议放全局状态库？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults

表单是高频变更的局部草稿，进全局 store 让每次击键都过一遍全站订阅分发——性能与语义双输（每敲一键全站重渲染）。RHF 的非受控+ref 设计正是为把它按在表单层；提交成功那一刻才轮到 Query mutation 出场。

### 4. (边界) URL 态与 Query 态的接口点举一例。
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries

列表页的筛选/页码放 URL（可分享、回退正确），useQuery 的 key 从 URL 参数取材：用户改地址栏=换 key=自动重取（L3 条件依赖的实战形态）。URL 管「是什么」，Query 管「它的结果数据」。

### 5. (协作) 一次「点赞」在四层间怎么走？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/useMutation

URL 给出 post id → useQuery 供渲染数据 → mutation 乐观改 Query 缓存（不碰状态库）→ 守卫/登录态从 Zustand 读（不进 Query）→ onSettled invalidate 对齐服务器。全程无跨层数据副本。

### 6. (对比) Query 缓存和状态库缓存的「缓存」是同一个词吗？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/caching

差半个词义：Query 缓存带服务器真相语义（staleness、GC、失效、水合）；状态库的「缓存」多为普通内存值（主题、配置），或派生 memo（jotai）。同名不同物，分层讨论时必须拆开。

### 7. (治理) 项目里怀疑分工乱了，怎么审计？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults

三步：① 搜 useEffect 里「取数后 set 进 store」的模式，有即候选；② 列状态库字段清单，问每个字段「服务器有副本吗」，有则应迁 Query；③ 查 Query 缓存里的 UI 态（假 queryFn），迁回状态库。审计一次立规矩一处。

### 8. (深度) 「服务器数据也有纯客户端派生（格式化、过滤），放哪？」
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations

派生留在消费处：Query 的 select 或组件内 useMemo——派生结果不是新真相，服务器数据一变要能跟着变。存进 store 的派生值=双份真相变体，审计同样要抓。

### 9. (坑) 登出清场要清几层？各用什么？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient

至少三层：Query（removeQueries 全清或整 client 重建）、状态库（store 重置 API / jotai 子树卸载）、路由缓存与 URL（跳登录页）。漏 Query 那层最常见——新账号看到上一个人的缓存列表，L2 就预警过的事故。

### 10. (实战) 同一份配置数据既进 Query 又被 zustand 缓存了，谁走？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/initial-query-data

留 Query：它有新鲜度与失效语义，zustand 那份迟早手动同步链。搬迁姿势：zustand 删字段，消费处改 useQuery({ staleTime: Infinity })，需要 zustand 参与逻辑时用 queryClient.getQueryData 现取而非镜像。

### 11. (架构) 四层里有性能敏感热点（大表格），Query 的 select 够用吗？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations

先用 select 订阅切片 + structuralSharing 保引用稳定；仍不够时行级 memo + 虚拟列表（TanStack Virtual）兜住渲染，数据层不必改道。「热点」多数是渲染问题，别急着用复制进 store 换性能。

### 12. (协作) Query、状态库两层的测试策略差异？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/testing

Query 三件套（新 client/retry off/MSW）测「数据流」；状态库测「状态转换」——vanilla store/裸 atom 直接 dispatch 断言（17/18 包同款）。两层测试互不 mock 对方，集成用例才同时挂 Provider。

### 13. (演进) RSC/Server Components 时代这套分工过时了吗？
**来源**：https://tanstack.com/query/latest/docs/framework/react/overview

没有：RSC 把「首帧取数」前移，但交互期的乐观、失效、跨组件共享仍需客户端缓存层——Query 官方 advanced-ssr 就是 RSC 共生方案。状态层/表单层/URL 层与 RSC 正交。分层模型是概念级的，框架渲染模型换代它不动。

### 14. (治理) 团队该定哪些「分层军规」？举五条。
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults

① 服务器数据只住 Query，状态库禁存其副本；② 表单值禁入全局 store；③ 可分享状态必上 URL；④ 登出=三层联清清单化；⑤ key 工厂唯一命名点。军规进 lint/评审清单，不靠记忆。

### 15. (深度) 为什么「URL 态」值得单列一层而不是 client state 的子集？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries

URL 是唯一「用户可直接编辑、可分享、受浏览器历史管辖」的状态源——它的生命周期不归 React。藏进组件 state 的同类信息会丢这三性（刷新即无、无法分享、回退诡异）。单列是给它应有的设计地位。
