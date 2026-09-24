# L6 作业：选型与收官（毕业）

## 一、知识回顾
1. Jotai / Zustand / Redux / Context / Valtio 各自象限。
2. Jotai 与 Valtio 两种范式的取舍。
3. 毕业看板的原子设计要点。

## 二、代码实操
1. 用 Jotai 完整实现看板：cards + derived 过滤 + per-id async 详情 + storage 布局 + write-only 乐观移动。
2. 用 Zustand + TanStack Query 复刻同一看板，逐行对照两种范式差异。
3. 为看板加 Provider 隔离与 SSR dehydrate/hydrate，消除首屏闪烁。

## 三、思考题
1. 同一需求你更愿用 Jotai 还是 Zustand，为什么？
2. 什么信号提示你「该从 Jotai 引入 Query 了」？

## 四、延伸阅读
- Jotai 官方 examples、Valtio、TanStack Query 协作
- TC39 Signals 提案

## 五、自查清单
- [ ] 原子粒度合理、按域组织
- [ ] 异步用 async atom + Suspense
- [ ] 持久化带迁移、SSR 有水合
- [ ] 能就选型与 Zustand/Valtio 对照作答
