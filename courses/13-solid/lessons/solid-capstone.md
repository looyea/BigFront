# 毕业项目：一个完整的 SolidStart 全栈应用

> 目标：把 L1–L8 所有能力落到**一个可交付的项目**上——从需求拆解、目录与状态架构、响应式与数据层、Suspense/错误边界、服务端函数与部署，到测试与验收清单。这是"会背"到"会建"的临界关。

## 一、项目设定：团队协作看板（迷你 Trello）

功能面刻意覆盖全课每个知识点：
- 多列看板，列/卡片可增删改、拖拽换列；
- 卡片详情抽屉（评论、标签、指派人）；
- 实时"已保存"指示、乐观更新 + 失败回滚；
- 需登录（session）、数据走后端；
- 路由：`/board/[id]`、`/board/[id]/card/[cardId]`、`/login`、`/api/*`。

## 二、目录与路由架构（L7 落地）

```
src/
├── app.tsx                     # Router root：Suspense 包 children（防 hydration 错）
├── entry-client / entry-server # 不碰
├── routes/
│   ├── index.tsx               # / → 跳默认板
│   ├── login.tsx               # 全屏、不套 board 布局
│   ├── board.tsx               # 布局文件：与 board/ 同名 → 子树共享头部/侧栏
│   ├── board/
│   │   ├── index.tsx            # /board 我的板列表
│   │   └── [id].tsx            # /board/:id 单看板（useParams + query + preload）
│   │   └── [id]/card/[cardId].tsx  # 卡片详情（嵌套动态段）
│   ├── api/
│   │   └── webhooks/[...slug].ts   # catch-all API 路由（导出 GET/POST）
│   └── (marketing)/about.tsx   # 分组、不进 URL
```
命名手法四件套全部用上：布局同名、`[id]`/`[cardId]` 动态、`[...slug]` catch-all、`(marketing)` 分组。

## 三、状态架构（L2/L6 落地）

- **服务端数据**（板、卡、用户）：一律 `query`+`createAsync`，**不在客户端再存一份**（单一事实源）；
- **纯客户端 UI 态**（抽屉开合、拖拽临时态、筛选）：`createSignal` 就近放对应组件；成组拖拽态用 `createStore`（路径更新、`produce` 改多字段）；
- **派生**（列内排序后的卡、完成度百分比、URL 过滤结果）：`createMemo`，**绝不 effect set 信号**；
- **共享**（当前用户、看板 store）：Context（Provider + `useBoard()` 抛错守卫）；
- 纪律：props/state 不解构、用到才读、`For` keyed 列表——把 L6 的"保住更新粒度"焊进 code review。

## 四、异步与鲁棒性（L5 落地）

- 每列数据 `createResource`/`query`，`<Suspense fallback={骨架列}>` 就近包，做**非阻塞流式**：先出框架、数据到位补内容；
- 顶层与每个远程区挂 `<ErrorBoundary fallback={(err,reset)=>...reset}`，把"某列拉取失败"关在局部、给"重试"而非白屏；
- 拖拽换列用**乐观更新**：`mutate` 本地即时改 → action 落库 → 失败 `catchError`/错误边界回滚并提示。

## 五、动作与写路径（L8 落地）

- 每个变更 = `<form action={serverAction.with(id)} method="post">` + `"use server"`；
- 关键写走 **single-flight**：目标数据在路由上 `route.preload`，提交后框架自动 revalidate、同响应流回，UI 秒更不转圈；
- `throw redirect` 处理登录后跳转与越权回退；`getRequestEvent()` 在校验里读 header/token。

## 六、渲染与部署（L7/L8 落地）

- 看板交互重、需登录 → 这些路由保持 **SSR/CSR**（个性化，不预渲染）；
- `(marketing)/about` 等公开静态页进 **prerender**（`routes` 名单，别把 `/board` 放进去）；
- 部署：Node 起步；要上边缘按平台选 Nitro preset，Cloudflare 记得 `node:async_hooks` external + `nodejs_compat`；严 CSP 就把 `serialization.mode` 定 `json`。

## 七、性能与工程质量收口（L6 落地）

- 长列表/重组件 `lazy`+`Suspense` 切包；昂贵派生 memo 收敛、纯返回属性不套 memo；
- 批量写用 `batch`/store 自动批处理；定时器/订阅一律 `onCleanup` 防泄漏；
- TS：`jsx:preserve`、信号类型 `Accessor/Setter`、Context 带 `|undefined` 守卫、泛型组件别用 `Component`。

## 八、测试策略（L8 落地）

- **逻辑层**：派生 memo / store 动作用 `createRoot`+`testEffect` 纯测，不碰 DOM；
- **组件层**：`@solidjs/testing-library`（render 收函数、`location` 测路由页、无 rerender 用 signal 驱动、别滥用 waitFor）；
- **E2E**：Playwright 覆盖"登录→拖拽→乐观更新→断网回滚→刷新一致"全链路；
- CI 盯死 Vitest"双份 solid-js"坑（deps 单例）。

## 九、交付与验收清单（graded rubric）

- [ ] 路由：`[id]`/`[cardId]`/catch-all/布局同名/分组五种约定都在用且 URL 正确
- [ ] 状态：服务端数据单一事实源、客户端态就近、派生全走 memo、无"effect set 信号"
- [ ] 响应式纪律：全仓无 props/state 解构、无 JSX 提前求值、列表用 For
- [ ] 异步：Suspense 非阻塞流式 + ErrorBoundary 局部化 + 乐观更新回滚
- [ ] 写路径：server action + single-flight + 至少一处 `throw redirect` 与 `getRequestEvent`
- [ ] 部署：渲染形态按路由分档、Cloudflare/严 CSP 配置到位
- [ ] 性能：memo 收敛、batch 合并、onCleanup 防泄漏、lazy 切包
- [ ] 测试：三层测试齐全、CI 绿
- [ ] 迁移自检：能向 React 团队讲清本项目"删掉了哪些 React 优化、为什么"

🎓 **毕业**：这九条勾满，你就具备了从零交付一个生产级 Solid/SolidStart 全栈应用的完整能力。恭喜完成「大前端学院 · SolidJS」全程。
