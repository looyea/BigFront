# SolidStart 总览 · 面试题

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) SolidStart 在 Solid 生态里是什么定位？相比纯 Solid 客户端应用多了什么？

它是官方元框架：在 Solid 细粒度响应式之上补齐文件路由、SSR 与水合、按路由自动代码分割、服务端函数（"use server"）、API 路由与部署目标。你写的组件/信号/store 原样可用，框架负责把应用端到端跑起来。
**来源**：SolidStart 官方文档 Getting started 与功能版面的定位叙述转述。

### 2. (A) app.tsx、entry-client.tsx、entry-server.tsx 各管什么？

app.tsx 是 HTML 根——客户端与服务端共同的渲染"外壳"，内部挂 Router 与 FileRoutes；entry-client 负责在浏览器加载并水合应用；entry-server 负责在服务端处理请求。官方明说两个 entry 一般不用改。
**来源**：官方 v1 getting-started「Project files」逐文件职责一节转述。

### 3. (A) 为什么 Router 的 root 组件里必须把 props.children 包进 Suspense？

因为 Start 下**每个路由组件都被自动 lazy 加载**，异步边界必须有人兜住；官方警告没有这层 Suspense 会出现"一些意外的水合错误"。惯例写法就是 `<Router root={(props) => <Suspense>{props.children}</Suspense>}>`。
**来源**：官方 routing 文档对 root + Suspense 的硬性提醒转述。

### 4. (A) `<FileRoutes />` 扮演什么角色？它和手写路由表什么关系？

文件路由扫描器：遍历 routes 目录、按文件名生成路由配置对象。因为它返回的就是 config 对象，你仍可以搭配自己选的 router 使用；且它只收录 UI 路由，API 路由文件不会进页面路由表。
**来源**：官方 FileRoutes 机制（生成路由、可与路由器选配）叙述转述。

### 5. (B) v2 的项目配置住在哪？和 v1 有什么版本差异要留意？

v2 收敛到 `vite.config.ts` 的 `solidStart()` 插件，可带 `middleware`（中间件入口）与 `devOverlay`（开发 toolbar 开关）；v1 文档则描述其下用 Vinxi 驱动 dev/build（`vinxi dev`）。读旧教程时注意这两代配置面的差别。
**来源**：v2 getting-started 配置节与 v1 文档 Vinxi 注脚的对比转述。

### 6. (B) 新项目页面在 dev 下多出一个浮动面板，怎么在生产里去掉/开发时关掉？

那是 SolidStart 的开发 toolbar（查应用错误与服务端函数调用），**生产构建本就不含**；开发期想隐藏配 `solidStart({ devOverlay: false })`。
**来源**：v2 文档 Development toolbar 一节转述。

### 7. (C) `~/` 这种导入路径是怎么生效的？对比 React 项目常见做法？

Start 内置 `~` 别名指向 appRoot（默认 `src/`），`~/lib/db` 即 `src/lib/db`，无需自己在 tsconfig/vite 里配 alias。React + Vite 裸项目通常要手写 resolve.alias 才有同级体验。
**来源**：v2 文档 Path alias 一节与常见 Vite 配置实践的对比转述。

### 8. (C) 同一个 routes 目录里的文件，框架怎么区分页面和接口？

看导出形态：**default export 组件 → UI 路由**；**导出 HTTP 方法名（GET/POST…）→ API 路由**。前者进 FileRoutes，后者成为服务端端点（如 src/routes/api/ping.ts → /api/ping）。
**来源**：v2 routing「UI routes and API routes」判定规则转述。

### 9. (D) 从零起一个 v2 项目，从命令到能跑 dev，你的完整步骤是？

`npm init solid`（或 pnpm/bun 等价物）→ 交互选模板（basic/with-tailwindcss/with-auth…）与 SSR/TS 选项 → `npm i` → `npm run dev`。注意 v2 要求 Node 24+；模板没配环境类型的话，把 `@solidjs/start/env` 加进 tsconfig types。
**来源**：v2 getting-started 建项流程与要求转述。

### 10. (B) 团队有人把业务逻辑直接写进 entry-server.tsx，你怎么劝？

官方定位 entry 文件只是"服务端处理请求"的管道，一般不需要修改；业务应住在 routes（页面/API 路由）与 "use server" 函数里。动 entry 属于框架层定制（如中间件走 `solidStart({ middleware })`），把它当逃生舱不是主路。
**来源**：官方对两个 entry 文件「通常无需修改」的定位转述。

### 11. (C) 为什么说 SolidStart 的组件懒加载和 Solid 的 lazy 是同一件事的两层？

Solid 的 `lazy(() => import())` 是应用开发者手动切分；Start 则把**每个路由文件默认就 lazy**当作框架行为——这就是 root 必须放 Suspense 的根因。理解这层，就理解 Start 的"按路由自动代码分割"几乎零成本。
**来源**：v1 routing 的 lazy 说明与 Solid lazy 机制综合转述。

### 12. (D) 让你给团队写「纯 Solid 老项目迁到 Start」的评估清单，你会列什么？

先搭脚手架并把 app.tsx/entry 结构对齐；把 Router 手工路由表改成 routes 目录文件映射（动态段/布局对照官方约定）；给 root 补 Suspense；把手写 fetch+effect 的数据层换成 query/createAsync（服务端资源加 "use server"）；配置从 vinxi/自建 Vite 迁到 vite.config.ts 的 solidStart()；最后配 @solidjs/start/env 类型与部署插件。
**来源**：文档 Migrating from v1 引导语与整体版式反推的迁移主题转述。

---

## 补充（新专题 13-15）

### 13.  对比 SvelteKit，SolidStart 在路由数据与错误处理上的心智差异清单？ 

 Kit 用 +load/+error 文件系统约定与状态码协议，Start v2 用路由树代码声明 loader + ErrorBoundary 组件；数据缓存层 Start 依赖自研/社区 query，Kit 内置失效原语；迁移要重写的恰是这些约定面。 

**来源**： https://github.com/solidjs/solid-start ； https://svelte.dev/docs/kit 

### 14.  环境变量在 Start 里的暴露规则与安全边界？ 

 默认全进服务端，进客户端需显式前缀/公开标记（v2 走 env 模块约定）；VITE_ 式前缀是打包进产物的信号，密钥一旦进客户端分支即泄露；CI 里对产物 grep 是最后防线。 

**来源**： https://github.com/solidjs/solid-start ； https://vitejs.dev/guide/env-and-mode 

### 15.  一个既有纯 CSR 项目升级 Start v2，你的分阶段路线？ 

 先装脚手架保持 SPA 模式验证构建链，再把取数从组件 fetch 迁到路由 loader（顺带治 loading 竞态），然后开 SSR 处理浏览器依赖点（isServer/onMount 收口），最后逐路由加 prerender；每阶段可独立回滚。 

**来源**： https://docs.solidjs.com/ 
