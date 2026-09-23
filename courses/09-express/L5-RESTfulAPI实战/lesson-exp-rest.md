# REST 设计原则与 CRUD 实战

> 目标：**掌握 RESTful API 的设计规范**——资源命名、HTTP 方法语义、状态码选择、幂等性、版本化；用 Express 实现一套规范的 CRUD 资源路由。

---

## 一、REST 核心思想

REST（Representational State Transfer）= 以**资源**为中心，用**统一接口**（HTTP 方法 + 状态码）操作资源。URL 表示"名词"（资源），HTTP method 表示"动词"（操作）。

```
GET    /articles          列表
GET    /articles/:id      详情
POST   /articles          新建
PUT    /articles/:id      全量更新
PATCH  /articles/:id      局部更新
DELETE /articles/:id      删除
```

反模式：`/getArticles`、`/createUser`、`/deleteArticleById`——把动词塞进 URL 是 RPC 风格，不是 REST。

---

## 二、资源命名规范

| 规则 | ✅ 好 | ❌ 差 |
| --- | --- | --- |
| 用复数名词 | `/users` | `/user` |
| 层级表关系 | `/users/42/orders` | `/getOrdersByUser` |
| 用小写 + 连字符 | `/user-profiles` | `/userProfiles` / `/UserProfile` |
| 避免动词 | `/orders/1/cancel`（动作可接受） | `/cancelOrder?id=1` |
| 查询用 query | `/articles?status=published&sort=-date` | `/articles/statusPublished` |

深层嵌套 ≤ 2 层。`/users/1/posts/5/comments/9` 太深 → 可扁平化为 `/comments/9` 再在 body 里带关系。

---

## 三、HTTP 方法语义与幂等性

| 方法 | 语义 | 幂等 | 安全 | 有 body |
| --- | --- | --- | --- | --- |
| GET | 读取 | ✅ | ✅ | 无 |
| POST | 创建/处理 | ❌ | ❌ | 有 |
| PUT | 全量替换 | ✅ | ❌ | 有 |
| PATCH | 局部更新 | ❌* | ❌ | 有 |
| DELETE | 删除 | ✅ | ❌ | 通常无 |

- **幂等** = 同一请求执行一次和执行 N 次，服务器状态相同。PUT `/users/1 {name:'A'}` 多次 = 最终 name 都是 A（幂等）。POST `/users` 多次 = 创建多条（不幂等）。
- PATCH 严格说非幂等（`{views: +1}` 每次不同），但描述性 patch（`{name:'B'}`）幂等。
- **安全** = 不修改服务器状态（只有 GET/HEAD/OPTIONS 是安全的）→ 爬虫/预取不会误改数据。

### 为什么幂等重要

- 网络重试安全：PUT/DELETE 超时后可放心重发，POST 不行（会重复创建）→ 需幂等键（Idempotency-Key header）。
- 客户端可预测。

---

## 四、状态码选择（易错高频）

| 场景 | 码 | 说明 |
| --- | --- | --- |
| GET 成功 | 200 | |
| POST 创建成功 | **201** | 配 `Location: /users/42` 头 |
| PUT/PATCH 更新成功 | 200 或 204 | 返回体用 200，无体用 204 |
| DELETE 成功 | 200 或 204 | |
| 请求参数错误 | **400** | 校验失败 |
| 未登录 | **401** | 缺/错凭证 |
| 已登录但无权限 | **403** | 权限不足（别混 401） |
| 资源不存在 | **404** | |
| 冲突（如重复注册） | **409** | 用户名已存在 |
| 实体/校验语义错误 | **422** | 格式对但语义错 |
| 请求过于频繁 | **429** | 限流 |
| 服务器内部错误 | **500** | |
| 上游依赖挂了 | **502/503/504** | 网关/不可用/超时 |

> 常见误区：一律返回 200 + `{code: 401}` 的业务码风格 vs 纯 HTTP 语义风格。企业里两种都有，关键是**团队内统一 + 文档清晰**。

---

## 五、CRUD 实战

```js
// routes/articles.js
import { Router } from 'express';
const router = Router();

// 列表（支持过滤/排序/分页，见 exp-pagination）
router.get('/', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = status ? { status } : {};
    const [items, total] = await Promise.all([
      Article.find(filter).skip((page - 1) * limit).limit(+limit).sort({ createdAt: -1 }),
      Article.countDocuments(filter),
    ]);
    res.json({ data: items, meta: { page: +page, total, hasMore: page * limit < total } });
  } catch (e) { next(e); }
});

// 详情
router.get('/:id', async (req, res, next) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json({ data: article });
  } catch (e) { next(e); }
});

// 创建
router.post('/', async (req, res, next) => {
  try {
    const article = await Article.create(req.body);
    res.status(201).location(`/articles/${article._id}`).json({ data: article });
  } catch (e) { next(e); }
});

// 全量替换 / 局部更新
router.put('/:id', upsertOrUpdate('full'));
router.patch('/:id', upsertOrUpdate('partial'));

// 删除
router.delete('/:id', async (req, res, next) => {
  try {
    const del = await Article.findByIdAndDelete(req.params.id);
    if (!del) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
// app.use('/api/v1/articles', articlesRouter)
```

Express 5 的 async handler 错误自动 `next(err)`（呼应 L2）→ 不再需要到处 try/catch，可移除上面的 try 直接依赖自动捕获。

---

## 六、集合的资源子操作

非 CRUD 的"动作"如何 REST 化？

```
POST /orders/123/cancel        # 动词作为子资源动作（可接受）
POST /articles/5/publish
PUT  /users/1/avatar           # 把 avatar 当子资源
```

纯状态变更用 PATCH 更语义化：`PATCH /orders/123 {status:'cancelled'}`。没有统一答案——团队规范优先。

---

## 七、统一响应结构

```json
// 成功
{ "data": {...}, "meta": { "page": 1, "total": 42 } }
// 错误
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [ {...} ] } }
```

约定：
- 成功一定有 `data`（单个对象或数组）；
- 失败一定 `error` 对象，含机器可读 `code`（前端据此分支）+ 人读 `message`；
- 列表分页信息放 `meta`，不混进 `data`；
- 字段命名统一（camelCase 或 snake_case，全程一致）。

---

## 八、版本化

三种主流方式：

```
URL 路径：/api/v1/users          # 最常用、直观、可缓存
请求头：  Accept: application/vnd.api+json; version=1
查询参数：/api/users?version=1
```

原则：破坏性变更（删字段、改类型、改语义）才升大版本；加字段/加可选参数是向后兼容，不必升版。Vite/前端对接时 URL 版本最省心。

---

## 九、HATEOAS 与自描述（选读）

超媒体 API：响应里带下一步可执行的链接（`_links: { self, next }`）。理论纯粹但实践中多被 OpenAPI/Swagger 文档取代。至少做到：**状态码语义正确 + 错误信息可操作 + 资源链接清晰**。

---

## 十、自检清单

- [ ] 为什么 PUT 幂等而 POST 不幂等？
- [ ] 401 和 403 的区别？
- [ ] POST 创建成功该返回什么状态码 + 什么头？
- [ ] 深层嵌套 URL 有什么问题？
- [ ] 什么时候需要 API 版本升级？
- [ ] 统一响应结构的好处？

---

## 🚀 部署预告

- **网关层版本路由**：API Gateway 按 `/v1` `/v2` 路由到不同后端服务；
- **文档即代码**：用 OpenAPI/Swagger 注解生成 `/docs`（Scalar/Swagger UI），CI 校验；
- **契约测试**：前后端共享 OpenAPI schema → breaking change 在 CI 拦截（呼应下一关校验）；
- **CORS**：跨域 API 需配置 `Access-Control-*`（呼应 L2 cors 中间件）。

下一关 **exp-validation** 讲解参数校验（zod / express-validator / joi）。
