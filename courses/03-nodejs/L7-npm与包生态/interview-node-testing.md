# node-testing 面试题精选

> 共 15 题，覆盖 运行器 / 断言 / mock / 集成测试 / 工程实践 五类。

---

## 一、运行器

### 1. Node 有内置测试框架吗？相比 jest/mocha 有什么优势？

有，`node:test`（18 稳定）+ `node:assert`。优势：**零依赖**（不引第三方、不进 lockfile、无供应链面）、启动快、原生 ESM、`node --test` 自动发现、每文件独立进程隔离。简单项目够用；复杂场景（快照、富 matcher、jsdom）仍可能选 vitest/jest（呼应 node-vitest 相关、10-vite）。

**来源**：Node.js — "Test runner"、Node.js — "Assertions"

### 2. `node --test` 默认发现哪些文件？怎么跑单文件 / 监听？

匹配 `*.test.js/.mjs/.cjs`、`test/` 下、`test-*.js`、`*-test.js` 等约定命名。`node --test path/to/x.test.js` 跑单文件，`--test --watch` 监听重跑，`--test-name-pattern` 按名过滤（呼应 node-testing 第一节）。

**来源**：Node.js — "Test runner execution model / run mode"

### 3. `describe`/`it` 和裸 `test` 有什么关系？TestContext `t` 能做什么？

`it` 是 `test` 的别名，`describe` 分组。回调收到的 `t` 可 `t.test()` 起子测试、`t.diagnostic()` 输出信息、`t.skip()/todo()`、`t.runOnly`、并可用 `t.planned`。组织成树便于定位失败（呼应 node-testing 第二节）。

**来源**：Node.js — "Test hooks / describe / it"、TestContext API

---

## 二、断言

### 4. `assert` 和 `assert/strict` 的区别？为什么建议后者？

`assert/strict` 让 `equal`→`deepStrictEqual`、`notEqual`→`notDeepStrictEqual`、`deepEqual`→`deepStrictEqual`，即**用 `===` 语义 + 深比较**。默认 `assert` 的 `equal`/`deepEqual` 用宽松 `==`，会把 `'1' == 1` 判等、埋隐患。测试里几乎总想要严格，故推荐 `assert/strict`（呼应 node-testing 第一节）。

**来源**：Node.js — "Assertion strict mode"

### 5. 如何断言异步代码 reject、以及函数同步抛错？分别用什么？

异步用 `await assert.rejects(promiseOrFn, [error])`（可传 `SyntaxError`、`{ code:'ENOENT' }`、正则校验 message）；同步抛错用 `assert.throws(fn, error)`。两者都能对错误对象做形状校验（呼应 node-testing 第三节、node-fs 错误码）。

**来源**：Node.js — "assert.rejects / assert.throws"

---

## 三、mock

### 6. `t.mock` 能替代 sinon/jest.mock 吗？spy、stub、fake timers 分别是什么？

能覆盖常见需求。**spy**：跟踪调用次数/参数/返回值（`fn.mock.calls`、`callCount()`）不改行为；**stub**：替换实现（传第三参）；`t.mock.timers`：fake `setTimeout`/`Date`/`performance.now`，测时间逻辑不用真等。所有 `t.mock` 在测试结束**自动还原**，无需手动 restore（呼应 node-testing 第五节）。

**来源**：Node.js — "Test Mocks / tracker"、sinon — "spies vs stubs"

### 7. mock 有什么滥用风险？什么时候更该写集成测试？

过度 mock 会得到"**测试通过但线上崩**"——因为你验证的是对 mock 的假设而非真实行为（mock 与被测代码一起腐化）。对**纯单元/难构造依赖**用 mock；对**HTTP/DB/文件系统等边界**，尽量真跑（`listen(0)`+fetch、测试库、临时文件），用集成测试兜住真实契约（呼应 node-testing 第六节）。

**来源**：社区 — "Don't mock what you don't own / integration tests"

---

## 四、集成测试

### 8. 给一个 http/Express 服务写集成测试的推荐做法？

`server.listen(0)` 让 OS 分配**随机空闲端口**（避免并行/CI 抢端口），等 `'listening'` 后用内置 `fetch` 打真实请求，断言状态码/头/body/错误分支；`after` 里 `server.close()`。Express 可 `app.listen(0)` 或 supertest 直接对 `app` 发请求（呼应 node-testing 第六节、Express L7）。

**来源**：Node.js — "net/ip address port 0"、社区 — "Integration testing Express with fetch"

### 9. 为什么测试结束后进程 sometimes 挂住不退出？怎么排查？

事件循环仍有**活跃句柄**（没 close 的 server/socket、未 ref 的定时器、子进程、文件 watcher），Node 就不会自然退出（呼应 node-event-loop）。排查：检查 `after` 是否 `close`/`destroy` 了资源、有没有 `setTimeout` 忘 `unref`/`clearTimeout`、临时 watcher 未 `close`（呼应 node-child-process interview 第 10 题）。

**来源**：Node.js — "Why doesn't my process exit / active handles"

---

## 五、工程实践

### 10. node:test 的并发模型是什么？如何避免用例互相污染？

**文件间默认并发**（利用多核），每个测试文件在**独立子进程**运行→全局/模块状态天然隔离。文件内用例可设 `concurrency`；需要独占资源（改 `process.env`、占端口）时把该文件/用例设 `concurrency: 1` 或串行。别依赖跨用例共享可变全局（呼应 node-testing 第七节、node-config）。

**来源**：Node.js — "Test runner concurrency / isolation model"

### 11. 怎么产出覆盖率与机器可读报告接入 CI？

`node --test --experimental-test-coverage` 出行/分支/函数覆盖；`--test-reporter=spec|dot|tap|junit` 选格式，`--test-coverage-reporter=lcov|text|html` 出覆盖率报告，lcov 可上传 Codecov；`--test-reporter-destination` 指定输出文件（呼应 node-testing 第七节、node-deploy-perf 流水线）。

**来源**：Node.js — "Test coverage / reporters"

### 12. `before`/`after` 与 `beforeEach`/`afterEach` 的区别与用途？

`before`/`after` 在套件（文件/describe）**首尾各跑一次**——适合起/停昂贵资源（服务器、DB 连接池）；`beforeEach`/`afterEach` **每个用例前后各跑**——适合重置状态（清库、建临时文件）。配对使用、`after` 必须释放 `before` 拿到的资源，防泄漏（呼应 node-testing 第四节）。

**来源**：Node.js — "Test hooks (before/after/beforeEach/afterEach)"

---

## 补充（新专题 13-15）

### 13. 用 node:test 给一个「读配置→连 DB→起 HTTP」的服务写集成测试，你的基建设计？

分层：单测（纯逻辑不碰 I/O）/集成（本真依赖）。DB：testcontainers 起一次性 PG（或 docker compose profile 本地+CI 同款），每文件独立 schema（迁移跑一次、数据 truncate 事务回滚）——「共享开发库跑测试」是 flaky 与互踩之源。HTTP：app.listen(0) 随机端口 + 用 fetch 打真 socket（本关 listen(0) 题），别 supertest 假注入（集成测的就是 HTTP 栈：header/超时/body 大小）。配置：测试专用 env（NODE_ENV=test 慎用——它会让很多库「偷懒」，显式 TEST_DB_URL 更诚实）；secrets 走 dotenv 的 .env.test 或 CI 注入。隔离：每用例自造数据（uuid 业务键），teardown 用 t.after 注册（本关 before/after 题的细粒度版）。速度闸门：集成套跑不动全量时按「变更影响目录」选择集（nx affected 思路）；CI 并行度=文件数（node --test 默认）。

**来源**：node:test 文档（concurrency/after）；Testcontainers 官方 Node.js 指南与「flaky test」消除模式（独立 schema-per-file）。

### 14. 断言风格 assert/strict 与 expect（chai/jest）怎么选？给「失败信息质量」视角的答案。

失败信息=断言的 UX：assert/strict 深度 equal 报错带 diff（util.inspect 彩色对比），但「大对象哪一条不等」要眼看；expect().toMatchObject/toHaveProperty 组合表达力强、jest 快照/异步 matcher（rejects/resolves）是生态优势。选型：纯 Node 项目 assert/strict 零依赖够用（本关 strict vs 松题：==/=== 默认差），重断言表达/快照/大套件 → vitest/jest 的 expect。普适纪律：① 断言「业务含义」不逐字段（错误消息带上下文：assert.equal(count, 3, "退款应只生成 1 条流水")）；② 浮点/时间用容差（toBeCloseTo/近似）；③ 错误断言到 code 不到 message 文案（i18n 一改全红——本关 code 为 ENOENT 题）；④ 快照是「防意外变更」不是「期望值」（review 时人肉审 diff）。

**来源**：Node assert/strict 文档 diff 行为；Vitest/Jest expect matcher 与快照定位说明。

### 15. CI 里测试套件越来越慢且偶发红，从 node:test 视角给一套治理方案。

慢：① 分账——--test-reporter=tap 出各文件耗时，揪 top5 慢文件；② 单测/集成分 job 并行（构建一次产物共享），集成里 DB 容器复用（service 容器+每文件 schema 而非每用例起停）；③ 文件级并行是 node --test 默认，CPU 密集用例多的话限 --test-concurrency；④ 时间旅行：mock timers 消灭 sleep、fixture 预压缩大文件。红（flaky）：① 隔离审计——共享 env/单例缓存/固定端口三大罪（本关并发边界题）；② 全量 --test-retries 禁用为默认（那是掩盖），本地 --test-only 复现 → 随机顺序（--test-shuffle? 社区工具）暴露顺序耦合；③ 超时：每个 await 点给 AbortSignal.timeout，「永挂」转「有栈可查的失败」；④ 检疫机制：连续 flaky 的用例打 @flaky 标签隔离出主路+工单，红灯不再被「重跑过了」淹没。度量：flaky 率与 P95 时长进周报，治理有数字才收口。

**来源**：node --test CLI 选项文档（concurrency/reporter）；Google test flakiness 治理（检疫/重跑禁令）通行实践。
