# 面试题：依赖图与 Batching（jo-dependencies）

### 1. (原理类) Jotai 依赖追踪与 Vue 响应式异同？
**来源**：https://jotai.org/docs/core/atom

都在读取时收集依赖；Vue 基于 reactive Proxy，Jotai 基于 getter 显式 get，粒度模型略不同。

### 2. (性能类) 为什么读即订阅能做到细粒度更新？
**来源**：https://jotai.org/docs/advanced/atom-patterns

每个订阅者只登记真正 get 的 atom，更新只精确通知命中者。

### 3. (坑类) 派生链过长会怎样，如何优化？
**来源**：https://github.com/pmndrs/jotai/discussions

末端读触发整链重算；扁平化、合并派生、对昂贵段加 memo。

### 4. (对比类) Jotai 自动依赖 vs Zustand 手动 selector 的取舍？
**来源**：https://zustand.docs.pmnd.rs/

自动省心易追踪；手动更可控但易漏/过度订阅，各有代价。

### 5. (实战类) 一次事件写多个 atom 会渲染几次？
**来源**：https://react.dev/reference/react-dom/client/createRoot

React 18 自动批处理，最终一次；中间态不外泄给组件。

### 6. (设计类) 如何防止高频 atom 拖垮性能？
**来源**：https://jotai.org/docs/utilities

transient 用 subscribe/或单独 atom + 节流，别混入主渲染路径（呼应 za-store-api）。

### 7. (原理类) 循环依赖为什么危险且要检测？
**来源**：https://jotai.org/docs/core/atom

互相 get 无法确定求值顺序，会无限/死锁，Jotai 主动抛错。

### 8. (实战类) 如何观测某 atom 被多少组件订阅？
**来源**：https://jotai.org/docs/devtools

Jotai DevTools 可视化依赖与订阅数，或 store.sub 手动观察。

### 9. (综合类) 设计一个不引发重渲风暴的搜索框。
**来源**：https://jotai.org/docs/utilities/debounce

inputAtom 高频写、debouncedAtom 派生节流，列表只订阅 debounced（呼应 debounce util）。

### 10. (TS类) 依赖图对类型有影响吗？
**来源**：https://jotai.org/docs/typescript/typescript

无直接影响，类型仍由 atom 初值/getter 决定。

### 11. (坑类) 在 getter 里 set 会怎样？
**来源**：https://jotai.org/docs/core/atom

getter 必须纯，写会引发更新循环，应放 write 或 effect。

### 12. (对比类) Solid 的 createEffect 与 Jotai 依赖模型差别？
**来源**：https://www.solidjs.com/docs/latest/api#createeffect

都自动追踪读取依赖；Solid 编译期细粒度 DOM 更新，Jotai 靠 React 渲染。

### 13. (趋势类) React Compiler 对依赖图重算的帮助？
**来源**：https://react.dev/learn/react-compiler

减少手动 memo，但跨 atom 依赖图与传播仍由 Jotai 决定。

### 14. (综合类) batching 与并发 transition 如何共处？
**来源**：https://react.dev/reference/react/useTransition

同帧 set 归一个 transition 原子提交，紧急输入不被拖慢（呼应 za-transition）。

### 15. (设计类) 团队用 Jotai 时的性能守则？
**来源**：https://jotai.org/docs/advanced/atom-patterns

小 atom、控派生深度、高频值隔离节流、用 DevTools/Profiler 常态化观察。
