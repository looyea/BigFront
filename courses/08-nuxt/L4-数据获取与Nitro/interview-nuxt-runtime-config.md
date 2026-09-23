# nuxt-runtime-config 面试题（15 题）

## A. 基础认知

### 1. runtimeConfig 是什么？解决什么问题？
**答**：Nuxt 的运行期配置中枢，一个服务端解析、按可见性分栏的配置对象。解决的核心问题是"同一份构建产物跑多环境"：不把配置烧死在 bundle 里，而是启动时读取（nuxt.config 默认值 + .env + 进程环境变量合并），改配置不用重新构建。它是 Nuxt 对 12-Factor 配置即环境（Config）原则的落地。

**来源**：《Nuxt 3 配置体系详解》、《服务端运行时配置最佳实践》

### 2. public 栏和非 public 栏的区别？
**答**：非 public 栏只在服务端上下文存在——server route、nuxt 插件服务端分支里可读，浏览器拿到的序列化结果里对应字段被置为 undefined；public 栏会随 payload 下发给客户端。判断标准只有一条：这个值会不会经浏览器之手。API 基址、地图 key 进 public；数据库串、第三方私钥留在非 public。放错栏是 Nuxt 项目最常见也最严重的安全事故。

**来源**：《Nuxt 运行时配置与环境变量》、《前端框架密钥泄露案例盘点》

### 3. 环境变量如何覆盖 runtimeConfig？命名规则？
**答**：NUXT_ 前缀 + 字段路径转 SCREAMING_SNAKE_CASE。如 runtimeConfig.public.apiBase 对应 NUXT_PUBLIC_API_BASE，runtimeConfig.db.url 对应 NUXT_DB_URL。优先级从低到高：nuxt.config 默认值 < 根目录 .env < .env.production（按 NODE_ENV）< 真实进程环境变量。注意只有已在 runtimeConfig 中声明过的字段才能被覆盖——没声明的 NUXT_XXX 会被忽略，这是防"任意环境变量注入"的白名单设计。

**来源**：《Nuxt 环境变量覆盖机制》、《.env 文件的加载顺序陷阱》

## B. 对比与辨析

### 4. app.config 和 runtimeConfig 怎么选？
**答**：本质区别是时机。app.config 构建期固化、全量可进客户端、改值必须重新部署，适合主题色、布局开关这类"设计时决策"；runtimeConfig 运行期解析、支持环境变量覆盖、有私密栏，适合 API 地址、密钥这类"部署时决策"。口诀：跟着环境变的用 runtimeConfig，跟着代码版本变的用 app.config。app.config 还支持环境变量覆盖但语义弱，生产项目不建议混用职责。

**来源**：《Nuxt 双配置文件对比》、《前端应用的配置分层》

### 5. 与 Next.js 的 env 体系对比？
**答**：Next 靠 NEXT_PUBLIC_ 前缀做构建期内联——带前缀的变量烧进 bundle，不带的仅服务端可读；改任何 NEXT_PUBLIC_ 值都必须重新构建。Nuxt 的 public 栏是运行期由服务端读取后随 payload 下发——改值重启进程即可，产物不变。所以"一个镜像跑三套环境"在 Nuxt 里天然成立，在 Next 里 public 变量部分就得三个构建。Nuxt 双栏 + 声明式白名单的设计对密钥更友好（呼应 next-deploy 第 4 节）。

**来源**：《Next.js 与 Nuxt 配置模型对比》、《多环境部署的构建期与运行期之争》

## C. 实战场景

### 6. 密钥已经不小心通过 public 栏发到线上了，怎么处理？
**答**：三步：①立即视该密钥为已泄露，去第三方平台吊销重发，不要抱侥幸心理；②把字段移出 public 栏，若前端确实需要该能力，改为经 server route 代理转发（客户端永远只见代理地址，呼应 nuxt-server-routes）；③加防线——CI 里跑 secret 扫描、启动插件断言 public 栏不含敏感字段名。已下发的历史 HTML/payload 可能已被搜索引擎和爬虫存档，泄露面按"曾被公开"评估。

**来源**：《前端密钥泄露应急处置》、《SSR 应用的缓存与敏感信息》

### 7. 如何让漏配的关键环境变量在启动时就炸而不是运行中炸？
**答**：写一个服务端优先插件（如 plugins/boot.config.ts），在非 public 栏给敏感字段留空字符串作为"必填"标记，插件里 useRuntimeConfig() 后逐字段 assert，缺失直接 throw。Nuxt 服务端启动期插件抛错会让进程起不来——这正是 fail-fast：容器编排里表现为探针失败、不接流量，远好于运行到某个请求才 500。配合部署流水线里的配置模板校验双保险。

**来源**：《配置缺失的 Fail-Fast 设计》、《Nuxt 插件执行时机》

### 8. server route 里怎么读配置？和组件里有区别吗？
**答**：server route 里用事件对象上的 h3 上下文：event.context.nuxtApp 不保证存在，规范做法是在 server route 中 import { useRuntimeConfig } from '#imports' 于服务端上下文调用，或直接读 process.env。区别在于：server route 天然全服务端，读私密栏无障碍；组件里同一段代码会被水合执行两次，读私密栏在客户端分支拿到 undefined，必须用 import.meta.server 守卫或只在服务端阶段使用（呼应 nuxt-hydration 的两侧执行模型）。

**来源**：《Nitro 与 H3 的上下文传递》、《Nuxt server 路由开发指南》

## D. 深度追问

### 9. 为什么 Nuxt 要求先声明字段才能被环境变量覆盖？
**答**：安全白名单。若任意 NUXT_* 都能注入配置，运维或 CI 中复用的通用密钥环境变量（NUXT_ 前缀未必都被想到）可能被意外合入并随 public 栏下发。先声明再覆盖还带来类型完整性：runtimeConfig 的形状在 nuxt.config 里定义一次，TS 全链路可推断，读不存在的字段编译期即报错。代价是多点一处声明，属于"显式优于魔法"的取舍。

**来源**：《Nuxt 配置设计的显式原则》、《环境变量注入攻击面分析》

### 10. 配置了 NUXT_PUBLIC_API_BASE 但线上仍是默认值，排查思路？
**答**：按链路逐段查：①变量是否真的到了进程（进容器 env | grep NUXT_ 验证，K8s 里查 ConfigMap/Secret 挂载）；②命名是否严格匹配声明的字段路径（大小写、下划线、PUBLIC 段缺失是重灾区）；③字段是否在 nuxt.config 的 runtimeConfig 里声明过（未声明则静默忽略）；④是否被 CDN/缓存层缓存了旧 payload——public 栏随 payload 下发，HTML 被缓存时新值不上线，按 nuxt-render-modes 的 HTML 缓存安全线处理；⑤确认验证的是构建产物而非 dev server。

**来源**：《Nuxt 配置不生效排查手册》、《SSR 环境变量覆盖》

### 11. runtimeConfig 的值能在客户端动态改吗？热更新配置怎么做？
**答**：不能——它是启动期快照，水合后客户端只持有一份 public 只读副本。要"不发版改配置"有两条正路：①把易变配置放进数据库/远端配置中心，server route 或 payload 接口下发，前端按需拉（呼应 nuxt-server-routes 的 /api/config 模式 + defineCachedEventHandler 的 swr 缓存）；②私有化部署可用 Nitro 的 storage 层 + 管理接口写穿。useRuntimeConfig 本身不订阅变更，别指望响应式。

**来源**：《动态配置下发架构》、《Nitro unstorage 应用》

### 12. 从工程角度评价 Nuxt 这套配置模型的设计？
**答**：优点：双栏可见性模型把"能不能给浏览器看"变成数据结构问题而非纪律问题；声明式白名单 + 类型推断降低误用；环境变量优先级符合 12-Factor，一次构建多环境部署是默认支持。不足：与 app.config 职责边界靠文档约定而非机制强制，新人易混；.env 只在本地/特定 preset 自动加载，容器里要显式注入否则静默用默认值；覆盖失败无告警（命名错就默默用旧值），需自建启动断言兜底。总体是 SSR 框架里对私密/公开切分最干净的设计之一（可与第 5 问的 Next 对照记分）。

**来源**：《Nuxt 配置体系设计评析》、《前后端一体化框架的配置方案横评》

---

## 补充（新专题 13-15）

### 13.  多环境（dev/staging/prod+多租户）的配置矩阵怎么设计才不乱？dotenv、env 覆盖、分环境 nuxt.config 三者分工？

分层模型按"变化频率×读者"切：① 代码默认值（nuxt.config 的 runtimeConfig 字面量）——本地跑起来的兜底，全是无害值；② .env/.env.production（c12 约定按 NODE_ENV 加载）——开发机与小团队的部署机注入，注意 .env 不进库、CI 里不缓存；③ 真实进程环境变量——平台（Docker/K8s/Serverless）注入，优先级最高，生产唯一正道（文件 env 在容器编排里是反模式）；④ 租户维度——env 覆盖不了的（每租户不同 key）走"启动后按请求解析"：租户配置进 DB/配置中心，runtimeConfig 只放拉取它的凭据。分环境 nuxt.config 的陷阱：nuxt 的 config 是构建期概念，同一构建产物跨环境=只有 ②③ 能变——"改配置要重 build"的诉求出现时先查是不是把 runtime 值写进了 nuxt.config。配套纪律：启动时 zod 校验必需 env 齐全（缺失直接 crash 而不是半瘫）、/api/healthz 吐配置指纹（不含密钥）供审计。

**来源**：Nuxt 官方 configuration 与 dotenv 约定；掘金《三个环境一套配置模型的落地》

### 14.  密钥已经通过 runtimeConfig.public 或前端 bundle 泄露到线上了，给一份标准应急响应流程。

按事故流程走而不是只改代码：① 定性——确认泄露面（public 栏进 payload、还是构建产物进 CDN 缓存、还是 git 历史），不同面回收手段不同；② 止血（分钟级）——旋转密钥（新旧双活窗口内旧 key 设死线），新值只走 env 注入；改 runtimeConfig 声明移除 public 字段并重部署；CDN/bundle 缓存主动 purge，payload 里旧 key 随缓存过期才是真清除；③ 评估暴露期损失——网关日志按"旧 key+异常来源"查询，判定有没有被滥用（调用量、数据导出痕迹），这一步决定要不要走合规通报；④ 溯源堵漏——git 历史里的密钥要 BFG/filter-repo 清并强制轮换（历史里的永远算泄露），CI 加 secret scanning（gitleaks 门禁），code review 清单加"public 栏只放可公开"；⑤ 复盘模板——泄露路径、发现时延（通常是别人报告而非自己发现）、止血时延三条时间线公开。加分句：预防的核心是"public 后缀即公示"——团队要把这个字段当 API 文档级别敏感来评审。

**来源**：Nuxt 安全公告处理惯例；OWASP 密钥泄露响应手册

### 15.  "配置热更新"在 Nuxt 配置模型里能做到什么程度？要不要做？

框架给的"热"分三档：① runtimeConfig——只在启动时读 env，改值要重启进程（容器滚动重启秒级，这已经算"热"），要运行中变就别用它承载；② app.config——客户端运行期可改（reactive），但那是"会话内状态"不是"配置下发"，刷新即回构建值；③ 真·运行中可变配置=应用自拉：配置中心/DB+轮询或订阅，runtimeConfig 只放"拉配置的凭据与地址"——这是架构选型不是框架特性。要不要做的判据：变更是否要求"不发版、不重启、分钟级全网生效"且回滚有开关（feature flag/限流阈值/文案应急）——满足才值得引入配置中心，并为它的一致性（各实例拉取时间差）、可用性（拉不到时兜底默认值）、审计（谁改了什么）三件债负责。不满足就老实重部署——"为了偶尔改个数字养一套动态配置"是复杂度自找。反模式警告：拿 process.env 散落读写模拟热更新（env 在 Node 启动后不该改）、把 50 个字段全塞远程配置（失去类型与启动校验）。

**来源**：Nuxt 官方 runtime config 说明；InfoQ《热更新配置的三种诚实形态》
