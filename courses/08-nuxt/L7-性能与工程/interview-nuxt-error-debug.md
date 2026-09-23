# nuxt-error-debug 面试题（15 题）

## A. 基础认知

### 1. createError 的各字段有什么用？为什么不直接 throw new Error？
**答**：`createError({statusCode, statusMessage, message, data, fatal})` 是一次"可识别失败"的契约：statusCode 承载 HTTP 语义供前端分支；statusMessage 是可安全外露给用户的短语；message 是面向开发者的详情、生产不外露；data 放结构化附加（如字段级校验错误）；fatal 决定是否直接上错误页。直接 `throw new Error()` 会被当成未知异常一律 500，既丢了语义（404 变 500）又可能把内部 message 泄露出去。统一用 createError 让服务端与客户端共享同一错误模型，是 Nuxt 全栈相对裸 Express 省心之处。

**来源**：《h3 createError 详解》、《Nuxt 错误契约》

### 2. error.vue 有什么特殊？为什么它要自包含？
**答**：`app/error.vue` 是框架级兜底组件，只在 fatal 错误（SSR 渲染抛错、createError({fatal:true})、未捕获运行时错误）时渲染，接收 error prop。它特殊的点在于：它运行在一棵**独立的最小应用**里，绕开你的 app.vue，因此不能依赖全局布局、Pinia store、provide/inject——一旦依赖这些，而这些正是崩溃原因，就会二次失败。所以它必须自带最简结构、只按 statusCode 分支、展示通用文案 + 一个"回首页/重试"动作，绝不展示 stack。

**来源**：《Nuxt 错误页机制》、《error.vue 的最佳实现》

### 3. 客户端 useFetch 的 error、showError、useError 三者怎么分工？
**答**：useFetch/useAsyncData 返回的 error ref 是**局部**错误，适合就地提示与 `refresh()` 重试；showError(err) 是**主动把错误提升到全局错误态**（用于事件处理里捕获到的严重问题）；useError() 读取全局错误态（响应式），clearError({redirect}) 清除并可跳转。选择原则：可恢复错误就地处理，不可恢复才升级全局，别一律 showError 造成动辄错误页白屏。

**来源**：《Nuxt 错误传播层级》、《局部 vs 全局错误处理》

## B. 对比与辨析

### 4. Nuxt 的错误处理与 Next.js App Router 的有何异同？
**答**：相似：都用一个应用级兜底页（Nuxt `error.vue` / Next `global-error.tsx` 处理根布局级、`error.tsx` 处理 segment 级），都是"错误边界"思路。不同：Next 的 `error.tsx` 是**逐路由段**的、由 React Error Boundary 驱动、需要 `reset()`；Nuxt 的 error.vue 是**全局单例**、由 createError 的 fatal 语义 + SSR 失败驱动，组件级兜底要自己用 `onErrorCaptured`。数据错误上，Nuxt 的 `useFetch.error` 与 Next 的 `use()`/Suspense throw 捕获模型不同。总体上 Nuxt 更集中在框架契约（createError），Next 更依赖 React 边界分层。

**来源**：《Next 与 Nuxt 错误边界对比》、《Error Boundary 的两种落地》

### 5. 与你在 Express 里写的错误中间件相比，Nitro 的错误处理强在哪？
**答**：Express 里要自己写 `app.use((err,req,res,next)=>...)` 统一错误、自己判断 `err.statusCode`、自己防泄露、自己保证异步错误被 `next(err)` 捕获（否则会漏成未处理拒绝，呼应 node-async-errors）。Nitro/h3 内置了这套：未捕获异常自动转 500 且生产抹除细节、createError 自动带状态码、`error` 配置可挂 Nitro 级 error handler。强在**约定统一 + 默认安全**，开发者只需表达语义而不必重造管道；代价是深度定制（如特定 APM 上报格式）要通过配置或 error 中间件切入。

**来源**：《从 Express 到 Nitro 的错误处理》、《框架内置错误管道》

## C. 实战场景

### 6. 如何给 Nuxt 全站接错误上报（Sentry 类）而不污染业务代码？
**答**：抓三类源头统一汇到一个上报模块：①运行时/组件错误——`vue:error` 钩子；②全局错误态变化——`app:error` 钩子（覆盖 showError 与 SSR 下发的错误）；③服务端——Nitro error handler 或 server middleware 里 catch 后上报（带 requestId，呼应 nuxt-modules 埋点）。用 `defineNuxtPlugin` 注册这些钩子，业务只管 `throw createError`，上报集中一处。注意生产别把用户隐私字段上报，stack 只在服务端侧保留。

**来源**：《Nuxt 前端监控接入》、《错误上报的钩子选型》

### 7. 一个公开的文章页，因第三方接口偶发超时而 SSR 抛错返回 500，怎么修得既稳又不掉 SEO？
**答**：不能把外部依赖的失败变成整页 500。做法：①取数处对超时做**软失败**——`useFetch` 捕获 error 后返回兜底（缓存的上一版正文 / 静态骨架），页面仍 200 输出主体内容（呼应 nuxt-usefetch 的失败不 500）；②给该路由配 `swr`/缓存，让旧内容在下游故障时顶上（呼应 nuxt-render-modes）；③只有真正无法呈现时才让整页进 error.vue，且对公开页尽量返回可用 HTML + 200/202 而非 500；④加超时与重试（客户端 retry，呼应 nuxt-usefetch）。核心：**区分"数据降级"与"页面崩溃"，前者就地兜底**。

**来源**：《上游故障的优雅降级》、《500 与 SEO》

### 8. 全站很多接口可能返回 401，如何统一"跳登录"而不是每页各写一遍、也不弹错误页？
**答**：不要把 401 交给 error.vue（那是 fatal 兜底，体验差且丢上下文）。集中拦截：封装统一的 fetch 层或用 `useFetch` 的 `onResponse`/全局插件里 hook，检测 `error.value?.statusCode===401` 时 `clearError()` 再 `navigateTo('/login?redirect=...')`（redirect 要校验站内，呼应 nuxt-middleware-auth）。服务端配合：route middleware 处理页面级未登录、server middleware 只解析不拦截（呼应 nuxt-cookie-session、nuxt-middleware-auth）。**401 是"引导"不是"错误"**，所以走导航通道而非错误页通道。

**来源**：《401 的统一处理》、《鉴权错误与错误页的边界》

## D. 深度追问

### 9. 为什么"把 error.message 直接展示给用户"在生产里是高危？常见泄露面有哪些？
**答**：message/stack 常含内部实现细节：文件路径、依赖版本、SQL 片段与表名、连接串片段、甚至被 catch 的第三方密钥回显——这些是给攻击者的侦察地图（呼应 exp-security、node-deploy-perf）。常见泄露面：error.vue 里 `{{ error.message }}`、接口 `return { err }`、把 Prisma/SQL 原始错误透传、dev 错误叠层被带到 prod、日志写进响应体。防：生产只回 statusCode + 通用 statusMessage，细节进服务端日志/APM；对第三方错误做映射（把内部码翻成用户文案）；上线前用未授权请求打一遍敏感端点看响应体。

**来源**：《错误信息泄露与加固》、《生产错误脱敏》

### 10. 水合期报错、SSR 抛错、客户端运行时报错三类如何快速区分与定位？
**答**：看现象与位置。①SSR 抛错：dev 终端（服务端）有栈、浏览器收到非 200 或直接 error.vue、`view-source` 里 HTML 异常——问题在服务端 setup/取数；②水合错误：控制台 hydration mismatch 警告、页面首帧与交互后不一致——两侧渲染分支/时机不同（Date/Math.random/window、onMounted 才有的状态），修法是统一初值或 `.client`/ClientOnly（呼应 nuxt-hydration）；③客户端运行时错误：只在交互/导航后出现、Vue devtools 有组件栈、服务端日志干净——用 onErrorCaptured 定位子树。快速判据：**服务端日志有没有对应记录** + **刷新（走 SSR）还是交互（走 CSR）触发**。

**来源**：《三类运行时错误的区分》、《SSR 与客户端错误定位》

### 11. fatal 与非 fatal、错误页与就地提示的边界怎么划？过度使用错误页有什么害处？
**答**：划界标准是"用户还能不能在当前页继续有意义地操作"。能继续（某块数据失败、表单校验错、提交失败可重试）→ 就地提示/局部兜底，**不进**错误页；不能继续（无权限、路由不存在、渲染根崩了、不可恢复的 5xx）→ fatal/error.vue。过度用错误页的害处：①把小失败放大成整站白屏，体验断崖；②SSR 里返回 error 页常伴随非 200，公开页会伤 SEO（第 7 题）；③丢上下文（用户在填写的表单、来路 redirect 全没了）。所以默认"就地降级优先、错误页最后"，把 `fatal:true` 当昂贵操作审慎使用。

**来源**：《错误严重度分级》、《别把错误页当默认兜底》

### 12. 从工程体系角度，你怎么保证"错误处理"本身不退化？
**答**：把它变成可回归的约束而非一次性代码。①契约统一：全项目禁止裸 `throw new Error` 于边界层，一律 createError（用 lint/自定义规则约束）；②测试固化：用 `@nuxt/test-utils`/Vitest 写断言——404/401/500 各返回正确 statusCode、生产响应体不含 stack、上游故障时页面仍 200（把本关第 7、8、9 题变成用例，呼应 nuxt-testing、node-testing）；③监控闭环：app:error/vue:error 上报 + 5xx 率告警，错误预算超阈值阻断发布；④安全回归：定期用未授权请求探测敏感端点，验证无信息泄露。**错误处理的成熟度，体现在它有多少条自动化用例守着，而不是文档写了多少。**

**来源**：《可回归的错误处理体系》、《错误预算与发布门禁》

---

## 补充（新专题 13-15）

### 13.  server/api 与页面之间的错误契约怎么设计？状态码、业务码、重试语义怎么约定不误伤？

契约三件：① 形状统一——所有非 2xx 返回同一结构（如 Problem details 风格：type/title/status/detail+扩展 code），Nitro 侧 createError 集中封装成 apiError(code, status) 工具禁散写；② 状态码语义诚实：401（会话问题，客户端触发单飞刷新/跳登录）、403（权限问题，就地提示）、404（资源不存在，可安全渲染"已删除"页）、409/422（业务冲突，表单回显）、429（带 Retry-After，客户端退避）、5xx（系统性，触发降级不追责具体 message）——"全 200+code 判"与"全 500+message 猜"是两个反模式极端；③ 重试语义写进契约：幂等 GET 可自动退避重试、POST 靠幂等键（呼应 server-routes 幂等题）、429/503 尊重 Retry-After。消费侧分工：useFetch 拿 error.value 按 code 映射文案（语言包键），拦截器只管 401 单飞与 429 退避两类"协议级"错误。治理：错误码注册表（枚举+负责人+文案键+监控面板）进仓库，新增码走 PR 评审——没有注册表的业务码三个月后就是考古现场。

**来源**：RFC 9457 Problem Details；SegmentFault《我们的接口错误码治理一年记》

### 14.  错误页/错误响应本身引发二次事故的路径有哪些？怎么给"兜底"做兜底？

二次事故路径清单：① error.vue 依赖了坏掉的东西——错误页取 useFetch 数据、依赖全局布局注入的 provide、需要登录态才渲染的资源，主故障时错误页跟着崩（Nuxt 要求 error.vue 自包含的根本原因）；② 缓存中毒——500/503 被 CDN/浏览器长缓存，故障恢复后用户仍吃错误页（给错误响应 no-store+503 带 Retry-After 是硬规矩，routeRules 审查含"错误路径的头"）；③ 重试风暴——客户端对 5xx 无退避猛重试、useFetch retry 默认值在多实例同时失败时放大流量，故障期把系统打死第二遍；④ 错误信息递归——上报 SDK 自己抛错触发错误处理再触发上报（上报通道要有熔断与去重）；⑤ 错误页泄密——stack/SQL/路径进 HTML（data 只给 request id，详情走内部通道）。兜底的兜底：错误页所需资源全部内联（零外部依赖的静态壳）、Nitro 层留"最后一道错误页"（Vue 崩了 nitro 也能出 HTML）、给错误页自己配 e2e（人为 throw 断言渲染成功）——"没测过的错误页等于没有错误页"。

**来源**：InfoQ《错误页成事故现场：二次故障复盘集》；Nuxt error.vue 自包含要求

### 15.  SSR 错误、水合期错误、客户端运行时错误三类如何快速区分与定位？各给一条真实排障动线。

指纹区分：SSR 错误=页面直接是错误响应/状态码非 200，日志在服务端（浏览器控制台干净），复现靠 curl（不吃 JS）；水合期错误=首屏 HTML 正确、控制台报 hydration/undefined、症状常是"局部闪/点击没反应"，复现必须带 SSR 产物（dev 的纯客户端模式测不出）；客户端运行时=交互后才炸、堆栈带 chunk 名，第一动作是 sourcemap 还原。动线示例：① SSR——用户报 500，curl -i 拿状态与 request id→服务端日志按 id 捞栈→定位是 useFetch await 的上游超时（不是渲染 bug）→修复在数据层加超时降级；② 水合——警告指向节点差异→对照 SSR HTML 与客户端首渲→发现 v-if 依赖 localStorage→改 useCookie/payload（数据归属病）；③ 运行时——报错在懒加载 chunk→sourcemap 还原→某函数仅客户端存在（window 在 SSR 期 undefined）→运行位置守卫修正。体系支撑：三类错误进 Sentry 用不同 fingerprint 与归属标签（server/hydration/client），"hydration 错误数"单独看板——它的上涨是架构漂移（数据归属失控）的领先指标，别混在"JS 报错"里。

**来源**：掘金《三类错误三份日志》；Nuxt 官方 useError/clearError
