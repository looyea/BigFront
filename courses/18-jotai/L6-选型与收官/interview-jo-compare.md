# 面试题：选型矩阵（jo-compare）

### 1. (选型类) 给一个 Jotai vs Zustand 的判据口诀。
**来源**：https://jotai.org/docs/introduction

状态是一堆相互派生的小原子、要原生 async→Jotai；一个内聚业务 store、简单快→Zustand。

### 2. (对比类) 为什么说 Jotai/Zustand 是互补路线？
**来源**：https://jotai.org/docs/introduction

一个自下而上原子、一个自上而下 store，覆盖不同数据形状，非零和。

### 3. (对比类) Jotai 与 Redux 心智负担差异？
**来源**：https://redux-toolkit.js.org/

Redux 强制 action/reducer/单向流；Jotai 用 atom 直接表达值与派生，样板少但需自律结构。

### 4. (设计类) 一个项目同时用 Jotai 和 Query 合理吗？
**来源**：https://jotai.org/docs/

合理：Query 管服务端态，Jotai 管客户端原子交互态，边界清晰（呼应 za-layers）。

### 5. (性能类) Context 何时会明显输给 Jotai？
**来源**：https://react.dev/reference/react/useContext

高频/细粒度更新时 Context 全子树重渲，Jotai 按 atom 精准订阅。

### 6. (选型类) 老 Redux 项目值得换 Jotai 吗？
**来源**：https://jotai.org/docs/

看收益：依赖派生/异步多、样板痛则渐进迁移；已稳定规范可不动。

### 7. (对比类) Jotai 的 async 与 RTK Query 对比？
**来源**：https://redux-toolkit.js.org/rtk-query/overview

RTKQ 提供完整缓存/失效/分页；Jotai async atom 轻且声明式，复杂缓存仍需自建或配合 Query。

### 8. (综合类) 给中小 SPA 一套默认选型。
**来源**：https://jotai.org/docs/

服务端态 Query + 客户端交互 Jotai（或 Zustand 二选一）+ 表单 RHF。

### 9. (对比类) DevTools 成熟度排序？
**来源**：https://jotai.org/docs/devtools

Redux 最强、Zustand 借用、Jotai 有依赖图 DevTools、Context 无。

### 10. (设计类) 团队同时有 Jotai 与 Zustand 如何划线？
**来源**：https://jotai.org/docs/

按数据形状：离散/派生密集用 Jotai，跨域业务大 store 用 Zustand，避免同一份两处存。

### 11. (选型类) 为什么不能只看体积选型？
**来源**：https://jotai.org/docs/introduction

体积差几 KB 无关痛痒，真正成本在订阅粒度、异步模型、团队规范与生态。

### 12. (对比类) Jotai 与 MobX 的响应式差异？
**来源**：https://mobx.js.org/README.html

MobX 可变对象 + 自动追踪(OOP)；Jotai 不可变原子 + 显式 get(函数式)。

### 13. (趋势类) React 信号化会统一这些库吗？
**来源**：https://github.com/tc39/proposal-signals

底层原语趋同，但 store/原子/规范层差异会长期存在。

### 14. (综合类) 给一张最终选型决策文字树。
**来源**：https://jotai.org/docs/

远端→Query；原子派生/async→Jotai；内聚业务小团队→Zustand；超大规范→RTK；低频→Context。

### 15. (设计类) Jotai 的最大优势与最大风险各是什么？
**来源**：https://jotai.org/docs/

优势：原子 + 原生异步 + 细订阅；风险：原子爆炸/依赖图复杂时缺集中约束需自律。
