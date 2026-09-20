# next-testing 面试题（12 题）

> 主题：服务端组件测试、Action/Handler 契约测试、E2E 策略与 Mock 边界。

## A. 体系与策略

### A1. Next.js 应用的测试金字塔和传统 React SPA 有什么不同？

**答**：层数相同（单元/集成/E2E），但重心迁移：SPA 大量逻辑在 hooks 与状态库，组件测试是主战场；Next 的 App Router 把取数与业务逻辑推向服务端，于是新增两类高价值对象——async 服务端组件（可直接 await 测渲染分支）与 Server Action/Route Handler（函数契约测试）。E2E 地位也提升，因为 SSR+Hydration 的衔接问题（水合不一致、缓存命中差异）只有真浏览器能暴露（呼应 next-render-modes 水合三步对账）。一句话：测试对象从"交互状态机"扩展到"横跨两端的数据流水线"。

**来源**：掘金《App Router 时代的测试金字塔重构》；知乎《RSC 怎么测》。

### A2. 哪些代码最值得测？给出你的优先级排序。

**答**：按"出错代价×确定性"排序：① 鉴权与权限逻辑（middleware/Action 内的 auth 分支）——安全事故级；② 数据转换与业务规则纯函数——便宜且高覆盖；③ Action 的校验失败/成功/重定向三分支——用户信任；④ Route Handler 契约（状态码/JSON 形状）——下游 APP 依赖；⑤ 黄金路径 E2E；⑥ 渲染快照类最低。反模式是给每个展示组件写 E2E 凑覆盖率——慢、脆、查不出真问题（呼应 exp-testing 的投入产出观）。

**来源**：InfoQ《测试投入的 ROI 模型》；CSDN《Next.js 项目测试优先级实践》。

### A3. next/jest 解决了什么问题？Vitest 方案又怎么配？

**答**：next/jest 用 SWC 替代 babel 做转译（与生产构建同源，行为一致），并自动处理：app router 的 use client 指令剥离、next/image/next/link 的内置 mock、tsconfig paths 别名、CSS/静态资源导入。Vitest 路线则配 @vitejs/plugin-react + vite-tsconfig-paths，并需自行 alias mock next 组件；优点是若项目已有 Vite 工具链可共享配置（呼应 vite-intro 双引擎格局）。团队选型跟着已有生态走，别为测试引入第二套编译链。

**来源**：SegmentFault《next/jest 与手写 Jest 配置的差异》；掘金《Vitest 测 Next 项目的坑位清单》。

## B. 服务端测试实战

### B1. 如何测试一个依赖数据库的服务端组件？

**答**：在数据访问层截断而不是在 HTTP 层：把 DB 调用收敛到仓储模块（如 @/lib/db），测试里 vi.mock 该模块返回固定夹具，组件本身零改动地跑真实渲染逻辑。若组件直接用 fetch，则 stubGlobal('fetch') 返回构造的 Response——注意按 Next 扩展过的 fetch 语义提供 headers，并警惕请求记忆化导致"断言发了两次请求"失败（同渲染周期同 URL 只会一次）。断言聚焦：渲染出哪些块、notFound/redirect 分支是否触发（rejects 匹配 NEXT_NOT_FOUND/NEXT_REDIRECT）。

**来源**：知乎《服务端组件的 mock 层次选择》；CSDN《mock fetch 时的 Next 特有坑》。

### B2. Next 15 里 page 组件的 params 是 Promise，这对测试有什么影响？

**答**：类型上从 `{ params: { slug } }` 变为 `{ params: Promise<{ slug }>`  }`，测试里不能传普通对象了，要 `Promise.resolve({...})` 传入并 await 组件返回；否则组件内部 await params 时拿到非 Promise 值，行为偏离生产。这背后是 Next 15 的渲染优化：未用到 params 的布局不再阻塞其解析（呼应 next-dynamic 第 1 节 async params）。面试延伸点：类型定义严格反而让测试更早发现框架版本行为变更。

**来源**：掘金《Next 15 async params 迁移与测试适配》；InfoQ《页面与布局 API 的 Promise 化》。

### B3. Server Action 单测和它的真实运行环境差了什么？风险在哪？

**答**：差了三样：① 序列化边界——真实运行时入参只能过"props 序列化海关"，单测里却可以传任意对象（呼应 next-boundaries 第 3 节）；② cookies()/headers() 动态 API——单测要 mock 且失去 static 页自动降级保护（呼应 next-fetch-cache 第 5 节）；③ 事务/重定向后的完整渲染链。风险：单测全绿但线上 Action 因传了不可序列化参数而报错。缓解：契约测试（用真实 form 序列化后反序列化的 FormData 做入参）+ 关键 Action 走 E2E 兜底。

**来源**：SegmentFault《Server Action 测试的断层与补法》；知乎《为什么 Action 单测绿了线上还挂》。

## C. E2E 与 CI

### C1. Playwright 在 Next 项目 CI 里怎么组织才跑得动？

**答**：① `playwright.config.ts` 的 webServer 指到 `next start`（先 build），设 `reuseExistingServer: !CI`；② 分层并行：shard 分片 + 浏览器矩阵只留 chromium（除非有 UI 关键差异）；③ 数据隔离：每个测试用独立账号/清库钩子，禁止依赖执行顺序；④ flaky 治理：失败自动重跑一次 + trace.zip 与视频归档，连续 flaky 必须修不是屏蔽；⑤ 只测黄金路径，控制在 10 分钟内。CI 缓存 next 的 .next 构建产物（turbo/cache 思路，呼应 vite-build 缓存层）。

**来源**：掘金《Playwright 在 Next CI 的落地细节》；InfoQ《E2E flaky 治理手册》。

### C2. 什么时候该用 Playwright 的 component test，而不是 RTL？

**答**：需要真浏览器能力时用 component test：CSS/布局断言（RTL 的 JSDOM 无布局引擎）、动画与滚动、Web API（剪贴板、IntersectionObserver——Link 视口预取就靠它，呼应 next-link-router）。纯逻辑与交互分支用 RTL 更快更稳。团队实践里常见取舍是：客户端组件 RTL、涉及布局/水合的验收交给页面级 Playwright，不单独引入 component testing 以控制工具面。

**来源**：CSDN《Playwright Component Testing 适用场景评估》；知乎《JSDOM 测不了的三件事》。

### C3. 如何测试 ISR 页面的"过期后再生成"行为？

**答**：这是时间依赖测试，三板斧：① 缩短窗口——测试环境把 revalidate 设为 5s（配置注入而非改码）；② 主动触发——测 revalidatePath/revalidateTag 后立刻请求断言拿到新内容（呼应 next-revalidate 第 3 节按需失效）；③ 环境分离——真实 SWR 生命周期交给预发布环境观察日志（stale 命中次数）。别在单测里 await 真实过期时间，那是 CI 杀手。要点：验证"失效机制生效"而非"定时器准确"。

**来源**：掘金《缓存失效的测试策略》；SegmentFault《ISR 行为验收怎么做》。

## D. 质量工程

### D1. Mock 边界怎么划？说出你的原则和一次反面教训。

**答**：原则：mock 只放在"系统外部依赖"（DB、第三方 API、时钟、随机数）与"平台 API"（cookies/headers），业务规则层永不 mock——mock 了自己就是在测试假人。反面教训：把组件内部的数据转换函数也 mock 掉，结果转换 bug 带着绿测试上线；或者按 URL mock fetch 时忘了 Next 记忆化去重，断言"调了两次接口"永远失败。改进：mock 清单进 code review 检查项，业务层集成测试用 testcontainers 起真 DB（呼应 node-testing 的集成环境思想）。

**来源**：知乎《Mock 的边界感》；CSDN《被 mock 吞掉的线上事故复盘》。

### D2. 覆盖率对 Next 项目意味着什么？你会设门槛吗？

**答**：覆盖率是"没测什么的负面清单"，不是 KPI。分目录设线更有效：lib/actions/api 路由（逻辑密集）80%+ 硬门槛；展示组件不设线（快照与 E2E 已兜底）；middleware 分支覆盖单独看（鉴权分支漏测=安全洞）。比总数字更有用的指标：增量覆盖率（新代码必须带测试）、变异测试抽检（用 Stryker 抽 lib 层验测试质量）、E2E 黄金路径通过率趋势。把 90% 全局红线当信仰的项目，往往长着一堆断言 `expect(true)` 的凑数测试。

**来源**：InfoQ《覆盖率指标的反噬与替代方案》；掘金《给 Next 项目定测试门槛的实践》。

### D3. 上线前，一个 Next 应用的"质量门禁"应包含哪些环节？

**答**：四层门禁：① 静态——tsc --noEmit、ESLint、依赖审计（npm audit/pnpm audit，呼应 node-publish）；② 构建——next build 零告警、bundle 体积红线（First Load JS 阈值告警，呼应 next-perf 第 2 节）、类型化路由检查 experimental.typedRoutes；③ 测试——单测/集成全绿 + Playwright 黄金路径；④ 运行验证——预发布环境冒烟：关键路由状态码、CWV 采集（Lighthouse CI 卡 LCP）、错误监控确认可上报。任何一层红就阻断合并/发布，门禁的价值在于不需要人肉记得。

**来源**：CSDN《Next.js CI/CD 质量门禁设计》；掘金《从 build 日志到发布卡点》。
