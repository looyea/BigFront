# 毕业项目：原子化看板 + 全链路回顾

## 一、需求
用 Jotai 实现看板：列与卡片、卡片详情异步加载、过滤/排序派生、持久化布局、乐观改状态 + 回滚、Suspense loading。

这六条需求不是随手挑的——它们恰好一一对应本包六个阶段的核心机制：行级状态(L4)、异步取数(L3)、派生(L2)、持久化(L4)、write 编排(L2)、挂起(L3)。毕业项目是期末考试，每题都划了重点。

## 二、原子设计
- cardsAtom（数组源）、cardDetailAtom=atomFamily 式 Map（id→async atom，含失效，呼应 jo-family）；
- filterAtom + visibleCardsAtom(derived)（呼应 jo-derived）；
- layoutAtom = atomWithStorage 持久化（呼应 jo-storage）；
- moveCardAtom = write-only 封装多原子乐观写 + 回滚（呼应 jo-write-only）；
- 详情组件在 Suspense 内 useAtomValue(cardDetail)（呼应 jo-async）。

补两块拼图：卡片**标题行内编辑**用 splitAtom 从 cardsAtom 拆行（jo-focus-select），编辑只重渲该行；**跨列拖拽**落点是两个 write atom（removeFrom 列 + addTo 列）合成一次 moveCardAtom 调用——一个 write 里多次 set 天然同帧原子提交（jo-dependencies 的 batching），不会出现「卡片从 A 消失但没出现在 B」的中间态。

```ts
const moveCardAtom = atom(null, async (get, set, { id, to }: MoveArg) => {
  const prev = get(cardsAtom);
  set(cardsAtom, move(prev, id, to));            // 乐观
  try { await api.move(id, to); }
  catch { set(cardsAtom, prev); }                // 回滚
});
```

## 三、隔离与 SSR
每看板 Provider 独立 store（呼应 jo-store）；SSR 用 dehydrate/hydrateAtoms（呼应 jo-ssr）。

「每看板一 Provider」写进需求是因为多标签页场景：打开两个同一看板的双窗口，若共享默认 store，一边拖卡片另一边跟着动且无法撤销——每个 Tab 组件包 `<Provider>`，隔离当场完成。SSR 侧注意 dehydrate 的订阅收集规则（jo-ssr 第二节）：服务端渲染过的详情组件才进快照，列表首屏数据要显式 `dehydrate(store, { atoms: [cardsAtom] })`。

## 四、与 Zustand 版逐行对照
Zustand：单 store + entities/ids + selector + Query 管异步；Jotai：原子拆分 + async atom 原生挂起 + focus 管粒度。同一需求两种范式的镜像实现。

镜像对照的记忆锚点：normalize 的 ids+entities ↔ 「cardsAtom + 按 id 的 async family」（两种「列表与详情分离」）；selector + useShallow ↔ 天然细订阅 + select/focus/split；per-request store ↔ Provider 隔离；persist ↔ atomWithStorage；action ↔ write-only atom。**十步对照走完，两个库你就都懂了**——这就是收官关把两家放一起的深意。

## 五、毕业清单
原子/读写/派生/异步/工具/store 隔离/SSR/性能/选型逐条能答；进阶：TanStack Query 协作、Valtio 兄弟、React Compiler。

自测十问（答不出就回对应关）：① 原子身份由什么决定？② 三 hook 各何时用？③ 派生为何惰性缓存？④ write atom 怎么编排多写？⑤ async atom 挂起机制与竞态语义？⑥ loadable 三态与 Suspense 怎么选？⑦ v2 为何砍 atomFamily、替代三件套？⑧ focus/split 各解什么粒度问题？⑨ 何时必须 Provider、SSR 三要点？⑩ 与 Zustand 的选型判据一句话？

## 六、之后的路
React Compiler 会把 memo 类优化（selectAtom 的浅比较价值）重排，但「依赖图 + 细粒度订阅」的架构价值不贬值；TanStack Query 与 Jotai 的分工表（jo-race 第四节）在多页应用里几乎必用上；再往深是 jotai-effect、atomWithObservable 的实时协作场景（jo-loadable 第四节）——课程收官，生态才刚展开。

## 小结
把 18 关收敛成一个原子化看板：split/family 管行级、async+Suspense 管详情、派生管过滤、storage 管布局、write 管乐观回滚、Provider 管隔离——并与 Zustand 版十步镜像对照，依赖图与异步挂起从此是你的母语。

## 部署预告
独立实现整个看板（不看讲义）：卡片编辑只重渲一行、拖拽断网自动回滚、双 Tab 互不串、刷新布局还在；然后打开 za-crud 的 Zustand 版对照表逐条打勾——两边都能默写出来，状态管理三强包就真正毕业了。
