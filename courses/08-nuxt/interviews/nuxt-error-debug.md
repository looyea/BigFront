# nuxt-error-debug 面试题（12 题）

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
