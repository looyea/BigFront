# nuxt-deploy 面试题（15 题）

## A. 基础认知

### 1. `nuxt build` 产出的 .output 是什么？怎么跑起来？
**答**：`.output` 是 Nitro 打出的自包含交付物：`server/index.mjs` 是把 SSR 渲染与 `server/**` API 合为一体、且自带所需依赖闭包的 Node 服务入口；`public/` 是带构建哈希的前端资源；`nitro.json` 是运行时元信息。自托管直接 `node .output/server/index.mjs` 即可，不需要 nuxt CLI、不需要源码、不需要全量 node_modules。dev 不能替代 build 验证——缓存、压缩、preset 差异只在产物里体现。

**来源**：《Nitro 输出结构》、《Nuxt 生产构建产物》

### 2. nitro.preset 是干什么的？常用的有哪些？
**答**：preset 决定产物打包成哪种目标运行时的形态，让同一份应用逻辑换一行配置就部署到不同平台。常用：`node-server`（自托管/容器，起 Node HTTP）、`static`（配 prerender 出纯静态）、`vercel`/`netlify`（平台函数+CDN）、`cloudflare`（Workers/Pages，Edge 运行时）、`aws-lambda`/`bun`/`deno-deploy`。不写时 build 会按检测到的平台自动选。这是 Nuxt 部署上最被称道的能力——"一次构建面向多平台"的抽象层。

**来源**：《Nitro Preset 全览》、《一份代码多平台部署》

### 3. 选 static（纯静态）预设要放弃什么？
**答**：放弃所有需要服务端运行时的能力：`server/**` API 与 route handlers、server/route middleware 鉴权拦截、`useFetch`/`useAsyncData` 的服务端执行分支（只能客户端跑，牺牲首屏与 SEO 的服务端数据）、runtimeConfig 非 public 栏、依赖请求上下文的功能（读 cookie、按身份渲染）。剩下的是构建期确定的 HTML+资源。适用场景：营销落地页、文档、个人站等无动态数据/无鉴权的站点，本质等同于 Next 的 `output:'export'`。

**来源**：《静态导出的能力边界》、《何时不该用 SSR》

## B. 对比与辨析

### 4. Nuxt 的部署模型和 Next.js 相比有什么不同？
**答**：相似：都把服务端代码+依赖打成自包含产物（`.output` vs standalone），都区分构建期与运行期配置，静态导出能力对等。核心差异在 Nitro 的 **preset 抽象**：Nuxt 用一行配置把同一套逻辑输出到 Node/Vercel/Netlify/Cloudflare/Lambda/Bun/Deno 等众多目标，跨平台迁移成本极低；Next 的部署目标更多绑定 Vercel 平台特性（Edge Runtime、Full Route Cache 的平台实现），自托管要更多手工对齐。运行期配置上 Nuxt 的 runtimeConfig（含 public）都在启动时解析、改值重启即生效，Next 的 `NEXT_PUBLIC_` 是构建期内联、改值要重新构建——"一次构建多环境"在 Nuxt 更顺（呼应 nuxt-runtime-config 第 5 节）。

**来源**：《Next 与 Nuxt 部署对比》、《Nitro 的跨平台优势》

### 5. "构建期 vs 运行期"这条线，对 CI/CD 与密钥管理意味着什么？
**答**：意味着可以把"构建"和"配置"彻底解耦：CI 构建机产出一份通用 `.output`（不接触任何生产密钥，构建环境被攻破也拿不到线上凭据），部署时由运行环境（K8s Secret/平台环境变量）注入 `NUXT_*`，同一制品晋级测试→预发→生产，符合 12-Factor 的一次构建多处运行。凡是被烧进产物的东西（`NEXT_PUBLIC_` 式的构建期内联、写死的地址）都要为每个环境单独构建，既慢又增加密钥进构建流水线的风险。所以设计时就要判断：哪些值属于代码版本（app.config/构建期），哪些属于环境（runtimeConfig/运行期）。

**来源**：《构建与配置解耦》、《不可变制品部署》

## C. 实战场景

### 6. 给你一个 Nuxt SSR 项目做容器化，你的 Dockerfile 关注点是什么？
**答**：①多阶段构建——构建阶段装全量依赖跑 `nuxt build`，运行阶段只 `COPY .output`，镜像从几百 MB 降到几十 MB；②`NODE_ENV=production`、`HOSTNAME=0.0.0.0`、`PORT`、以非 root 用户运行；③基座一致——构建与运行同一 Node 大版本、同一 libc（musl/glibc），有原生依赖（sharp/bcrypt）时尤其注意，否则运行期报错；④健康检查打轻量端点、K8s readiness/liveness；⑤内存上限 `--max-old-space-size` 配合副本数横向扩；⑥`.dockerignore` 排除 node_modules/.nuxt 减小上下文；⑦不往镜像写 `.env`/密钥（第 5 题）。

**来源**：《Node/Nuxt 容器化最佳实践》、《多阶段构建瘦身》

### 7. 生产上静态资源应该怎么服务？为什么？
**答**：`/_nuxt/*` 带构建哈希，交给 Nginx/CDN 用 `Cache-Control: public, max-age=31536000, immutable` 长缓存——内容变则文件名变，无需失效，命中即本地/边缘返回，几乎不给 Node 压力。HTML 与 `/api` 反代到 Node，且按内容性质设缓存（公开可缓存页配 swr/isr、私有页 no-store，呼应 nuxt-perf 第 9 题）。反代必须透传 `X-Forwarded-Proto/-For/Host`，否则 secure cookie、canonical 绝对地址、客户端 IP、限流全错。开启压缩（brotli）、HTTP/2，配合 CDN 回源。

**来源**：《SSR 应用的静态资源分发》、《反向代理头透传》

### 8. 多实例部署后，会话丢失、缓存时新时旧，怎么根治？
**答**：根因是把进程内内存当共享状态。会话不要用进程内 store，改共享存储（Redis）或无状态令牌；`defineCachedEventHandler`/routeRules 的默认内存缓存也不跨实例——要么换 Nitro storage 指向 Redis（多实例共享同一份），要么用平台级缓存层；`useStorage` 在生产配 Redis/KV driver。实例间还需要失效广播（改了配置/内容时通知各节点清缓存，呼应 nuxt-runtime-config 面试第 11 题）。原则：**SSR 每请求建 app、进程间不共享内存态，任何需要共享的东西都必须落到外部共享存储**（呼应 nuxt-state 第 6 节、node-deploy-perf）。

**来源**：《无状态服务的共享状态》、《多实例缓存一致性》

## D. 深度追问

### 9. Serverless/Edge 运行时部署 Nuxt 有什么额外注意点？
**答**：①冷启动：函数/Workers 首次调用有初始化延迟，Node 常驻无此问题，对 TTFB 敏感要评估（呼应 nuxt-perf 面试第 12 题）；②内存/文件缓存不跨调用、不跨实例——`defineCachedEventHandler` 默认内存层几乎失效，要换平台 KV/Redis；③Edge 运行时 API 受限（Workers 无完整 Node：不能连任意 TCP/文件系统/部分 crypto），server route 里依赖 Node 能力的代码要改写或换 preset；④请求体/响应有大小与时长上限；⑤环境变量在运行期注入的机制各平台不同，要验证 `NUXT_*` 真的到了进程。结论：性能与正确性结论必须绑定部署形态给出。

**来源**：《Edge 部署 Nuxt 的限制》、《Serverless 缓存陷阱》

### 10. 如何设计发布流程让"部署"本身低风险、可回滚？
**答**：①不可变制品：一次构建产出唯一 `.output`，各环境晋级同一制品（禁止"到生产再 build"），回滚=切回旧制品，天然可逆；②带版本的产物与资源哈希使新旧版不冲突，可无缝并行；③灰度：蓝绿或按流量比例（Nginx/网关）把新版本先给小流量，观测 5xx 率/CWV/错误上报（呼应 nuxt-testing、nuxt-error-debug）达标再放量；④迁移与代码解耦（DB 变更向后兼容、先加后删）；⑤优雅退出摘流量保证在途请求完成；⑥一键回滚脚本 + 明确 SLO 触发回滚阈值。核心：**让回滚比修复更快**，才是低风险部署的本质。

**来源**：《低风险发布与回滚》、《不可变制品晋级》

### 11. SSR 服务遇到突发流量，从架构上怎么扛？
**答**：分三层。入口层：CDN + 静态化把可缓存内容挡在源站外（prerender/swr/isr，动态命中越少越好，呼应 nuxt-render-modes）；应用层：多副本横向扩 + autoscaler 按 CPU/延迟扩缩，热点接口用 defineCachedEventHandler 打到 Redis、避免每请求穿透 DB（呼应 nuxt-server-routes）；下游保护：对上游依赖加超时/熔断/降级返回旧缓存（呼应 nuxt-error-debug 第 7 题），慢查询分页与索引。单实例侧：Node 单线程，靠多进程/多副本而非并发线程吃满多核。关键指标盯 TTFB（SSR 是否饱和）与事件循环延迟，扩容量之前先确认不是被一条慢 SQL 拖死。

**来源**：《SSR 应用的高并发应对》、《缓存与降级的组合拳》

### 12. 综合评一评"Nuxt/Nitro 这套部署体系"的成熟度与仍存在的坑。
**答**：成熟度很高：`.output` 自包含制品 + preset 多目标 + runtimeConfig 运行期配置，把"同构应用怎么上线"这件 historically 很痛的事做成了配置项，跨平台迁移成本和密钥管理风险都显著下降，对自托管尤其友好。仍要注意的坑：①preset 自动探测有时选错，CI/CD 里显式写 preset 更稳；②内存态默认实现（缓存、storage）在 serverless/多实例下静默退化，要主动换成共享存储；③Edge preset 的运行时限制不像文档一句话那么轻，Node 依赖会踩雷；④运行期注入要求部署平台真的把 `NUXT_*` 传进进程，本地 `.env` 习惯带进容器会失效；⑤SSR 是 CPU 密集，容量规划与冷启动在 serverless 下容易被低估。总体：它把复杂度从"部署脚本"移到了"少数几个正确配置"，前提是团队理解每个配置在哪个阶段生效（呼应 nuxt-architect）。

**来源**：《Nitro 部署体系评析》、《同构框架上线的心智模型》

---

## 补充（新专题 13-15）

### 13.  给 Nuxt SSR 应用写一份生产 Dockerfile 并解释每条决策；.output 的自包含性帮你省了哪些事？

双阶段：build 阶段（完整 devDeps+源码+npm ci+nuxt build）→ 运行阶段（node:20-slim，只 COPY .output 进来，非 root 用户 USER app，CMD node .output/server/index.mjs）。逐条决策：① .output 自包含（server bundle 已打进依赖、public 资源独立目录）——不需要 node_modules、不需要源码、不需要 nuxt 命令，运行镜像天然小且攻击面小；② lockfile 层缓存（COPY package-lock 先于 COPY .）；③ NODE_ENV=production 由启动环境给而非 build 残留（产物跨环境复用，接上一题）；④ 健康检查用 /api/healthz（nitro 里注册轻量端点：进程活着+事件循环可达即 ok，不查 DB 防级联误杀），HEALTHCHECK 指令或 K8s probe；⑤ 资源限制下 V8 堆参数按容器内存设（--max-old-space-size 留余量防 OOMKill）；⑥ 日志 stdout JSON（12-factor，容器里不写文件）；⑦ 信号处理：nitro 内置 graceful shutdown（SIGTERM 后收完在途请求）——别在 entrypoint 用 sh -c 包一层吞了 PID1 信号。省掉的事：依赖裁剪、构建环境隔离、产物一致性校验（镜像 digest 即版本）——"部署难"的一半问题是产物不自包含造成的。

**来源**：Nuxt 官方 deployment docker 文档；掘金《我们的 Node 镜像从 1.2G 瘦到 180M》

### 14.  设计一条低风险发布流水线：构建、晋升、灰度、验证、回滚五个环节各给机制与判据。

构建：一次产物多环境晋升（镜像/制品库存 .output 或容器镜像，promotion 只换 env 不换包），CI 产物带 git sha+构建元数据打进版本端点。灰度：入口层分流（按 cookie uid 哈希/按权重），新实例组先接 5%——Nuxt 侧注意"同用户粘旧版"（导航中途切版本会吃到新旧 payload 不兼容，会话粘性是硬要求）。验证三段判据：冒烟（部署后立即跑核心 e2e 打真实域名，登录/下单类必过）、金丝雀指标（错误率/P95 TTFB/LCP 对比基线，窗口 15-30 分钟，阈值提前写死不许临场解释）、业务漏斗（转化类指标滞后确认）。回滚：K8s 回上一 revision/流量切回旧组——前端特有一坑"资源版本错配"（HTML 已回旧但 CDN 里新版本 hash 资源还在不影响、反之新 HTML 引用已被 purge 的旧资源才致命），规矩是 CDN purge 永远滞后于流量回滚且只清超期版本。不可回滚项单列：DB migration（expand-contract：先加列后切读写再删）、外部 API 契约变更、已发客户端缓存——这些要求 PR 阶段就标注"回滚豁免"并给前向修复预案。整条流水线的人味设计：值班手册写"谁有权按回滚键、看到什么信号必须按"——机制没有授权链就只是文档。

**来源**：Google SRE 发布工程实践；InfoQ《前端发布的可回滚设计》

### 15.  Serverless/Edge 部署 Nuxt 的收益与代价清单？哪些场景明确不该去？

收益：零运维扩缩（突发流量不预备容量）、全球就近 TTFB、按调用计费（低流量站近乎白嫖）、冷启动隔离在平台层（每请求独立实例天然防串号，呼应 SSR 实例复用题）。代价清单：① 冷启动——Node runtime 首请求多几百毫秒（SSR 页 TTFB 雪崩式抖动），Edge runtime 启动快但 CPU 时间窗小（重渲染/大 hydration 页超时）；② API 兼容性——无 fs/无长连接/定时器残废：server/tasks、文件上传落盘、WS/SSE、依赖原生模块的 DB 驱动全部受限或需改造；③ 本地缓存跨实例消失——defineCachedFunction 的内存层失效，一切缓存要外置（平台 KV/Redis/http cache）；④ 计费模型陷阱——高流量静态资源走平台出口比 CDN 贵、CPU 密集页按时长计费烧钱；⑤ 观测与调试降级（日志聚合、无 shell、复现难）。明确不该去：重计算 SSR 页（大数据拼装）、依赖长连接/文件系统的应用、需要复杂 DB 连接池的 BFF（连接风暴打爆数据库）、有状态后台任务。折中形态最实用：内容/营销页 prerender+Edge 缓存，应用动态部分留 node-server——Nitro 的多 preset 输出（同一项目不同部分不同目标）让"混部"可行，别全站一刀切。

**来源**：Nitro 官方 preset 文档；掘金《迁 Edge 半年，我们把 SSR 迁了回来》
