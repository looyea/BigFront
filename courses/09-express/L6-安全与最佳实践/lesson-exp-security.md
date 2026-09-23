# Express 安全加固完全指南

> 目标：**对照 OWASP Top 10 系统掌握 Express 的防御手段**——helmet 安全头、CORS 精确配置、XSS/CSRF/SQLi 注入防护、依赖漏洞扫描、限流防暴力、敏感信息处理、安全 Cookie。构建"纵深防御"。

---

## 一、安全思维：纵深防御

没有单一银弹。安全 = 多层叠加：网络（防火墙/WAF）→ 传输（HTTPS）→ 框架（helmet/CORS）→ 输入（校验/转义）→ 认证授权 → 数据（加密）→ 依赖（扫描）。任何一层失守，下一层兜底。**默认不信任一切外部输入**。

---

## 二、Helmet：安全响应头

```bash
npm i helmet
```

```js
import helmet from 'helmet';
app.use(helmet());   // 一次开启一组安全头中间件
```

它默认设置的头：

| 头 | 作用 |
| --- | --- |
| Content-Security-Policy | 限制资源加载来源，缓解 XSS/注入 |
| X-Content-Type-Options: nosniff | 禁止浏览器 MIME 嗅探 |
| X-Frame-Options: SAMEORIGIN | 防点击劫持（禁 iframe 嵌套） |
| Referrer-Policy | 控制 Referer 泄露 |
| HSTS | 强制 HTTPS |
| X-DNS-Prefetch-Control、Cross-Origin-* | 其他加固 |

### CSP 精配

```js
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", 'https://trusted.cdn.com'],
    styleSrc: ["'self'", "'unsafe-inline'"],   // 尽量避 unsafe-inline
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'", 'https://api.example.com'],
    objectSrc: ["'none'"],
    frameAncestors: ["'self'"],
  },
}));
```

CSP 是 XSS 的最后防线——即使有注入，脚本也因来源不在白名单而无法执行。生产可用 nonce/hash 替代 unsafe-inline。

---

## 三、跨域 CORS（呼应 L2）

**不要用 `origin: '*'` 图省事**，尤其带凭证时。

```js
import cors from 'cors';
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://app.example.com', 'https://admin.example.com']   // 白名单
    : true,
  credentials: true,               // 允许携带 cookie（origin 不能是 *）
  methods: ['GET','POST','PUT','PATCH','DELETE'],
  allowedHeaders: ['Content-Type','Authorization'],
  maxAge: 86400,                   // 缓存预检结果，减少 OPTIONS
}));
```

原理：浏览器同源策略拦截跨域读；CORS 是服务端"授权哪些源能读"。`credentials: true` 时 `origin` 必须精确回显（不能 `*`）。防 CSRF 不能完全依赖 CORS（简单请求不发预检）。

---

## 四、XSS 防护

XSS = 注入恶意脚本到别人页面。三类：存储型（存 DB）、反射型（URL 参数回显）、DOM 型（前端）。后端职责：

```js
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
const purify = DOMPurify(new JSDOM('').window);

// 存富文本前先清洗（白名单标签）
const clean = purify.sanitize(req.body.htmlContent, { ALLOWED_TAGS: ['b','i','a','p','ul','li'] });
```

- **输出编码/转义**：模板默认转义（EJS `<%= %>`）、JSON 响应浏览器不解析为 HTML；
- **富文本白名单清洗**（DOMPurify/sanitize-html），别自己写正则过滤（易绕过）；
- **CSP 兜底**；
- **Cookie httpOnly** 降低 XSS 偷 token 危害（呼应 L5）。

---

## 五、CSRF 防护

跨站请求伪造：诱导已登录用户的浏览器向你的站发非预期请求（靠自动携带的 cookie）。

防御：
1. **SameSite Cookie**（`lax`/`strict`）——现代默认，挡大部分；
2. **CSRF Token**（同步器令牌 / 双提交 cookie）：

```bash
npm i csrf-csrf    # 或 csurf（已归档，用 fork）
```

3. **校验 Origin/Referer** 头是否本站；
4. **自定义 Header**（如 `X-Requested-With`）——跨域需预检，攻击表单无法伪造；
5. **不用 GET 做状态改变**、要求敏感操作带二次确认。

> **用 JWT 放 Authorization header 的 API 天然免疫 CSRF**（浏览器不会自动带 header）。CSRF 主要是 cookie/session 认证的问题。

---

## 六、注入防护（SQLi / NoSQLi / 命令注入）

### SQL 注入
- **永远用参数化查询 / ORM**，绝不字符串拼接 SQL：

```js
db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);   // ✅ pg 参数化
const q = `SELECT * FROM users WHERE name = '${name}'`;            // ❌ 注入
```

### NoSQL 注入
- 不把用户输入当对象信任（zod / express-mongo-sanitize 过滤 `$`、`.` 键）。

### 命令注入
- 避免 `exec(\`convert ${userFile}\`)`；用 `execFile('convert', [argv])`（不经 shell）或参数数组、白名单。

```js
import { execFile } from 'child_process';
execFile('convert', [inputPath, outputPath], cb);   // ✅ 数组参数不过 shell
// exec(`convert ${input}`)   ❌ input="a; rm -rf /" 直接执行
```

---

## 七、限流与防暴力

```bash
npm i express-rate-limit
```

```js
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

const general = rateLimit({
  windowMs: 15 * 60 * 1000, max: 100,               // 每 IP 15min 100 次
  standardHeaders: 'draft-7', legacyHeaders: false,
});
const loginGuard = rateLimit({ windowMs: 15*60*1000, max: 5, message: { error:{ code:'TOO_MANY' } } });

app.use('/api', general);
app.use('/api/login', loginGuard);                   // 登录单独更严
```

集群必须用 **Redis Store**（默认内存 store 各实例独立 + 重启清零）。配合账号锁定、验证码、异常检测。

---

## 八、依赖安全

```bash
npm audit                          # 扫已知漏洞
npm audit fix
npx better-npm-audit audit
```

- CI 集成 `npm audit` / Snyk / Dependabot / Renovate 自动升级告警；
- **锁版本**（package-lock.json）+ `npm ci`（可复现构建）；
- 精简依赖（越少攻击面越小），警惕 typosquatting（仿冒包名）与供应链投毒（呼应 L7 polyfill.io）；
- `ignore-scripts` 防安装期恶意 postinstall。

---

## 九、其他必做加固

- **隐藏指纹**：`app.disable('x-powered-by')`（helmet 已含）→ 不暴露 Express；
- **HTTPS 强制**：`app.use(helmet.hsts())` + 重定向 http→https（或网关层）；
- **请求体大小限制**：`express.json({ limit: '10kb' })` 防大包 DoS；
- **错误不泄露**：生产 error handler 不回堆栈（呼应 L2）；
- **日志不含敏感**：脱敏 password/token/身份证（pino redact）；
- **安全 Cookie 三件套**：`httpOnly + secure + sameSite`；
- **防开放重定向**：redirect 目标白名单校验（别 `res.redirect(req.query.url)`）；
- **密码策略 + 多因素**；
- **头注入**：设置响应头前过滤 CRLF（框架多已处理）。

```js
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
```

---

## 十、安全头速查 + 自检

- [ ] 装了 helmet 吗？CSP 配置合理吗？
- [ ] CORS origin 是白名单而非 `*`（带凭证时）吗？
- [ ] 所有 SQL 都参数化了吗？
- [ ] 用户输入进查询/命令/HTML 前都校验/清洗了吗？
- [ ] 登录/敏感接口限流了吗？
- [ ] 依赖定期 audit 吗？锁版本了吗？
- [ ] Cookie 是 httpOnly+secure+sameSite 吗？
- [ ] 生产隐藏了错误堆栈和 x-powered-by 吗？
- [ ] 强制 HTTPS + HSTS 了吗？

---

## 🚀 部署预告

- **WAF / 反爬**：云 WAF 挡常见攻击（SQLi/XSS 特征），比应用层更早拦截；
- **TLS 终结**：Nginx/LB 处配 HTTPS，`trust proxy` 让 Express 识别（呼应 L3）；
- **Secrets 管理**：密钥/DB 密码走 Vault/环境变量，绝不入 git（呼应 L5）；
- **扫描进 CI**：`npm audit`、Snyk、TruffleHog（扫泄露密钥）纳入流水线阻断；
- **最小权限**：DB 账号按库/表授权，容器非 root 运行。

下一关 **exp-patterns** 讲工程模式：分层架构 / 配置管理 / 错误码 / 日志规范。
