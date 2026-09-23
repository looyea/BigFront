# L7 作业：单元与集成测试

> 覆盖：exp-testing

---

## 一、读代码（10 题）

### 1. 这个测试文件为什么无法用 supertest 正常工作？指出 app/server 结构问题。

```js
// index.js
import express from 'express';
const app = express();
app.get('/health', (req, res) => res.sendStatus(200));
app.listen(3000);   // ← 问题所在
```

### 2. 阅读单测，`expect(fakeRepo.create).not.toHaveBeenCalled()` 断言的是什么？为什么重要？

```js
fakeRepo.findByEmail.mockResolvedValue({ id: '1' });
await expect(service.register({ email: 'a@b.com' })).rejects.toThrow();
expect(fakeRepo.create).not.toHaveBeenCalled();
```

### 3. 这段测试有什么隐患？（提示：共享状态）

```js
let user;
it('能创建用户', async () => { user = await createUser(); });
it('能查到刚创建的用户', async () => {
  expect(await getUser(user.id)).toBeDefined();
});
```

### 4. 阅读覆盖率配置，为什么 `thresholds: { lines: 100 }` 反而可能有害？

```js
coverage: { provider: 'v8', thresholds: { lines: 100 } }
```

### 5. 这个集成测试为什么"慢且不稳定"？应改用什么？

```js
// 直接连生产从库做读测试
const db = mongoose.connect('mongodb://prod-replica:27017/app');
```

### 6. 阅读 mock 代码，`nock` 在这里解决了什么问题？如果去掉会怎样？

```js
nock('https://api.pay.com').post('/charge').reply(500);
await expect(service.checkout(cart)).rejects.toMatchObject({ code: 'PAY_FAILED' });
```

### 7. 这段测试断言了内部实现细节，重构时会发生什么？怎么改？

```js
const spy = vi.spyOn(service, 'buildQueryPrivate');
await service.list();
expect(spy).toHaveBeenCalledWith({ sort: '-createdAt' });
```

### 8. 阅读认证测试，为什么这里 `jwt.sign` 用测试密钥而非真走登录？两种做法各适合哪层测试？

```js
const token = jwt.sign({ sub: 'u1', role: 'admin' }, config.jwt.secret);
await request(app).get('/api/admin').set('Authorization', `Bearer ${token}`).expect(200);
```

### 9. CI 里这段脚本有什么问题？（提示：测试失败不阻断）

```yaml
- run: npm test || echo "tests failed, continue"
```

### 10. 为什么 `it('测试用户服务', ...)` 这个命名不好？给出改进。

---

## 二、手写（5 题）

### 1. 把一个 `index.js` 重构成 `app.js`（组装导出）+ `server.js`（listen），使其可被 supertest 测试。

### 2. 用 vitest 为 `makeUserService(fakeRepo, fakeMailer)` 写单测：覆盖"邮箱重复抛 CONFLICT""新用户创建并发欢迎邮件"两个分支，断言副作用。

### 3. 用 supertest 为 `POST /api/users` 写集成测试：① 合法 → 201 + Location + 响应不含 password；② 非法邮箱 → 400 + error.code=VALIDATION_ERROR。

### 4. 用 mongodb-memory-server 写 `globalSetup`：启动内存库、`afterEach` 清集合、`afterAll` 关闭，保证用例隔离。

### 5. 用 nock 为一个"调外部汇率 API 换算价格"的 Service 写测试：mock 正常返回与 500 两种情况，断言换算结果与错误路径。

---

## 三、场景题（1 题）

### 1. 团队抱怨"CI 要 40 分钟、测试经常红但重跑又绿、没人信任测试"。请诊断这套测试体系的可能问题（金字塔倒置？flaky？共享状态？覆盖外部服务？），并给出一份分阶段改造计划（结构、隔离、mock、门禁、并行）。

---

## 四、简答题（3 题）

### 1. 什么是测试金字塔？为什么"大量单元 + 适量集成 + 少量 E2E"更健康？

### 2. 依赖注入（工厂 + composition root）如何让 Service 单测不必连数据库？

### 3. 覆盖率能证明没有 bug 吗？"测行为不测实现"是什么意思，为什么重要？

---

## 五、挑战题（1 题）

### 🏆 为一个 Express 模块搭建"可进 CI 的完整测试体系"

针对 L6 的 user feature-slice 模块，产出：
- `app.js` / `server.js` 分离
- Service 单测（mock Repository，覆盖全部业务分支与错误路径）
- 路由集成测试（supertest + mongodb-memory-server，断言 HTTP 契约与 DB 副作用）
- 外部依赖用 nock/msw mock（支付/邮件/汇率任一）
- 认证测试辅助（测试 token 工厂 + 一个走真实 login 的 e2e 变体）
- vitest 配置：coverage thresholds（lines 80 / branches 75）+ 隔离策略
- GitHub Actions：`npm ci` → lint → test（覆盖率不达标即失败）
- README：如何跑测试、如何新增一个用例、如何排查 flaky
