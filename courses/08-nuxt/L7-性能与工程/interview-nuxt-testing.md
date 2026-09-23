# nuxt-testing 面试题（12 题）

## A. 基础认知

### 1. 一个 Nuxt 全栈应用你会怎么搭测试分层？
**答**：四层金字塔。①单元：纯函数与 utils 用 Vitest 直接测最快；②组件：SFC 渲染与交互用 `@nuxt/test-utils` 的 `mountSuspended`（能 await 异步 setup）；③集成：起真实 Nitro 用 `$fetch` 测 server route 的状态码/错误契约/缓存头；④端到端：Playwright 覆盖关键用户流程与"只有真浏览器+真服务端才能证明"的 SSR/水合/鉴权行为。原则是底层多而快、顶层少而精、中间测契约，别把一切塞进 e2e。

**来源**：《Nuxt 测试策略》、《全栈应用的测试金字塔》

### 2. environment:'nuxt' 和 mountSuspended 分别解决什么？
**答**：`environment:'nuxt'` 让 Vitest 运行在装配好的 Nuxt 上下文里，自动导入的 `useRuntimeConfig/useState/useFetch`、`#imports` 别名、注入都能真实工作，不必手工 import 一切。`mountSuspended` 是 `@nuxt/test-utils` 提供的挂载函数，会等待组件 setup 里的顶层 await（异步 setup / Suspense）完成后再断言，普通 `mount` 会停在 pending 拿不到数据。两者配合让"带 Nuxt 特性的组件"变得可测。

**来源**：《@nuxt/test-utils 运行时》、《异步 setup 的测试》

### 3. 在 Nuxt 里怎么 mock 自动导入和接口数据？有哪些坑？
**答**：`mockNuxtImport('useFetch', () => () => ({data:ref(...), ...}))` 替换自动导入的 composable，`mockComponent` 桩掉子组件，`setup({ nuxtConfig: { runtimeConfig } })` 覆盖配置。坑：①mock 与真实行为漂移——全绿但线上崩，所以 IO 契约必须有集成层真测；②mock useFetch 后忘了保持它的响应式/`status`/`error` 形状，测出的行为与真不同；③过度 mock 导致测试只验证了"我 mock 了什么"。原则：mock 只为隔离不可控依赖，不为省事绕过真实链路。

**来源**：《Nuxt 测试替身》、《mock 的边界与漂移》

## B. 对比与辨析

### 4. 测 server route：起真实 Nitro 和直接调用 handler，怎么选？
**答**：直接调 handler（构造 mock H3Event 或用 h3 的测试工具）快、能精确覆盖分支，但绕过中间件链、路由匹配、序列化——测的是函数不是行为。起真实 Nitro 用 `$fetch` 慢一点，但覆盖"文件名=方法/路径"的约定、server middleware 解析、createError 的状态码、缓存头（呼应 nuxt-server-routes、nuxt-error-debug）。我的选择：核心业务分支用直调 handler 快测，端到端契约（状态码、鉴权、头）用真 Nitro 各测一条——两层互补，不要只留其一。

**来源**：《Nitro 路由的两种测试》、《测函数 vs 测行为》

### 5. 与 React/Next 生态、Express 的测试相比，Nuxt 有什么不同？
**答**：相似：都用 Vitest/Jest 跑单元、Playwright/Cypress 跑 e2e、都有"测 API 契约"一层（Express 用 supertest，呼应 exp-testing）。Nuxt 独有的是：**必须处理 SSR 与水合**——要能在服务端上下文跑组件（`mountSuspended`）、要断言真实 HTML/payload；以及**框架把前后端缝在一起**，`@nuxt/test-utils` 能同时驱动客户端与被测 Nitro 服务，跨端集成测试比 Next 需分别配 jest + supertest 更一体化。水合测试（首屏 HTML vs 水合后 DOM 一致）是 SSR 框架特有的一类回归。

**来源**：《SSR 框架测试的差异》、《跨端集成测试》

## C. 实战场景

### 6. 如何写一条"守住 SSR 首屏直出、且 SEO 关键标签正确"的回归？
**答**：e2e（Playwright）里：①`page.goto('/')` 后取 `page.content()`（第一份 HTML，未水合改写前），断言含首屏关键文本与 `<title>`/`description`/`og:image`（绝对 URL）；②或直接用 fetch 拿原始 HTML 字符串断言，避免被客户端渲染干扰（呼应 nuxt-seo-meta 第 10 题）；③再加一条"禁用 JS 上下文"仍能拿到主体内容，直接证明不依赖水合。把关键模板（首页/详情/落地页）各写一条，进 CI——这是最容易在重构中被悄悄破坏的东西。

**来源**：《SSR 直出回归》、《把可索引性做成测试》

### 7. 页面依赖一个不可控的第三方 API（支付/地图），端到端怎么测？
**答**：在 Nitro 侧把第三方调用收敛到 server route（BFF，呼应 nuxt-server-routes），e2e 用 Playwright 的 `page.route`/`route.fulfill` 或起一个假实现（wiremock / 本地 stub 端点，经 `runtimeConfig` 指向它，呼应 nuxt-runtime-config）拦截，断言我方面向成功/失败/超时/401 的降级表现（呼应 nuxt-error-debug 第 7 题）。绝不在 CI 打真实第三方：既不稳定又可能产生真实副作用。关键是"通过配置切换被依赖对象"，而不是硬编码或依赖网络运气。

**来源**：《外部依赖的端到端替身》、《BFF 让测试可控》

### 8. 集成测试要读写数据库，怎么保证隔离与可重复？
**答**：用独立的测试库 + 每个测试套件事务回滚，或跑一次性的临时 SQLite/in-memory（呼应 unstorage 思路时可用内存存储）；`beforeAll` seed 固定夹具、`afterAll` 清理；用 `NODE_ENV=test`/专用 `runtimeConfig` 把连接串和缓存储存指向测试实例；缓存类断言要绕过或显式清缓存避免上一个用例的 swr 命中影响当前（呼应 nuxt-perf）；时间敏感逻辑注入可控时钟。最忌"多个用例共享有状态数据、按执行顺序隐式耦合"——那正是 flaky 之源。

**来源**：《数据库测试隔离》、《fixtures 与可重复性》

## D. 深度追问

### 9. 测试偶发失败（flaky）怎么系统性治理？
**答**：先分类再治。时间/竞态类：注入假定时器或可控时钟、把 `await sleep` 换成对可观察状态的 `waitFor`（轮询到条件满足）；网络/外部类：换成 mock 或本地 stub（第 7 题）；SSR/水合时序类：等待明确信号（hydration 完成标记、特定元素可见）而非固定延时；数据类：修隔离（第 8 题）；并行污染：检查共享全局态与端口占用。治不了先**隔离（标记 skip + 建 issue 追踪）**，绝不允许重试到绿蒙混——重试只是掩盖，flaky 会侵蚀整套测试的信任度。

**来源**：《Flaky 测试治理》、《为什么不许 retry-to-pass》

### 10. 覆盖率指标该怎么用？它的局限是什么？
**答**：把覆盖率当**发现盲区的地图**而非 KPI：某关键模块覆盖低提示去补，趋势下降要警惕。局限：高覆盖不等于行为正确——大量断言薄、只跑不验的用例能把行数刷上去却测不出 bug；SSR/水合/鉴权/缓存这些最容易出事的跨端行为，行覆盖率很难体现（需要 e2e/集成来守）。所以我在 CI 设的是"关键路径有用例 + 体积/性能预算 + 契约断言"的组合门禁，覆盖率只做软阈值、不逼大家为数字写垃圾测试。

**来源**：《覆盖率的正确用法》、《别为数字写测试》

### 11. 团队里测试常因"拖慢交付"被砍，你怎么让测试真正落地？
**答**：①把成本降下来：脚手架出可复制的分层模板与常用夹具（mountSuspended、起 Nitro、Playwright 配置），写测试不再是"从零搭"；②把反馈做快：单测/组件进 pre-commit 或 PR 快速门禁，慢的 e2e 放并行 CI 且只保留关键流程；③把价值显性：用一次真实回归（比如 SSR 直出被重构破坏、私有页误配缓存）说明测试拦住了什么；④增量而非补债——新代码必须有测试、老代码改到时补，不搞"先把覆盖率补到 80% 再上线"的休克式要求；⑤责任分层：逻辑归开发单测、契约归接口测试、关键流程归 e2e，别都堆给 QA。让测试成为"敢改代码"的前提，而不是对赌进度的负担。

**来源**：《测试落地与团队动力学》、《增量测试策略》

### 12. 同构全栈框架（Nuxt）测试里最难的部分是什么？你的取舍？
**答**：最难是"两个执行环境 + 中间那道序列化边界"要同时可信：同一份代码在 Node 与浏览器各跑一遍，中间靠 payload 传递，bug 常出在两侧不一致（水合 mismatch、某侧才有的 window 访问、序列失真）或服务端/客户端读到不同的配置/身份。这类问题单测天然测不到，必须靠真起服务端 + 真浏览器的集成/e2e。我的取舍：**把 e2e 预算优先花在"跨边界"断言上（首屏 HTML、水合一致、鉴权重定向、缓存头、payload 形状），而不是点按钮的业务流**——后者用组件测试更划算。守住 SSR 框架真正易碎的地方，测试的性价比才立得住（呼应 nuxt-hydration、nuxt-error-debug 第 12 题）。

**来源**：《同构测试的难点》、《跨边界断言优先》
