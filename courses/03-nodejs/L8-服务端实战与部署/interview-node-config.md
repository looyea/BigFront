# node-config 面试题精选

> 共 15 题，覆盖 环境变量 / dotenv / 配置分层 / 密钥安全 / 日志 五类。

---

## 一、环境变量

### 1. `process.env` 的值有什么类型陷阱？如何正确读布尔/数字配置？

`process.env` 里所有值都是**字符串**（或未定义）。`if (process.env.DEBUG_FEATURE)` 对 `"false"`/`"0"` 都为真（非空字符串 truthy）。正确做法：布尔用 `process.env.X === 'true'`，数字用 `Number(process.env.PORT)` 并校验 `NaN`；或统一在 config 层做类型转换（呼应 node-config 第二、四节）。

**来源**：Node.js — "process.env"、12-Factor — "Config"

### 2. 什么是 12-Factor 的"配置"？为什么不放代码里？

12-Factor 定义：严格区分**代码**与**配置**——配置是随部署环境变化的部分（后端存储、外部服务地址、每实例凭据）。硬编码在代码里会导致"换环境改代码/一份构建无法多环境复用"。应存于**环境变量**，让构建产物在 dev/staging/prod 间不变（呼应 node-config 第一节）。

**来源**：12factor.net — "III. Config"

### 3. `NODE_ENV` 有什么作用？设置错会怎样？

`NODE_ENV` 事实上的环境开关：`production` 下许多库关掉调试/开发特性（Express 不泄露错误栈、模板缓存、错误页简化），`development` 反之。设错（生产设成 dev）会**性能变差 + 泄露堆栈信息**；设成 `production` 但缺其它配置又可能行为异常。它是**开关之一**但非唯一配置（呼应 node-config 第二节、Express L8）。

**来源**：Express — "Production best practices / NODE_ENV"、Node.js — "process.env.NODE_ENV"

---

## 二、dotenv

### 4. dotenv 做了什么？生产环境应该继续用 `.env` 吗？

`dotenv` 在启动时把 `.env` 文件的键值**注入 `process.env`**。适合本地/小型部署；生产**不建议**依赖 `.env` 文件（易被误提交/打进镜像、无集中管理），应由平台（K8s Secret、Vault、云 Secret Manager、CI secrets）注入真实环境变量。Node 20.6+ 的 `node --env-file` 已能免依赖加载（呼应 node-config 第三节）。

**来源**：dotenv — "FAQ / when not to use"、Node.js — "--env-file"

### 5. `.env` 文件的 Git 处理规范？

`.env`（含真值）**加入 `.gitignore` 绝不提交**；仓库放 `.env.example`/`.env.template`（只有键名+占位说明）当文档；团队靠它复制本地 `.env`。误提交密钥要**立即轮换**并从 Git 历史清除（`filter-repo`/BFG），因为删文件不等于抹掉历史（呼应 node-config 第五节）。

**来源**：dotenv — "Should I commit .env to Git?"、GitHub — "Removing sensitive data from a repository"

---

## 三、配置分层与校验

### 6. 一个健壮的应用应如何组织配置来源与优先级？

集中一个 `config` 出口，按**越具体越优先**分层合并：默认值 < 基础配置文件 < 环境专属文件 < **真实环境变量** < 命令行参数。对外只暴露解析/校验后的强类型配置对象（`Object.freeze`），避免代码各处散落 `process.env.X`（呼应 node-config 第四节）。

**来源**：12factor.net — "Config"、node-config — "Configuration layers"

### 7. 为什么建议"启动即校验配置"（fail fast）？

配置错误（缺 URL、类型不对）若推迟到运行时某分支才暴露，往往在**生产高峰**触发、难复现。启动时用 envalid/zod/joi 校验：不合法就**立刻退出**、错误清晰，交由进程守护/CI 拦截，比半路 NPE 安全得多（呼应 node-config 第四节、node-async-errors、node-cluster fail fast）。

**来源**：社区 — "Validate env at startup (envalid)"、Node.js Best Practices

---

## 四、密钥安全

### 8. API key / DB 密码 / JWT secret 应如何管理？绝不能出现在哪些地方？

来源用**平台 secret 注入**（Vault / K8s Secret / 云 Secrets Manager / CI secrets），运行时进 `process.env`。绝不能：硬编码进源码、提交进 Git（哪怕私有仓）、打进 Docker 镜像层、发布进 npm 包、写进日志/错误信息。要最小权限、定期轮换、日志字段脱敏（呼应 node-config 第五节、node-publish `files`）。

**来源**：OWASP — "Secrets Management"、12factor — "dev/prod parity"

### 9. 为什么说"把 .env 打进 Docker 镜像"是反模式？

镜像会被 push 到 registry、被任何人 `docker history`/`cat` 读出、跨环境复用同一镜像意味着配置被冻结进构建产物。正确：镜像只含代码+依赖，**运行时**通过 `-e`/K8s `envFrom`/`secrets` 注入配置与密钥（呼应 node-config 第三、五节、node-deploy-perf 多阶段构建）。

**来源**：Docker — "Best practices / don't bake secrets into images"、Play with Videos — "BuildKit secrets"

---

## 五、日志

### 10. 生产日志为什么推荐结构化 JSON、分级、写 stdout，而不是 console.log 到文件？

结构化（一行一 JSON、字段化）才能被 ELK/Loki/CloudWatch **检索、聚合、告警**；分级（info/debug/error）控制噪声与性能；写 **stdout/stderr 交给平台收集**符合 12-Factor"日志是事件流"，避免自己在容器里写文件、轮转、丢日志。`console.log("user="+u)` 拼接无法按字段查询（呼应 node-config 第六节）。

**来源**：12factor.net — "XI. Logs"、pino — "Why so fast / structured logs"

### 11. 什么是 correlation / trace id，为什么重要？

一次用户请求可能跨多个服务/多次异步调用。给请求生成唯一 **trace id**，在所有日志行、下游调用透传，就能把散落的日志**串成一条链**，快速定位"哪一步慢了/错了"。通常在入口中间件生成、用 pino `child` 绑定（呼应 node-config 第六节、Express 中间件）。

**来源**：社区 — "Distributed tracing / correlation IDs"、OpenTelemetry — "Trace context"

### 12. `debug` 模块和直接 `console.log` 调试日志相比优势在哪？

`debug` 用**命名空间**（`app:db`、`app:http`）+ 环境变量 `DEBUG` 在**运行时按需开合**，生产默认静默、排障时 `DEBUG=app:*` 重跑即可，无需改代码重新部署；还自带时间戳、%s 格式化。比散落 `console.log`（易遗留、无法整体关闭）干净得多（呼应 node-config 第七节）。

**来源**：debug(npm) — README、Node.js Best Practices — "Logging"

---

## 补充（新专题 13-15）

### 13. 设计一个「启动即校验、错误信息能救命」的配置层，给出代码结构与校验点。

结构：config/ 单一模块：来源合并（默认 < 文件 < env < 旗标，显式优先级表）→ zod/envalid schema 校验 → 冻结导出（Object.freeze 防运行中改写）。校验点超越「存在」：① 类型转换+范围（PORT 数字 1-65535、日志级别枚举）；② **条件必填**（NODE_ENV=production 时 DATABASE_URL 必填、S3 凭证成组出现）；③ 语义合法（JWT secret 最小熵、URL 可 parse、cron 表达式能解）；④ 危险组合拦截（prod+cors:"*" 直接拒——比上线后扫出来便宜一万倍）。错误信息=救命文档：报「缺失/非法的具体键 + 当前来源 + 期望格式示例 + 文档链接」，禁止 dump 整个 env（密钥泄漏）。启动即炸 fail fast：配置错误在 deploy 期红、不在流量期红（本关「何时 fail fast」题的落点）。测试：config 模块是全项目单测性价比最高的一块——纯函数+边界表驱动。

**来源**：12-Factor config 章；zod/envalid 模式与 OWASP secrets-in-config 反例集。

### 14. 密钥管理：从 .env 到 KMS，给一条随团队规模演进的路线与红线。

演进：单人=本地 .env（gitignore + .env.example 模板，本关 Git 规范题）→ 小团队=平台 Secret（K8s Secret/云 SSM，CI 注入不落盘）→ 规模化=动态短时凭证（STS/Workload Identity，进程根本不持有长期 key）+ KMS 信封加密（数据密钥轮换）+ 审计（谁取过哪把钥）。红线恒定：① 不进 git/镜像层（本关 Docker 反模式题——层缓存可还原、registry 可拉取=公开）；② 不打日志（脱敏在 logger 层做 redact 路径表，pino redact）；③ 不发前端（JWT 签密与验公钥分开，公开只能公开）；④ 权限最小（桶级/前缀级而非 root）；⑤ 可轮换（双活密钥期+版本化密文，「换 key=全量重启」的架构先重构）。取证友好：取用事件留痕（Vault lease/KMS CloudTrail），泄露响应=轮换时长，MTTR 目标写进 SLO。

**来源**：Vault 动态凭证与信封加密文档；AWS Well-Architected 安全支柱（凭据管理）与 K8s Secrets 加密静态说明。

### 15. 线上排障要求「一个请求全链路可串」：trace id 从哪来、怎么贯、日志怎么配？

来源：入口生成（或采纳上游 W3C traceparent——有则续接无则新建，本关 correlation 题），**在 ALS.run 边界绑定**，出站 fetch/DB/kafka 注入 traceparent 头（传播协议标准化后与 APM/Tempo 无缝续链）。贯穿：AsyncLocalStorage 是 Node 的上下文载体（HTTP 中间件/队列 job 边界各 run 一次；worker 线程边界要手工 postMessage 带 id 再 run——ALS 不跨 worker！这是 worker/queue 架构的暗坑）。日志侧：pino mixin/transport 自动带 traceId 字段，级别动态可调（debug flag 热更，本关配置边界题的联动）；查询=traceId 精确过滤 + spanId 排序。指标：采样率决策——全采（内部流量小）vs head-based 概率采（错误强制采：tail sampling 需要 collector 侧缓冲）。工具：OpenTelemetry NodeSDK 一次埋 HTTP/DNS/DB 自动 span，日志用 trace.correlation 注入——自建方案只在预算极紧时考虑。验收：一个慢请求从入口日志出发 30 秒内定位到最深耗时 span，串不起来=白干。

**来源**：W3C Trace Context 规范；OpenTelemetry JS 文档（自动插桩+日志 trace 关联）与 pino redact/mixin 说明。
