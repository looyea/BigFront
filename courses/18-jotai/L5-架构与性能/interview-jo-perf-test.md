# 面试题：性能调优与测试（jo-perf-test）

### 1. (性能类) Jotai 天生细粒度订阅为何还要优化？
**来源**：https://jotai.org/docs/advanced/atom-patterns

若误用大对象 atom 或派生链过深，仍会粗粒度/放大重算，需按模式优化。

### 2. (实战类) 如何用 DevTools 定位过度订阅？
**来源**：https://jotai.org/docs/devtools

看某 atom 订阅数与被触发频率，找出不该依赖该 atom 的组件、拆细或 select。

### 3. (设计类) 为什么反对把整个表单塞一个对象 atom？
**来源**：https://jotai.org/docs/

一字段改全表单订阅者重渲，应用 focusAtom 拆字段（呼应 jo-focus-select）。

### 4. (实战类) store.get/set 直测一个派生 atom？
**来源**：https://jotai.org/docs/

store.set(源, 值)，再 expect(store.get(派生)) 断言，无需渲染。

### 5. (坑类) 测试间共享默认 store 造成什么？
**来源**：https://jotai.org/docs/utilities/provider

用例互相影响、flaky，需新 store/Provider 隔离。

### 6. (性能类) 高频 atom 用什么避免拖慢渲染？
**来源**：https://jotai.org/docs/utilities/debounce

store.sub transient 写 DOM 或 debounce 派生，别进主渲染订阅（呼应 za-store-api）。

### 7. (TS类) 测 async atom 类型与 await？
**来源**：https://jotai.org/docs/typescript/typescript

await store.get(asyncAtom) 得 resolve 值，测试断言其类型。

### 8. (综合类) 给一个大列表优化到行级渲染？
**来源**：https://jotai.org/docs/utilities/split

splitAtom/focus 拆行，每行只订阅自身，滚动/更新仅命中行（呼应 react-performance）。

### 9. (对比类) Jotai 测试与 Zustand 测试差异？
**来源**：https://zustand.docs.pmnd.rs/

都用纯 store 直测；Jotai 强调 store.get/set，Zustand getState/setState。

### 10. (实战类) 如何用 msw 测 async 竞态？
**来源**：https://mswjs.io/

控制两请求返回顺序，断言最终采用最新依赖值结果（呼应 jo-race）。

### 11. (性能类) 派生 atom 每次读都重算吗？
**来源**：https://jotai.org/docs/

否，惰性缓存，依赖不变命中缓存（呼应 jo-derived）。

### 12. (设计类) 性能优化优先级你会怎么排？
**来源**：https://jotai.org/docs/advanced/atom-patterns

先拆细订阅粒度→控派生深度→高频隔离→再谈微优化。

### 13. (综合类) 给一个编辑器的隔离 + 性能测试方案。
**来源**：https://jotai.org/docs/utilities/provider

每编辑器实例独立 Provider store；测某文件 atom 变更只重渲对应面板。

### 14. (趋势类) React Compiler 会取代这些手动优化吗？
**来源**：https://react.dev/learn/react-compiler

减轻组件级 memo，但订阅粒度与派生结构设计仍需人为负责。

### 15. (设计类) 团队 Jotai 性能与测试规范要点？
**来源**：https://jotai.org/docs/

小 atom、控派生深度、高频隔离、纯 store 直测 + Provider 隔离、常态化 Profiler。
