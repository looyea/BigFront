# 面试题：Store 隔离（jo-store）

### 1. (原理类) atom 与 store 的关系是什么？
**来源**：https://jotai.org/docs/core/store

atom 是描述（key + 计算），store 是存放其运行时值的容器；同一 atom 在不同 store 里有独立值。

### 2. (设计类) 为什么全局默认 store 不安全于 SSR？
**来源**：https://jotai.org/docs/utilities/ssr

Node 复用同一 store 实例跨请求，用户数据互相污染，必须每请求独立 store。

### 3. (实战类) 用 Provider 实现可重复 Widget 独立状态？
**来源**：https://jotai.org/docs/utilities/provider

每个 Widget 外层包独立 store 的 Provider，内部 atom 读写互不干扰（呼应 za-factory）。

### 4. (对比类) Jotai Provider/store 与 React Context 异同？
**来源**：https://jotai.org/docs/utilities/provider

都做作用域注入；但 Jotai 只订阅用到的 atom，不像 Context value 变更全子树重渲。

### 5. (坑类) 忘包 Provider 直接用全局 atom 会？
**来源**：https://jotai.org/docs/

测试间/多实例共享同一份值，出现脏状态与相互影响。

### 6. (综合类) 设计一个向导的多实例隔离方案。
**来源**：https://jotai.org/docs/utilities/provider

每开一个向导用新 createStore 的 Provider 包住，step/data atom 各自独立。

### 7. (TS类) createStore 类型如何标注？
**来源**：https://jotai.org/docs/typescript/typescript

createStore() 返回 WritableStore，get/set/sub 类型随所用 atom 推断。

### 8. (实战类) 如何做一个可被覆写的全局配置 atom？
**来源**：https://jotai.org/docs/utilities/provider

外层 Provider 给默认值，子树用新 store 覆写该 atom，实现分层配置。

### 9. (对比类) store 隔离与 Zustand per-request 工厂对比？
**来源**：https://jotai.org/docs/utilities/ssr

思路一致（每请求独立实例）；Zustand 用 createStore+Context，Jotai 用 vanilla store+Provider。

### 10. (性能类) 大量 Provider 会有开销吗？
**来源**：https://jotai.org/docs/

每个 store 是轻量 map，开销小；主要是订阅数增加，仍比 Context 全量渲染省。

### 11. (设计类) 测试里用 Provider 还是直接 store.set？
**来源**：https://jotai.org/docs/

纯逻辑测 store.get/set 直测；测渲染联动用新 Provider 包裹组件。

### 12. (坑类) 同一 store 实例给两个 Provider 会怎样？
**来源**：https://jotai.org/docs/utilities/provider

两子树共享该 store 的 atom 值，隔离失效；需各自 createStore。

### 13. (趋势类) signal effect scope 会替代 Provider 吗？
**来源**：https://github.com/tc39/proposal-signals

scope 更自然地绑定生命周期与隔离，但作用域注入语义仍会保留类似机制。

### 14. (综合类) 给一个 SSR 每请求 store 的最小实现。
**来源**：https://jotai.org/docs/utilities/ssr

服务端每次请求 createStore() 存进上下文，渲染 Provider store，dehydrate 后随 HTML 下发。

### 15. (设计类) 团队何时该从全局 atom 切到 Provider？
**来源**：https://jotai.org/docs/

一旦出现 SSR、测试污染或多实例隔离需求，即从默认 store 升级到 Provider。
