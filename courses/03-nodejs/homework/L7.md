# L7 课后作业：npm 与包生态

> 覆盖 **node-npm / node-publish / node-testing** 三关。先读代码/找 bug，再动手写，最后场景与简答。环境：Node 20+。

---

## 一、读代码，找 bug / 预测（10 小题）

**1.** 这个 package.json 片段有什么问题？会导致什么后果？
```json
{
  "devDependencies": { "typescript": "^5.4.0" },
  "dependencies": { "express": "^4.19.0" }
}
```
> 生产镜像用 `npm ci --omit=dev` 后，`import express` 和 `import ts` 哪个会失败？（呼应 node-npm 第五节）

**2.** `^0.3.1` 允许安装到 `0.4.0` 吗？`~0.3.1` 呢？说明 0.x 的特殊规则。

**3.** 这段 scripts 在 Windows 上为什么会挂？怎么改跨平台？
```json
"scripts": { "clean": "rm -rf dist && mkdir dist" }
```

**4.** 删掉 `package-lock.json` 后 `npm install` 重装，最可能发生什么？为什么 CI 应用 `npm ci`？

**5.** 同事没在 `package.json` 里声明 `lodash`，却 `require('lodash')` 成功跑起来了，这叫什么现象？有什么隐患？换哪个包管理器能暴露它？（呼应 node-npm 第六节）

**6.** 这个 `exports` 有什么顺序问题？对 TypeScript 消费者影响？
```json
"exports": {
  ".": { "import": "./dist/index.js", "require": "./dist/index.cjs", "types": "./dist/index.d.ts" }
}
```

**7.** 一段双包（ESM+CJS）代码里有个模块级 `const registry = new Map()`，dual package hazard 会让什么出错？（呼应 node-publish 第三节）

**8.** 这个包 `"type": "module"`，产物里 `index.cjs` 却写成了 `index.js`（内容是 CJS），会发生什么？

**9.** 下面测试为什么"通过但线上会崩"？给出改进方向。
```js
const fakeDb = t.mock.method(db, "query", () => [{ id: 1 }]);
assert.equal(await getUser(1).name, "x");   // 只验证了对 mock 的假设
```

**10.** 这个集成测试跑完后进程不退出，为什么？怎么修？
```js
before(() => { server = http.createServer(app).listen(3000); });
// 没有 after，且写死端口 3000
```

---

## 二、手写编程题（5 题）

**11.** 写一份规范的 `package.json`：`type:module`、`exports` 提供 `.` 与 `./slugify` 两个入口（含 `types`/`import`/`require`/`default` 条件）、`files:["dist"]`、`scripts` 含 `build`(tsup)、`test`(node --test)、`prepublishOnly`、`engines.node>=18`。

**12.** 用 **tsup** 把一个 TS 源打成 ESM(`.js`)+CJS(`.cjs`)+`.d.ts`，配好 `exports` 让 `import 'pkg'` 与 `require('pkg')` 都能用；分别写一个 ESM 脚本和一个 CJS 脚本 `npm i ./pkg-1.0.0.tgz` 后冒烟通过。

**13.** 用 `node:test` + `assert/strict` 给一个 `slugify(str)` 函数写 5 条用例（含空串、中文、特殊字符、超长、大小写），并用 `describe` 分组。

**14.** 给一个裸 `http` JSON 服务写集成测试：`listen(0)` + 内置 `fetch`，断言 `GET /health`→200 `{ok:true}`、`POST /echo`→回显 body、未知路径→404、超大 body→413；`after` 里 `server.close()` 确保进程能退出（呼应 node-testing 第六节）。

**15.** 用 `t.mock.timers` 测一个"3 秒后 resolve"的 `delay()`，不真正 sleep；再用 `t.mock.method` 对 `fs.readFileSync` 打桩，测"配置读失败时降级到默认值"的分支（呼应 node-testing 第五节）。

---

## 三、场景题（1 题）

**16.** 你要把一个内部工具库发布给公司项目用，并为 CI/CD 打底。请回答：
- (a) 用 scoped 包 + 私有 registry，`package.json` 与 `.npmrc` 要配什么？为什么 scoped 默认私有？（呼应 node-publish 第七节）
- (b) 消费者既用 ESM 打包器又用老 CJS 脚本，你如何设计入口避免 dual package hazard？（呼应 node-publish 第三、四节）
- (c) 如何在 CI 用 `npm ci` + `node --test --experimental-test-coverage` 做质量闸门并产出 lcov？（呼应 node-testing 第七、十一题）
- (d) 如何开 2FA 与 `--provenance` 降低账号被劫持投毒风险？（呼应 node-publish 第八节）

---

## 四、简答题（3 题）

**17.** 解释 semver 三段各自含义，`^`/`~`/精确的区别，以及 lockfile 为什么存在、CI 为何用 `npm ci`。（呼应 node-npm 第三、四节）

**18.** `main` vs `module` vs `exports` 的区别与优先级；`exports` 为什么"封锁未声明子路径"？`types` 为何放最前？（呼应 node-publish 第一、二节）

**19.** 单测、集成测、mock 各自的边界；为什么"过度 mock 危险"、HTTP/DB 边界更应写集成测试？（呼应 node-testing interview 第 7 题）

---

## 五、挑战题 🏆

**20.** 🏆 搭建一个 **pnpm workspace 双包 monorepo**：`packages/slugify`（含 ESM+CJS 双产物、`exports`、`.d.ts`）与 `apps/demo`（依赖 workspace 版 slugify）。要求：
- 根 `package.json` 配 `packageManager`（corepack）与 workspaces；
- `packages/slugify` 用 tsup 出双格式、`files` 白名单、`prepublishOnly` 跑 build+test；
- 为 slugify 写 `node:test` 单元 + 对 demo 里消费它写一条集成测试，开 `--experimental-test-coverage` 出 lcov；
- 用 `npm pack --dry-run` 校验发布内容无源码/密钥泄漏，写一份 `changesets` 或 `semantic-release` 的自动发版流程说明（呼应 node-npm 第七、八节、node-publish 第六节）。
