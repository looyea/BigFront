# next-error-loading 面试题（12 题）

> 主题：错误边界文件约定、声明式中断、日志监控与加载兜底。

## A. 机制原理

### A1. App Router 的 error.js 底层是什么机制？为什么必须 'use client'？

**答**：底层是 React Error Boundary（getDerivedStateFromError/componentDidCatch 家族），Next 把它包装成文件约定并按路由段自动布置。必须 'use client' 是因为错误边界是 React 的状态化组件机制，需要客户端实例来捕获子树渲染异常并执行 reset；如果边界自己也在服务端渲染，服务端已崩，无处兜底。所以错误 UI 的渲染职责被强制放在客户端。

**来源**：掘金《App Router 错误边界原理拆解》；SegmentFault《为什么 error.tsx 必须 use client》。

### A2. error.js 和 global-error.js 的捕获范围有什么区别？

**答**：error.js 捕获"本段及其子段"的渲染错误与 async 运行时错误，但它自己在根布局之内——根 layout 崩溃它无能为力。global-error.js 只放在 app/ 根，专职接住根 layout 自身的错误，此时外层没有任何 HTML 骨架，必须自己渲染 `<html><body>` 并含 html/body 闭合；且生产构建后它只渲染一次，错误修复后需整页刷新。策略上二者是"分区兜底 + 总兜底"的关系。

**来源**：CSDN《global-error 与 error 的边界差异》；InfoQ《Next.js 官方文档错误处理精读》。

### A3. error.js 能捕获哪些错误、不能捕获哪些？

**答**：能：子树组件渲染抛错、子树 async 客户端组件的错误、事件处理器之外的运行时崩溃。不能：① 服务端路由层的请求错误（如 Route Handler 抛错走 HTTP 500，不到组件层）；② middleware 里的错误；③ 被更内层 error 边界先接住的（就近原则）；④ 事件回调里的错误（那是浏览器全局 onerror 的地盘，靠 Sentry 客户端捕获）；⑤ production 下拿不到堆栈，只有 digest。答题亮点：说明"错误处理是分层的，组件边界只负责组件层"。

**来源**：知乎《Next.js 里接不住的那些错误》；掘金《Route Handler 与组件层的错误通道》。

## B. 实战写法

### B1. 一个合格的 error 页面应该包含哪些元素？

**答**：四个元素：① 用户语言的错误说明（不透传内部堆栈）；② digest 展示——用户截图报障时工程侧能按号检索日志；③ reset() 重试按钮——瞬态故障（网络抖一下）点一下就恢复，成本远低于整页刷新；④ 逃生出口——返回首页/帮助链接，防止该段永久坏死后用户被困。加分项：按 digest 前缀区分错误类别上报，给不同文案（网络类提示重试、权限类提示登录）。

**来源**：CSDN《Next.js 错误页用户体验清单》；SegmentFault《digest 在故障报障中的价值》。

### B2. notFound()、forbidden()、redirect() 的共性机制与使用禁忌是什么？

**答**：共性：都在服务端渲染路径抛出框架识别的特殊信号（内部靠 throw 中断执行流），分别渲染就近的 not-found/forbidden 兜底页（带 404/403 状态码）或发出 3xx 跳转。禁忌：① 不能包在 try/catch 里，否则信号被吞；② 只能在渲染路径（服务端组件/Action/middleware）用，别在事件处理器里用——那是客户端；③ redirect 后代码不会继续执行，别指望后面的清理逻辑跑完。它们让"控制流中断"从字符串约定升级为类型安全 API。

**来源**：知乎《App Router 的声明式中断 API》；掘金《redirect 与 throw 的恩怨》。

### B3. loading.js 和手写 Suspense + 骨架屏有什么区别？

**答**：loading.js 等价于框架在该段外面自动包了一层 Suspense fallback——粒度是路由段，且首屏（Layout 未就绪）时也会生效；手写 Suspense 粒度是任意组件，可以把慢的部分单独包出去、快的部分先渲染（流式渲染的核心手法，呼应 next-context-streaming）。工程上两者组合：段级用 loading.js 保底，段内把非关键慢数据下推进小 Suspense。相同点：都不防御后端挂起超时——那需要 fetch AbortSignal / Prewarm 策略（呼应 next-fetch-cache）。

**来源**：InfoQ《loading.tsx 与 Suspense 的粒度选择》；CSDN《骨架屏在 Next.js 中的三层实践》。

## C. 日志与监控

### C1. 为什么浏览器里看不到服务端组件的真实错误堆栈？该怎么排查？

**答**：安全设计——服务端堆栈可能含 SQL、文件路径、密钥变量名，下发浏览器等于泄密。Next 把服务端渲染错误序列化为 digest（哈希编号），错误页只展示编号。排查链路：用户报障给 digest（或监控上报带 digest）→ 在服务端日志（stdout/平台日志/日志服务）里按 digest 检索 → 还原完整堆栈。所以生产环境日志必须结构化持久化，只往控制台 println 是查无此人（呼应 node-config 日志落盘思路）。

**来源**：掘金《digest：Next.js 错误排查的钥匙》；SegmentFault《为什么 SSR 错误堆栈不上前端》。

### C2. 如何给 Next.js 全站接入错误监控（如 Sentry）？

**答**：三通道：① `instrumentation.ts` 的 register() 做运行时初始化，服务端全局错误走 onRequestError 钩子；② 客户端 `app/instrumentation-client.ts`（或 layout 中 error 捕获组件）接 window error/unhandledrejection 与 React onError；③ Server Actions 与 Route Handler 的异常自动被服务端通道捕获。要点：按 digest 关联用户可见编号；Source Map 上传（客户端）保证堆栈可还原；Next.js 与 Edge 两种运行时要条件加载 SDK（process.env.NEXT_RUNTIME 判断），否则 Edge 打包报错。

**来源**：CSDN《Next.js App Router 接入 Sentry 全流程》；InfoQ《instrumentation 钩子与监控体系》。

### C3. 404 与 403 数量突然暴涨，分别可能意味着什么？

**答**：404 暴涨通常是：① 旧链接失效/改版未配 redirect（SEO 流量腰斩前兆）；② 爬虫在扫不存在的资源；③ 上游系统拼错 URL。403/forbidden 暴涨通常是：① 越权探测/攻击前戏（批量试 admin 路径，呼应 next-middleware-auth）；② 会话策略变更后正常用户被误伤（登录循环 bug）；③ 接口被脚本滥用。监控上两者都应按路径模式聚合，404 看 referrer 与 UA，403 看 IP 与账号维度，前者是运营问题、后者是安全问题。

**来源**：知乎《从状态码异常看系统健康》；掘金《Next.js 中间件与监控的联动实践》。

## D. 架构与决策

### D1. 错误边界的粒度该怎么设计？

**答**：原则是"爆炸半径 = 业务影响面"。核心页骨架（导航、侧栏）所在的段不轻易放 error 兜底大块内容，避免静默降级把事故藏起来；每个独立功能区（列表、图表、评论）各自放段级 error.js——一个区崩不影响其他区（段即边界，呼应 next-boundaries）；global-error 只做最简样式（它无法依赖全局 CSS/Context，崩了就没有根布局）。反模式：根上放一个大 error 接管全站——白屏率不变，只是文案变了；正确做法是让"部分可用"成为常态。

**来源**：InfoQ《前端容错设计的粒度哲学》；CSDN《Next.js 布局树与错误边界划分》。

### D2. 页面渲染错误和接口（Route Handler）错误处理方式为什么要区分开？

**答**：因为受众不同。页面错误的受众是人：要友好 UI、重试按钮、SEO 正确的状态码（404/403/500）。接口错误的受众是程序：要稳定的 JSON 契约（code/message/detail）、正确的 HTTP 语义、可机器聚合的错误码体系，绝不能在 API 里渲染 React 错误页。实现上 Route Handler 用 try/catch + NextResponse.json 显式处理（呼应 next-route-handlers 第 4 节 withAuth 高阶），组件树错误才交给 error.js。一套错误处理架构如果只考虑了页面，API 消费方（APP/小程序）就会拿到一坨 HTML 错误页。

**来源**：掘金《页面与 API 的双通道错误设计》；SegmentFault《NextResponse 错误契约规范》。

### D3. 渐进增强视角下，Server Action 失败（比如网络断了）用户会看到什么？

**答**：分两种链路：① 表单 + useActionState 的渐进增强路径，Action 失败时原生 form 提交本就会重新请求，服务端返回错误状态渲染新页面，用户看到表单错误文案——前提是 Action 返回了结构化的 input/error 状态而不是抛裸异常；② JS 增强路径，useActionState 的 error 值更新、表单保留 pending 结束态。设计要点：Action 永远返回"下一步 UI 所需的数据"，把失败当分支而非异常（呼应 next-forms-mutations 防御四层模板），并保证幂等——用户断网重试不该扣两次钱。

**来源**：知乎《Server Actions 的失败路径设计》；CSDN《从 useActionState 看表单容错》。
