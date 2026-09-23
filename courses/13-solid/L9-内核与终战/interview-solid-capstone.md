# 毕业项目（架构综合） · 面试题

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (D) 设计一个"实时协作看板"的状态分层：服务端数据、客户端 UI 态、派生值各放哪？

服务端数据（板/卡/用户）走 `query`+`createAsync` 作单一事实源、不在客户端复制；纯客户端 UI 态（抽屉、拖拽临时态）就近 `createSignal`、成组用 `createStore`；一切可推出的量（排序、完成度、过滤结果）用 `createMemo`。跨层共享走 Context。
**来源**：官方 complex-state-management 与 Start 数据层落到真实业务的综合设计题转述。

### 2. (A) 为什么"客户端再存一份服务器数据"是反模式，Solid 里尤甚？

多一份可写状态就要手动同步、易失步；Solid 的 query 具名缓存本就为该数据提供了响应式载体，再复制进 store 只会制造两个真相源。正确做法是消费同一 query，写操作走 action 后 revalidate。
**来源**：单一事实源原则 + query 缓存机制结合的高频架构问答转述。

### 3. (D) 拖拽换列要"零延迟 + 断网可回滚"，说清数据流。

乐观更新：`mutate` 立即改本地 query 缓存让 UI 秒动；同时提交 server action 落库；失败用 `catchError`/重新 mutate 回滚到拖拽前状态并提示；成功后 action 完成触发相关 query 自动 revalidate（配合目标数据 preload 即 single-flight）。
**来源**：mutate 乐观更新 + single-flight + ErrorBoundary 综合的场景题转述。

### 4. (B) 某列远程数据挂了导致整页白屏，架构上漏了什么？

错误边界没做局部化：应给每个远程数据区就近包 `<ErrorBoundary fallback={(err,reset)=>…<button onClick={reset}>重试}>`，把故障关在该列子树、给恢复入口，而不是让异常冒泡到根。Suspense 管"未就绪"、ErrorBoundary 管"失败"，两者要成对规划。
**来源**：官方 ErrorBoundary 捕获范围与就近策略转述。

### 5. (C) 哪些路由该预渲染、哪些必须动态？给看板的划分。

公开、对所有访客一致、更新≈发布频率的（营销/关于页）进 prerender；含登录个性化、按用户/实时数据渲染的 `/board/*` 绝不进预渲染（否则把同一份壳发给所有人）。判据一句话：HTML 能否在构建期被完全确定。
**来源**：官方 route-prerendering 适用面延伸的决策题转述。

### 6. (D) 项目要上 Cloudflare、又是严 CSP，部署配置上要注意哪两点、代价是什么？

① Cloudflare 依赖 AsyncLocalStorage，要 `rollupConfig.external` 补 `node:async_hooks`/`__STATIC_CONTENT_MANIFEST` 且 wrangler 开 `nodejs_compat`；② 严 CSP 下把 `serialization.mode` 定 `json`（不用 eval 反序列化），代价是服务端函数载荷略大。
**来源**：官方 define-config 的 Cloudflare 特例 + 序列化模式两处配置综合转述。

### 7. (A) 长列表卡顿，你在 Solid 语境下按什么顺序定位与修？

先确认列表用 `<For>` 而非 `.map`（keyed 复用）；再查是否解构/提前求值把粒度弄粗；昂贵派生是否每行重复算→提到 memo；是否有 effect 在 set 信号造成连环更新→改 memo/batch；重组件行 `lazy`+Suspense 切包。核心先"恢复细粒度"再谈算法。
**来源**：Solid 性能排查主线（粒度→memo→effect→分割）综合转述。

### 8. (B) 团队把从组件里 `export` 出去的普通函数当"逻辑复用"，Solid 下更自然的做法是什么？

不必套 React 自定义 hook 那套 `useXxx` 约定——把复用逻辑写成**普通函数**，内部建 signal/memo/effect，返回访问器即可（Solid 非 hook、无条件/顺序限制）。注意在正确的 Owner 作用域内调用以享自动回收。
**来源**：官方"复用逻辑用普通函数、不是自定义 hook"叙述转述。

### 9. (C) 这个全栈应用里 query / action / API 路由 / createResource 会不会打架？各守什么位？

不冲突、分层次：createResource 是运行时异步原语（组件本地一次性异步）；query 是框架层具名缓存读（可 preload、跨组件共享）；action 是写路径（用户提交驱动、配 single-flight）；API 路由（导出 GET/POST）服务**站外 HTTP 客户端**。内部 UI 优先 query/action，对外接口才用 API 路由。
**来源**：官方各异步/数据入口职责分工的综合辨析转述。

### 10. (D) 给毕业项目设计测试矩阵（哪层测什么、用什么工具）。

逻辑层：memo 派生与 store 动作用 `createRoot`/`testEffect` 无 DOM 快测；组件层：`@solidjs/testing-library`（render 收函数、`location` 测路由页、signal 驱动更新、勿滥用 waitFor）；E2E：Playwright 跑"登录→拖拽乐观→断网回滚→刷新一致"全链路；CI 盯 Vitest 双份 solid-js 坑。
**来源**：testing-library 定位 + Start 全栈特性归纳的分层测试设计转述。

### 11. (B) 上线后发现内存缓慢上涨，最可能踩了什么、怎么查？

未清理的订阅/定时器/WebSocket，或 `createRoot` 外的游离响应式作用域没 dispose（不随组件回收）。查：所有 setInterval/订阅是否都在 `onCleanup` 里释放；模块顶层/库内手建的 root 是否在卸载时调用返回的 dispose。
**来源**：官方 onCleanup 防内存泄漏 + createRoot 不自动回收转述为排障题。

### 12. (A) 用一段话把整个 Solid/SolidStart 技术栈的"一条主线"讲清楚，作为毕业陈述。

一切皆同一张细粒度计算图：signal 读时登记、写时短路，memo/effect/render effect 按拓扑序精确更新到属性；Owner 树管回收与 Context；控制流组件把响应式落到 DOM 复用；resource/Suspense/ErrorBoundary 处理异步与失败边界；Start 用文件路由、"use server" 编译抽离、query/action + single-flight、prerender/部署预设把这张图端到端跑成全栈应用。九关只是它的不同切面。
**来源**：全课技术主线综合凝练（毕业陈述式）转述。

---

## 补充（新专题 13-15）

### 13.  完成度百分比（全板统计）的性能与正确性架构？ 

 计数存每列 store 路径+列级 memo，板级 memo 聚合：单卡移动只重算触达列与根链，全板 O(列数)；正确性靠派生不存储（单一真值源），并发编辑下以服务端返回为准 reconcile。 

**来源**： https://www.solidjs.com/docs/latest/api#creatememo 

### 14.  万张卡片列表卡顿，完整归因与优化顺序？ 

 先量再改：Profiler/帧计时定位是首建、更新还是布局；首建重→windowing/分段挂载，更新重→查状态提升过度与 Index 错位，布局重→contain/合成层；每改一项回归一次，最后才动架构。 

**来源**： https://www.solidjs.com/docs/latest/guides/loops 

### 15.  给这个项目配测试矩阵：单元/组件/端到端/快照各测什么？ 

 单元：派生 memo 与回滚纯函数表驱动；组件：拖拽落点、乐观失败回显、错误边界隔离；e2e：金路径建卡-拖拽-刷新持久化+渐进增强无 JS；快照只锁骨架不锁样式。 

**来源**： https://github.com/solidjs/testing-library ； https://playwright.dev/docs/intro 
