# next-fullstack-project 面试题（15 题）

> 主题：全栈项目设计与落地——数据层、鉴权、CRUD、缓存失效与工程闭环。

## A. 架构决策

### A1. 做一个带登录的全栈 Next 应用，渲染策略怎么定？

**答**：按"响应是否与请求者有关"切两半：公开区（落地页、文档、商品详情）与请求者无关→SSG/ISR 进 Full Route Cache，CDN 顶流量；私有区（控制台、笔记、订单）与 cookies/session 有关→动态渲染，每次请求现算现取。实现上不必手写开关——在私有 layout 里 await auth()（底层读 cookies）自动整段转动态；这同时是一层鉴权守卫。混合页面（带用户名的首页）则拆：外壳静态 + 用户信息小块动态（next/revalidate 的 PPR 思路，呼应 next-render-modes 第 4 节）。定完渲染策略再选数据与缓存层，顺序不能反。

**来源**：掘金《全栈 Next 应用的第一道架构题：动静分区》；InfoQ《RSC 时代的渲染策略决策树》。

### A2. 项目目录怎么组织？pages/components/lib 那套 SPA 习惯哪里要改？

**答**：App Router 的惯例是"路由为中心"而非"类型为中心"：数据与动作跟着段走（app/notes/actions.ts、app/notes/[id]/page.tsx），因为路由段本身就是缓存/布局/错误的边界单元；共享代码再下沉 src/lib（纯逻辑）、src/components（跨段复用组件）、src/features（按业务域垂直切分的中大型项目）。SPA 时代"一个 store 目录管全局状态"的习惯要收敛——服务端数据的事实源在 DB 与缓存层，客户端全局状态需求会缩小一大半（呼应 next-fetch-cache 第 6 节、react-state-mgmt 的"服务器状态"论述）。

**来源**：CSDN《App Router 项目结构演变》；知乎《从横向分层到纵向切段》。

### A3. ORM 单例为什么要挂 globalThis？生产环境需要吗？

**答**：开发模式热更新会重新执行模块，每次重新 new PrismaClient() 就新建连接池，几十次热重载后数据库连接数打爆（"too many connections"）。globalThis 在热更新间存活，挂上去即可复用。生产无热更新，模块只执行一次，普通模块级单例足够——所以官方模板都带 `if (NODE_ENV !== 'production')` 守卫。同类问题在 Node 课程里也见过：任何"进程级昂贵资源"（连接池、Kafka client）都要防重复初始化（呼应 node-config 的资源管理、exp-patterns 的依赖注入视角）。

**来源**：SegmentFault《Prisma 官方推荐的单例写法原理》；掘金《热重载引发的连接池泄漏》。

## B. 鉴权与写路径

### B1. 登录校验在这个项目里出现了几次？重复吗？

**答**：三次，各司其职不算重复：① middleware——URL 级粗筛，未登录访问 /notes 直接重定向，省掉无谓的组件渲染，但它信的是 JWT 载荷，可能过期于签发之后；② 私有 layout 服务端 auth() 再查——段级守卫，拦住所有子页且校验的是服务端可验证信息；③ 每个 Server Action 入口——最终防线，因为 Action 是公开 HTTP 端点，可被绕过一切 UI 直接 POST。分层逻辑是"每层都假设上一层不可靠"：UI 隐藏按钮防君子、middleware 防误入、Action 防恶意（纵深防御，呼应 next-middleware-auth 第 2、3 节）。

**来源**：知乎《Next 鉴权的三层纵深到底防谁》；CSDN《绕过 middleware 直接调用 Action 的演示》。

### B2. 表单提交的完整链路里，校验应该做几层？各层目的？

**答**：三层：① 客户端 required/pattern——即时体验，挡 80% 手误，但完全不可信；② Action 内 zod schema——权威校验，产出字段级错误经 useActionState 回填表单（保留用户输入是体验底线）；③ 数据层约束——唯一索引、外键、NOT NULL，兜住并发写入的竞态（"检查不存在再插入"在两个并发请求下会双穿，靠唯一索引+捕获冲突错误解决，呼应 exp-validation 的同类话题）。业务规则（余额够不够）必须在服务端且和写入同事务/同锁范围。

**来源**：掘金《表单校验的三层职责论》；InfoQ《竞态条件下的一致性兜底》。

### B3. 用户报告"删除笔记后偶尔还在列表里看到它"，你的排查路径？

**答**：典型缓存失效半径问题，按序查：① 删除 Action 是否 revalidatePath('/notes')——只失效了 /notes/[id] 最常见；② 失效是否发生在写入成功后（提前 return 的分支漏调）；③ 列表若还有客户端层缓存（Router Cache 回退命中、或自建的乐观状态），确认导航是 forward 还是 back——back 走内存缓存显示旧快照是预期行为，需要数据绝对即时时给该段关缓存；④ 多实例部署时查跨实例缓存共享是否缺位（呼应 next-deploy C2）。修复后用"改→退→进"三步复现路径回归（呼应 next-revalidate 第 5 节失效半径选择树）。

**来源**：CSDN《删除后仍可见：一次缓存失效不完整的排查实录》；SegmentFault《Router Cache 与数据新鲜度》。

### B4.（加练）乐观更新失败了怎么办？

**答**：useOptimistic 的临时状态在 Action resolve 后自动被真实 state 取代——失败路径要保证服务端返回明确错误且页面据此重新渲染真实列表（revalidate 或返回数据），UI 自然"回滚"。要点：① 删除/新增的乐观项要能在失败时复活，key 稳定；② 失败要 toast + 恢复，不能静默吞；③ 高风险操作（付款）干脆不乐观（呼应 next-forms-mutations 第 3 节的取舍）。

**来源**：知乎《useOptimistic 的失败语义》；掘金《乐观 UI 的回滚工程》。

## C. 数据与性能

### C1. 这个项目的数据获取全走服务端组件，还需要写 API 接口吗？

**答**：站内消费不需要——服务端组件直连数据层是最短路径，省掉"自己给自己调 HTTP"的序列化往返（Route Handler 三正当用途之外的场景，呼应 next-route-handlers 第 2 节）。仍然要接口的时刻：① 站外消费者（APP/小程序/Webhook）；② 客户端组件确需运行时拉取（配合 SWR/React Query）；③ 第三方回调（支付通知）。判断标准是"调用方在不在你的浏览器之外"。很多团队把 actions 和 api 各写一套逻辑导致双份校验漂移，正确做法是两者共用 lib 层的同一业务函数。

**来源**：掘金《Server Components 时代还需要 BFF 吗》；InfoQ《Action 与 Route Handler 的逻辑复用》。

### C2. 首屏列表 500 条笔记，页面很慢，给出三级优化。

**答**：① 查询层：分页/游标 + 只 select 列表需要的列（别让 ORM 全字段带出 content 大文本）；② 渲染层：列表段套 Suspense，骨架屏先出、数据流式补（呼应 next-context-streaming 第 4 节）；再狠一层虚拟滚动（客户端岛 + TanStack Virtual）；③ 缓存层：高频且容忍分钟级延迟的列表转 ISR + revalidateTag 主动失效，CDN 直接顶住（呼应 next-fetch-cache 第 3 节金字塔）。顺序按 ROI：先查询后渲染后缓存——多数"框架慢"其实是 SQL 慢。

**来源**：CSDN《Next 列表页性能三板斧》；知乎《流式列表与虚拟滚动的选择》。

### C3. 什么时候该项目要拆出独立的后端服务？

**答**：信号出现再拆，别预防性微服务：① 有非 HTTP 形态的常驻任务（定时批处理、消息消费者）塞不进请求-响应模型——独立 Node worker（呼应 node-child-process/workers）；② 另一类客户端（APP）复用同一套 API 且团队 ≥2 个前端，接口契约需要独立版本管理；③ 计算/内存特征与 Web 前端冲突（AI 推理、大文件处理）需要独立扩缩容。拆分方式：Next 保留 BFF/页面，重活外移，接口用 tRPC/OpenAPI 定型（呼应 exp-patterns、react-data-fetching）。拆分的代价（部署、事务、一致性）要在决策桌上明码标价。

**来源**：掘金《Next 全栈应用的拆分时机》；InfoQ《从全栈框架拆出后端的成本清单》。

## D. 项目复盘

### D1. 从空白仓库到第一次上线，你的里程碑顺序是什么？

**答**：走通垂直切片再横向铺开：M0 脚手架（create-next-app + lint/test 门禁 + CI，先让"绿"有地方长）；M1 数据模型 + auth（schema 定型，登录可用）；M2 一条黄金路径端到端（建笔记→列表→详情，含 Action + revalidate），此时部署到预览环境——垂直切片暴露的问题最有价值；M3 补齐 CRUD 与边界（校验、错误页、空态）；M4 性能与监控（CWV 基线、digest 日志链路）；M5 上线放量 + 回滚预案。反面教材是先把所有页面 UI 铺完再通数据——集成地狱（呼应 react-architecture 的切片交付、exp-deploy 的里程碑法）。

**来源**：SegmentFault《全栈项目的垂直切片交付法》；知乎《第一次上线前必须有的五个里程碑》。

### D2. 这个项目如何验证"质量"？上线后盯什么？

**答**：上线前三层：Action/业务函数单测（三分支纪律）、Route Handler 契约测试、Playwright 黄金路径（登录→建→改→删）；CI 门禁含 build 零告警与包体红线（呼应 next-testing D3）。上线后盯四个数：错误率与 digest 突增（发布窗口对齐）、LCP/INP p75 真实用户值（web-vitals 上报）、Action 失败率（业务健康探针）、DB 慢查询。每个指标预先定义"回滚阈值"，让回滚成为按钮而不是辩论（呼应 next-deploy D3）。

**来源**：CSDN《上线后 24 小时观察清单》；掘金《用数字守护发布：告警与回滚阈值》。

### D3. 面试被问"介绍一下你的 Next 全栈项目"，怎么讲出彩？

**答**：套"30 秒定位 + 3 个决策 + 1 个坑"框架：一句话说清做什么、给谁用；三个有张力的技术决策——① 动静分区渲染（为什么私有段全动态：响应与请求者无关才可缓存）；② 写路径全走 Server Action + 三层鉴权（为什么不建 API：站内消费最短路径）；③ 缓存失效半径显式管理（revalidatePath 位点清单，治过"删了还在"的幽灵 bug）；一个真实坑 + 排查路径（热重载连接池爆炸→globalThis 单例）。决策都带"放弃了什么方案、为什么"，比罗列功能清单高一个段位。

**来源**：知乎《全栈项目面试的讲述结构》；掘金《把八股讲成工程：项目表达方法论》。

---

## 补充（新专题 13-15）

### D4.  一个笔记站：公开分享页、个人列表、编辑器、删除回收站——每页的渲染模式与缓存策略怎么定？

**答**：逐页决策（内容频率×身份依赖×SEO）：① 公开分享页——SSG/ISR + generateStaticParams 枚举活跃分享（长尾 dynamicParams 首访现渲+缓存），SEO 要收录；② 个人列表——cookies() 存在即动态，走 SSR/PPR；别用 revalidate 造假缓存（千人千面无全路由缓存可言），缓存的是"该用户的笔记数据"（tag: note:{userId}）；③ 编辑器——重交互岛：页面壳动态 SSR（鉴权+初始文档），编辑器本体客户端岛，草稿本地、autosave 走 Action 幂等 upsert（防抖+版本号 CAS）；④ 回收站——低频动态页即可，恢复=Action（状态机 CAS + revalidatePath 列表与详情页）。通检：所有 mutation 都回答"影响哪些页的缓存"（tag 清单化进代码评审），登录态 cookie 用 path 作用域，防开放重定向在跳登录处统一闸。

**来源**：掘金《一个 Next 全栈小站的架构决策记录》；Next.js 官方 Route Segment Config。

### D5.  全栈小项目里"数据层"怎么写才不至于推倒重来？给一套可演进的模块边界。

**答**：边界四件套：① lib/db 只放连接与事务原语（单例池、withTx），不写业务；② features/<域>/data 放查询/命令（getNotes、createNote），函数签名接"用户/租户上下文"并内部断言权限（权限下数据层是最后一行代码：每个查询自带 owner 条件，别信调用方）；③ actions.ts 只做"解析输入(zod)+调数据层+决定 revalidate"，不放查询——三层之间箭头单向；④ 类型与 schema 共享（zod+drizzle 生成），客户端岛 import 类型不 import 查询。演进压力测试：将来拆独立 API 服务时，被搬走的只有 actions/http 壳，features/data 整体可平移（这就是"单仓全栈"与"微服务"的最大公约数提前量）；换 ORM 只动 data 层。反面：把 prisma 查询散写进组件——RSC 允许"组件直连数据"的魔法让原型期极快，但上线前要把"直连"收编进 data 模块，否则权限与缓存策略没有挂载点。

**来源**：InfoQ《小全栈的架构演进路线》；知乎《Next 项目里 lib/db 该长什么样》。

### D6.  小站从"能跑"到"敢发"：上线前你要过哪几关？（安全/数据/可观测/成本）

**答**：四关清单：安全——每个 Action/handler 有鉴权闸（清单式逐一核对，含"无状态变更的 GET handler"）、输入全 zod、文件上传限类型体积+转存策略、cookie 四属性与 CSRF 复核、错误响应不透堆栈、rate limit（登录/Action 重灾区）；数据——迁移工具化（prisma migrate 进 CI 检查 drift）、备份与恢复演练做过一次、唯一约束/外键兜住"应用层幂等漏网"；可观测——Sentry（含 digest 串联）、RUM CWV、结构化日志带请求 id、告警三条（5xx 率、Action 失败率、构建失败）；成本——缓存命中率（x-nextjs-cache）看 ISR 是否真在省钱、图片/字体流量、函数时长分布。流程关：冒烟 E2E 关键路径 5 条（注册→建→编辑→分享→删）、回滚路径演练（旧镜像还在 registry）、feature flag 包住高危变更。收口句："敢发"的标准不是测试通过率，是"坏了能多快发现、多快回滚"。

**来源**：Vercel 官方博客《Next.js 应用生产就绪清单》；OWASP ASVS 精简实践。
