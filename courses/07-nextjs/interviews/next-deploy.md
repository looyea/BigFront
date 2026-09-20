# next-deploy 面试题（12 题）

> 主题：Next 部署形态、standalone/Docker、环境变量纪律、Nginx/CDN 与发布策略。

## A. 形态选择

### A1. 部署一个 Next.js 应用有哪几种主流方式？各自适用什么项目？

**答**：四种：① Vercel 官方平台——全功能零运维，初创/接单项目、想要 PR 预览工作流的首选；② 自托管 Node（standalone 产物 + pm2/容器）——数据合规或成本敏感的中大型项目，全功能但缓存跨实例共享要自己解决；③ 静态导出 output:'export'——博客、文档等纯 SSG 站，丢进任何 CDN/OSS 即可，无服务端能力；④ 容器平台/K8s——多服务混部的大厂形态，本质是 ② 的编排升级。决策树：有没有 SSR/Action/middleware 需求？有→排除③；能不能接受平台绑定？不能→走②/④。

**来源**：掘金《Next.js 四种部署方案对比实测》；InfoQ《选 Vercel 还是自建：成本与可控性账本》。

### A2. Next.js 相比 Nuxt/SvelteKit 部署上有什么特别要注意的？

**答**：三点 Next 特有：① Edge 运行时——middleware 与 edge 路由在自建环境由 Node 模拟，行为子集有差异（geo、部分 Web API），跨环境要回归（node 侧差异呼应 next-route-handlers 第 6 节）；② 缓存基础设施假设——Full Route Cache 默认写文件系统/内存，多实例需要 cacheHandler 对接 Redis/DynamoDB 或平台 KV，Nuxt 的 Nitro 在这层抽象得更彻底；③ Image Optimizer 依赖 sharp，官方镜像不含，Linux/ARM 上装 sharp 是高频翻车点（呼应 next-fonts-images 第 4 节）。

**来源**：SegmentFault《Next 自托管的三大隐性成本》；知乎《Nuxt 与 Next 部署体验差异》。

### A3. 纯静态导出站上线后发现需要 ISR 和登录态接口，怎么办？

**答**：说明当初选型错了——静态导出没有服务端运行时，这两个需求都触碰能力矩阵红线。路径：① 最快迁移：去掉 output:'export'，用 Vercel 或 Node 全量接管，CI 与 Nginx 相应改造；② 折中混合：页面保持静态站放 CDN，动态能力单独抽成 API 服务（Express 起一个，呼应 exp-deploy），前端运行时调接口——但要评估鉴权、SEO、跨域复杂度。教训前置：技术选型阶段就要列全"未来 6 个月可能出现的动态需求"。

**来源**：CSDN《从静态导出迁回 SSR 的一次复盘》；掘金《静态站 + 独立 API 的混合架构得失》。

## B. standalone 与容器

### B1. standalone 产物里为什么默认没有 static 和 public？不拷进去会怎样？

**答**：standalone 目录只包含 server.js 与运行时依赖（node_modules 裁剪），因为 .next/static 属于构建产物、public 属于源文件，Next 认为拷贝策略交给部署方更灵活。漏拷 .next/static 的症状是所有 JS/CSS 404、页面裸奔且无交互（Hydration 都开始不了）；漏拷 public 则是 favicon、图片、robots.txt 全 404。Dockerfile 里三行 COPY（standalone/static/public）是标准模板，应当做成脚手架固化。

**来源**：掘金《standalone 部署 404 排错清单》；SegmentFault《为什么线上样式全丢了》。

### B2. 写一个 Next 的 Dockerfile，你会做哪些体积与安全优化？

**答**：体积：① 多阶段构建——base(deps) 装全量、builder 编译、runner 只拷 standalone+static+public，基础镜像 node:20-alpine 或 distroless；② pnpm 的 store 缓存层提升重建速度。安全：③ 构建期密钥用 BuildKit secret 挂载，绝不 RUN 里 echo 进环境变量（会进镜像历史）；④ runner 阶段用非 root 用户（adduser + chown + USER）；⑤ 依赖审计（pnpm audit）放 CI 门禁。运行：⑥ NODE_ENV=production、HOSTNAME=0.0.0.0、只读文件系统 + tmpfs 给 .next/cache；⑦ 健康检查指向 /api/health（探活要含 DB）。

**来源**：CSDN《Next.js 容器化最佳实践清单》；InfoQ《前端应用的镜像瘦身与安全基线》。

### B3. 容器内存限额 512MB，应用时不时被 OOM kill，排查与缓解？

**答**：先分"构建 OOM 还是运行 OOM"（看 kill 发生在哪一步）。运行期：① V8 默认堆按宿主机内存算，容器里会超限额——--max-old-space-size=384 显式压低，触发 GC 而不是被杀；② 找泄漏：SSR 每次请求的内存曲线、自建的进程内缓存（unstable_cache 内存版）有没有上限；③ 大文件处理别过 Node（上传走对象存储直传，呼应 next-route-handlers）。构建期：next build 峰值内存高，CI 给足内存或降 --max-old-space-size 反而出问题时要先看是不是并行度（webpack memory cache）太高。观测加 rss 曲线告警，别等用户投诉。

**来源**：知乎《容器里的 V8：为什么默认堆策略会害死你》；掘金《next build OOM 的四种死法》。

## C. 配置与环境

### C1. 环境变量在 Next 里有哪几种"生效时机"？举一个因此引发的线上事故。

**答**：三种：① NEXT_PUBLIC_* 构建期内联进浏览器 bundle——改了不重新 build 无效，且必然泄给公众；② 服务端变量运行时读取——restart 即生效，同一镜像可跑多环境；③ next.config.js 里的值构建期固化（images、env 注入等）。典型事故：把第三方支付的 publicKey/secretKey 都配成 NEXT_PUBLIC_，被抓包直接拿到私钥——publicKey 本可公开，secretKey 泄漏造成资损。规范：变量名单进 code review，命名约定 + CI 正则扫描 NEXT_PUBLIC_ 里的敏感词。

**来源**：CSDN《NEXT_PUBLIC 泄漏密钥事故复盘》；掘金《Next 环境变量生效时机全解》。

### C2. 自托管多实例下，revalidateTag 为什么"有时灵有时不灵"？怎么治？

**答**：根因是缓存按实例隔离：tag 失效只作用于收到请求的那个实例的缓存存储，其他实例仍持旧条目；负载均衡随机打到哪个实例，表现就是"时灵时不灵"。治法：① 接共享缓存层——experimental.cacheHandler 把 Full Route Cache 写 Redis/DynamoDB，所有实例同一账本；② 或用平台（Vercel）自带跨实例缓存；③ 过渡方案：失效后向所有实例广播（消息队列/各自暴露内部失效接口逐个打）；④ 若接受最终一致，把 revalidate 窗口调小当兜底。这题的深层考点是"分布式失效半径"（呼应 next-revalidate 第 6 节）。

**来源**：知乎《多实例 Next 的缓存一致性难题》；InfoQ《cacheHandler 与自建缓存层设计》。

### C3. middleware 在自托管环境和 Vercel 上行为不一致，可能是什么？

**答**：middleware 规定跑 Edge 运行时（Web API 子集：无 Node fs/child_process、crypto 用 web 版）。Vercel 是真 Edge/Workerd 语义；自托管 Node 服务器是用 Node 模拟 Edge 环境，两者在 API 支持面、fetch 行为、执行超时上有出入；常见翻车：在 middleware 里 import 了含 Node API 的工具库，模拟环境侥幸跑通、上真 Edge 就炸。原则：把 middleware 当"最小守卫"——只做 URL 级判断与重定向，重逻辑后移到服务端（geo 数据、JWT 校验库要挑纯 JS 实现，呼应 next-middleware-auth 第 2 节）。

**来源**：SegmentFault《Edge 中间件的运行时差异坑》；掘金《middleware 里不能 import 什么》。

## D. 发布与运维

### D1. 滚动发布后，新实例的第一批用户请求特别慢，为什么？怎么办？

**答**：新实例冷启动时 Full Route Cache、模块级 memo、JIT 都是冷的，SSR 页面要现场取数现场渲染，且 V8 未预热编译开销大。缓解：① 发布后预热——内部流量/脚本先打一遍高频路由（含关键动态页）再挂入负载均衡；② 静态段本就在构建产物里，保证 CDN/Nginx 层缓存独立于应用实例，实例重启不殃及静态资源；③ ISR 页面把再生成放后台，用户永远拿 stale；④ K8s 配 startupProbe + 就绪探针延迟放量，别让用户当预热耗材（呼应 node-deploy-perf 的冷启动话题）。

**来源**：掘金《发布的最后一公里：冷启动与预热》；CSDN《K8s 上 Next 应用的探针配置实践》。

### D2. 健康检查接口应该检查什么？为什么不能只看首页 200？

**答**：首页 200 只证明"HTML 模板渲染没炸"，它可能全程命中静态缓存，DB 挂了都看不出来。合格的 /api/health（Route Handler 实现，呼应 next-route-handlers 第 3 节）应分层次：liveness（进程活着即可，给编排系统重启用）与 readiness（依赖可用才放流量：DB SELECT 1、缓存 ping、关键第三方可达性，各带 500ms 级超时防止探活被拖死）；再配上 digest 与版本号，报错时能立刻对齐发布批次。探针参数：太密打爆接口、超时太短误杀慢而正常的实例。

**来源**：InfoQ《健康检查的反模式与设计》；知乎《readiness 探针把事故挡在放量前》。

### D3. 由你负责一个日活十万的 Next 站点发布，给出完整流程与回滚预案。

**答**：流程：① 门禁——lint/typecheck/build 零告警 + bundle 体积红线 + 测试绿（呼应 next-testing D3 那套）；② 镜像带 git sha，推仓库；③ 预发布环境全量冒烟：黄金路径 E2E + Lighthouse CI 卡 LCP + health 检查；④ 生产分批：先 1 台摘流量升级→内部预热→放量 10% 观察窗（错误率、digest 突增、CWV p75），无异常逐批推进；⑤ 回滚预案：切流回旧版本实例组（蓝绿秒级）或 kubectl rollout undo，保留最近 5 个镜像 tag；⑥ 数据兼容红线：新旧版本共存的窗口内 DB 迁移必须向后兼容（先加列后删列），发布可回滚的前提是" schema 不回滚也能跑"。

**来源**：掘金《一次发布体系的搭建复盘》；SegmentFault《前端全栈应用的回滚工程学》。
