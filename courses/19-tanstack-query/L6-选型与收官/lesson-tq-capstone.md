# 毕业项目：影视浏览应用数据层

## 一、需求清单（一条链串全课）

做一个 TMDB 式影视浏览 App 的数据层：**热门列表**（首屏，SSR 水合）→ **无限滚动**（往下刷第 N 页）→ **搜索**（防抖 + 条件查询）→ **详情**（路由预取，点进秒出）→ **收藏**（乐观更新 + 失败回滚）→ **多标签同步收藏态**（persist + broadcast）→ **测试覆盖收藏回滚**。每个需求对应本包一关，下面按施工顺序拆。

## 二、地基：key 工厂与 client 配置

```ts
export const movieKeys = {
  all: ['movies'] as const,
  lists: (q?: string) => [...movieKeys.all, 'list', { q: q ?? '' }] as const,
  detail: (id: number) => [...movieKeys.all, 'detail', id] as const,
  favorites: () => [...movieKeys.all, 'favorites'] as const,
};
const qc = new QueryClient({ defaultOptions: {
  queries: { staleTime: 5 * 60_000, gcTime: 30 * 60_000 },   // L2 双时钟
}});
```

树形 key 是后续「失效一片」的前提（L2）；staleTime 5 分钟治「返回列表又转圈」（L2 误区关）。

## 三、逐关落位

- **列表+无限**：首屏 useQuery(['movies','list',{page:1}])，翻页切 useInfiniteQuery（getNextPageParam 判 total_pages），触底 fetchNextPage（L4）；
- **搜索**：输入进 Zustand 防抖后作为 key 参数，enabled 挡空串（L3），keepPreviousData 防闪（L3）；
- **详情预取**：卡片 onMouseEnter prefetchQuery(detail key)（L3）；列表数据里已含的字段用 initialData 传进详情页，连一次骨架都不闪（L3）；
- **收藏**：useMutation 四拍乐观模板（L4），onError 回滚自己那笔、onSettled invalidate favorites 前缀；
- **SSR**：每请求 new client + prefetch 热门列表，dehydrate → HydrationBoundary（L5）；
- **多端**：persistQueryClient 只持久 favorites（shouldDehydrateQuery 白名单）+ broadcastQueryClient（L5）；
- **测试**：MSW 注入收藏失败，断言「先变心后碎回」（L5）。

## 四、毕业自查清单

结构：key 工厂单点定义 / 无 useEffect 拷数据进 store / queryFn 全收 signal（L4）。
行为：返回不闪骨架 / 点进详情秒出 / 离线提交排队（networkMode）/ 两标签收藏同步。
工程：SSR 首帧无重复请求 / 持久化白名单不含敏感数据 / 乐观失败可回滚且有测试。
选型：说得清这里为何是 Query 而不是 SWR（失效树+乐观+infinite 三连）。

## 五、后续路径

专题到此收官，延伸三条：**TanStack Router**（URL state 层与路由级 preload，与 tq-division 的第四层直接接轨）、**TanStack Table/Virtual**（大列表虚拟渲染，与 infinite 无缝配）、**Query 进阶源码向**（observers 机制、fine-grained 订阅 v5 新篇）。状态管理四包（Pinia/Zustand/Jotai/Query）的终极检验永远是那句：**这份数据，到底归谁？**

## 小结
毕业项目=七关知识点的一次串行施工：key 工厂打地基、六项需求逐关落位、三层自查定去留——能做出来且讲得清每步归属，本包即毕业。

## 部署预告
按本关清单动工（TMDB 免费 API 或本地 json-server 均可），完成后可选挑战：给收藏页接 streaming SSR、把搜索防抖值写进 URL 让结果页可分享、Devtools 里数一数一次收藏点错触发了几次请求。
