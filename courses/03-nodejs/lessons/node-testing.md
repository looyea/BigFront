# 测试：node:test 与断言

> 目标：Node 18+ 内置了**零依赖的测试运行器 `node:test`** 与**断言库 `node:assert`**，不用装 jest/mocha 就能写单元/集成测试。掌握 `test()`/`describe()`/`it()`、断言（`deepStrictEqual`/`rejects`/`throws`）、**异步测试**、**mock/stub/spy**（`t.mock`）、**子测试**、**并发/隔离**，以及给**裸 http 与 Express 服务写集成测试**、用 `--experimental-test-coverage` 统计覆盖率（呼应 09-express L7 的 exp-testing、下一关起进入 L8）。

---

## 一、最小可跑：test + assert

```js
// math.test.js（文件名 *.test.js 会被自动发现）
import { test } from "node:test";
import assert from "node:assert/strict";   // strict 模式：类型也要相等
import { add } from "./math.js";

test("add", () => {
  assert.equal(add(2, 3), 5);
  assert.deepEqual([1, [2]], [1, [2]]);
});
```

```bash
node --test                 # 跑所有匹配的测试文件
node --test math.test.js    # 跑单文件
node --test --watch         # 监听重跑
npm test 里写 "test": "node --test"   # （呼应 node-npm scripts）
```

`assert/strict` 让 `equal` 等价于 `deepStrictEqual`（严格 + 深比较），比松散的老 `assert` 更安全（老 `assert.deepEqual` 用 `==`，易漏 bug）。

---

## 二、组织：describe / it / 子测试

```js
import { describe, it } from "node:test";

describe("购物车", () => {
  it("空车总额为 0", () => assert.equal(total([]), 0));
  it("含一件商品", (t) => {
    assert.equal(total([{ price: 10, qty: 2 }]), 20);
    t.diagnostic("10 * 2");                    // 附带诊断信息
  });
});
```

- `describe` 分组、`it` 单条（`it` 是 `test` 的别名）；
- 回调收一个 `t`（TestContext）：`t.diagnostic`、`t.test()`（子测试）、`t.skip()`、`t.todo()`；
- 修饰：`test('x', { skip: '原因' })`、`{ only }`、`{ todo }`、`{ timeout: 1000 }`、`{ concurrency }`。

---

## 三、异步与断言Promise/异常

```js
import assert from "node:assert/strict";

test("异步返回", async () => {
  assert.equal(await fetchUser(1), { id: 1 });
  await assert.rejects(read("/nope"), { code: "ENOENT" });   // 断言会 reject，且校验错误对象（呼应 node-fs 错误码）
});

test("同步抛错", () => {
  assert.throws(() => JSON.parse("{"), SyntaxError);
});
```

- 测试函数返回 Promise，runner 自动 await；抛错/reject 即失败（呼应 node-async-errors）；
- `assert.rejects`/`assert.doesNotReject` 处理 Promise 拒绝；可传 `{ code }`/`instanceof`/正则校验错误。

---

## 四、before/after 钩子与资源清理

```js
import { before, after, beforeEach } from "node:test";

let server;
before(async () => { server = await startServer(0); });   // 起一次
beforeEach(() => resetDb());
after(() => server.close());                              // 收尾，避免句柄泄漏（呼应 node-event-loop 退出）
```

顶层或 `describe` 内都可放钩子；`after` 里务必 `close` 服务器/连接，否则测试进程挂住不退（呼应 node-child-process interview 第 10 题）。

---

## 五、mock / stub / spy：隔离依赖

`t.mock`（或全局 `mock`）可替换方法、跟踪调用，**自动在测试后还原**：

```js
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("读取失败降级", (t) => {
  const read = t.mock.method(fs, "readFileSync", () => { throw new Error("disk"); });
  const result = loadConfig();               // 内部调用 fs.readFileSync，被替换
  assert.equal(result.usingDefault, true);
  assert.equal(read.mock.callCount(), 1);   // 断言被调用次数/参数
  read.mock.calls[0].arguments;              // 拿到调用参数
});
```

- `fn.mock.calls`/`callCount()`/`returnValues` 做**行为断言**（spy）；
- 传实现即 stub；`t.mock.timers` 可 fake `setTimeout`/`Date`，测时间逻辑不真等；
- 别过度 mock——集成测试（下节）更接近真实。

---

## 六、给 HTTP 服务写集成测试（呼应 Express L7）

内置 `fetch`（Node 18+）直接打真服务器，是最实用的集成测试方式：

```js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

let srv, base;
before(async () => {
  srv = http.createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true, url: req.url }));
  }).listen(0);                              // 端口 0 = 让 OS 随机分配，避免并行冲突
  await new Promise((r) => srv.once("listening", r));
  base = `http://127.0.0.1:${srv.address().port}`;
});
after(() => srv.close());

test("GET /json 返回 ok", async () => {
  const res = await fetch(`${base}/json`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /application\/json/);
  assert.deepEqual(await res.json(), { ok: true, url: "/json" });
});
```

Express 应用同理：`app.listen(0)` 起真端口，或 supertest 式地对 `app` 直接发请求（呼应 09-express 的路由/中间件）。**测试即文档**：断言状态码、头、body、错误分支。

---

## 七、并发、隔离与覆盖率

- **文件级默认并发**（多核跑不同文件）、单文件内 `concurrency` 控制用例并发；需要**独占**（如改环境变量、占端口）用 `{ concurrency: 1 }` 或 `--test-isolation=none/process`；
- 每文件是**独立子进程**，互不污染全局（呼应 node-config：别依赖隐式全局）；
- **覆盖率**：`node --test --experimental-test-coverage`，输出行/分支/函数覆盖，配 `--test-reporter=spec|dot|tap|junit` 选格式，CI 里可 `--test-reporter` + lcov 上传。

---

## 八、自检清单

- [ ] `node --test` 能发现哪些文件？`assert` 与 `assert/strict` 差别？
- [ ] `describe`/`it`/子测试 `t.test` 怎么组织？`skip`/`only`/`todo` 用途？
- [ ] 如何断言一个 Promise reject、一个函数抛特定错误？
- [ ] `t.mock` 的 spy/stub/fake timers 各解决什么？为何测完自动还原？
- [ ] 给 HTTP 服务写集成测试为什么用 `listen(0)`？after 里为什么要 close？
- [ ] 怎么开覆盖率、怎么避免用例间全局状态互相污染？

---

## 🚀 部署预告

- 集成测试 `listen(0)` + `fetch` 与 **node-http** 的裸服务器、**Express L7** 的 supertest 思路一致；
- `--test-reporter`/覆盖率接入 CI，是 **node-deploy-perf** 部署流水线（build→test→publish/docker）的质量闸门；
- `after` 里关服务/关句柄，与 **node-event-loop** "无活跃句柄才退出"、**node-child-process** 子进程清理一脉相承；
- 至此 L7「npm 与包生态」完成。

下一关进入 L8 **node-config**：process.env、12-factor、dotenv、配置分层与结构化日志——把"能跑"变成"能在任何环境安全地跑"。
