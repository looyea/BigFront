# next-route-handlers 面试题（12 题）

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
