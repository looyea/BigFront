# 面试题：全局原子与模块作用域（jo-global）

### 1. (原理类) 为什么 Jotai 能无 Provider 全局共享？
**来源**：https://jotai.org/docs/core/store

模块作用域 atom + 内部默认 store 单例，useAtom 直接读写它，不经 React context。

### 2. (对比类) 全局 atom 与一个全局 Zustand store 的差异？
**来源**：https://jotai.org/docs/introduction

都是模块单例；Zustand 一个大对象 + selector，Jotai 多个小 atom，天然细订阅。

### 3. (坑类) 全局 atom 在测试里的问题与解法？
**来源**：https://jotai.org/docs/advanced/atom-lifecycle

用例间状态残留；解法：每测试用 Provider + createStore 隔离（呼应 jo-store/jo-perf-test）。

### 4. (实战类) 主题 atom 全局共享怎么落地？
**来源**：https://jotai.org/docs/utilities

themeAtom=atomWithStorage("theme","light")，任意组件 useAtom 读写并自动持久。

### 5. (设计类) 哪些状态适合做全局 atom，哪些不适合？
**来源**：https://jotai.org/docs/introduction

适合：跨页共享的会话/UI 偏好；不适合：纯局部（用 useState）、服务端数据（用 Query）。

### 6. (对比类) Jotai Provider 与 React Context 关系？
**来源**：https://jotai.org/docs/utilities/provider

Jotai 的 Provider 是注入自定义 store 的可选机制，日常全局共享并不需要它。

### 7. (SSR类) 全局 atom 在 SSR 直接用的风险？
**来源**：https://jotai.org/docs/utilities/ssr

Node 单例跨请求共享，需每请求 createStore+Provider（详见 jo-ssr）。

### 8. (性能类) 无 Provider 的性能收益来自哪？
**来源**：https://jotai.org/docs/core/use-atom

省去 context 传播与全子树比较，仅按 atom 订阅更新。

### 9. (综合类) 给登录态设计一组全局 atom。
**来源**：https://jotai.org/docs/core/atom

tokenAtom、userAtom、isLoggedIn=atom(get=>!!get(tokenAtom))、logout=write-only atom 清两者（呼应 jo-write-only）。

### 10. (设计类) 如何组织 atom 文件目录？
**来源**：https://jotai.org/docs/advanced/atom-patterns

store/<domain>.ts 导出该域 atom/派生/写 atom，作为黑盒接口。

### 11. (坑类) 全局 atom 名冲突/重复创建会怎样？
**来源**：https://jotai.org/docs/advanced/atom-lifecycle

同一文件重复 atom() 生成不同原子不共享；需保证单一来源导出。

### 12. (对比类) 与把值挂 window 相比？
**来源**：https://jotai.org/docs/

window 无订阅/派生/并发安全；atom 有响应式与依赖追踪。

### 13. (趋势类) 未来信号标准会让全局 atom 更简单吗？
**来源**：https://github.com/tc39/proposal-signals

标准原语 + effect scope 可能内建隔离生命周期，Jotai 有望更贴标准。

### 14. (综合类) 何时从全局 atom 升级到 Provider？
**来源**：https://jotai.org/docs/utilities/provider

出现 per-instance 隔离、SSR 每请求、测试独立性需求时。

### 15. (实战类) 如何避免全局 atom 变成新的大泥球？
**来源**：https://jotai.org/docs/advanced/atom-patterns

保持原子小、按域分文件、派生用只读 atom 表达关系，别塞巨型对象。
