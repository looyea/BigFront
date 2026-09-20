# React 项目架构

> 目标：把前 7 关的零件组装成一个**可长期演进**的工程。本课讲：按 feature（而非按文件类型）组织目录、组件分层（页面/容器/展示/UI 库）、逻辑复用层（hooks/services/utils）、**Server/Client 组件边界**（新范式，为 L8 后两关铺垫）、状态与数据的分层归属、错误与加载兜底的全局策略、以及"避免过度工程"。呼应 **vue-project-architecture**、**node-config**、**react-state-mgmt**、**react-data-fetching**。

---

## 一、按 Feature 组织，而非按类型

```
src/
  features/
    auth/        { components, hooks, api.ts, store.ts, index.ts }
    cart/
    products/
  shared/        (或 components/, hooks/, lib/, ui/)
    ui/          通用无业务按钮/输入/Modal
    hooks/       useDebounce 等通用
    lib/         http 客户端、格式化、常量
  app/           路由、全局 Provider、布局
```
- **横向按业务切**（auth/cart/products），每个 feature 自带组件+hook+服务+store，**内聚**、可整体删除/迁移；
- `shared` 放**跨 feature 无业务**的东西；`app` 放装配层；
- 反例：把所有 `.jsx` 放 `components/`、所有 `.js` 放 `api/`——一个功能散落五处、改一处要跳八方（对照 vue-project-architecture 同结论）。
- `index.ts` 作 feature 的**公共 API 门面**，外部只从门面导入，隐藏内部结构、防止随意穿透耦合。

---

## 二、组件分层

- **页面/路由组件**：对应一条 route，负责编排（拿 loader/Query 数据、组合子组件）；
- **容器/特性组件**：绑定某 feature 的业务组件（含数据与交互）；
- **展示组件**：纯 props 进、UI 出，无业务、易测易复用（呼应 react-composition 的"提升状态、下传展示"）；
- **UI 基础组件**：`shared/ui` 里与业务无关的按钮/表单控件，可沉淀成设计系统。

分层目的：**业务逻辑与展示分离**，改动局部化。别把 500 行塞一个组件——按"会一起变化的放一起"拆。

---

## 三、逻辑复用层：hooks / services / utils

- `services`（api.ts）：封装 HTTP（一个 axios/fetch 实例 + 拦截器，统一错误、鉴权头，呼应 09-exp-auth）；组件不直接写 `fetch('/...')`；
- `hooks`：有状态逻辑（`useProducts`、`useAuth`）编排 service + Query，暴露给组件（呼应 react-custom-hooks）；
- `utils`：纯函数（格式化、校验），无 React 依赖、最好测（呼应 react-testing）。
依赖方向单向：组件 → hooks → services → lib，**不反向**、不平级乱引。

---

## 四、Server / Client 组件边界（React 19 / Next 范式）

- 新范式（由 Next.js App Router 落地，见下一关）：组件分**服务端组件**（默认，在服务器渲染、可直接访问数据、代码不进客户端包）与**客户端组件**（`'use client'`，有交互/hooks/state）；
- 架构原则：**尽量把边界推深**——页面主体留服务端，只有真正需要交互的小叶子标 `'use client'`，客户端 bundle 越小越好；
- 本套课目前以**纯 SPA**（全客户端）讲解，但理解这一边界是走向全栈 React 的关键，也影响"哪些逻辑该抽成 client hook、哪些数据该在 server 取"（呼应 react-data-fetching、react-nextjs）。

---

## 五、全局策略与"别过度工程"

- **错误**：根 ErrorBoundary + 路由级 `errorElement` + Query 错误态，分层兜底（呼应 react-render-control）；
- **加载**：Suspense fallback / Query isLoading，统一骨架风格；
- **配置/环境变量**：走 `import.meta.env`（Vite），区分 dev/prod（呼应 node-config、react-deploy）；
- **避免过度**：小项目别强上 Redux/微前端/复杂 monorepo；先按 feature 分层 + Context/Query，等**痛点出现再演进**。架构是"随复杂度生长"，不是"一开始堆满"。

---

## 六、自检清单

- [ ] 为什么按 feature 而非按文件类型组织？index 门面有何用？
- [ ] 页面/容器/展示/UI 四层各自职责？
- [ ] 组件为何不直接 fetch？services→hooks→组件的单向依赖是什么？
- [ ] Server/Client 边界应把 client 标得"深"还是"浅"？为什么？
- [ ] "别过度工程"在你项目里如何落地？

---

## 🚀 部署预告

- 本课给出"feature 优先 + 组件分层 + 逻辑单向依赖 + 分层兜底 + 适度工程"的组装蓝图；
- 下一关进入 **react-nextjs**：把"组件在服务器还是客户端渲染"从概念变现实——App Router、SSR/SSG/ISR、Server vs Client Components、水合，呼应 vue-ssr-nuxt 与 07-nextjs。
