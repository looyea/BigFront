# next-testing 面试题（15 题）

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

---

## 补充（新专题 13-15）

### D4.  给一个 App Router 项目搭测试策略：金字塔怎么分？RSC、Action、middleware、E2E 各怎么覆盖？

**答**：分层重划：① 单元——纯函数（数据转换、zod schema、tag 常量层）照旧；② 组件层二分：RSC 测"输出 HTML 包含已格式化的数据/条件渲染正确"（server renderer 工具 + mock headers/cache），客户端岛测交互（RTL，与 React 时代一致）；③ Action 当服务函数测：直接 await 调用，mock 数据层，断言"返回结构化 result + 该 revalidate 的被调用"——Action 是函数不是端点，测试成本低是它相对 REST 的隐性红利；④ middleware 纯函数测分支；⑤ E2E 收缩到"跨层胶水"：登录→建单→刷新看到新数据、无 JS 表单提交、并行路由模态的 URL/后退语义——这些恰是单测测不到的 RSC 新语义。⑥ 契约防回归：路由清单快照（URL 表 diff）、metadata 输出快照。反模式：用 E2E 测 Action 业务分支（慢且脆）、mock 一切导致"测了个寂寞"——缓存/边界行为要用集成环境（真 DB+内存缓存）兜住。

**来源**：Next.js 官方 Testing 指南（Jest/Vitest 配置与示例）；InfoQ《全栈框架时代前端测试分层还成立吗》。

### D5.  mock 了全局 fetch 之后，"同一组件树两次调用只发生一次请求"——测试怎么利用/规避 memoization 与缓存？

**答**：机制回顾：同一渲染内相同 URL+选项的 fetch 被 React memoize（断言 mock 调用次数会"少一次"）；显式 revalidate 走数据缓存，跨用例存活（第二次用例可能一次网络都不发）。测试策略：① 作用域隔离——每个用例清模块注册表（vi.resetModules/重新 import），Next 提供 unstable_revalidate 类测试钩子或关缓存跑（force-no-store 的测试 env）；② 断言改"结果正确"而非"fetch 次数"，把"该缓存的确实缓存"单独立用例（两次渲染 mock 只调一次=缓存行为测试，反而变废为宝）；③ memoization 键被新对象 options 打断的经典坑——mock 实现里 JSON.stringify options 做键，让单测也能暴露"options 字面量导致缓存击穿"的真问题；④ 集成层（Playwright+真服务）验证一次访问内请求数不超预算。加分句：memoize/cache 从"测试障碍"重构成"缓存契约测试对象"，是 RSC 测试成熟度的标志。

**来源**：Next.js 官方 Caching with memoization 文档；SegmentFault《单测里 fetch mock 断言次数总是差一次》。

### D6.  CI 里跑 Next 测试最慢最烦的三件事（构建耦合、环境差异、E2E 不稳定），你分别怎么治？

**答**：① 构建耦合：组件测试不需要真 next build——用 SWC 转译插件（next 官方 jest/vitest 集成）按需编译，别为跑单测起全量构建；E2E 需要产物但要一次构建到处跑：build 一次 → 并行分片跑用例（Playwright shard + CI matrix），别每个 job 各 build 各的；② 环境差异：单测环境 jsdom/node 没有真请求域 API——统一 mock 出口（next/headers 的稳定封装层，别在组件里裸调）；数据层测试用 testcontainers 起真 DB 别依赖共享测试库（偶发脏数据是 flake 之母）；③ E2E flake：消灭 sleep——用 web-first 断言（auto-wait 语义）、时间/随机文本打 data-testid 锚点而非文案断言；流式/PPR 页的"边界何时补齐"不确定→暴露 test id 的 ready 信号（Suspense 补齐后元素出现）等它；失败留 trace+视频、CI 自动重试只兜基础设施抖动（业务 flake 要根治不喂养）。治理度量：flaky 率与套件时长进周报，超阈值专项——测试基建当产品养。

**来源**：InfoQ《前端 CI 提速》；掘金《Playwright 在 Next 项目的不稳定清单与对策》。
