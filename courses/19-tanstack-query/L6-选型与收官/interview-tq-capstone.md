# 面试题：毕业项目：影视浏览应用数据层（tq-capstone）

### 1. (架构) 毕业项目的整体数据流画一遍（从 URL 到屏幕）。
**来源**：https://tanstack.com/query/latest/docs/framework/react/overview

路由解析 /movies/popular?page=2 → key 工厂生成 [movies, list, {page:2}] → useInfiniteQuery 命中缓存或取数 → select 切片供组件 → 收藏按钮触发 useMutation 四拍 → invalidate favorites 前缀 → broadcast 同步他标签。一条链走完本包六关。

### 2. (实战) 搜索输入到发请求，完整链路怎么设计？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries

输入框（局部/RHF）→ 防抖 300ms（或 URL 防抖）→ 值进 queryKey [search, {q}] → enabled 挡空串 → keepPreviousData 防列表闪 → 结果页。注意防抖值别每字符入 key——防抖是 key 变化的节流阀。

### 3. (实战) 无限滚动的游标从哪来、失效怎么办？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/useInfiniteQuery

API 给 page 或 cursor 均可，getNextPageParam 从响应 total_pages/next_cursor 推导。失效代价复习：invalidate=已加载页逐页重放，高互动场景优先对单条 setQueryData 定点，全量刷新留给手动下拉与 onSettled。

### 4. (实战) 详情页「秒出」的组合拳拆成两招。
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/prefetching

第一招 hover prefetch（进入视口/悬停预热 [movies, detail, id]）；第二招跳转时把列表里已有的 title/poster 作 initialData 塞详情查询——真字段后台 stale 验证补齐。两招叠加才做到「连骨架都不闪」。

### 5. (实战) 收藏乐观更新在项目里的完整配置？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

onMutate cancelQueries(favorites 前缀) + 只记本次补丁的回滚表 → setQueryData 翻转 → onError 撤自己那笔 → onSettled invalidate favorites。失败注入测试必备（MSW 500）：先变心后碎回且不误伤连点。

### 6. (工程) SSR 在这个项目里覆盖哪些页面、为什么？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/ssr

覆盖列表页与详情页（SEO 主体+首屏指标页），收藏/个人页登录态后置不必 SSR。实现：每请求 new client、prefetch 当页数据、dehydrate 进 HTML、HydrationBoundary 灌回；流式化用 advanced-ssr（外壳先出，慢接口 Suspense 补）。

### 7. (工程) persist 白名单在本项目放哪几条？
**来源**：https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient

favorites（弱网友好、变化少）、用户偏好配置类。不放：搜索联想、热门 feed（时效强）、任何含 token 的 profile 查询。判据：回访命中率高+陈旧可容忍+不敏感。

### 8. (工程) 测试计划里优先级最高的三条用例？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/testing

① 收藏失败回滚路径（乐观正确性命门）；② 搜索防抖与空串不发请求（enabled 契约）；③ 详情预取后点进零 loading（prefetch+key 一致性，水合/预取/点击三处 key 必须逐字节相等）。

### 9. (复盘) 项目里哪些点能体现「比 useEffect 手写省了代码」？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/queries

数四类：竞态处理（搜索快输）、去重（两组件同取一列表）、失效联动（收藏后角标自更新）、加载态矩阵（isPending/isFetching/placeholder 分离）。手写每项都要长尾代码，项目里它们都是配置项。

### 10. (对比) 被问「为什么不用 SWR」的标准答法？
**来源**：https://tanstack.com/query/latest/docs/framework/react/comparison

对着需求清单答：无限滚动契约、乐观四拍+回滚表、前缀失效 favorites 一片、SSR 水合带新鲜度语义、多标签 broadcast——五条里任何一条 SWR 都要手搓补丁，五条全有就该换系统。按需求选型不按名气。

### 11. (延伸) 升级 streaming SSR 的动手顺序？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr

① 详情页接 useSuspenseQuery + 边界包 Suspense；② 服务端 prefetch 不 await、promise 经 use() 穿线；③ HydrationBoundary 随片段多次 hydrate；④ 验证 TTFB 与慢接口的解耦（网络节流模拟）。每步可灰度，回退成本低。

### 12. (延伸) 列表涨到 500 项渲染卡顿，动哪层？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations

先 select 收窄订阅+行组件 memo，再上虚拟列表（TanStack Virtual 与 infinite 天然配对）；数据层几乎不动——infinite 的单条目多页结构本就为长列表设计。渲染问题渲染解，别拷数据。

### 13. (毕业) 给这门四包专题写一段「毕业感言」式总结。
**来源**：https://tanstack.com/query/latest/docs/framework/react/overview

Pinia/Zustand/Jotai 教的是「浏览器自己的数据怎么管」，TanStack Query 教的是「别人的数据怎么借」——四包合起来是一句话：先问归属，再选工具，永不混住。带着分层地图出去，什么新库都不慌。

### 14. (毕业) 后续路线三条各自的入口判断？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/suspense

团队被 URL 状态 bug 折磨→Router；大表格/长列表性能债→Table+Virtual；想 deeper 理解订阅与共享→读 Query 源码（observers/structuralSharing）。每条都回得本包某关的伏笔，学以致用闭环。

### 15. (毕业) 项目交付时怎么写一页「数据层设计说明」？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults

五段：key 树与工厂清单、默认 staleTime/gcTime/retry 决策理由、失效联动矩阵（哪个 mutation 刷哪些 key）、SSR/persist/broadcast 覆盖范围、测试策略三件套——讲得清 why，比代码更值得 review。
