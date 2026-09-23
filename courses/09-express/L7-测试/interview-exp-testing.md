# exp-testing 面试题精选

> 共 15 题，覆盖 **金字塔 / 可测试设计 / 单测 / 集成 / mock / 覆盖率 / 原则** 七类。

---

## 一、测试策略

### 1. 讲讲测试金字塔，为什么后端尤其要重视单元测试？

金字塔自底向上：单元测试（多、快、稳）、集成测试（中）、E2E（少、慢、脆）。后端业务规则集中在 Service（纯逻辑），单测毫秒级、无外部依赖、易定位、可覆盖大量分支与边界；把验证主要压在这里，回归成本低。E2E 要起真实链路，慢且不稳定，只留关键路径冒烟。金字塔本质是"成本/收益/稳定性"的权衡。

**来源**：Mike Cohn — "Succeeding with Agile（金字塔图）"; Martin Fowler — "Test Pyramid"; Google — "Software Engineering at Google / Blip Blop"

### 2. 什么是"冰淇淋筒反模式"？有什么危害？

金字塔倒置——E2E 巨多、单测寥寥。危害：测试套件慢到没人愿意跑、偶发失败（flaky）频繁、失败难定位（链路长）、维护成本指数上升、CI 反馈环慢。团队应把测试下沉，多用单测覆盖逻辑，E2E 只保核心场景。

**来源**：Kent C. Dodds — "The Testing Ice Cream Cone / Glass Hourglass"; Cypress blog — "testing pyramid"

---

## 二、可测试设计

### 3. 为什么 Express 项目要把 app 和 server（listen）拆成两个文件？

`app.js` 只组装中间件/路由并导出 app；`server.js` import app 后 `app.listen()`。好处：① 测试可直接 `import app` 交给 supertest 在内存起临时端口，不占用真实端口、不干扰；② 装配与运行解耦，便于多入口（HTTP/HTTPS/集群 worker）复用同一 app；③ 优雅关闭只需操作 server。这是可测试性的结构前提。

**来源**：Express — "Generator app.js/server.js 分离"; NearForm Node Best Practices — "testing"; StrongLoop — "app vs server"

### 4. 依赖注入如何提升可测试性？不用 DI 框架能做到吗？

被测单元把依赖"从外部接收"而非内部 new，测试即可传入 fake（假 repo/mailer/时钟），隔离 DB/网络/时间，测得快且确定。Node 不必上 InversifyJS 容器——用"工厂函数 + composition root"（`makeUserService(repo, mailer)`，装配处统一 new）即可，轻量直观。重型容器留到大型多绑定/生命周期场景。

**来源**：Martin Fowler — "Dependency Injection"; Vitaly Friedman — "DI in Node without frameworks"; InversifyJS docs

---

## 三、单元测试

### 5. 单测一个 Service，Repository 该 mock 到什么程度？断言什么？

mock Repository 到"每个业务分支对应一个受控返回值"（如 findByEmail 返回已存在→断言抛 CONFLICT、create 未被调用）。断言：① 返回的业务结果正确；② 关键副作用是否发生（`expect(repo.create).not.toHaveBeenCalled()` / `mailer.send` 被调用一次）；③ 抛出的领域错误 code。不测 Repository 内部、不断言私有实现细节。

**来源**：Testing Library — "Test implementation details are an anti-pattern"; jest docs — "mock functions"; vitest — "vi.fn"

### 6. vitest 和 jest 怎么选？

vitest：Vite 生态原生、开箱 ESM/TS、基于 esbuild 启动极快、API 兼容 jest、内置 coverage/UI。jest：生态最广、snapshot 成熟、社区资料多、历史悠久但 ESM 支持 historically 别扭。前端项目已在 Vite → 选 vitest 统一配置；纯 Node 大项目/需特定插件 → jest 也可。二者理念一致，迁移成本低。

**来源**：vitest — "Why Vitest / comparison"; Jest docs; Anthony Fu — "Vitest 分享"

---

## 四、集成测试

### 7. supertest 测 Express 端点，和直接 fetch 一个真实部署的服务有何区别？

supertest 把 app 传给一个 ephemeral（临时端口）http server，在同一进程内发真实 HTTP 请求并断言——覆盖完整中间件链（body 解析、校验、路由、error handler），但无需手动启停服务、快、CI 友好，进程内跑。真实部署 fetch 更接近端到端冒烟（含网络/网关/环境），留给预发/smoke。supertest 是"集成层"主力。

**来源**：supertest — GitHub README/API; Express — "testing middleware stack"; Mocha — "integration with supertest"

### 8. 集成测试里数据库怎么处理？内存 DB 和真实测试库各有什么利弊？

内存/容器化临时 DB（mongodb-memory-server / testcontainers）：本地无需预置、隔离干净、可并行、CI 易用；缺点是与生产版本/扩展可能有差异、首次拉镜像慢。共享真实测试库：贴近生产；缺点是要防用例互相污染（必须清库/唯一命名/事务回滚）、并发难、状态残留导致 flaky。原则：用例隔离、可任意顺序重复。

**来源**：mongodb-memory-server docs; testcontainers — "node"; Google — "Test doubles / database in tests"

---

## 五、Mock 与外部依赖

### 9. 测试涉及第三方 HTTP 调用，为什么要 mock 外部服务？用什么工具？

不打真实第三方：① 稳定（不受对方可用性/限流/数据变化影响）；② 快、可离线；③ 能构造超时/5xx/异常边界；④ 不产生真实副作用（发钱/发邮件）。工具：nock / msw（拦截出网请求返回固定响应），并可 `nock.isDone()` 断言确实调用。对内部依赖用 mock，对外部契约可用 contract test / replay 补充。

**来源**：nock — GitHub README; MSW — "Mocking and spying network requests"; Pact — "consumer-driven contract testing"

### 10. 什么是 flaky test？为什么危险？如何治理？

同一代码下时过时不过的测试。危险：侵蚀对 CI 的信任 → 大家习惯性 retry/忽略红灯 → 真 bug 被淹没。常见根因：用例间共享状态/执行顺序依赖、时间/随机未固定、异步竞态、依赖外部服务、资源未清理。治理：隔离与清库、fake timers、固定 seed、去掉顺序依赖、控制并发、把不稳定测试单独标记排查，而非盲目重试。

**来源**：Google Engineering — "Flaky tests at Google"; Microsoft — "how we deal with flaky tests"; pytest-rerunfailures 讨论

---

## 六、覆盖率与门禁

### 11. 覆盖率门禁设多少合适？为什么"高覆盖仍可能有 bug"？

覆盖率是"下限护栏"不是目标：常见起点 lines 70-80%、按模块设定，逐步提升，别一刀切 100%（逼出无断言的凑数测试）。100% 覆盖只说明每行被执行过，不代表断言充分、边界/异常都验证、逻辑正确——空断言也能刷满。真正要保的是关键业务分支、错误路径、边界条件被有意义地断言。

**来源**：Martin Fowler — "Test Coverage"; coverage 相关 — "100% coverage is a weak signal"; Google — "code coverage / testing overview"

---

## 七、测试原则

### 12. 写好测试有哪些通用原则？

① AAA 结构（Arrange/Act/Assert）清晰；② 命名描述行为即文档（"当邮箱重复时应抛 CONFLICT"）；③ 完全隔离——无共享状态、无顺序依赖、无未固定随机/时间；④ 快——慢测试会被跳过，标记单独跑；⑤ 测行为不测实现，重构不破测；⑥ 错误路径/边界与 happy path 同等重要；⑦ 一个用例一个关注点，失败信息可自解释；⑧ DRY 适度，别为复用把断言糊成一团（过度 setup 反而难读）。

**来源**：Kent Beck — "Test Driven Development"; Roy Osherove — "ART of unit test / Principles of clean tests"; GrowthBook/Google — "test readability (ARRANGE-ACT-ASSERT)"

---

## 补充（新专题 13-15）

### 13.  测试里的数据库怎么办：事务回滚、独立库、容器、testcontainers——给出你的策略矩阵与踩坑经验。

四方案解剖：① 事务回滚（外层包事务+每用例 ROLLBACK）——快，但坑在"被测代码自己开事务/连接"时必须共享同一连接（Prisma 的交互式事务拿不到测试事务），且回滚测不出"提交后才可见"的行为（唯一约束冲突、序列、异步消费者读不到未提交数据）；② 每跑独立库（docker compose 起 PG，truncate 分段清理）——主流方案：TRUNCATE ... RESTART IDENTITY CASCADE 比逐表 delete 快且无外序烦恼，并发用例需按测试文件分 schema/分库；③ testcontainers（代码内声明容器，随测试生命周期）——把②的体验工程化（版本与迁移脚本同源、本机 CI 一致），代价是启动冷与 CI 里 docker-in-docker 的运维话题；④ 内存库 SQLite/better-sqlite3——只适合"仓储层抽象干净且 SQL 方言差异可控"的小型项目，用 PG 特有语法（on conflict/jsonb/数组）的项目别自欺。策略矩阵按层给：单元（Repository mock 或 fake）、集成（独立库+迁移后 truncate 复用容器）、端到端冒烟（完整 compose 环境含第三方 stub）。迁移一致性：测试库必须跑同一套 Prisma migration（"schema 由迁移唯一决定"原则），跳过迁移的手工建表是测试通过线上挂的经典源。踩坑集：全局 truncate 与并行 worker 打架（并行粒度与清理粒度要一致）、时钟冻结（时间相关断言用注入的 Clock 而非 system time mock）、第三方 API 在测试环境真调（网络层白名单拦截，漏网的在 CI 变 flaky）。收口句：这题的高分不在方案清单，在"你的断言在测回滚可覆盖的行为还是提交后才成立的行为"这一层自觉。

**来源**：Testcontainers 文档；Thoughtworks《测试环境即代码》；知乎《共享测试库的两个团队的一天》

### 14.  认证与权限这类"安全关键路径"的测试怎么设计？它和普通业务测试有什么不同？

差异定性：安全测试测的是"不该通过的必须不通过"——断言方向相反、覆盖矩阵化。设计三块：① 权限矩阵测试——角色×资源×操作三维表（期望 allow/deny），数据驱动生成用例（几十角色组合跑同一套断言函数），矩阵进 PR 审查（改权限=改矩阵，评审可见）；② 令牌边界用例集——过期/错签名/错 alg（none 攻击回归）/错 aud/iss 伪造/篡改 payload（验签顺序：先验签再解析的回归钉）、refresh 复用触发吊销链、并发刷新竞争（两个请求同时刷新的幂等结果）；每条都是历史事故或标准攻击的固化。③ 会话与传输行为——登出后旧 cookie 的每次访问路径都要断言 401（"登出只清了 UI"是高频事故）、Set-Cookie 属性断言（httpOnly/sameSite/secure 的快照测试，防配置漂移）、Cookie 域边界（子域污染场景）。不同之处的总结：a) 失败容忍度（普通用例可 quarantine，安全用例 flaky 也要修不能禁）；b) 负例为主（deny 路径穷举而非 allow 抽样）；c) 与渗透分工（自动测挡已知回归，人测探未知组合，报告里的 finding 逐条转 CI 用例是闭环 KPI）。加分实践：用 supertest 建"以真实中间件链跑最小 app"的认证切片测试（不连真库，auth 依赖 fake），安全用例的毫秒级反馈鼓励人手都写。收口句：安全测试成熟的标志是"渗透报告的第二年变薄"——每轮外部发现都沉淀为内部回归。

**来源**：OWASP Testing Guide（认证/会话）；Google 安全测试实践；掘金《渗透报告里的越权我们在 CI 早就该发现》

### 15.  讲讲你的 CI 测试流水线设计：从 push 到合并的关卡、速度与稳定性的权衡、以及 flaky 治理机制。

关卡递进（反馈时长与成本成正比）：① pre-commit（lint+类型+受影响单测，30 秒预算——超预算的门禁会被绕过，形同虚设）；② PR 快线（单元+受影响集成+权限矩阵，目标 10 分钟内，按变更路径路由：只改 docs 全跳过、改 auth 域强制跑安全用例集）；③ 合并后全量（集成+契约+夜间 e2e 冒烟+性能基线对比）；④ 发布门禁（迁移演练环境跑一次带真 schema 变更的冒烟）。速度工程：分层并行（无依赖用例分片）、缓存（npm/构建层/Docker 层）、失败快抛（--bail 策略分阶段：探索期跑完收集全失败，合并门禁期见红即停）；预算制度："CI 时长"是团队公开指标，超过阈值列入当期技术债专项。稳定性与隔离：用例间零共享状态（每用例自造数据自清理）、时间随机化测试顺序（暴露隐性依赖的探测器）、网络出口白名单（真调外部的用例在本地全绿 CI 红——先从这里查）。flaky 治理机制化：隔离区（quarantine 标签+自动跳过关但计入债务看板）、负责人认领+时限（一周内定位，到期未修只能修不能删——"删 flaky 测试"要先证明测的是真行为）、归因分类（环境类：容器资源/端口冲突；并发类：共享夹具；逻辑类：真 bug 的伪装——最贵的一类优先查）。度量：flaky 率、隔离区存量、定位时长趋势，季度 review。收口句：CI 不是测试的运行时，是团队质量流程的执行器——设计它等于设计"坏代码被发现的最短路径拓扑"。

**来源**：Google Testing Blog（flaky 治理）；Atlassian CI 效能研究；InfoQ《测试并行度与隔离度的权衡》
