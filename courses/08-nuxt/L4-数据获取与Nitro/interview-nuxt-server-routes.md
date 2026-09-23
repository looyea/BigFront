# nuxt-server-routes 面试题（12 题）

> 主题：H3 事件模型、接口设计、缓存原语与服务端工程。

## A. 模型与写法

### A1. H3 的 event 对象与 Node req/res、Web Request/Response 是什么关系？

**答**：H3 是夹在中间的适配器层：event 同时持有平台原生的 req/res（node）或 Request（worker 系），并暴露跨平台统一工具（getQuery/readBody/setResponseHeader/sendRedirect）。写 handler 只碰 H3 API，Nitro 按 preset 把它编译到 Node/CF Workers/Netlify 等适配层——这正是"同代码 55+ 平台"在服务端侧的实现（呼应 nuxt-overview B1）。与 Next Route Handler 对比：Next 直接收 Web Standard Request、回 Response（标准派）；Nuxt 走 H3 event（抽象派）——前者贴近标准但边缘能力受限，后者多一层但抹平差异更深。答题落点：两种抽象都服务同一目标——服务端代码的平台可移植性（呼应 next-route-handlers 第 1 节）。

**来源**：掘金《H3 源码速读：event 里到底有什么》；InfoQ《Web 标准与适配层的路线之争》。

### A2. server/api 与 server/routes 的区别？给三个必须用 routes 的例子。

**答**：api/ 自动挂 `/api` 前缀，routes/ 按路径原样注册。必须出 api/ 的场景：① 健康检查与探针端点（/healthz、/metrics——运维约定路径不该带 /api）；② Webhook 回调（/hooks/stripe——对方控制台里写死的 URL）；③ 协议端点（/.well-known/*、RSS /feed.xml、OG 图片 /og/[id].png）；④ 兼容旧域名结构的路径迁移期。原则：URL 是对外契约的一部分，前缀选择服务语义而非目录方便。Next 对照：Route Handler 的路径完全由文件位置决定、无强制前缀——Nuxt 的 api/ 前缀约定更"防呆"也更"绕路"（呼应 next-route-handlers 第 2 节）。

**来源**：CSDN《/api 前缀引发的 Webhook 联调事故》；SegmentFault《healthz 该放在哪一层》。

### A3. 一个上传接口（multipart）在 Nitro 里怎么写？大文件要注意什么？

**答**：`readMultipartFormData(event)` 拿 files（含 filename/type/data Buffer）与 fields。大文件三防线：① 体积上限——平台层（Nginx client_max_body_size/平台请求体限制）先挡，Nitro 里逐文件校 data.length，双层（平台 413 与业务 413 语义不同）；② 类型白名单——mime + 魔数嗅探（改扩展名的 jpeg 传不上来是经典绕过，呼应 exp-security）；③ 落盘策略——buffer 全进内存是 Nitro 默认形态，百 MB 级改"直传对象存储 + 回调校验"（exp-upload 预签名直传的手艺平移），或流式管道 writeStream。加分：上传接口的幂等（客户端重试+文件哈希查重）。

**来源**：掘金《Nuxt 上传接口的三道闸门》；知乎《大文件别过应用服务器》。

## B. 缓存与性能

### B1. defineCachedFunction 与 defineCachedEventHandler 的区别，各自适用场景？

**答**：同一缓存内核，包装对象不同：Function 版缓存**进程内函数调用**（如 buildRanking、汇率查询），对内部调用方透明、键从参数生成，适合"昂贵计算/第三方数据"层；EventHandler 版缓存**整个 HTTP 响应**（含 headers），命中直接回响应不执行 handler，适合"接口级出口缓存"。组合拳：EventHandler 外层 swr 顶流量 + Function 内层锁计算去重（缓存击穿防护——同 key 并发只有一个回源，其余等它的结果，对照 next-fetch-cache 第 3 节金字塔的中间层）。storage 选择决定共享范围：memory=单实例（dev 默认）、redis=多实例一致（呼应 nuxt-server-routes 第 3 节）。

**来源**：InfoQ《两层缓存函数：Nuxt 的自研金字塔》；CSDN《缓存击穿在 Nitro 里的解法》。

### B2. 接口 P99 从 20ms 恶化到 800ms，监控显示都在 /api，你的 Nitro 侧排查路径？

**答**：分层收网：① 先看是不是"被 HTML 缓存的假象"——routeRules 对 /api 无效，接口问题独立于页面；② DevTools/日志按 handler 拆耗时：DB 等待（连接池指标）、外部依赖（汇率/支付接口的下游 SLA）、序列化（返回巨型 JSON 的 payload 膨胀）；③ 事件循环阻塞检查：单进程里有 CPU 密集 handler（图片处理、正则炸弹）会拖死全部请求（node-event-loop 的诊断手法完全适用，呼应 node-perf）；④ 缓存命中率下跌（getKey 变更导致全员回源）；⑤ 实例过载：Nitro 单实例并发模型（Node 事件循环 + 连接池上限）对照 node-cluster 的扩容判断。顺序：先定位"哪个 handler"，再定位"哪一层资源"。

**来源**：掘金《接口变慢的 Nitro 排查树》；SegmentFault《序列化也是性能问题》。

### B3. 为什么说"server/utils 的自动导入"在服务端反而比前端要收敛使用？

**答**：服务端 utils 自动导入让"这个函数哪来的"更难追（server 世界没有 IDE import 提示的社交压力），且两个特性叠加危险：① 隐式依赖——handler 看似纯函数实际调用链碰了 DB/网络，单测环境没有 Nitro 上下文直接爆炸（nuxt-testing 的同款话题）；② 跨运行时误用——server 里 import 'h3' 全家自动可用，但把带 Node API 的 utils 误引到共享代码会污染 edge preset 产物。规范建议：核心链路 handler 保留显式 import 或文件头注释依赖清单；utils 层每个文件顶部写"依赖的环境能力"声明。显式是服务端可运维性的朋友。

**来源**：CSDN《自动导入在仓库另一端惹的祸》；知乎《服务端隐式依赖与可测试性》。

## C. 鉴权与协作

### C1. session 从 cookie 到 event.context.user 的完整链路怎么搭？和 Next 对照。

**答**：Nuxt 版：server/middleware 每个 API/SSR 请求解析 cookie（getCookie(event,'session')）→ 查 session 存储（内存/Redis，defineCachedFunction 加速）→ event.context.user；页面 SSR 侧用 useRequestHeaders 拿 cookie 转交同一解析逻辑（或干脆 server api 化统一入口）。对照 Next：middleware.ts（Edge）粗筛 + 服务端段/Action 内 auth() 精查的三层纵深（呼应 next-middleware-auth）——Nuxt 的 route middleware 双端跑的特性，使"服务端精查"更要放 server 层（middleware 客户端可绕过）。结论两框架一致：**浏览器里跑的代码都不算防线**（呼应 nuxt-lifecycle A3）。

**来源**：掘金《Nuxt 全栈 session 设计》；InfoQ《cookie 到 context：鉴权链路解剖》。

### C2. 接口要同时服务浏览器（带 cookie）与服务间调用（带 API Key），handler 怎么统一？

**答**：认证抽象成"策略链"：context.user 的解析入口接受多凭证（优先 API Key 头 → 校验哈希比对；否则 session cookie），统一产出 principal 对象（type: 'user'|'service'）。授权再按 principal 类型走不同规则（服务账号白名单路径）。实现放 server/utils/authz.ts + 中间件调用，handler 只问 `requirePrincipal(event, { scopes: ['orders:write'] })`。要点：两条认证通道日志要分域可审计；服务间密钥走 runtimeConfig 私密栏（绝不 public，nuxt-runtime-config）；时钟偏斜与密钥轮换预留双密钥期。Express 时代的 passport 策略思想在 H3 里就是普通函数组合（呼应 exp-auth）。

**来源**：SegmentFault《多凭证 API 的鉴权抽象》；CSDN《服务账号与用户账号共存的权限模型》。

### C3. 你的接口需要"幂等"，客户端重试不会重复扣款，方案？

**答**：Idempotency-Key 模式：客户端生成唯一键放 header → 服务端首次处理时把 {key → response} 写缓存（TTL=业务窗口，Redis 存储共享），并发到达时第二个请求对同一 key 加锁等待第一个结果（defineCachedFunction 的锁行为或手写 setnx）→ 重试命中直接回放已存响应。细节：键的粒度是"操作+参数哈希"防错用；非幂等失败（余额不足）也要存回放（否则重试变二次判断，语义漂移）；支付回调类由渠道保证幂等则服务端去重即可。这是 09 包 exp-rest/exp-patterns 讲过的老手艺在 Nitro 的复刻——接口设计的知识跨框架完全保值。

**来源**：InfoQ《幂等键的工程细节》；知乎《重复扣款事故与 Idempotency 落地》。

## D. 架构与生态

### D1. "前后端同仓"对团队的真实收益与隐性成本？

**答**：收益：类型与 schema 共享（#shared 的 zod 两端通吃）、一次部署一套流水线、SSR 内部调用短路、需求到实现单 PR 闭环（全栈化的组织红利，呼应 nuxt-lifecycle A2 的团队分工）。隐性成本：权限边界模糊（前端同学改到核心接口）、构建耦合（接口重依赖拖慢前端 CI、一个仓库两种进程形态的资源画像冲突）、"顺手写在 server"导致业务逻辑失去领域归属（大团队最终都要拆 domain 包）。缓解从目录纪律开始：server 只是"入口层"，业务核心沉到 shared 或独立包，仓库内先做出"服务边界"（nuxt-architect 拆分讨论的伏笔）。

**来源**：掘金《全栈单体仓库的第三年》；InfoQ《同仓的甜头与苦头》。

### D2. Nitro 的 storage 层是什么？它给接口开发带来什么抽象红利？

**答**：Nitro 内建的统一 KV 抽象：`useStorage()` 返回带命名空间的存储接口（redis/fs/memory/cloudflare KV/upload…驱动可组合挂载点），读写序列化自动。红利：① 缓存、session、计数器、功能开关共用一套 API，换驱动不改业务码（dev 内存、prod Redis）；② defineCachedEventHandler/Function 的 storage 选项直接吃它——跨实例一致缓存零胶水（呼应 next-deploy C2 的 cacheHandler 对比）；③ mount 能力把不同后端按路径前缀编织（'cache:':redis + 'config:':fs）。抽象层的价值在"环境无关性"——这是 Nitro 多平台能力在数据层的投影。

**来源**：CSDN《unstorage 驱动矩阵实践》；SegmentFault《用 mount 思路组织服务端存储》。

### D3. 把 Express 老项目的几个接口迁进 server/api，你会怎么做风险控制？

**答**：三步走：① 不重写先包装——Nitro 里挂 H3 的 `toNodeHandlerMiddleware`/或直接 routeRules.proxy 把老服务整个代理进来当过渡层（外部契约不动）；② 逐接口绞杀——新 handler 与老服务并行，灰度按流量百分比放量，双跑期比对响应 diff（日志采样自动化）；③ 迁完再下线：保留一个季度的 proxy 兜底 + 404 监控确认无遗漏调用方。技术关注点：Express 中间件语义（req/res 直改）要重写成 H3 工具族、错误契约对齐 createError、会话兼容（cookie 同域同签名算法）。方法论与 Next/任何框架迁移同构——新框架接入，绞杀者模式永远优先于大爆炸重写（呼应 exp-deploy 的迁移章、nuxt-dynamic D2）。

**来源**：InfoQ《绞杀者模式在前端仓库的复刻》；知乎《接口迁移的双跑比对怎么做》。
