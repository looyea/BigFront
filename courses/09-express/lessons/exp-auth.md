# 鉴权：JWT / Session / OAuth2

> 目标：**打通注册 → 登录 → 令牌签发 → 验证 → 刷新 → 登出的完整链路**；掌握 bcrypt 密码哈希、JWT 结构与陷阱、httpOnly Cookie、Refresh Token 轮换、RBAC 权限中间件、OAuth2/OIDC 授权码流程。

---

## 一、认证 vs 授权

- **认证（Authentication）**：你是谁？（验证身份）
- **授权（Authorization）**：你能干什么？（权限校验）

顺序：先认证（登录拿到凭证）→ 后授权（每个请求检查权限）。

---

## 二、Session 认证（服务端有状态）

```
登录成功 → 服务端生成 session 存 Redis（sessionId → userId）→ Set-Cookie 下发 sessionId
后续请求 → 浏览器自动带 cookie → 服务端查 Redis 拿 userId → 知道是谁
```

```js
import session from 'express-session';
import connectRedis from 'connect-redis';
const RedisStore = connectRedis(session);

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,        // 签名 cookie
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 1000*60*60*24 },
}));

app.post('/login', async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user && await bcrypt.compare(req.body.password, user.passwordHash)) {
    req.session.userId = user._id;           // 存进 session
    res.json({ ok: true });
  } else res.status(401).json({ error: { code: 'BAD_CREDENTIALS' } });
});

function requireAuth(req, res, next) {
  if (req.session?.userId) return next();
  res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
}
```

优点：可即时吊销（删 session）、cookie 自动携带。缺点：服务端要存 session（集群需 Redis 共享）、每次查存储。

---

## 三、JWT 认证（无状态）

### 3.1 JWT 结构

`header.payload.signature` 三段 Base64Url：

```
eyJhbGciOiJIUzI1NiJ9.eyJ1aWQiOiIxMjMiLCJpYXQiOjEsImV4cCI6Mn0.签名
```

- header：算法（HS256/RS256）；
- payload：claims（sub/iat/exp + 自定义 userId/role）——**仅 Base64 编码，不是加密**，任何人可解码看到内容！
- signature：用密钥对前两段签名 → 防篡改（改了 payload 签名就对不上）。

### 3.2 签发与验证

```bash
npm i jsonwebtoken bcrypt
```

```js
import jwt from 'jsonwebtoken';

// 登录签发
app.post('/login', async (req, res) => {
  const user = await userService.verify(req.body);
  if (!user) return res.status(401).json({ error: { code: 'BAD_CREDENTIALS' } });
  const token = jwt.sign(
    { sub: user._id, role: user.role },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '15m' }          // Access Token 短命
  );
  const refreshToken = jwt.sign({ sub: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  res.json({ accessToken: token });   // 或放 httpOnly cookie（见 3.4）
});

// 验证中间件
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch (e) {
    const code = e.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    res.status(401).json({ error: { code } });
  }
}
```

> **必须显式传 `algorithms: ['HS256']`**——否则历史上有 `alg:none` 绕过和 HS/RS 混淆漏洞。

### 3.3 密码哈希：bcrypt / argon2

```js
// 注册：绝不存明文
const passwordHash = await bcrypt.hash(req.body.password, 12);  // cost=12
await User.create({ email, passwordHash });

// 登录：用 compare（内部处理 salt）
const ok = await bcrypt.compare(input, user.passwordHash);
```

- **绝不能自创加密**（MD5/SHA1 可被彩虹表/GPU 秒破）；
- bcrypt/argon2 自带随机 salt + 可调慢哈希（抗暴力）；
- argon2 是新一代推荐（抗 GPU/ASIC）；
- 登录防枚举：用户名不存在也要跑一次假 compare（timing 一致）+ 统一"账号或密码错误"。

### 3.4 Token 存哪里？（重大安全决策）

| 存放 | XSS | CSRF | 说明 |
| --- | --- | --- | --- |
| localStorage + Header | ❌ 易被 XSS 偷 | ✅ 免疫 | SPA 常见但 XSS 风险高 |
| **httpOnly Cookie** | ✅ JS 读不到 | ❌ 需防 CSRF | 更安全（推荐） |
| 内存 + 定时刷新 | ✅ | ✅ | 最安全但刷新丢 |

**最佳实践**：JWT 放 **httpOnly + Secure + SameSite Cookie** → XSS 偷不到；再配 CSRF 防护（SameSite=lax/strict 或 Origin 校验）。Access Token 短命（15m）存内存，Refresh Token（7d）存 httpOnly cookie 且**轮换 + 复用检测**。

### 3.5 双 Token 刷新

```js
// POST /refresh：用 Refresh Token 换新 Access Token
app.post('/refresh', (req, res) => {
  const rt = req.cookies.refreshToken;
  try {
    const payload = jwt.verify(rt, process.env.JWT_REFRESH_SECRET);
    const newAccess = jwt.sign({ sub: payload.sub, role: }, JWT_SECRET, { expiresIn: '15m' });
    // Refresh Token 轮换：发新 refresh，旧的进黑名单
    const newRefresh = rotateRefreshToken(payload);
    res.cookie('refreshToken', newRefresh, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 7*24*3600*1000 });
    res.json({ accessToken: newAccess });
  } catch { res.status(401).json({ error: { code: 'INVALID_REFRESH' } }); }
});
```

### 3.6 登出与吊销

JWT 天生无法主动吊销（签名有效即认）。方案：
- **黑名单**（Redis 存已登出 jti，到期自动清）；
- Refresh Token 存 DB → 登出删除即可失效；
- 短 Access Token + 不主动吊销（接受 15m 窗口）。

---

## 四、授权：RBAC 权限中间件

```js
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    }
    next();
  };
}

router.delete('/:id', auth, requireRole('admin'), postController.remove);
router.get('/me', auth, (req, res) => res.json({ data: req.user }));

// 资源属主校验（比角色更细）
router.patch('/:id', auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: { code: 'NOT_FOUND' } });
  if (post.authorId.toString() !== req.user.sub && req.user.role !== 'admin') {
    return res.status(403).json({ error: { code: 'FORBIDDEN' } });   // 或 404 防枚举
  }
  // ...更新
});
```

防 IDOR（越权访问他人资源）：**每个涉及具体资源的操作都要校验归属**，不能只靠前端不显示按钮。

---

## 五、OAuth2 / OIDC

第三方登录（"用微信/GitHub/Google 登录"）与授权委托。

### 5.1 授权码流程（Authorization Code + PKCE）

```
1. 用户点"用 Google 登录" → 跳授权服务器 /authorize?client_id&redirect_uri&state&code_challenge
2. 用户在 Google 登录并同意授权
3. Google 302 回 redirect_uri?code=xxx&state=yyy
4. 后端拿 code + code_verifier 换 access_token（POST /token，服务端对服务端，含 client_secret）
5. 用 access_token 调 /userinfo 拿用户资料 → 本地建/关联账号 → 签发自己的 JWT/session
```

- **code 流程**（后端换 token，secret 不暴露前端）优于 implicit；
- **PKCE**（code_challenge/verifier）防授权码拦截，public client（SPA/移动）必用；
- **state** 防 CSRF；
- OIDC = OAuth2 + `id_token`（JWT，含身份信息）→ 认证用途。

```bash
npm i passport passport-google-oauth20
```

```js
// passport 策略骨架
passport.use(new GoogleStrategy({
  clientID, clientSecret, callbackURL,
}, async (accessToken, refreshToken, profile, done) => {
  const user = await upsertOAuthUser(profile);
  return done(null, user);
}));
```

---

## 六、安全清单

- [ ] 密码用 bcrypt/argon2 哈希，cost 合理（bcrypt ≥10）；
- [ ] JWT 显式指定 `algorithms`，密钥用强随机环境变量；
- [ ] payload 不放敏感信息（可被解码）；
- [ ] Access Token 短命 + Refresh Token 轮换 + 复用检测；
- [ ] Token 优先放 httpOnly Cookie + CSRF 防护；
- [ ] 每个资源操作校验归属（防 IDOR）；
- [ ] 登录限流（防暴力）+ 失败锁定 + 统一错误信息（防枚举）；
- [ ] 敏感操作二次验证（改密码/支付）；
- [ ] HTTPS 全程（防中间人抓 token/cookie）；
- [ ] 生产密钥不入库（用 secret manager / 环境变量）。

---

## 七、自检清单

- [ ] JWT 的 payload 是加密的吗？能被别人看到吗？
- [ ] 为什么 Access Token 要短命、Refresh Token 长命？
- [ ] httpOnly cookie 防的是 XSS 还是 CSRF？
- [ ] Session 认证相比 JWT 的最大优势（吊销）是什么？
- [ ] 为什么登录时用户名不存在也要执行一次密码比较？
- [ ] OAuth2 为什么用授权码流程而不是直接前端拿 token？

---

## 🚀 部署预告

- **密钥管理**：JWT_SECRET 用 Vault/AWS Secrets Manager 注入，定期轮换（kid 支持多密钥并行）；
- **RS256 与非对称**：多服务验证同一 token 时，用 RS256/ES256（公钥验签、私钥签发）避免共享对称密钥；
- **Redis 依赖**：session/黑名单/refresh 存 Redis → 高可用（哨兵/集群），呼应 L2 session；
- **网关鉴权**：微服务下 token 校验可上移到 API Gateway，服务只解析 `X-User-Id` 内部头。

下一关 **exp-pagination** 讲解分页、排序与过滤。
