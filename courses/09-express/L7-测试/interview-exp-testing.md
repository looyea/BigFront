# exp-testing 面试题精选

> 共 12 题，覆盖 **金字塔 / 可测试设计 / 单测 / 集成 / mock / 覆盖率 / 原则** 七类。

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
