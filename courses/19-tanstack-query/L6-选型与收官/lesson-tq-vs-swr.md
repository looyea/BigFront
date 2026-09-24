# Query vs SWR vs RTK Query

## 一、官方 comparison：同题不同卷

TanStack Query 与 SWR 解决同一道题——**声明式缓存取数**——卷面差异在缓存控制权（官方 /comparison 表的核心行）：

| 维度 | TanStack Query | SWR |
|---|---|---|
| 失效粒度 | 前缀/exact/predicate 三级匹配 | 按 key 精确触发为主 |
| mutation 配套 | useMutation 全套生命周期 | mutate() 轻量版 |
| 无限/分页 | useInfiniteQuery 内建 | 数组参数手搓 |
| 并行批量 | useQueries | 无对等 hook |
| 预取 | prefetch + 渲染前触发点丰富 | 内置 data 预载较简 |
| 持久化/多标签 | persist + broadcast 插件 | 插件生态较薄 |
| Devtools | 面板全景 | 精简版 |
| 心智面积 | 大（全都要） | 小（两周化一名词） |

一句话：**SWR 是「取数 Hook」，Query 是「缓存系统穿成 Hook 的样子」**（za-compare 的老句式换主角再讲一遍）。

## 二、SWR 的极简主义价值

SWR 名字即策略（stale-while-revalidate），API 面小到一个 useSWR：上手十分钟、包体积小、Vercel 系项目开箱即配。当你只需要「GET 缓存 + 聚焦重取 + 简单提交后重取」，SWR 的天花板来得比 Query 的学习曲线更早撞上。**简单本身是一种能力**——选型的第五个考量维度（需求、团队、生态之外）。

## 三、RTK Query： Redux 全家桶的取数件

RTK Query 与 Redux Toolkit 深度绑定：store 里划出「缓存切片」、自动生成 hooks、失效走 tag 系统（提供 tag→订阅 tag→按 tag 失效）。在已有 Redux 状态管理的大型应用里它是顺滑补丁；从零项目则先掂量 Redux 本身的重量。它证明一件事：**缓存层可以长在状态库里，但没人愿意在两个库里各写一遍**。

## 四、选择判据（背这四条）

① 有失效树/乐观回滚/无限滚动/SSR 任一硬需求 → Query；② 需求只有「缓存 GET + 定时刷新」→ SWR 省下的学习成本是实打实的；③ 应用已是 Redux 且团队满意 → RTK Query 就近接入；④ 非 React 栈：Vue 有 TanStack Query Vue 版，Solid 有 swrv 与 solid-query——**跨框架生态 Query 占优**（jo-compare 的框架绑定维度的镜像）。

## 五、不变的那一层

三个库底下是同一套理论：**server state 独立于 client state、以 key 寻址、带新鲜度生命周期、变更走失效联动**。学会任何一个，另一个半天上手——这关不是「站队」，是把「为什么长这样」再确认一遍。真正各异的只有 API 面积与默认值。

## 小结
SWR 极简、RTK Query 一体化、Query 全能；判据=需求硬列表面积排序，跨框架生态与团队存量同权重；三家共享同一套 server state 理论——选型题的底层是概念题。

## 部署预告
给同一个「列表+详情+搜索+提交刷新」需求各写 Query 与 SWR 两版（可拷源码对比）：数行数、数心智概念（Query 的 stale/gc/invalidate vs SWR 的关键默认值）；把两版 README 各写一段选型理由。
