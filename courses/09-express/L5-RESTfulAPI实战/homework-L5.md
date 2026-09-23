# L5 作业：REST 设计 / 校验 / 鉴权 / 分页

> 覆盖：exp-rest / exp-validation / exp-auth / exp-pagination

---

## 一、读代码（10 题）

### 1. 这段路由有哪两处不符合 REST 规范？如何改？

```js
app.post('/getUser', (req, res) => { /* ... */ });
app.post('/deleteUser?id=5', (req, res) => { /* ... */ });
```

### 2. 以下创建用户的响应，状态码和头应该是什么？

```js
app.post('/users', async (req, res) => {
  const u = await User.create(req.body);
  res.json({ data: u });
});
```

### 3. 阅读代码，客户端 PATCH body 里多传了 `role:'admin'`，会发生什么？

```js
const Schema = z.object({ name: z.string(), email: z.string().email() });
router.patch('/users/:id', validate(Schema), async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, req.body);   // req.body 已被 zod 处理
  res.json({ ok: true });
});
```

### 4. 以下登录代码有什么安全问题？（至少 2 个）

```js
const user = await User.findOne({ email });
if (user.password === req.body.password) {
  const token = jwt.sign({ sub: user._id, role: user.role }, 'secret123');
  res.json({ token });
} else res.status(401).json({ error: '密码错误，该账号密码为 ' + user.password });
```

### 5. 为什么 `SKIP 1000000 LIMIT 20` 会很慢？改成什么方案？

### 6. 阅读游标分页代码，`limit + 1` 的作用是什么？

```js
const rows = await Model.where(keyset).orderBy('id').limit(pageSize + 1);
const hasMore = rows.length > pageSize;
const data = hasMore ? rows.slice(0, pageSize) : rows;
```

### 7. 这段排序参数处理有什么风险？如何修？

```js
app.get('/posts', (req, res) => {
  Post.find().sort(req.query.sort);   // ?sort=-secretWeight
});
```

### 8. 以下 JWT 验证中间件漏了什么关键防护？

```js
const payload = jwt.verify(token, process.env.JWT_SECRET);
```

### 9. 阅读代码，为什么注册时应避免 `User.create(req.body)`？

### 10. 这个 401/403 用对了吗？分别应该怎么返回？

```js
// 未登录访问 /me         → res.status(403)...
// 普通用户访问 /admin     → res.status(401)...
```

---

## 二、手写（5 题）

### 1. 用 zod 写一个注册接口：name、email、password（≥8 含大小写数字）、confirm（与 password 一致），失败返回统一 `VALIDATION_ERROR` + details（含 field）。

### 2. 实现完整鉴权中间件链：`auth`（解析 Bearer JWT，验签指定 algorithms，挂 req.user）+ `requireRole(...roles)` + 一个"仅本人或管理员可改"的属主校验。

### 3. 用 offset 分页实现 `GET /articles?page=&limit=&sort=&status=`，limit 上限 100、sort 白名单、status 枚举、返回 `{data, meta:{page,total,totalPages,hasMore}}`。

### 4. 实现基于 `(createdAt,_id)` 的游标分页：不透明 base64 cursor 编解码 + limit+1 探测 hasMore + 返回 nextCursor。

### 5. 写一个 `POST /refresh`：从 httpOnly cookie 取 refresh token，验证后用轮换（rotation）签发新 access + 新 refresh，旧 refresh 失效。

---

## 三、场景题（1 题）

### 1. 你的 API 被安全扫描报告三问题：① 普通用户改 URL 里的 id 就能看别人订单；② 登录接口可被暴力破解；③ 深度分页接口在 `?page=50000` 时 CPU 飙高。分别给出根因和修复方案。

---

## 四、简答题（3 题）

### 1. 幂等性是什么？PUT/POST/PATCH 各自的幂等表现？

### 2. Access Token + Refresh Token 双令牌机制解决了什么问题？

### 3. offset 分页和 cursor 分页分别适合什么业务？给出选型理由。

---

## 五、挑战题（1 题）

### 🏆 构建"规范的 REST 资源服务"

以"博客系统"实现一套生产级 CRUD API：
- REST 规范：复数资源命名、正确状态码（201+Location / 204 / 401 / 403 / 404 / 409 / 422）、统一 `{data|error,meta}` 结构
- 校验：zod 覆盖 body/query/params，防 mass assignment，错误带 field
- 鉴权：bcrypt 密码哈希 + 双 Token（httpOnly cookie refresh + 轮换）+ RBAC + 属主校验（防 IDOR）+ 登录限流
- 列表：offset（后台）+ cursor（feed）两套分页 + sort 白名单 + 过滤防 NoSQL 注入
- OpenAPI：从 zod 生成 `/docs`
- 集成测试覆盖注册→登录→发帖→改他人帖(403)→深分页性能
