# node-testing 面试题精选

> 共 12 题，覆盖 运行器 / 断言 / mock / 集成测试 / 工程实践 五类。

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
