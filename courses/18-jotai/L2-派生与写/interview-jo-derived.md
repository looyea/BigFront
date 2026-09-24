# 面试题：Derived Atom（jo-derived）

### 1. (原理类) 派生 atom 的依赖是如何被追踪的？
**来源**：https://jotai.org/docs/core/atom

getter 执行时调用 get(x) 即建立对该 atom 的依赖，Jotai 记录依赖图并据此失效重算。

### 2. (对比类) derived 与 Zustand selector 的缓存差异影响？
**来源**：https://jotai.org/docs/introduction

derived 缓存结果，多组件读同一派生只算一次；selector 每组件每变更都跑，重计算需自 memo。

### 3. (坑类) 为什么 getter 里不能有副作用？
**来源**：https://jotai.org/docs/core/atom

求值时机不确定（惰性/缓存/重算），副作用会不可预期，应放 write 或 effect。

### 4. (实战类) 用派生实现列表过滤？
**来源**：https://jotai.org/docs/advanced/derived atom

filterAtom + itemsAtom，visibleAtom=atom(get=>get(items).filter(by get(filter)))，组件读 visibleAtom。

### 5. (设计类) 可写派生(atom(get,set))典型用途？
**来源**：https://jotai.org/docs/primitives

做 v-model：get 返回组合值、set 拆分写回多个源 atom。

### 6. (对比类) 与 MobX computed 的异同？
**来源**：https://mobx.js.org/

都惰性缓存自动依赖；MobX 面向对象可变、Jotai 函数式不可变值。

### 7. (性能类) 派生链很深会有什么风险？
**来源**：https://jotai.org/docs/advanced/atom-patterns

末端消费触发整条链同步重算，链过深/过宽影响帧率（呼应 pinia-getters 链）。

### 8. (TS类) 派生 atom 的只读类型如何体现？
**来源**：https://jotai.org/docs/typescript/typescript

仅 getter 的 atom 类型为 Writable=false，写它会 TS 报错。

### 9. (综合类) 举例 derived 依赖另一个 derived。
**来源**：https://jotai.org/docs/core/atom

total=atom(get=>sum(get(items))); discounted=atom(get=>get(total)*0.9); 后者依赖前者。

### 10. (坑类) 循环依赖报错如何定位？
**来源**：https://github.com/pmndrs/jotai/discussions

画依赖图、检查 getter 是否互相 get；Jotai 会抛 circular dependency 提示。

### 11. (实战类) 把 selector 逻辑迁成 derived 的收益？
**来源**：https://jotai.org/docs/introduction

获得缓存与跨组件共享计算，避免每组件重复执行派生。

### 12. (设计类) 何时不必用派生直接组件内算？
**来源**：https://jotai.org/docs/

仅单组件用、成本极低的映射，useMemo 足够，别过度建 atom。

### 13. (对比类) derived 与 signal computed 的关系？
**来源**：https://github.com/tc39/proposal-signals

几乎同构：惰性派生 + 自动依赖，体现 Jotai 贴近 signal 模型。

### 14. (趋势类) React Compiler 会削弱 derived 的价值吗？
**来源**：https://react.dev/learn/react-compiler

编译器 memo 单组件，但跨组件共享派生仍需 Jotai 缓存。

### 15. (综合类) 给购物车设计 items + 派生 total/count。
**来源**：https://jotai.org/docs/core/atom

countAtom=atom(get=>get(items).length); totalAtom=atom(get=>get(items).reduce(...))，均只读派生。
