# react-architecture 面试题精选

> 共 12 题，覆盖 A 目录与分层 / B 逻辑与依赖 / C Server/Client 边界 / D 演进·Vue 对照四类。

---

## 一、目录与分层（A 类）

### 1. 项目目录"按类型分"和"按 feature 分"差别在哪？你选哪个？

**答**：按类型（components/、api/、store/ 各堆一处）会让**一个功能散落多处**，改一个需求要跨文件夹跳、删除功能要满工程找。按 feature（auth/、cart/，每个内含自己的组件/hook/service/store）让**相关代码高内聚**，可整体理解、迁移、删除，边界清晰。选 feature 优先，再配 `shared/`（跨业务通用）与 `app/`（装配）。这是"以变化为单位组织"的体现（呼应 vue-project-architecture）。

**来源**：React 大型应用结构实践、Feature-Sliced Design(FSD) 文档、Bulletproof React 指南

### 2. 什么是组件"分层"？页面/容器/展示/UI 基础各干什么？

**答**：① **页面/路由组件**对应 route，编排数据与子组件；② **容器/特性组件**绑定业务（含数据流与交互）；③ **展示组件**纯 props→UI、无业务、可复用易测；④ **UI 基础组件**（按钮/输入/Modal）业务无关，沉淀设计系统。目的：把"业务逻辑"和"视觉呈现"分离，使改动局部化、展示层可独立测试与复用。

**来源**：Presentational & Container components（Dan Abramov）、Atomic Design、Bulletproof React

### 3. feature 目录里的 index.ts（barrel/门面）有什么价值？会引入什么问题？

**答**：价值：定义 feature 对外的**公共 API**，外部 `import { useAuth } from '@/features/auth'` 而非深入内部文件，隐藏实现、降低耦合、便于重构。问题：若 indiscriminately re-export 一切，等于没封装，还可能造成**循环依赖**、拖慢打包（把所有文件都拉进图）。故门面应**只导出真正公共的东西**，内部文件不外泄。

**来源**：Barrel files 讨论、FSD public API、TypeScript circular import 实践

---

## 二、逻辑与依赖方向（B 类）

### 4. services / hooks / utils 三层各自职责与依赖方向？

**答**：`services`（api）封装 HTTP——统一实例、拦截器、鉴权头、错误规整，组件不裸写 fetch；`hooks` 是**有状态逻辑**编排层（`useProducts` 调 service/Query 并把数据/动作给组件，呼应 react-custom-hooks）；`utils` 是**纯函数**（格式化/校验，无 React 依赖、最易测，呼应 react-testing）。依赖单向：组件 → hooks → services → lib，禁止反向或平级乱引，保证可替换、可测。

**来源**：分层架构 / Clean Architecture 前端实践、Bulletproof React — API layer

### 5. 为什么"一个 500 行的巨型组件"是架构坏味道？怎么拆？

**答**：坏在：难读、难测、任一小改触发整块重渲染（呼应 react-performance 状态下沉）、多人协作频繁冲突、逻辑与 UI 混杂。拆分依据"**会一起变化的放一起**"：按子功能拆展示子组件、把有状态逻辑抽成自定义 Hook、把数据获取交给 Query/loader、把复用 UI 提到 shared。拆后各块职责单一、可独立测试与记忆化。

**来源**：Single Responsibility、React 官方 — 拆分组件、Extracting hooks

### 6. 如何避免"到处 import 导致耦合一团"？

**答**：① 明确**依赖方向**（上层依赖下层，不反向）；② 用 feature 门面限定跨模块入口；③ 配置路径别名 `@/` 并由 lint/依赖检查（如 ESLint `import/no-cycle`、dependency-cruiser）把关；④ 共享的东西放 shared，别从某个 feature 里抠给别的 feature 用（会隐性耦合业务）。核心是让"谁能依赖谁"成为**可检查的规则**。

**来源**：dependency-cruiser、ESLint import plugin、FSD 层规则

---

## 三、Server / Client 边界（C 类）

### 7. React Server Components / Client Components 的边界该如何设计？

**答**：默认**服务端组件**（在服务器渲染、可直连数据源、其代码不进客户端 bundle）；需要交互/浏览器 API/hooks 的地方标 `'use client'`。原则是**把 client 边界尽量推深**——页面主体留服务端，只把真正交互的小叶子变客户端组件，最小化客户端 JS。数据获取优先在 server 侧做，跨边界用 props 序列化传递（函数/Date 等不可跨边界直传）。这直接决定"哪些逻辑抽 client hook、哪些数据在 server 取"（呼应 react-architecture 第四节、react-nextjs、react-data-fetching）。

**来源**：React 官方文档 — Server Components、Next.js — Server and Client Components

### 8. "客户端 bundle 越小越好"在架构上如何落地？

**答**：① RSC 边界推深，服务端数据不进客户端包；② 路由/重组件 `React.lazy` 动态 import 代码分割（呼应 10-vite-splitting）；③ 第三方重型库按需引入、找更轻替代；④ 避免 barrel 把整包拉入；⑤ 构建期用 Vite manualChunks 拆 vendor、看打包分析定位大依赖。架构上就是"数据默认 server、UI 惰性加载、依赖审慎引入"。

**来源**：Next.js — Reducing bundle size、Vite 构建分析、React.lazy

---

## 四、演进与 Vue 对照（D 类）

### 9. 如何理解"架构随复杂度生长，而非一开始堆满"？

**答**：预先上 Redux、微前端、monorepo、DDD 全套，小项目会背沉重样板与认知负担、收益为负。合理路径：先**按 feature 分层 + Context/Query 满足需求**，当出现真实痛点（跨端复用、超大团队协作、状态复杂到需可预测）再引入对应工具。判据是"当前的规模与团队协作成本"。能讲清"何时该升级架构"比"会不会堆架构"更能体现成熟度（呼应 react-state-mgmt 选型、react-architecture 第五节）。

**来源**：Bulletproof React — Trade-offs、YAGNI、Premature optimization 讨论

### 10. 从 Vue 项目架构迁到 React，哪些经验可平移、哪些要重学？

**答**：可平移：feature 优先目录、组件分层、单向依赖、错误/加载分层兜底、环境变量区分——这些框架无关（呼应 vue-project-architecture）。要重学：① **无 SFC/模板**，一切 JSX + import；② 逻辑复用从"composables 引用共享"变为"自定义 Hook 各自一份 + Context/store 共享"（呼应 react-custom-hooks）；③ 响应式自动更新 → 需理解手动重渲染/记忆化/选择器（呼应 vue-reactivity-theory）；④ 数据默认在客户端 → 新范式要设计 Server/Client 边界。

**来源**：Vue 与 React 架构对比、React 官方 — Thinking in React、Composition 对照

### 11. 全局配置/环境变量在 React + Vite 项目里怎么管才干净？

**答**：用 `import.meta.env.VITE_*`（Vite 约定，只有 `VITE_` 前缀会注入客户端，敏感值别放，呼应 10-vite-deploy、node-config）。收拢到一个 `lib/config.ts` 读取 + 类型化 + 校验（缺失即报错），组件不直接散落读 `import.meta.env`。区分 dev/prod/base、API baseURL 走环境变量。SSR/Next 下再注意服务端变量与 `NEXT_PUBLIC_` 前缀之别（呼应 react-nextjs）。

**来源**：Vite 文档 — Env variables、Next.js — Environment Variables

### 12. 面试官让你"设计一个可维护的中大型 React 应用架构"，你如何组织答案？

**答**：给蓝图 + 权衡：① 目录按 feature + shared + app，门面收敛依赖；② 组件分层（页面/容器/展示/UI）与单向依赖 services→hooks→组件；③ 状态分三类各归其位（局部/Context/外部 store/Query 服务端态，呼应 react-state-mgmt）；④ 数据用 Data Router loader + Query；⑤ 渲染控制分层兜底（ErrorBoundary/Suspense）；⑥ 性能按 feature 与虚拟化 + 代码分割；⑦ 测试按行为、CI；⑧ 演进式——先满足当前复杂度再加重。强调"每层为可替换/可测/可定位服务"，体现体系化而非堆名词。

**来源**：Bulletproof React、Feature-Sliced Design、React 官方 — Thinking in React
