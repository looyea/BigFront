# nuxt-lifecycle 面试题（12 题）

> 主题：钩子时机、请求链路、插件体系与调试方法论。

## A. 时间线掌握

### A1. 面试要求"口述一次 SSR 请求的完整一生"，给出你的版本。

**答**：DNS/TLS 之后：HTTP 抵达 Nitro → server middleware（全局请求层）→ routeRules（redirect/proxy/HTML 缓存命中三个短路点）→ 未命中则新建服务端 Vue app（请求隔离）→ 路由匹配 → route middleware（可 redirect/abort）→ 页面与组件 setup 服务端执行，await 的数据收集进 payload、Suspense 决定一次性或流式 HTML → render:html 拼装（head/样式注入站）→ 响应回写缓存并出栈 → 浏览器解析 HTML、加载 JS、payload 反序列化 → Vue 水合 → app:created、插件执行、app:suspense:resolve、page:finish——交互接管。加分点：报出"哪三站能短路、哪一站开始花钱（setup 取数）"，体现的是链路成本观（呼应 nuxt-lifecycle 第 2、3 节）。

**来源**：掘金《SSR 请求一生：从八股到链路成本》；InfoQ《面试里的全链路叙事》。

### A2. 组件 setup 里的 await 会发生什么？服务端与客户端行为一致吗？

**答**：都发生在 Suspense 边界内：服务端——渲染挂起，await 完成前该子树不出 HTML（整页模式会等，流式模式先出外围+占位）；客户端——组件进 loading 态（slot fallback），resolve 后替换——这就是 Nuxt 版 useAsyncData 挂起的底层。坑点：无 Suspense 包裹的异步 setup 在特定位置会抛"async setup 需要 Suspense"类错误；await 里的异常走错误通道（createError 与 error.vue，nuxt-error-debug）。对照 Next：RSC 的 await 是服务端独享、客户端组件靠 React.lazy/Suspense，两家的"异步渲染树"机制神似（呼应 next-context-streaming、vue-async-suspense）。

**来源**：CSDN《async setup 报错的真相》；SegmentFault《Suspense 与流式渲染在 Nuxt 的现状》。

### A3. route middleware 在服务端与水合后都会跑吗？鉴权逻辑该信任哪一次？

**答**：SSR 首屏：服务端上下文跑一次；之后客户端每次导航再跑（同一份代码双端执行，除非标 `app: false`/`server: false` 限定单端）。鉴权的答案是**都不能只信一次**：客户端这次防误入（UI 级体验），服务端每请求的 Nitro/session 校验才是防线——middleware 跑在浏览器里就等于跑在攻击者的机器上（可绕过）。这与 Next 三层纵深同构：middleware → 布局/服务端段 → API/Action 逐层重查（呼应 nuxt-middleware-auth、next-middleware-auth 第 2 节）。

**来源**：知乎《客户端中间件的安全边界》；掘金《app:false 的妙用与风险》。

## B. 插件与钩子体系

### B1. Nuxt 插件、Nitro 插件、Vite 插件三种"插件"分别活在哪个阶段？

**答**：三层世界：① Nuxt 插件（app/plugins）——应用运行时，客户端每次 app 创建/SSR 每请求，注入依赖、注册钩子、挂全局对象；② Nitro 插件（server/plugins）——服务端引擎生命周期，实例启动/请求前后（runtime 层），做预热与全局中间件事务；③ Vite 插件——构建期（dev 与 build），转换模块、注入虚拟模块（unimport 就住这层，呼应 nuxt-auto-imports B2）。面试把三者摆位即显架构清晰：一个管"应用逻辑"、一个管"服务运行"、一个管"代码编译"。顺序上构建期产物决定运行期代码，运行期钩子决定应用行为——三层各自有各自的注册 API，互不越界。

**来源**：InfoQ《Nuxt 的三层插件体系》；CSDN《我把 Vite 插件写进 Nuxt 插件的乌龙》。

### B2. 钩子支持异步且会 await——这个设计的收益与风险？

**答**：收益：数据收集（useFetch 靠它阻塞到 resolve）、鉴权可在钩子里查远端、插件初始化能 await 三方连接——"框架给异步留了正门"。风险：① 钩子链是串行的，任一慢则全链慢（首屏 TTFB 被一个埋点初始化拖 800ms 的真实案例不少），要并发化的放 Promise.all 或延后；② 忘 catch 的异步钩子抛错可能中断渲染或触发全局 error.vue，钩子内部自吞+上报是纪律；③ 客户端钩子里 await 长任务会推迟 page:finish，路由过渡观感受影响。诊断入口：DevTools timeline 看钩子耗时条（呼应 nuxt-lifecycle 第 5 节）。

**来源**：掘金《钩子 await 链上的性能税》；SegmentFault《埋点初始化拖慢首屏排查记》。

### B3. 给"全站灰度分流"设计生命周期落点，说明理由。

**答**：分两半：**决策要早、要稳**。① 入口决策放 **server middleware**（比 route middleware 更早、覆盖含静态资源的全部请求）：读 cookie/header 定 variant，写入 event.context 与首屏 payload——SSR 渲染即带正确分支，避免水合后闪变（决策若放客户端钩子必造成两态不一致，nuxt-hydration 的隐患模板）；② 粘性放 cookie 回写；③ 上报放 page:start/finish 插件；④ 紧急回滚：routeRules 临时 rewrite 整段 variant 路径（配置通道比代码发布快）。要点：同一 variant 在服务端渲染链与客户端水合链必须同源读取（payload 是保证）。

**来源**：知乎《灰度系统的挂载点选择》；InfoQ《避免闪烁的 SSR 分流》。

## C. 调试与心智

### C1. "页面偶发白屏/卡 loading"，结合生命周期给出排查路线。

**答**：白屏多在水合前后、卡 loading 在 Suspense。路线：① DevTools 记录一次复现：看 app:suspense:resolve 是否到达（未到=某处 await 挂起未 resolve——查 useFetch 的 timeout、第三方脚本 promise 永不落地）；② 服务端日志对应请求有无 render 完成标记（Nitro 超时/进程 OOM 会砍在中途，对照 node-deploy-perf 内存排查）；③ 偶发=时序竞态高发词：钩子里共享状态、无 key 的并行 useFetch（nuxt-usefetch）；④ 网络面板确认是否 hydration 后立刻报错清场（nuxt-error-debug）。方法论：把"偶发"翻译成"哪个时间段的竞态"，再用时间线缩小站域。

**来源**：CSDN《卡 Suspense 白屏的四段排查》；掘金《偶发白屏与永不 resolve 的 promise》。

### C2. 为什么 Nuxt 不用 class 组件时代的 created/mounted 命名，钩子体系是事件系统吗？

**答**：本质就是事件系统：Nuxt 钩子≈带类型与生命周期的 event emitter（on/调用语义、异步 await 队列，呼应 node-events 的 EventTarget 家族）。不用 Vue 组件生命周期命名，是因为作用域不同层：组件钩子跟实例（mount 语义），Nuxt 钩子跟"应用与导航"这些没有 DOM 实例的概念（page:finish、app:created 是流程事件不是 DOM 事件）。好处：同一套 hook API 双端可用（服务端没有 mounted 也能有 page:finish）；服务端渲染不 mount，用 mount 隐喻会撒谎。理解成"流程事件总线+类型注册表"，学习成本骤降。

**来源**：SegmentFault《Nuxt 钩子是事件总线吗》；知乎《为什么 SSR 框架要自造生命周期词汇》。

### C3. 团队新人常问"这段代码什么时候跑"，给他一张什么决策卡？

**答**：三问卡：① 跟着组件实例？→ Vue 钩子（onMounted 等），注意 SSR 期 mounted 不跑、watch 首值会跑；② 跟着请求/导航？→ 站链路：server middleware（每请求含资源）→ routeRules（构建期定格部分不跑）→ route middleware（每导航）→ setup（每实例创建）→ payload/水合（仅首屏一次）；③ 跟着应用一生一次？→ Nuxt 插件顶部/Nitro 插件。终极习惯：任何不确定，DevTools 录一次导航看钩子序列——**时刻表问题用监控回答，不用记忆回答**。这张卡同样适用于 Next（edge middleware/RSC/水合三问换词而已）。

**来源**：掘金《新人答疑卡：你的代码何时跑》；CSDN《把生命周期问题变成可观测问题》。

## D. 跨框架与治理

### D1. Next 的 instrumentation.ts、layout 客户端 effect 与 Nuxt 插件，如何统一心智？

**答**：归位到"初始化时机谱"：越靠前越接近进程/应用生命周期（instrumentation register ≈ Nitro 插件：进程级、一次）；中间是"应用实例创建"（Nuxt 插件 ≈ Next 根 layout 的客户端初始化组件）；最后是"每视图挂载"（页面 effect / onMounted）。统一规则：**把副作用按作用域放上这三级台阶，别越级**——进程级资源放应用级钩子=每请求重连（连接池爆炸），页面级逻辑放进程钩子=脏数据跨用户（呼应 next-fullstack-project 第 3 节的单例守卫、A6 串号）。框架换了，台阶没换。

**来源**：InfoQ《初始化时机谱：跨框架的通用抽象》；知乎《从三个框架看副作用分级》。

### D2. 生命周期有"卸载"阶段吗？SSR 下请求结束要做什么清理？

**答**：Nuxt 服务端渲染完即丢弃整个 app 实例，无显式"卸载"钩子——但资源纪律仍在：请求作用域内创建的东西（abort controller、watch 链、事件订阅）随实例被 GC，前提是别把引用漏到进程级单例（模块级 Map 记 userId→context 是典型内存泄漏与串号双料，Next 同款雷，呼应 next-deploy B3 内存排查）。真正需要清理的是**进程级**：Nitro 插件里建的连接池要在平台实例回收/信号（process signal）时关；定时器类根本不该出现在请求路径。答案分层：实例级靠丢弃、进程级靠显式——两回事别混。

**来源**：CSDN《SSR 内存泄漏的引用链追踪》；SegmentFault《谁在请求结束后不放手》。

### D3. 钩子体系仍在演进（实验位不少），架构文档里如何隔离它？

**答**：策略是"钩子不裸用"：全站定义一个**应用事件层**（lib/app-events.ts 暴露 onNavigationStart/onDataDegraded 等自有词汇），Nuxt 钩子→自有事件 的映射只写在这一个文件的插件里；业务代码只订阅自有词汇。收益：框架钩子改名/时机调整只动一处、测试不依赖 Nuxt 运行时可直调发射器、团队语义（如"首屏就绪"）跨框架可移植（Next 迁移时同一文件换映射）。成本：极薄一层抽象几乎免费——这类"防腐层"（anti-corruption layer）是 DDD 借来的老手艺，用在高速演进的框架面最有效（呼应 next-architect C3 的实验位生存指南）。

**来源**：掘金《给框架钩子加一层防腐》；InfoQ《业务语义与框架事件的隔离带》。
