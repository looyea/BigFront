# next-route-handlers 面试题（15 题）

> 来源：整理自 CSDN、掘金、SegmentFault、知乎等站点 Next.js API 层设计高频面经，中文重述。

---

## A. 形态与标准

**1. Route Handler 基于 Web 标准而非 Express 风格，给前端工程带来什么实际好处？**
**来源**：InfoQ《Request/Response 对象的统一》；知乎（edge 运行时相关讨论）
同一份 handler 逻辑可在 Node/边缘运行时/本地测试/其他支持 Web 标准的平台间迁移（fetch 构造 Request 即可单测，无需 supertest 起服务）；类型由 TS 的 lib.dom 直接提供（呼应 next-testing、node-esm-cjs 的可移植论）。

**2. Route Handler 里怎么读 query、path 参数、表单与文件上传？和 Express 的对应物？**
**来源**：CSDN《Next 接口参数获取大全》；掘金（formData 上传实践）
query：`new URL(req.url).searchParams`（req.url 是绝对地址）；path：ctx.params（Promise）；JSON：`await req.json()`；表单/文件：`await req.formData()`（File 对象直接可 get）。对照 Express 的 query/params/body 由中间件挂载——这里全是显式 await，错误也要自己 catch（呼应 exp-validation）。

**3. 为什么 handler 没有 next()，全局横切（日志/限流/错误映射）怎么做？**
**来源**：SegmentFault《没有中间件的接口层》
组合替代管线：高阶函数链 `withErr(withLog(withAuth(handler)))`、或 wrapper 统一在 layout 层导出；粗粒度前置（重写/鉴权跳转）交给 middleware.js（L5）。这题看你是否理解"管线模式 vs 装饰器模式"的互换性（呼应 exp-patterns、es-closure）。

---

## B. 定位与分工

**4. 公司有独立 Express/Java 后端了，Next 里还要写 Route Handler 吗？**
**来源**：知乎《BFF 层的生死题》
要——但角色收敛为 BFF：聚合多上游、裁剪字段给特定页、藏第三方密钥（前端直连外部 API 等于公开 appkey）、webhook 回调落点。领域逻辑仍归后端。反面：把核心业务写进 handler 造成"影子后端"，事务/权限/审计都难治理（呼应 next-route-handlers 第三节、exp-server 职责论）。

**5. Server Action 出现后，'写操作调 API'还需要 Route Handler 吗？**
**来源**：掘金《Action 与 Handler 的分工》
表单式变更→Action（类型安全、渐进增强）；仍需 Handler 的是：给**非本应用**消费（移动端/合作方/脚本）、文件直传签名、SSE/流、以及需要独立 URL 语义的一切（可缓存可重放）。L5 会给对比表（呼应 next-server-actions、mp-network 的端点思维）。

**6. 页面组件直接查库（RSC）和调自家 /api，两种取数路径怎么选？**
**来源**：CSDN《RSC 时代还需要自己的 API 吗》
内部渲染默认直查（少一跳、类型贯通）；当"这份数据还有外部消费者"（APP/H5 共接口）、或需要独立缓存/限流域时才包 API。判断轴：数据的**受众范围**决定要不要端点化（呼应 next-fetch-cache、react-architecture 的边界）。

---

## C. 运维与边界

**7. handler 里抛未捕获错误，客户端收到什么？生产会泄漏堆栈吗？**
**来源**：SegmentFault《Next API 错误处理现状》
500 + 空/简体（版本略有差异），生产默认不吐堆栈；但要自己做错误映射：zod 错→400、鉴权→401/403、上游超时→502，用统一 wrapper + `error.ts` 模块收敛（呼应 exp-patterns 错误中间件的对应物、next-error-loading）。

**8. 上传大文件到 handler 有什么坑？（buffer、超时、代理）**
**来源**：掘金《Next 文件上传三次翻车》；Vercel 平台限制相关社区讨论
Node 侧 formData 会把文件读进内存/临时盘，serverless 有请求体上限（平台 4.5MB 量级）与超时；反代 client_max_body_size 不同步直接 413。正解：大文件走**直传签名**（handler 只发 presigned URL），像小程序的 uploadFile 也要域名与大小白名单那样先查平台天花板（呼应 mp-network、exp-upload、node-deploy-perf）。

**9. Route Handler 怎么做限流？为什么放内存 Map 在 serverless 下无效？**
**来源**：InfoQ《无服务器环境的计数难题》
每实例独立内存且随时冷启——Map 计数等于没有限流。方案：平台 KV（原子 increment）、Redis+Lua、或推到网关/CDN WAF 层。这题本质是 node-cluster 的"共享状态"问题在 serverless 的放大版（呼应 node-workers、exp-security）。

---

## D. 综合设计

**10. 用 handler 实现 SSE 流式接口，写关键代码并说明与 WebSocket 的取舍。**
**来源**：CSDN《Next 的 ReadableStream 实战》；知乎（AI 输出场景）
构造 ReadableStream + TextEncoder，controller.enqueue 写 `data: ...\n\n`，return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })。取舍：SSE 单向、走 HTTP/自动重连、穿透代理友好（AI  token 流）；WebSocket 双向但要独立连接管理、serverless 支持差（呼应 mp-network 的长连接对比）。

**11. 给一个跨国产品做 API 层部署设计：handler 用 edge 还是 node？**
**来源**：掘金（边缘函数实践案例）
按"是否需要重计算/持久连接/Node 依赖"分层：鉴权判断、AB、简单聚合放 edge（就近、亚毫秒冷启）；DB 事务、图像处理、长任务放 node 运行时（可函数可容器）。同一 api/ 树不同文件不同 runtime，import 图红线（第五节）。加分：说明平台差异（Vercel Edge Config 等）（呼应 next-deploy）。

**12. 设计题：为内部工具站写'带审批的导出接口'（发起→审批→下载），用 handler 体系怎么组织？**
**来源**：SegmentFault《长任务 API 的模式》
POST /api/exports 建任务（校验+配额）立即 202；后台/队列执行（handler 内别跑 5 分钟循环——serverless 超时）；GET /api/exports/[id] 查状态+签名 URL 下载；审批走 webhook/Action。模式总结：接口只做"状态机的一步"，慢活在边界外——与 node-child-process 的异步化哲学、mp-openapi 支付回调的同款世界观（呼应 next-forms-mutations 的 after()）。

---

## 补充（新专题 13-15）

**13.  Route Handler 里要做流式响应/SSE，浏览器、代理、部署平台三层各可能怎么"吃掉"你的流？逐项给验证方法。**
**来源**：Next.js 官方 Route Handlers 流式响应说明；掘金《SSE 在 Serverless 上不流的三个原因》
三层拦截点：① 浏览器——fetch 默认会等 body 完成？不，fetch 可读流式，但 EventSource 只支持 GET 且受 6 连接限制；用 curl -N 对照浏览器 Network 面板渐进渲染验证；② 代理/CDN——nginx proxy_buffering 默认开、部分 CDN 直接缓冲整响应，响应头加 X-Accel-Buffering: no、验证 x-cache 是否 HIT（缓冲通常不 HIT 但要确认边缘没攒块）；③ 平台——serverless 函数有最大响应时长与内存流缓冲（Vercel 的 maxDuration、边缘函数的执行时限），且免费层可能不支持长连接；压测法：先发一个每 5s 心跳的小流跑 6 分钟看断点位置。工程细节：心跳注释行防闲置断连、客户端 Last-Event-ID 续传、优雅退出时 controller.close() 让下游感知。加分句：能报出"我们线上是哪层把流压成块的、怎么定位的"就是做过的人。

**14.  用 Route Handler 自建 REST API 的团队常犯哪些错？版本化、错误格式、鉴权你会怎么规范？**
**来源**：InfoQ《BFF 与公共 API 的边界》；SegmentFault《Next.js 做 API 服务的踩坑集》
常犯：① 无版本——URL 直接 /api/orders，改字段即破坏第三方，应从 /api/v1 起并承诺"不兼容变更只开新版本、旧版本给日落期"；② 错误格式漂移——有的 handler 抛文本、有的返回 {message}、Next 默认 500 页 JSON 混进来，规范：统一 { error: { code, message, details } } + 中央 wrapper 捕获未处理异常，杜绝泄露堆栈；③ 状态码语义随手写（业务失败也 200、创建成功也 200 无 Location）——建立 code↔status 映射表；④ 鉴权散写——每个 handler 手调 getSession，漏一个就是一个洞：抽 withAuth(role) handler 包装器 + 集成测试"未带凭据访问全部 v1 端点必须 401/403"；⑤ 把内部 BFF 与对外 API 混一棵树——内部端点被爬虫/扫描发现。加分句：Route Handler 解决"能不能写"，规范解决"敢不敢长期维护"。

**15.  从 Express/Nest 迁业务到 Next Route Handlers，哪些"框架肌肉记忆"要放下、哪些能力反而变少？**
**来源**：知乎《Next.js Route Handlers 能替代 Express 吗》；InfoQ《全栈框架里的 API 层定位》
要放下的：① 中间件栈心智——没有全局 app.use 链，只有 per-route wrapper 与 middleware.ts（Edge 运行时、能力受限），依赖注入/装饰器那套 Nest 结构在函数式 handler 里没有对应物，规范靠封装而不是框架；② 长生命周期资源——不能模块顶层挂常驻连接池/定时任务（serverless 实例随时冷、多实例），连接靠惰性池+平台托管、任务外移到 cron/队列；③ 对 socket/WS 的幻想——请求-响应模型平台不支持，实时走 SSE 或独立服务。变少的能力：生态（无成熟 router/multer 类挂载习惯、文件上传要自己流式处理）、可观测性默认值（没有 pino 全局注入，要自己在 wrapper 里打日志）。反而顺的：与页面共享类型与数据层、部署单元合一、边缘就近。结论句：Route Handler 适合 BFF 与中小规模 API；重 API（多服务复用、复杂任务、长连接）仍该独立后端——把"能不能"和"该不该"分开答。
