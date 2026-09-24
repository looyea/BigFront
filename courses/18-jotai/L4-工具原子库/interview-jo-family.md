# 面试题：atomFamily 与参数化原子（jo-family）

### 1. (设计类) 为什么 v2 宁移除 atomFamily 也不内置失效？
**来源**：https://jotai.org/docs/utilities/family

没有普适正确的失效策略，内置易掩盖泄漏；交还给开发者按业务定义生命周期。

### 2. (实战类) 手写一个安全的 atomFamily(Map)？
**来源**：https://jotai.org/docs/

Map 缓存 + 暴露 remove(id)/或引用计数，行删除即清理，避免无界增长。

### 3. (坑类) 无界 atomFamily 内存泄漏的表现？
**来源**：https://jotai.org/docs/utilities/family

长会话反复创建参数 atom 从不回收，堆持续增长、GC 不掉。

### 4. (对比类) 参数化原子 vs focusAtom 处理列表状态？
**来源**：https://jotai.org/docs/utilities/focus

focus 从整数组 atom 聚焦子项、随父生命周期；family 独立按 key 建，需自管失效。

### 5. (实战类) 给可增删的 TODO 列表选方案？
**来源**：https://jotai.org/docs/

items 数组 atom + focusAtom 取各项，或 Map family 以 id 为键并随删除清理。

### 6. (设计类) 如何设计带 TTL 的参数 atom 缓存？
**来源**：https://jotai.org/docs/

Map 存 {atom, ts}，定时/访问时清过期，或用 WeakMap 让参数对象键自动回收。

### 7. (TS类) makeFamily 泛型怎么写？
**来源**：https://jotai.org/docs/typescript/typescript

return (id:K)=>WritableAtom<V,[A],null>，cache 为 Map<K, 该 atom 类型>。

### 8. (性能类) 每行一个 atom 会不会太多订阅？
**来源**：https://jotai.org/docs/

反而更优：行更新只通知该行订阅者，避免整表重渲（呼应 react-performance）。

### 9. (综合类) 给动态 Tab 设计参数化原子。
**来源**：https://jotai.org/docs/utilities/family

tabAtomFamily(id) 建 each tab state，关闭 Tab 时 delete(id) 回收。

### 10. (坑类) 用数组下标作 family key 的风险？
**来源**：https://jotai.org/docs/

增删导致下标错位复用错 atom，应用稳定 id 作 key。

### 11. (对比类) 与 Zustand 里手写 entity map 的对比？
**来源**：https://jotai.org/docs/

Zustand 用 entities map + selector；Jotai 用参数 atom 天然行级订阅，思路不同。

### 12. (设计类) 参数 atom 的初值从哪里来？
**来源**：https://jotai.org/docs/

工厂里根据 id 从后端/store 取初始，或 atomWithDefault 延迟加载。

### 13. (趋势类) future signal scope 会解决失效吗？
**来源**：https://github.com/tc39/proposal-signals

effect scope 提供生命周期绑定，参数化派生回收更自动，减轻手动 Map 负担。

### 14. (综合类) 团队用参数 atom 的守则？
**来源**：https://jotai.org/docs/utilities/family

以稳定 id 为键、显式删除即回收、必要时 LRU、优先 focus 处理数组派生。

### 15. (坑类) 在组件 render 里直接调用 makeFamily(id) 每次新对象会怎样？
**来源**：https://jotai.org/docs/

若工厂未 memo，则每次渲染新 atom、状态不共享；工厂必须用 Map 保证同 id 返回同一实例。
