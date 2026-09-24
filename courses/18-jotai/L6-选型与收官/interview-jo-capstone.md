# 面试题：毕业项目与全链路回顾（jo-capstone）

### 1. (综合类) 用 Jotai 从零设计一个看板的状态骨架。
**来源**：https://jotai.org/docs/

cardsAtom(源)+visibleCardsAtom(派生过滤)+cardDetail(id) async atom+layoutAtom 持久+moveCard write-only 乐观。

### 2. (对比类) Jotai 版 vs Zustand 版看板的关键差异？
**来源**：https://jotai.org/docs/introduction

Jotai 自下而上原子、异步原生挂起；Zustand 单 store+selector、异步靠 Query。

### 3. (设计类) 看板里如何兼顾乐观更新与竞态？
**来源**：https://jotai.org/docs/

write atom 先本地改、失败回滚快照；async 取数以最新依赖为准忽略过期（呼应 jo-race）。

### 4. (实战类) 卡片详情懒加载 + 缓存怎么设计？
**来源**：https://jotai.org/docs/utilities

per-id async atom 天然缓存该 id 结果，配 Map 工厂与失效（呼应 jo-family）。

### 5. (性能类) 整板大量卡片如何避免全量重渲？
**来源**：https://jotai.org/docs/utilities/split

splitAtom/focus 拆到卡片级订阅，单卡改只重渲该卡（呼应 jo-perf-test）。

### 6. (SSR类) 看板首屏 SSR 如何无闪烁？
**来源**：https://jotai.org/docs/utilities/ssr

服务端建 store 取数、dehydrate 结果、客户端 hydrateAtoms 注入（呼应 jo-ssr）。

### 7. (综合类) 你会如何评审一份 Jotai 代码？
**来源**：https://jotai.org/docs/advanced/atom-patterns

看原子粒度、派生是否有副作用、高频是否隔离、是否滥用默认 store、持久化是否带迁移。

### 8. (设计类) 毕业检查里最易被忽略的点？
**来源**：https://jotai.org/docs/

原子爆炸与依赖图可维护性——小 atom 好但需按域组织与命名。

### 9. (对比类) Jotai 学完对理解 signal/响应式有何帮助？
**来源**：https://github.com/tc39/proposal-signals

atom≈signal+computed，直接映射 TC39 提案心智（呼应 tc39-core）。

### 10. (实战类) 与 TanStack Query 协作的边界？
**来源**：https://jotai.org/docs/

服务端集合数据交 Query 缓存/失效，交互/UI/原子派生留 Jotai（呼应 za-layers）。

### 11. (综合类) 给一个“看板 + 协作”演进方案。
**来源**：https://jotai.org/docs/

乐观 + 版本号/CRDT 冲突合并，async atom 或 Query 拉增量，write atom 提交意图。

### 12. (性能类) 依赖图调试方法论？
**来源**：https://jotai.org/docs/devtools

DevTools 看订阅与传播，Profiler 数重渲，缩小派生深度，异常值单独 atom。

### 13. (设计类) 团队引入 Jotai 的落地顺序？
**来源**：https://jotai.org/docs/

先交互态原子化→引入 async atom+Suspense→加 Provider 隔离/SSR→定 utils 与性能规范。

### 14. (趋势类) React Compiler 后 Jotai 价值变化？
**来源**：https://react.dev/learn/react-compiler

组件 memo 自动化，但跨组件原子图、异步挂起与隔离仍是 Jotai 独特价值。

### 15. (综合类) 一句话总结 Jotai 工程哲学。
**来源**：https://jotai.org/docs/

把状态拆成可组合、可派生、可挂起的最小原子，用依赖图换取极致细粒度与异步优雅。
