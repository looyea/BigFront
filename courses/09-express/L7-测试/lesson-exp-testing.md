# 单元与集成测试

> 目标：**掌握 Express 测试的完整方法论**——测试金字塔分层；用 supertest 测端点；vitest/jest 单测 Service；mock 外部依赖（DB/HTTP）；mongodb-memory-server 集成测试；CI 跑覆盖率门禁。

---

## 一、测试金字塔

```
        /  E2E  \          少、慢、脆——真实浏览器/部署后冒烟
       /----------\
      / 集成测试    \       中——多组件协作（API + DB）
     /--------------\
    /    单元测试      \    多、快、稳——纯函数/业务逻辑
   /--------------------\
```

原则：**大量单元 + 适量集成 + 少量 E2E**。别把测试全压成端到端（慢且难维护）。后端重点：Service 单测（业务规则）+ 路由集成测（HTTP 契约）。

---

## 二、可测试的前提：app 与 server 分离

要测 HTTP，必须能"不 listen 就拿到 app"。所以把 **app 定义** 和 **启动监听** 拆两个文件（呼应 L6 分层）：

```js
// app.js —— 只组装，不 listen
import express from 'express';
import routes from './modules/index.js';
import { errorHandler } from './common/middleware/errorHandler.js';

const app = express();
app.use(express.json());
app.use('/api', routes);
app.use(errorHandler);
export default app;         // 导出给 supertest
```

```js
// server.js —— 只在真实启动时 listen
import app from './app.js';
import config from './config/index.js';
app.listen(config.port, () => console.log(`listening :${config.port}`));
```

测试 `import app from './app.js'` → supertest 直接在内存里发请求，无需真开端口。

---

## 三、单元测试（Service 层）

vitest（快、Vite 生态）或 jest。测纯业务，mock 掉 Repository：

```bash
npm i -D vitest
```

```js
// user.service.test.js
import { describe, it, expect, vi } from 'vitest';
import { makeUserService } from './user.service.js';

const fakeRepo = {
  findByEmail: vi.fn(),
  create: vi.fn(),
};
const fakeMailer = { sendWelcome: vi.fn() };
const service = makeUserService(fakeRepo, fakeMailer);

describe('register', () => {
  it('邮箱已存在时抛 ConflictError', async () => {
    fakeRepo.findByEmail.mockResolvedValue({ id: '1', email: 'a@b.com' });
    await expect(service.register({ email: 'a@b.com', password: 'x' }))
      .rejects.toMatchObject({ code: 'CONFLICT' });
    expect(fakeRepo.create).not.toHaveBeenCalled();
  });

  it('新邮箱成功创建并发送欢迎邮件', async () => {
    fakeRepo.findByEmail.mockResolvedValue(null);
    fakeRepo.create.mockResolvedValue({ id: '2', email: 'new@b.com' });
    const user = await service.register({ email: 'new@b.com', password: 'x' });
    expect(user.email).toBe('new@b.com');
    expect(fakeMailer.sendWelcome).toHaveBeenCalledWith(expect.objectContaining({ id: '2' }));
  });
});
```

有了 DI（L6）→ 依赖换成 fake → 不连 DB 也能测全部业务分支。**这就是分层/注入的回报。**

---

## 四、集成测试（supertest 测端点）

```bash
npm i -D supertest
```

```js
// user.routes.test.js
import request from 'supertest';
import app from '../../app.js';

describe('POST /api/users', () => {
  it('合法数据返回 201 + Location', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ email: 'a@b.com', password: 'Passw0rd!' })
      .expect(201);
    expect(res.headers.location).toMatch(/^\/users\//);
    expect(res.body.data.email).toBe('a@b.com');
    expect(res.body.data).not.toHaveProperty('password');   // 不回传密码！
  });

  it('非法邮箱返回 400 + VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ email: 'not-an-email' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

supertest 把 app 传给一个临时的 http server（ephemeral port），发真实请求断言响应——测的是完整中间件链（校验 + 路由 + 错误处理）契约。

---

## 五、真数据库集成（mongodb-memory-server）

集成测试要么用**内存 DB**（快、隔离）要么**测试库**（每次重置）。

```bash
npm i -D mongodb-memory-server
```

```js
// test/setup.js
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod;
export async function startDB() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}
export async function stopDB() {
  await mongoose.disconnect();
  await mongod.stop();
}
export async function clearDB() {
  for (const m of Object.values(mongoose.connection.collections)) await m.deleteMany({});
}
```

vitest `globalSetup` 启动、每个 `afterEach` 清库、`afterAll` 关闭 → 每个用例干净状态。

> 关系型用 testcontainers（起真 Postgres 容器）或事务回滚策略。原则：**测试间相互隔离，可任意顺序、可重复**。

---

## 六、Mock 外部 HTTP

测"调第三方 API"的业务，用 `nock`/`msw` 拦截出网请求（不打真实外部服务）：

```js
import nock from 'nock';

it('汇率服务返回时正确换算', async () => {
  nock('https://api.fx.com').get('/rates?cur=USD').reply(200, { rate: 7.2 });
  const price = await convertToUSD(100);   // 内部走 axios → 被 nock 截获
  expect(price).toBeCloseTo(720);
  nock.isDone();     // 断言确实调用了
});
```

---

## 七、认证接口的测试技巧

受保护路由需要登录态。常见：

```js
// 生成一个测试用 token（绕过登录，或走真实登录拿）
const token = jwt.sign({ sub: 'test-user-id', role: 'admin' }, config.jwt.secret);

await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${token}`).expect(200);
await request(app).get('/api/admin/stats').expect(401);          // 无 token
```

或 e2e 里真跑 `POST /login` 拿 token 再测后续（更接近真实）。

---

## 八、覆盖率与 CI 门禁

```bash
npm i -D @vitest/coverage-v8
```

```json
// vitest.config.js / package.json scripts
{ "scripts": { "test": "vitest run --coverage" } }
```

```js
// vitest.config.js
export default {
  test: {
    coverage: {
      provider: 'v8',
      thresholds: { lines: 80, branches: 75 },   // 低于阈值 CI 失败
      reportOnFailure: true,
    },
  },
};
```

CI（GitHub Actions）：

```yaml
- run: npm ci
- run: npm test          # 覆盖率不达标 → 非零退出 → 流水线红
```

> 覆盖率是"下限保护网"不是目标——100% 覆盖 ≠ 无 bug。重点覆盖业务分支、边界、错误路径。

---

## 九、测试组织与原则

- **AAA**：Arrange（准备）→ Act（执行）→ Assert（断言），结构清晰；
- **命名**：`it('当 X 时应 Y')` 说清行为即文档；
- **隔离**：无共享状态、无执行顺序依赖、无随机；
- **快**：单测毫秒级，整库秒级（内存 DB）；慢测标记单独跑；
- **测行为不测实现**：断言对外契约（状态码/响应体/DB 副作用），别断言内部私有调用细节（重构即碎）；
- **错误路径也要测**：400/401/404/500 分支是 bug 高发区。

---

## 十、自检清单

- [ ] 为什么要把 app 和 server.listen 分成两个文件？
- [ ] 单测 Service 为什么要 mock Repository？依赖什么设计？
- [ ] supertest 测的是什么层次？
- [ ] 集成测试如何保证用例间数据库状态隔离？
- [ ] 覆盖率能证明没有 bug 吗？
- [ ] 为什么"测行为不测实现"？

---

## 🚀 部署预告

- **测试进 CI/CD**：PR 必过 lint + test + coverage 门禁才能合并（呼应 L6 CI）；
- **容器化测试**：CI 里 `docker compose` 起 Postgres/Redis 做真依赖集成（testcontainers）；
- **契约测试**：OpenAPI schema 驱动消费者/提供者契约校验，防前后端联调 break；
- **冒烟测试**：部署到预发后跑一组真实 HTTP 冒烟（smoke）确认服务可用再放量。

下一关进入 **L8 生产部署**（exp-deploy）——PM2/Docker/Nginx/优雅关闭全链路。
