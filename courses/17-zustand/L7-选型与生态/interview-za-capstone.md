# 面试题：团队规范与进阶（za-capstone）

### 1. (设计类) 你会给团队定哪几条 Zustand 铁律？
**来源**：https://zustand.docs.pmnd.rs/limits/optimal-composition

① 一律走封装 createStore ② 更新只经 action ③ selector 只返回稳定值 ④ 服务端态归 Query ⑤ 跨 slice 经 get().action。

### 2. (实战类) 封装 createStore 时中间件顺序怎么定？
**来源**：https://zustand.docs.pmnd.rs/integrations/middleware

devtools 最外、按需 persist、immer 最内，团队统一（呼应 za-middleware-chain）。

### 3. (对比类) 为什么用封装而不是让每人自己写中间件？
**来源**：https://zustand.docs.pmnd.rs/

避免各写各的导致顺序错误、遗漏 devtools、命名不统一，封装即约定。

### 4. (设计类) 如何 lint 禁止组件内直接 setState？
**来源**：https://github.com/pmndrs/zustand/discussions

ESLint 自定义规则检测 store.setState 出现在组件文件，或约定只暴露 action。

### 5. (综合类) 给整个包设计一次 code review 检查表。
**来源**：https://zustand.docs.pmnd.rs/limits/optimal-composition

含 v5 selector 稳定、中间件顺序、persist 版本迁移、SSR 隔离、乐观回滚、分层归属。

### 6. (对比类) Zustand 学到什么程度算毕业？
**来源**：https://zustand.docs.pmnd.rs/

能独立做封装、诊断过度渲染、处理 SSR/水合/并发、制定团队规范。

### 7. (趋势类) React Compiler 会改变你的规范吗？
**来源**：https://react.dev/learn/react-compiler

减轻 memo 负担，但分层归属、selector 稳定、单写路径等规范仍核心。

### 8. (设计类) 为何把 selector 集中导出？
**来源**：https://zustand.docs.pmnd.rs/limits/optimal-composition

一处维护如何取数、便于 mock/测试与改结构，组件不依赖内部字段。

### 9. (实战类) 新项目引入 Zustand 的落地顺序？
**来源**：https://zustand.docs.pmnd.rs/

先封装 createStore+分层目录→迁移全局交互态→配 persist/devtools→定测试与 lint。

### 10. (对比类) 什么时候你会反过来推荐不用 Zustand？
**来源**：https://redux-toolkit.js.org/

超大团队要严格规范/重中间件，或状态极少只需 Context/Query。

### 11. (综合类) 给“状态归属”写一份团队一页纸。
**来源**：https://tkdodo.eu/blog/

server→Query、client 全局→Zustand、client 局部→useState、form→RHF、url→router、原子依赖→Jotai。

### 12. (设计类) 进阶路线 Jotai/Valtio 与 Zustand 关系？
**来源**：https://jotai.org/docs/introduction

互补：Zustand 全局业务 store，Jotai 原子派生，Valtio proxy 可变嵌套，按场景共存。

### 13. (实战类) 如何做一次 store 健康度审计？
**来源**：https://zustand.docs.pmnd.rs/integrations/auto-render-optimizations

Profiler 找过度渲染、搜组件内 setState、查 server 数据入 store、验 persist 版本与迁移。

### 14. (趋势类) Signals 标准对 Zustand 未来的影响？
**来源**：https://github.com/tc39/proposal-signals

订阅/派生更标准化，Zustand 或提供更原子的 API，但 store 心智长期共存。

### 15. (综合类) 一句话总结 Zustand 的工程哲学。
**来源**：https://zustand.docs.pmnd.rs/

以最小 API 提供最大自由度，用团队约定（封装/命名/边界）把自由变成秩序。
