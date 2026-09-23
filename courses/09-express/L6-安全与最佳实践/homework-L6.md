# L6 作业：安全加固 / 工程模式

> 覆盖：exp-security / exp-patterns

---

## 一、读代码（10 题）

### 1. 这段 CORS 配置有什么安全隐患？

```js
app.use(cors({ origin: '*', credentials: true }));
```

### 2. 下面 SQL 有什么问题？改成安全写法。

```js
const sql = `SELECT * FROM users WHERE name = '${req.query.name}'`;
db.query(sql);
```

### 3. 阅读代码，这个用户提交的评论存库前少了什么处理？会带来什么后果？

```js
app.post('/comments', (req, res) => {
  Comment.create({ body: req.body.html, userId: req.user.id });
});
// 展示时 EJS: <%- comment.body %>
```

### 4. 这个限流配置在 PM2 4 实例部署下为什么形同虚设？

```js
app.use(rateLimit({ windowMs: 60000, max: 10 }));   // 未配 store
```

### 5. 阅读执行命令代码，攻击者传 `?file=a.jpg; rm -rf /` 会发生什么？如何修？

```js
app.get('/convert', (req, res) => {
  exec(`convert ${req.query.file} out.png`);
});
```

### 6. 这个 Controller 违反了哪条分层原则？重构建议？

```js
// order.controller.js
app.post('/orders', async (req, res) => {
  const stock = await Stock.findOne({ sku: req.body.sku });
  if (stock.qty < req.body.qty) return res.status(400).json({ error: '库存不足' });
  await stock.updateOne({ qty: stock.qty - req.body.qty });
  const order = await Order.create(req.body);
  res.json(order);
});
```

### 7. 阅读配置代码，为什么把 JWT_SECRET 写进 config/index.js 默认值里是危险的？

```js
const config = { jwt: { secret: process.env.JWT_SECRET || 'dev-secret-123' } };
```

### 8. 下面 error handler 有什么信息泄露问题？

```js
app.use((err, req, res, next) => {
  res.status(500).json({ error: { message: err.message, stack: err.stack } });
});
```

### 9. pino 配置里 redact 缺失会导致什么？看下面日志泄露了什么？

```js
logger.info({ req: { headers, body } }, 'incoming');   // body 含 password
```

### 10. 为什么 `GET /api/user/:id/orders` 直接返回数据前，要做属主校验？缺了会怎样？

---

## 二、手写（5 题）

### 1. 实现一个安全中间件装配函数 `applySecurity(app)`：helmet（含自定义 CSP）、白名单 CORS、express.json 限 10kb、关闭 x-powered-by、全局限流。

### 2. 设计并实现领域错误体系：`AppError` 基类 + 至少 5 个语义子类 + 全局 `errorHandler`（生产隐藏 5xx、记结构化日志带 requestId）。

### 3. 写一个集中式 config 模块：分环境 .env、用 zod 校验必填项（缺失即启动失败）、类型转换、导出单例。

### 4. 用工厂 + composition root 实现 `makeUserService(repo, mailer)`，并写一个用假 repo 的单元测试（不连真 DB）。

### 5. 为一个 user 模块搭 feature-slice 三层：controller / service / repository / schema / routes，Controller 薄、Service 无 req/res、Repository 管 DB。

---

## 三、场景题（1 题）

### 1. 你的 Express API 在一次安全审计中被测出：① 越权查看他人订单（IDOR）；② 富文本评论导致存储型 XSS；③ 一个内部错误响应泄露了 SQL 与依赖版本；④ npm 依赖存在已知高危漏洞。请针对每一项给出根因分析和具体修复（含代码/配置/流程）。

---

## 四、简答题（3 题）

### 1. 什么是纵深防御？以"防 XSS"为例说明至少 3 层。

### 2. Controller-Service-Repository 分层对一个多人协作的大项目有哪些具体收益？

### 3. 生产环境 secrets（数据库密码、JWT 私钥）应该怎么管理？为什么不放 .env 提交进 git？

---

## 五、挑战题（1 题）

### 🏆 构建"生产级 Express 工程脚手架"

产出一个可作为团队起点的 Express 5 项目骨架：
- feature-slice 目录 + 三层范例模块（user）
- 统一 config（zod 校验 + 分环境 + gitignore + 示例 .env.example）
- 领域错误体系 + 全局 error handler + notFound
- 结构化日志（pino + requestId + redact 脱敏）
- 安全装配（helmet+CSP、白名单 CORS、限流 Redis store、参数化/校验、防 IDOR 属主中间件）
- DI 工厂 + composition root
- 优雅关闭（SIGTERM）
- CI：`npm audit` + lint + 测试 + 覆盖率门禁
- README：架构说明 + 新增一个业务模块的 step-by-step 指南
